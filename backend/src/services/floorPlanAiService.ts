import { parseLayoutTable, type LayoutTableInput } from './floorPlanService';

export interface AiTableDraft extends LayoutTableInput {
    confidence: number;
}

export interface AnalyzeResult {
    tables: AiTableDraft[];
    warnings: string[];
}

const TABLE_TYPES = ['RECTANGULAR', 'SQUARE', 'ROUND', 'OCTAGONAL', 'CAPSULE', 'BAR'] as const;

const SYSTEM_PROMPT = `You are a floor-plan digitizer for a restaurant booking app.
Analyze the dining-room image and detect every numbered table / seat group.

Canvas: the app renders on a 1000x800 canvas (x: 0-1000, y: 0-800).
Return ONLY a JSON array, no markdown, no commentary. Each item:
{"name": "table number as printed, e.g. '12'", "type": "one of RECTANGULAR|SQUARE|ROUND|OCTAGONAL|CAPSULE|BAR", "x": number, "y": number, "width": number, "height": number, "rotation": number (usually 0), "capacity": integer 1-12, "confidence": 0-1, "adjacentNames": []}

Rules:
- OCTAGONAL = square with cut corners. CAPSULE = long booth/banquette (width > height). ROUND = circle. SQUARE = small square. BAR = stool/counter dot.
- capacity: infer from size/shape (small round/square=2, rect=2-4, large rect 100x120=6, octagon=6, capsule=4). Default 2 when unsure.
- x,y = top-left corner on 1000x800. width/height 20-300. Keep relative positions faithful to the image.
- adjacentNames: tables visually touching/very close (combinable). Empty array if unsure.
- One entry per printed number. Skip legends, doors, bar counters without numbers.
- Max 80 tables. If nothing detected, return [].`;

function clamp(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function toDraft(raw: any): AiTableDraft | null {
    try {
        const type = TABLE_TYPES.includes(raw?.type) ? raw.type : 'RECTANGULAR';
        const parsed = parseLayoutTable({
            name: String(raw?.name ?? ''),
            capacity: Number(raw?.capacity ?? 2),
            type,
            x: clamp(Number(raw?.x ?? 0), 0, 2000),
            y: clamp(Number(raw?.y ?? 0), 0, 2000),
            width: clamp(Number(raw?.width ?? 60), 10, 2000),
            height: clamp(Number(raw?.height ?? 60), 10, 2000),
            rotation: clamp(Number(raw?.rotation ?? 0), -360, 360),
            adjacentNames: Array.isArray(raw?.adjacentNames) ? raw.adjacentNames : [],
        });
        const confidence = clamp(Number(raw?.confidence ?? 0.5), 0, 1);
        return { ...parsed, confidence };
    } catch {
        return null;
    }
}

function extractJsonArray(text: string): any[] {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) throw new Error('AI did not return a table list');
    return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Fallback when GEMINI_API_KEY is missing (local dev / tests):
 * returns an empty draft with a warning instead of failing the upload.
 * The manual editor remains fully usable.
 */
export async function analyzeFloorPlanImage(
    buffer: Buffer,
    mimetype: string,
): Promise<AnalyzeResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { tables: [], warnings: ['GEMINI_API_KEY is not configured — AI detection skipped, use the manual editor.'] };
    }
    if (buffer.length === 0) throw new Error('Empty image');

    // Lazy import so the backend boots without the optional dep installed.
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash' });

    const base64 = buffer.toString('base64');
    const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { inlineData: { data: base64, mimeType: mimetype } },
    ]);
    const text = result.response.text();
    const raw = extractJsonArray(text);

    const tables: AiTableDraft[] = [];
    const seen = new Set<string>();
    let dropped = 0;
    for (const item of raw.slice(0, 80)) {
        const draft = toDraft(item);
        if (!draft || seen.has(draft.name)) {
            dropped += 1;
            continue;
        }
        seen.add(draft.name);
        tables.push(draft);
    }

    const warnings: string[] = [];
    if (tables.length === 0) warnings.push('No tables detected — check the image or use the manual editor.');
    if (dropped > 0) warnings.push(`${dropped} AI row(s) dropped (invalid or duplicate).`);
    const lowConf = tables.filter((t) => t.confidence < 0.6).length;
    if (lowConf > 0) warnings.push(`${lowConf} table(s) have low confidence — please review positions.`);

    // Keep only adjacency refs that resolve to detected names.
    const names = new Set(tables.map((t) => t.name));
    for (const t of tables) t.adjacentNames = t.adjacentNames.filter((n) => names.has(n) && n !== t.name);

    return { tables, warnings };
}

import { describe, it, expect } from 'vitest';
import { analyzeFloorPlanImage } from './floorPlanAiService';

describe('analyzeFloorPlanImage', () => {
    it('skips AI detection with a warning when GEMINI_API_KEY is missing', async () => {
        const saved = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        try {
            const result = await analyzeFloorPlanImage(Buffer.from([0x89, 0x50]), 'image/png');
            expect(result.tables).toEqual([]);
            expect(result.warnings.length).toBeGreaterThan(0);
        } finally {
            if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
        }
    });

    it('rejects empty images when a key is configured', async () => {
        const saved = process.env.GEMINI_API_KEY;
        process.env.GEMINI_API_KEY = 'test-key';
        try {
            await expect(analyzeFloorPlanImage(Buffer.alloc(0), 'image/png')).rejects.toThrow();
        } finally {
            if (saved === undefined) delete process.env.GEMINI_API_KEY;
            else process.env.GEMINI_API_KEY = saved;
        }
    });
});

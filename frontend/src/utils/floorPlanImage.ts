export const MAX_FLOOR_PLAN_MB = 5;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** Returns 'type' | 'size' when invalid, null when the file is acceptable. */
export function validateFloorPlanFile(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) return 'type';
    if (file.size > MAX_FLOOR_PLAN_MB * 1024 * 1024) return 'size';
    return null;
}

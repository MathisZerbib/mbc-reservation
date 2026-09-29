import { describe, it, expect } from 'vitest';
import { parseSlug, RESERVED_SLUGS } from './tenantService';

describe('parseSlug', () => {
    it('accepts clean slugs', () => {
        expect(parseSlug('le-petit-cafe')).toBe('le-petit-cafe');
        expect(parseSlug('  MBC  ')).toBe('mbc');
        expect(parseSlug('UPPER')).toBe('upper');
        expect(parseSlug('a1')).toBe('a1');
    });

    it('rejects malformed slugs', () => {
        expect(() => parseSlug('x')).toThrow();
        expect(() => parseSlug('has space')).toThrow();
        expect(() => parseSlug('-leading')).toThrow();
        expect(() => parseSlug('trailing-')).toThrow();
        expect(() => parseSlug('')).toThrow();
    });

    it('rejects every reserved app path', () => {
        expect(RESERVED_SLUGS.size).toBeGreaterThan(0);
        for (const reserved of RESERVED_SLUGS) {
            expect(() => parseSlug(reserved)).toThrow();
        }
    });
});

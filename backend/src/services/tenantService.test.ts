import { describe, it, expect, afterEach } from 'vitest';
import { parseSlug, RESERVED_SLUGS, sandboxSlugs, trialDaysFor, LIFETIME_FREE_SLOTS, LIFETIME_TRIAL_DAYS, TRIAL_DAYS } from './tenantService';

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

describe('sandboxSlugs', () => {
    const original = process.env.SANDBOX_TENANT_SLUGS;
    afterEach(() => {
        if (original === undefined) delete process.env.SANDBOX_TENANT_SLUGS;
        else process.env.SANDBOX_TENANT_SLUGS = original;
    });

    it('excludes the seed and demo tenants by default', () => {
        delete process.env.SANDBOX_TENANT_SLUGS;
        const slugs = sandboxSlugs();
        expect(slugs.has('mbc')).toBe(true);
        expect(slugs.has('demo-restaurant')).toBe(true);
    });

    it('normalises an override and ignores blanks', () => {
        process.env.SANDBOX_TENANT_SLUGS = ' Staging , ,LIVE ';
        expect([...sandboxSlugs()]).toEqual(['staging', 'live']);
    });
});

describe('trialDaysFor', () => {
    it('grants lifetime access while slots remain', () => {
        expect(trialDaysFor(0)).toBe(LIFETIME_TRIAL_DAYS);
        expect(trialDaysFor(LIFETIME_FREE_SLOTS - 1)).toBe(LIFETIME_TRIAL_DAYS);
    });

    it('falls back to the standard trial once the slots are taken', () => {
        expect(trialDaysFor(LIFETIME_FREE_SLOTS)).toBe(TRIAL_DAYS);
        expect(trialDaysFor(50)).toBe(TRIAL_DAYS);
    });
});

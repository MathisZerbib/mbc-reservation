import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from './translations';

const paths = (o: unknown, prefix: string[] = []): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        typeof v === 'string' ? [[...prefix, k].join('.')] : paths(v, [...prefix, k]),
    );

describe('i18n parity', () => {
    it('en and fr expose exactly the same keys', () => {
        const en = new Set(paths(TRANSLATIONS.en));
        const fr = new Set(paths(TRANSLATIONS.fr));
        expect([...en].filter(k => !fr.has(k))).toEqual([]);
        expect([...fr].filter(k => !en.has(k))).toEqual([]);
        expect(en.size).toBeGreaterThan(0);
    });
});

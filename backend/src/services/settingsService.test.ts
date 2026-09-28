import { describe, it, expect } from 'vitest';
import { parseAvgTicket, MIN_AVG_TICKET, MAX_AVG_TICKET } from './settingsService';

describe('parseAvgTicket', () => {
    it('accepts numbers and numeric strings within bounds', () => {
        expect(parseAvgTicket(55)).toBe(55);
        expect(parseAvgTicket('42.5')).toBe(42.5);
        expect(parseAvgTicket(MIN_AVG_TICKET)).toBe(MIN_AVG_TICKET);
        expect(parseAvgTicket(MAX_AVG_TICKET)).toBe(MAX_AVG_TICKET);
    });

    it('rounds to cents', () => {
        expect(parseAvgTicket(42.555)).toBe(42.56);
    });

    it('rejects non-numbers and out-of-range values', () => {
        expect(() => parseAvgTicket(NaN)).toThrow();
        expect(() => parseAvgTicket('abc')).toThrow();
        expect(() => parseAvgTicket(undefined)).toThrow();
        expect(() => parseAvgTicket(0)).toThrow();
        expect(() => parseAvgTicket(-5)).toThrow();
        expect(() => parseAvgTicket(MAX_AVG_TICKET + 1)).toThrow();
    });
});

import { describe, it, expect } from 'vitest';
import {
    parseAvgTicket,
    parseLateGraceMinutes,
    parseBooleanSetting,
    parseDepositMinSize,
    parseTurnoverMinutes,
    MIN_AVG_TICKET,
    MAX_AVG_TICKET,
    MIN_LATE_GRACE_MINUTES,
    MAX_LATE_GRACE_MINUTES,
    MIN_DEPOSIT_SIZE,
    MAX_DEPOSIT_SIZE,
    MIN_TURNOVER_MINUTES,
    MAX_TURNOVER_MINUTES,
} from './settingsService';

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

describe('parseLateGraceMinutes', () => {
    it('accepts numbers and numeric strings within bounds', () => {
        expect(parseLateGraceMinutes(15)).toBe(15);
        expect(parseLateGraceMinutes('30')).toBe(30);
        expect(parseLateGraceMinutes(MIN_LATE_GRACE_MINUTES)).toBe(MIN_LATE_GRACE_MINUTES);
        expect(parseLateGraceMinutes(MAX_LATE_GRACE_MINUTES)).toBe(MAX_LATE_GRACE_MINUTES);
    });

    it('rounds to whole minutes', () => {
        expect(parseLateGraceMinutes(15.6)).toBe(16);
    });

    it('rejects non-numbers and out-of-range values', () => {
        expect(() => parseLateGraceMinutes(NaN)).toThrow();
        expect(() => parseLateGraceMinutes('soon')).toThrow();
        expect(() => parseLateGraceMinutes(undefined)).toThrow();
        expect(() => parseLateGraceMinutes(-1)).toThrow();
        expect(() => parseLateGraceMinutes(MAX_LATE_GRACE_MINUTES + 1)).toThrow();
    });
});

describe('parseBooleanSetting', () => {
    it('accepts booleans', () => {
        expect(parseBooleanSetting(true, 'autoCancelLate')).toBe(true);
        expect(parseBooleanSetting(false, 'depositEnabled')).toBe(false);
    });

    it('rejects non-booleans', () => {
        expect(() => parseBooleanSetting('yes' as any, 'autoCancelLate')).toThrow();
        expect(() => parseBooleanSetting(1 as any, 'autoCancelLate')).toThrow();
        expect(() => parseBooleanSetting(undefined, 'autoCancelLate')).toThrow();
    });
});

describe('parseDepositMinSize', () => {
    it('accepts integers within bounds', () => {
        expect(parseDepositMinSize(6)).toBe(6);
        expect(parseDepositMinSize('8')).toBe(8);
        expect(parseDepositMinSize(MIN_DEPOSIT_SIZE)).toBe(MIN_DEPOSIT_SIZE);
        expect(parseDepositMinSize(MAX_DEPOSIT_SIZE)).toBe(MAX_DEPOSIT_SIZE);
    });

    it('rejects non-integers and out-of-range values', () => {
        expect(() => parseDepositMinSize(4.5)).toThrow();
        expect(() => parseDepositMinSize('big')).toThrow();
        expect(() => parseDepositMinSize(undefined)).toThrow();
        expect(() => parseDepositMinSize(MIN_DEPOSIT_SIZE - 1)).toThrow();
        expect(() => parseDepositMinSize(MAX_DEPOSIT_SIZE + 1)).toThrow();
    });
});

describe('parseTurnoverMinutes', () => {
    it('accepts integers within bounds', () => {
        expect(parseTurnoverMinutes(105)).toBe(105);
        expect(parseTurnoverMinutes('90')).toBe(90);
        expect(parseTurnoverMinutes(MIN_TURNOVER_MINUTES)).toBe(MIN_TURNOVER_MINUTES);
        expect(parseTurnoverMinutes(MAX_TURNOVER_MINUTES)).toBe(MAX_TURNOVER_MINUTES);
    });

    it('rejects non-integers and out-of-range values', () => {
        expect(() => parseTurnoverMinutes(45.5)).toThrow();
        expect(() => parseTurnoverMinutes('long')).toThrow();
        expect(() => parseTurnoverMinutes(undefined)).toThrow();
        expect(() => parseTurnoverMinutes(MIN_TURNOVER_MINUTES - 1)).toThrow();
        expect(() => parseTurnoverMinutes(MAX_TURNOVER_MINUTES + 1)).toThrow();
    });
});

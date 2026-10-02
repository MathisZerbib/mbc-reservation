import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDemoSession } from './auth';

const sign = (payload: object) =>
    `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

describe('isDemoSession', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('is true for a demo JWT (drives the demo-only seed refill gate)', () => {
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(sign({ userId: '1', isDemo: true }));
        expect(isDemoSession()).toBe(true);
    });

    it('is false for regular staff/owner sessions', () => {
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(sign({ userId: '1' }));
        expect(isDemoSession()).toBe(false);
    });

    it('is false without a token', () => {
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
        expect(isDemoSession()).toBe(false);
    });
});

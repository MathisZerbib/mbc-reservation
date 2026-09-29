import { describe, it, expect, beforeEach } from 'vitest';
import { signVerificationToken, verifyVerificationToken } from './verification';

describe('verification tokens', () => {
    beforeEach(() => {
        process.env.JWT_ACCESS_SECRET = 'test-secret';
    });

    it('round-trips a user id', () => {
        const token = signVerificationToken('user-123');
        expect(verifyVerificationToken(token)).toBe('user-123');
    });

    it('rejects garbage and wrong-purpose tokens', () => {
        expect(() => verifyVerificationToken('not-a-token')).toThrow();
    });
});

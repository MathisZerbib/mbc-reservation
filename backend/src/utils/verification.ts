import jwt from 'jsonwebtoken';

const PURPOSE = 'verify-email';
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Single-use (by design: flips emailVerified) signed verification tokens.
 * Pure helpers — unit-tested without a database.
 */
export function signVerificationToken(userId: string): string {
    return jwt.sign({ userId, purpose: PURPOSE }, process.env.JWT_ACCESS_SECRET as string, {
        expiresIn: TTL_SECONDS,
    });
}

export function verifyVerificationToken(token: string): string {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as {
        userId?: string;
        purpose?: string;
    };
    if (!payload?.userId || payload.purpose !== PURPOSE) {
        throw new Error('Invalid verification token');
    }
    return payload.userId;
}

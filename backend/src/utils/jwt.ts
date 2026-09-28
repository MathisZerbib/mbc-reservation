import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function generateAccessToken(user: { id: string }, extraClaims: Record<string, unknown> = {}) {
  return jwt.sign({ userId: user.id, ...extraClaims }, process.env.JWT_ACCESS_SECRET as string, {
    expiresIn: '12h',
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateTokens(user: { id: string }, extraClaims: Record<string, unknown> = {}) {
  const accessToken = generateAccessToken(user, extraClaims);
  const refreshToken = generateRefreshToken();
  return { accessToken, refreshToken };
}
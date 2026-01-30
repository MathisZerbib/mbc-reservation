import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function generateAccessToken(user: { id: string }) {
  return jwt.sign({ userId: user.id }, process.env.JWT_ACCESS_SECRET as string, {
    expiresIn: '5m',
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateTokens(user: { id: string }) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  return { accessToken, refreshToken };
}
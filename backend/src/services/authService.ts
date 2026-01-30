import { PrismaClient } from '@prisma/client';
import { hashToken } from '../utils/hashToken';
import { prisma } from '../lib/prisma';


export function addRefreshTokenToWhitelist({ refreshToken, userId }: { refreshToken: string; userId: string }) {
  return prisma.refreshToken.create({
    data: {
      hashedToken: hashToken(refreshToken),
      userId,
      expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    },
  });
}

export function findRefreshToken(token: string) {
  return prisma.refreshToken.findUnique({
    where: { hashedToken: hashToken(token) },
  });
}

export function deleteRefreshTokenById(id: string) {
  return prisma.refreshToken.update({
    where: { id },
    data: { revoked: true },
  });
}

export function revokeTokens(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}

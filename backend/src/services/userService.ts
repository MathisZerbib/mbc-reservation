import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUserByEmailAndPassword(user: {
  email: string;
  password: string;
  tenantId: string;
  role?: 'OWNER' | 'STAFF';
}) {
  const hashed = await bcrypt.hash(user.password, 12);
  return prisma.user.create({
    data: { email: user.email, password: hashed, tenantId: user.tenantId, role: user.role ?? 'OWNER' },
  });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function markEmailVerified(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
}
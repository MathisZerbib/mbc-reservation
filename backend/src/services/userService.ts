import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUserByEmailAndPassword(user: { email: string; password: string }) {
  const hashed = await bcrypt.hash(user.password, 12);
  return prisma.user.create({
    data: { email: user.email, password: hashed },
  });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prismaClientSingleton = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? {
      rejectUnauthorized: true,
      // Ensure this path matches your Render Secret File path
      ca: fs.readFileSync('/etc/secrets/ca.pem').toString(),
    } : false
  });
  
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ 
    adapter,
    log: ['query', 'info', 'warn', 'error'] 
  });
};
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
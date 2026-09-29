import "dotenv/config";
import { defineConfig } from "prisma/config"; 

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!,
    // Local shadow DB for `prisma migrate diff` (never used at runtime).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
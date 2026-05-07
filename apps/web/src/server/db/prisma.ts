import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
  return url;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: requireDatabaseUrl() })),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;


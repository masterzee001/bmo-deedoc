import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

function findRepoRoot(start: string): string {
  let current = path.resolve(start);

  while (true) {
    const schemaPath = path.join(current, "packages", "database", "prisma", "schema.prisma");
    if (fs.existsSync(schemaPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

const repoRoot = findRepoRoot(__dirname);
const appRoot = path.join(repoRoot, "apps", "api");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(appRoot, ".env"), override: true });

type ApiEnv = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: number;
};

function requireValue(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: ApiEnv = {
  DATABASE_URL: requireValue("DATABASE_URL", "file:./dev.db"),
  JWT_SECRET: requireValue("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  PORT: Number(process.env.PORT || 4000),
};

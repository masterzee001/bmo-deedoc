import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

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

const databaseUrl = process.env.DATABASE_URL;
const repoRoot = findRepoRoot(__dirname);

if (databaseUrl?.startsWith("file:")) {
  const relativePath = databaseUrl.slice("file:".length);
  if (!path.isAbsolute(relativePath)) {
    process.env.DATABASE_URL = `file:${path.resolve(repoRoot, "packages", "database", "prisma", relativePath)}`;
  }
}

export const prisma = new PrismaClient();

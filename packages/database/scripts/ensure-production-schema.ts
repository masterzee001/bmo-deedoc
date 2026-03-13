import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(workspaceRoot, "prisma", "migrations");
const schemaPath = path.join("prisma", "schema.prisma");
const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";

type CommandResult = {
  status: number;
  output: string;
};

function runPrisma(args: string[]): CommandResult {
  const result = spawnSync(prismaCommand, ["prisma", ...args], {
    cwd: workspaceRoot,
    env: process.env,
    encoding: "utf8",
  });

  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return {
    status: result.status ?? 1,
    output,
  };
}

function printOutput(output: string) {
  const trimmed = output.trim();
  if (trimmed) {
    console.log(trimmed);
  }
}

function getMigrationNames(): string[] {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function baselineExistingSchema() {
  const diffResult = runPrisma([
    "migrate",
    "diff",
    "--from-url",
    process.env.DATABASE_URL || "",
    "--to-schema-datamodel",
    schemaPath,
    "--exit-code",
  ]);

  printOutput(diffResult.output);

  if (diffResult.status !== 0) {
    throw new Error("Automatic baseline aborted because the live database schema differs from prisma/schema.prisma.");
  }

  for (const migrationName of getMigrationNames()) {
    const resolveResult = runPrisma([
      "migrate",
      "resolve",
      "--applied",
      migrationName,
      "--schema",
      schemaPath,
    ]);

    printOutput(resolveResult.output);

    if (resolveResult.status !== 0 && !resolveResult.output.includes("already recorded as applied")) {
      throw new Error(`Failed to mark migration ${migrationName} as applied.`);
    }
  }
}

function main() {
  const deployResult = runPrisma(["migrate", "deploy", "--schema", schemaPath]);

  if (deployResult.status === 0) {
    printOutput(deployResult.output);
    return;
  }

  printOutput(deployResult.output);

  if (!deployResult.output.includes("P3005")) {
    process.exitCode = deployResult.status;
    return;
  }

  console.log("Detected a non-empty database without Prisma migration history. Verifying schema before baselining.");
  baselineExistingSchema();

  const retryResult = runPrisma(["migrate", "deploy", "--schema", schemaPath]);
  printOutput(retryResult.output);

  if (retryResult.status !== 0) {
    process.exitCode = retryResult.status;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

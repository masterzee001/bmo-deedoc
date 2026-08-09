import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { buildOgunReferenceLevelReport } from "./ogun-reference-level-report";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const prisma = new PrismaClient();

async function main() {
  const report = await buildOgunReferenceLevelReport(prisma);

  console.log("Ogun reference levels");
  for (const level of report) {
    const metricKey = level.key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    console.log(`reference_level_${metricKey}=${level.status}`);
    console.log(
      `reference_level_${metricKey}_counts=${JSON.stringify({
        expected: level.expected,
        loaded: level.loaded,
        sourceRows: level.sourceRows,
        verified: level.verified,
        blockers: level.blockers,
      })}`,
    );
  }

  console.log("REFERENCE LEVELS:");
  for (const level of report) {
    console.log(`${level.label}: ${level.status}`);
  }
}

main()
  .catch((error) => {
    console.error("Ogun reference level report failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

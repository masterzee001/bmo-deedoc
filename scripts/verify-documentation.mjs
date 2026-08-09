import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "README.md",
  "docs/MASTER_FEATURES.md",
  "docs/TECHNICAL.md",
  "docs/OGUN_IMPLEMENTATION_AUDIT.md",
  "docs/IMPLEMENTATION_ROADMAP.md",
  "docs/DATABASE_MIGRATION_BASELINE.md",
  "docs/RBAC_AND_TERRITORY.md",
  "docs/SECURITY_BASELINE.md",
  "docs/INFRASTRUCTURE_BOUNDARIES.md",
  "docs/OGUN_REFERENCE_DATA_READINESS.md",
  "docs/PHASE_0_COMPLETION.md",
  "docs/PHASE_1_COMPLETION.md",
  "docs/PHASE_1_ARCHITECTURE_REVIEW.md",
];
const failures = [];

for (const relativePath of requiredFiles) {
  if (!existsSync(path.join(repoRoot, relativePath))) {
    failures.push(`Missing required document: ${relativePath}`);
  }
}

if (failures.length === 0) {
  const master = readFileSync(path.join(repoRoot, "docs", "MASTER_FEATURES.md"), "utf8");
  const featureIds = [...master.matchAll(/^## (\d{3})\./gm)].map((match) => Number(match[1]));
  const uniqueFeatureIds = new Set(featureIds);
  const missingFeatureIds = Array.from({ length: 140 }, (_, index) => index + 1).filter(
    (featureId) => !uniqueFeatureIds.has(featureId),
  );

  if (featureIds.length !== 140 || uniqueFeatureIds.size !== 140 || missingFeatureIds.length > 0) {
    failures.push(`MASTER_FEATURES must contain each feature 001-140 exactly once; missing=${missingFeatureIds.join(",")}.`);
  }

  for (const relativePath of requiredFiles) {
    const content = readFileSync(path.join(repoRoot, relativePath), "utf8");
    const lineWithTrailingWhitespace = content.split(/\r?\n/).findIndex((line) => /[ \t]+$/.test(line));
    if (lineWithTrailingWhitespace >= 0) {
      failures.push(`Trailing whitespace found in ${relativePath}:${lineWithTrailingWhitespace + 1}.`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("master_features=140");
  console.log(`required_documents=${requiredFiles.length}`);
  console.log("documentation_integrity=ok");
}

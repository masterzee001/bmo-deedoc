import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Repository invariant: only the execution authority may mark money as paid.
 *
 * The kill switch, the atomic claim, the authoritative revaluation and the
 * execution record all live in apps/api/src/lib/payout-execution.ts. Each of
 * those was previously hand-copied into a route handler, which worked only for
 * as long as every future author remembered to copy them again. This turns the
 * architectural rule into something the build enforces: a PAID mutation written
 * anywhere else fails here, with the reason, rather than being caught in review
 * or not at all.
 *
 * Detection is deliberately structural rather than clever. It looks for a
 * Prisma write against a money-out model in the same statement as a PAID
 * status, which is the shape the defect actually takes.
 */

const repoRoot = process.cwd();

/** The only module permitted to transition a money-out record to PAID. */
const EXECUTION_AUTHORITY = join("apps", "api", "src", "lib", "payout-execution.ts");

/** Models whose PAID status means money left the platform. */
const MONEY_OUT_MODELS = ["payoutAssignment", "rewardRedemption", "payoutTransaction", "payoutExecution"];

const SCAN_ROOTS = [
  join("apps", "api", "src"),
  join("apps", "worker", "src"),
  join("apps", "web"),
  join("packages"),
  join("scripts"),
];

const SKIP_DIRECTORIES = new Set(["node_modules", "dist", ".next", "generated", ".turbo"]);

/**
 * Files exempt from the rule, each with the reason. Tests are NOT exempt
 * wholesale: a test that writes PAID directly would prove the route works while
 * bypassing the very chokepoint under test.
 */
const ALLOWED = new Map([
  [EXECUTION_AUTHORITY, "the execution authority itself"],
]);

function* walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        yield* walk(full);
      }
      continue;
    }
    if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      yield full;
    }
  }
}

/**
 * Prisma writes against a money-out model, with the statement text that follows
 * so the PAID check can look inside the same call rather than across the file.
 */
function findMoneyOutWrites(source) {
  const findings = [];
  const write = new RegExp(
    `\\b(?:${MONEY_OUT_MODELS.join("|")})\\s*\\.\\s*(create|createMany|update|updateMany|upsert)\\b`,
    "g",
  );
  let match;
  while ((match = write.exec(source)) !== null) {
    // The statement body: from the call to the end of its argument object,
    // bounded so an unbalanced brace cannot swallow the rest of the file.
    const statement = source.slice(match.index, match.index + 1200);
    const paid = /status\s*:\s*(?:"PAID"|'PAID'|`PAID`|[A-Za-z_$][\w$]*\.PAID)/.test(statement);
    if (paid) {
      findings.push({
        line: source.slice(0, match.index).split("\n").length,
        model: match[0].split(".")[0].trim(),
        operation: match[1],
      });
    }
  }
  return findings;
}

const violations = [];
let filesScanned = 0;

for (const root of SCAN_ROOTS) {
  const absolute = join(repoRoot, root);
  try {
    statSync(absolute);
  } catch {
    continue;
  }
  for (const file of walk(absolute)) {
    const relativePath = relative(repoRoot, file);
    filesScanned += 1;
    if (ALLOWED.has(relativePath.split(sep).join(sep))) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    for (const finding of findMoneyOutWrites(source)) {
      violations.push(
        `${relativePath}:${finding.line} writes ${finding.model}.${finding.operation} with status PAID ` +
          "outside the execution authority",
      );
    }
  }
}

// A guard that cannot fail is not a guard. If the authority stops containing the
// pattern this scanner looks for, the scanner has stopped matching reality and
// would pass every file vacuously.
const authoritySource = readFileSync(join(repoRoot, EXECUTION_AUTHORITY), "utf8");
if (findMoneyOutWrites(authoritySource).length === 0) {
  console.error(
    `FAIL ${EXECUTION_AUTHORITY} contains no PAID money-out write. Either the execution authority moved, ` +
      "or this check no longer detects the pattern it exists to detect. Refusing to report a vacuous pass.",
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error("FAIL money-out PAID transitions must go through the execution authority:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error(`  permitted: ${[...ALLOWED.keys()].join(", ")}`);
  process.exit(1);
}

console.log(`money_out_files_scanned=${filesScanned}`);
console.log(`money_out_chokepoint=${EXECUTION_AUTHORITY.split(sep).join("/")}`);
console.log("money_out_chokepoint_integrity=ok");

import path from "node:path";
import dotenv from "dotenv";
import {
  NIGERIA_EXPECTED_LGA_TOTAL,
  NIGERIA_EXPECTED_STATE_TOTAL,
  NIGERIA_STATE_EXPECTED_LGA_COUNTS,
} from "@pics-nigeria/shared";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl?.startsWith("file:")) {
  const relativePath = databaseUrl.slice("file:".length);
  if (!path.isAbsolute(relativePath)) {
    process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../prisma", relativePath)}`;
  }
}

const prisma = new PrismaClient();

async function main() {
  const states = await prisma.state.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let loadedLgas = 0;
  let loadedWards = 0;
  let loadedPollingUnits = 0;
  let statesWithMissingLgas = 0;
  let lgasWithoutWards = 0;
  let wardsWithoutPollingUnits = 0;
  let hasFailures = false;

  console.log("Reference completeness check");
  console.log(`expected_states=${NIGERIA_EXPECTED_STATE_TOTAL}`);
  console.log(`loaded_states=${states.length}`);
  console.log(`expected_lgas=${NIGERIA_EXPECTED_LGA_TOTAL}`);

  if (states.length < NIGERIA_EXPECTED_STATE_TOTAL) {
    hasFailures = true;
  }

  for (const state of states) {
    const [lgas, wards, pollingUnits] = await Promise.all([
      prisma.lGA.findMany({
        where: { stateId: state.id },
        select: { id: true },
      }),
      prisma.ward.findMany({
        where: { stateId: state.id },
        select: { id: true, lgaId: true },
      }),
      prisma.pollingUnit.findMany({
        where: { stateId: state.id },
        select: { id: true, wardId: true },
      }),
    ]);

    const expectedLgas = NIGERIA_STATE_EXPECTED_LGA_COUNTS[state.id] ?? 0;
    const stateLgasWithoutWards = lgas.filter((lga) => !wards.some((ward) => ward.lgaId === lga.id)).length;
    const stateWardsWithoutPollingUnits = wards.filter(
      (ward) => !pollingUnits.some((pollingUnit) => pollingUnit.wardId === ward.id),
    ).length;
    const missingLgas = Math.max(expectedLgas - lgas.length, 0);
    const isComplete = missingLgas === 0 && stateLgasWithoutWards === 0 && stateWardsWithoutPollingUnits === 0;

    loadedLgas += lgas.length;
    loadedWards += wards.length;
    loadedPollingUnits += pollingUnits.length;
    statesWithMissingLgas += missingLgas > 0 ? 1 : 0;
    lgasWithoutWards += stateLgasWithoutWards;
    wardsWithoutPollingUnits += stateWardsWithoutPollingUnits;

    if (!isComplete) {
      hasFailures = true;
    }

    console.log(
      [
        `state=${state.name}`,
        `expected_lgas=${expectedLgas}`,
        `loaded_lgas=${lgas.length}`,
        `missing_lgas=${missingLgas}`,
        `loaded_wards=${wards.length}`,
        `lgas_without_wards=${stateLgasWithoutWards}`,
        `loaded_polling_units=${pollingUnits.length}`,
        `wards_without_polling_units=${stateWardsWithoutPollingUnits}`,
        `status=${isComplete ? "ready" : "incomplete"}`,
      ].join(" "),
    );
  }

  console.log(`loaded_lgas=${loadedLgas}`);
  console.log(`loaded_wards=${loadedWards}`);
  console.log(`loaded_polling_units=${loadedPollingUnits}`);
  console.log(`states_with_missing_lgas=${statesWithMissingLgas}`);
  console.log(`lgas_without_wards=${lgasWithoutWards}`);
  console.log(`wards_without_polling_units=${wardsWithoutPollingUnits}`);

  if (hasFailures) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Reference completeness check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

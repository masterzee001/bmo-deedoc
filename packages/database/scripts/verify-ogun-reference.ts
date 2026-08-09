import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const prisma = new PrismaClient();
const allowIncomplete = process.argv.includes("--allow-incomplete");

const expected = {
  stateId: "ng-state-ogun",
  senatorialDistricts: 3,
  federalConstituencies: 9,
  stateConstituencies: 26,
  lgas: 20,
};

async function main() {
  const identityBlockers: string[] = [];
  const geodataBlockers: string[] = [];
  const failures: string[] = [];
  const ogunById = await prisma.state.findUnique({ where: { id: expected.stateId }, select: { id: true, name: true } });
  const ogunByName = await prisma.state.findUnique({ where: { name: "Ogun" }, select: { id: true, name: true } });
  const ogun = ogunById || ogunByName;

  if (!ogun) {
    throw new Error("Ogun State reference record is missing.");
  }

  if (ogun.id !== expected.stateId) {
    failures.push(`Ogun State uses non-canonical id '${ogun.id}' instead of '${expected.stateId}'.`);
  }

  const [districts, federalConstituencies, stateConstituencies, lgas, wards, pollingUnits] = await Promise.all([
    prisma.senatorialDistrict.findMany({ where: { stateId: ogun.id }, select: { id: true, stateId: true } }),
    prisma.federalConstituency.findMany({
      where: { stateId: ogun.id },
      select: { id: true, stateId: true, senatorialDistrict: { select: { stateId: true } } },
    }),
    prisma.stateConstituency.findMany({
      where: { stateId: ogun.id },
      select: {
        id: true,
        stateId: true,
        federalConstituencyId: true,
        lga: { select: { stateId: true } },
        federalConstituency: { select: { stateId: true } },
      },
    }),
    prisma.lGA.findMany({ where: { stateId: ogun.id }, select: { id: true, stateId: true } }),
    prisma.ward.findMany({
      where: { stateId: ogun.id },
      select: {
        id: true,
        stateId: true,
        lgaId: true,
        stateConstituencyId: true,
        lga: { select: { stateId: true } },
        stateConstituency: { select: { stateId: true } },
      },
    }),
    prisma.pollingUnit.findMany({
      where: { stateId: ogun.id },
      select: {
        id: true,
        stateId: true,
        lgaId: true,
        wardId: true,
        lga: { select: { stateId: true } },
        ward: { select: { stateId: true, lgaId: true, stateConstituencyId: true } },
      },
    }),
  ]);

  const checkedCounts = [
    ["senatorial districts", districts.length, expected.senatorialDistricts],
    ["federal constituencies", federalConstituencies.length, expected.federalConstituencies],
  ] as const;

  for (const [label, actual, expectedCount] of checkedCounts) {
    if (actual !== expectedCount) {
      failures.push(`Expected ${expectedCount} Ogun ${label}; found ${actual}.`);
    }
  }

  if (stateConstituencies.length !== expected.stateConstituencies) {
    identityBlockers.push(
      `Expected ${expected.stateConstituencies} Ogun State Constituencies; found ${stateConstituencies.length}. Authoritative LGA mappings are required before loading them.`,
    );
  }

  if (lgas.length !== expected.lgas) {
    identityBlockers.push(`Expected ${expected.lgas} Ogun LGAs; found ${lgas.length}. An authoritative checked-in LGA dataset is required.`);
  }

  if (federalConstituencies.some((item) => item.senatorialDistrict.stateId !== ogun.id)) {
    failures.push("One or more Ogun Federal Constituencies reference a Senatorial District outside Ogun.");
  }

  if (stateConstituencies.some((item) => item.lga.stateId !== ogun.id)) {
    failures.push("One or more Ogun State Constituencies reference an LGA outside Ogun.");
  }

  const stateConstituenciesWithoutFederal = stateConstituencies.filter(
    (item) => !item.federalConstituencyId || item.federalConstituency?.stateId !== ogun.id,
  ).length;
  if (stateConstituenciesWithoutFederal > 0) {
    identityBlockers.push(
      `Ogun State Constituency command mappings are incomplete: without_federal_parent=${stateConstituenciesWithoutFederal}.`,
    );
  }

  if (wards.some((item) => item.lga.stateId !== ogun.id)) {
    failures.push("One or more Ogun Wards reference an LGA outside Ogun.");
  }

  const wardsWithoutStateConstituency = wards.filter(
    (item) => !item.stateConstituencyId || item.stateConstituency?.stateId !== ogun.id,
  ).length;
  if (wardsWithoutStateConstituency > 0) {
    identityBlockers.push(
      `Ogun Ward command mappings are incomplete: without_state_constituency_parent=${wardsWithoutStateConstituency}.`,
    );
  }

  if (
    pollingUnits.some(
      (item) => item.lga.stateId !== ogun.id || item.ward.stateId !== ogun.id || item.ward.lgaId !== item.lgaId,
    )
  ) {
    failures.push("One or more Ogun Polling Units have inconsistent State, LGA, or Ward parentage.");
  }

  const lgaIdsWithWards = new Set(wards.map((ward) => ward.lgaId));
  const wardIdsWithPollingUnits = new Set(pollingUnits.map((pollingUnit) => pollingUnit.wardId));
  const lgasWithoutWards = lgas.filter((lga) => !lgaIdsWithWards.has(lga.id)).length;
  const wardsWithoutPollingUnits = wards.filter((ward) => !wardIdsWithPollingUnits.has(ward.id)).length;

  if (wards.length === 0 || lgasWithoutWards > 0) {
    identityBlockers.push(`Ogun Ward data is incomplete: wards=${wards.length}, lgas_without_wards=${lgasWithoutWards}.`);
  }

  if (pollingUnits.length === 0 || wardsWithoutPollingUnits > 0) {
    identityBlockers.push(
      `Ogun Polling Unit data is incomplete: polling_units=${pollingUnits.length}, wards_without_polling_units=${wardsWithoutPollingUnits}.`,
    );
  }

  identityBlockers.push("Polling Unit identity records do not yet store authoritative source codes and provenance.");
  geodataBlockers.push("Polling Unit coordinates, accuracy, capture date, and approved geofence policy are not yet available.");

  console.log("Ogun reference verification");
  console.log(`state_id=${ogun.id}`);
  console.log(`senatorial_districts=${districts.length}`);
  console.log(`federal_constituencies=${federalConstituencies.length}`);
  console.log(`state_constituencies=${stateConstituencies.length}`);
  console.log(`lgas=${lgas.length}`);
  console.log(`wards=${wards.length}`);
  console.log(`polling_units=${pollingUnits.length}`);
  console.log(`lgas_without_wards=${lgasWithoutWards}`);
  console.log(`wards_without_polling_units=${wardsWithoutPollingUnits}`);
  console.log(`state_constituencies_without_federal_parent=${stateConstituenciesWithoutFederal}`);
  console.log(`wards_without_state_constituency_parent=${wardsWithoutStateConstituency}`);

  for (const blocker of identityBlockers) {
    console.warn(`BLOCKER ${blocker}`);
  }
  for (const blocker of geodataBlockers) {
    console.warn(`GEODATA_BLOCKER ${blocker}`);
  }

  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }

  if (failures.length > 0 || (!allowIncomplete && identityBlockers.length > 0)) {
    process.exitCode = 1;
    return;
  }

  console.log(`ogun_reference_status=${identityBlockers.length > 0 ? "structurally_valid_but_incomplete" : "identity_complete"}`);
  console.log(`polling_unit_geodata_status=${geodataBlockers.length > 0 ? "not_ready" : "ready"}`);
}

main()
  .catch((error) => {
    console.error("Ogun reference verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ensureNationalReferenceStates, syncLgasForState, syncPollingUnitsForWard, syncWardsForLga } from "../../../apps/api/src/lib/inec-reference";
import { ensureNationalConstituencyReference } from "./inec-constituency-reference";

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
  await ensureNationalReferenceStates(prisma);
  await ensureNationalConstituencyReference(prisma);

  const states = await prisma.state.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let totalLgasSynced = 0;
  let totalWardsSynced = 0;
  let totalPollingUnitsSynced = 0;

  for (const state of states) {
    const beforeLgas = await prisma.lGA.count({ where: { stateId: state.id } });
    await syncLgasForState(prisma, state.id);
    const afterLgas = await prisma.lGA.count({ where: { stateId: state.id } });
    totalLgasSynced += Math.max(afterLgas - beforeLgas, 0);

    const lgas = await prisma.lGA.findMany({
      where: { stateId: state.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    console.log(`State ${state.name}: ${lgas.length} LGAs available.`);

    for (const lga of lgas) {
      const beforeWards = await prisma.ward.count({ where: { stateId: state.id, lgaId: lga.id } });
      await syncWardsForLga(prisma, state.id, lga.id);
      const afterWards = await prisma.ward.count({ where: { stateId: state.id, lgaId: lga.id } });
      totalWardsSynced += Math.max(afterWards - beforeWards, 0);

      const wards = await prisma.ward.findMany({
        where: { stateId: state.id, lgaId: lga.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

      for (const ward of wards) {
        const beforePollingUnits = await prisma.pollingUnit.count({
          where: { stateId: state.id, lgaId: lga.id, wardId: ward.id },
        });
        await syncPollingUnitsForWard(prisma, state.id, lga.id, ward.id);
        const afterPollingUnits = await prisma.pollingUnit.count({
          where: { stateId: state.id, lgaId: lga.id, wardId: ward.id },
        });
        totalPollingUnitsSynced += Math.max(afterPollingUnits - beforePollingUnits, 0);
      }
    }
  }

  const [stateCount, lgaCount, wardCount, pollingUnitCount] = await Promise.all([
    prisma.state.count(),
    prisma.lGA.count(),
    prisma.ward.count(),
    prisma.pollingUnit.count(),
  ]);

  console.log("National polling-unit bootstrap completed.");
  console.log(`states_loaded=${stateCount}`);
  console.log(`lgas_loaded=${lgaCount}`);
  console.log(`wards_loaded=${wardCount}`);
  console.log(`polling_units_loaded=${pollingUnitCount}`);
  console.log(`lgas_added_this_run=${totalLgasSynced}`);
  console.log(`wards_added_this_run=${totalWardsSynced}`);
  console.log(`polling_units_added_this_run=${totalPollingUnitsSynced}`);
}

main()
  .catch((error) => {
    console.error("National polling-unit bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

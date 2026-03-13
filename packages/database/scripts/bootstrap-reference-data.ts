import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { NIGERIA_GEO_POLITICAL_ZONES, NIGERIA_STATE_REFERENCE } from "@pics-nigeria/shared";

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

const sampleParty = {
  id: "seed-party-independent-alliance",
  code: "PIA",
  name: "Progressive Independent Alliance",
};

async function main() {
  const zoneIdByName = new Map<string, string>();

  for (const zone of NIGERIA_GEO_POLITICAL_ZONES) {
    const existingZone = await prisma.geoPoliticalZone.findUnique({
      where: { name: zone.name },
      select: { id: true },
    });

    if (existingZone) {
      zoneIdByName.set(zone.name, existingZone.id);
      continue;
    }

    await prisma.geoPoliticalZone.create({ data: zone });
    zoneIdByName.set(zone.name, zone.id);
  }

  for (const state of NIGERIA_STATE_REFERENCE) {
    const zoneName = NIGERIA_GEO_POLITICAL_ZONES.find((zone) => zone.id === state.geoPoliticalZoneId)?.name;
    const geoPoliticalZoneId = zoneName ? zoneIdByName.get(zoneName) || state.geoPoliticalZoneId : state.geoPoliticalZoneId;
    const existingState = await prisma.state.findUnique({
      where: { name: state.name },
      select: { id: true },
    });

    if (existingState) {
      await prisma.state.update({
        where: { id: existingState.id },
        data: {
          geoPoliticalZoneId,
        },
      });
      continue;
    }

    await prisma.state.create({
      data: {
        id: state.id,
        name: state.name,
        geoPoliticalZoneId,
      },
    });
  }

  await prisma.politicalParty.upsert({
    where: { id: sampleParty.id },
    update: sampleParty,
    create: sampleParty,
  });

  console.log("National geo-political zones and states are ready.");
}

main()
  .catch((error) => {
    console.error("Reference data bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

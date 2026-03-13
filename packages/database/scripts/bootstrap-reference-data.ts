import path from "node:path";
import dotenv from "dotenv";
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

const territorySeed = {
  geoPoliticalZone: { id: "seed-zone-south-west", name: "South West" },
  state: { id: "seed-state-lagos", name: "Lagos" },
  district: { id: "seed-senatorial-lagos-central", name: "Lagos Central", stateId: "seed-state-lagos" },
  federalConstituency: {
    id: "seed-fed-ikeja",
    name: "Ikeja Federal Constituency",
    stateId: "seed-state-lagos",
    senatorialDistrictId: "seed-senatorial-lagos-central",
  },
  lga: { id: "seed-lga-ikeja", name: "Ikeja", stateId: "seed-state-lagos" },
  stateConstituency: {
    id: "seed-state-const-ikeja-1",
    name: "Ikeja I",
    stateId: "seed-state-lagos",
    lgaId: "seed-lga-ikeja",
  },
  wards: [
    { id: "seed-ward-ikeja-ward-a", name: "Ward A", stateId: "seed-state-lagos", lgaId: "seed-lga-ikeja" },
    { id: "seed-ward-ikeja-ward-b", name: "Ward B", stateId: "seed-state-lagos", lgaId: "seed-lga-ikeja" },
  ],
  pollingUnit: {
    id: "seed-pu-ikeja-001",
    name: "Polling Unit 001",
    stateId: "seed-state-lagos",
    lgaId: "seed-lga-ikeja",
    wardId: "seed-ward-ikeja-ward-a",
  },
};

const sampleParty = {
  id: "seed-party-independent-alliance",
  code: "PIA",
  name: "Progressive Independent Alliance",
};

async function main() {
  await prisma.geoPoliticalZone.upsert({
    where: { id: territorySeed.geoPoliticalZone.id },
    update: territorySeed.geoPoliticalZone,
    create: territorySeed.geoPoliticalZone,
  });

  await prisma.state.upsert({
    where: { id: territorySeed.state.id },
    update: {
      ...territorySeed.state,
      geoPoliticalZoneId: territorySeed.geoPoliticalZone.id,
    },
    create: {
      ...territorySeed.state,
      geoPoliticalZoneId: territorySeed.geoPoliticalZone.id,
    },
  });

  await prisma.politicalParty.upsert({
    where: { id: sampleParty.id },
    update: sampleParty,
    create: sampleParty,
  });

  await prisma.senatorialDistrict.upsert({
    where: { id: territorySeed.district.id },
    update: territorySeed.district,
    create: territorySeed.district,
  });

  await prisma.federalConstituency.upsert({
    where: { id: territorySeed.federalConstituency.id },
    update: territorySeed.federalConstituency,
    create: territorySeed.federalConstituency,
  });

  await prisma.lGA.upsert({
    where: { id: territorySeed.lga.id },
    update: territorySeed.lga,
    create: territorySeed.lga,
  });

  await prisma.stateConstituency.upsert({
    where: { id: territorySeed.stateConstituency.id },
    update: territorySeed.stateConstituency,
    create: territorySeed.stateConstituency,
  });

  for (const ward of territorySeed.wards) {
    await prisma.ward.upsert({
      where: { id: ward.id },
      update: ward,
      create: ward,
    });
  }

  await prisma.pollingUnit.upsert({
    where: { id: territorySeed.pollingUnit.id },
    update: territorySeed.pollingUnit,
    create: territorySeed.pollingUnit,
  });

  console.log("Reference political data is ready.");
}

main()
  .catch((error) => {
    console.error("Reference data bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

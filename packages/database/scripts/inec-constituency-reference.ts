import path from "node:path";
import XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

type SenateRow = {
  stateName: string;
  name: string;
  code: string;
  composition: string;
};

type FederalRow = {
  stateName: string;
  name: string;
  code: string;
  composition: string;
};

type StateAssemblyRow = {
  stateName: string;
  name: string;
  code: string;
  composition: string;
};

type WorkbookData = {
  senate: SenateRow[];
  federal: FederalRow[];
  stateAssembly: StateAssemblyRow[];
};

const workbookPath = path.resolve(__dirname, "../reference/inec-constituencies.xls");

function normalizeName(value: string) {
  return value
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim()
    .toUpperCase();
}

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toId(prefix: string, code: string) {
  return `${prefix}-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function isHeaderRow(firstCell: string) {
  const normalized = normalizeName(firstCell);
  return normalized === "S/N" || normalized.includes("NAME OF");
}

function readWorkbook(): WorkbookData {
  const workbook = XLSX.readFile(workbookPath);
  const senate = parseSenateSheet(workbook.Sheets["SEN. DIST."]);
  const federal = parseFederalSheet(workbook.Sheets["FED. CONST."]);
  const stateAssembly = parseStateAssemblySheet(workbook.Sheets["STATE CONST."]);

  return { senate, federal, stateAssembly };
}

function parseSenateSheet(sheet: XLSX.WorkSheet): SenateRow[] {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as Array<Array<string | number>>;
  const items: SenateRow[] = [];
  let currentStateName = "";

  for (const row of rows) {
    const first = cleanName(String(row[0] || ""));
    const second = cleanName(String(row[1] || ""));
    const third = cleanName(String(row[2] || ""));
    const fourth = cleanName(String(row[3] || ""));

    if (!first && !second && !third && !fourth) {
      continue;
    }

    if (first && !second && !third && !fourth && !isHeaderRow(first) && Number.isNaN(Number(first))) {
      currentStateName = first.replace(/,$/, "");
      continue;
    }

    if (typeof row[0] === "number" && second && third) {
      items.push({
        stateName: currentStateName,
        name: second,
        code: third,
        composition: fourth,
      });
    }
  }

  return items;
}

function parseFederalSheet(sheet: XLSX.WorkSheet): FederalRow[] {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as Array<Array<string | number>>;
  const items: FederalRow[] = [];
  let currentStateName = "";

  for (const row of rows) {
    const first = cleanName(String(row[0] || ""));
    const second = cleanName(String(row[1] || ""));
    const third = cleanName(String(row[2] || ""));
    const fourth = cleanName(String(row[3] || ""));

    if (!first && !second && !third && !fourth) {
      continue;
    }

    if (first && !second && !third && !fourth && !isHeaderRow(first) && Number.isNaN(Number(first))) {
      currentStateName = first.replace(/,$/, "");
      continue;
    }

    if (typeof row[0] === "number" && second && third) {
      items.push({
        stateName: currentStateName,
        name: second,
        code: third,
        composition: fourth,
      });
    }
  }

  return items;
}

function parseStateAssemblySheet(sheet: XLSX.WorkSheet): StateAssemblyRow[] {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as Array<Array<string | number>>;
  const items: StateAssemblyRow[] = [];
  let currentStateName = "";

  for (const row of rows) {
    const first = cleanName(String(row[0] || ""));
    const second = cleanName(String(row[1] || ""));
    const third = cleanName(String(row[2] || ""));
    const fourth = cleanName(String(row[3] || ""));

    if (!first && !second && !third && !fourth) {
      continue;
    }

    if (first && !second && !third && !fourth && !isHeaderRow(first) && Number.isNaN(Number(first))) {
      currentStateName = first.replace(/,$/, "");
      continue;
    }

    if (typeof row[0] === "number" && second && third) {
      items.push({
        stateName: currentStateName,
        name: second,
        code: third,
        composition: fourth,
      });
    }
  }

  return items;
}

function normalizeLgaCandidate(value: string) {
  return normalizeName(
    value
      .replace(/THE ENTIRE GEOGRAPHICAL AREAS OF/gi, "")
      .replace(/THE ENTIRE GEOGRAPHICAL AREA OF/gi, "")
      .replace(/THE ENTIRE L\.?G\.?A\.?S?/gi, "")
      .replace(/THE ENTIRE LGA/gi, "")
      .replace(/PART OF THE LGA/gi, "")
      .replace(/WARDS?.*$/gi, "")
      .replace(/GEOGRAPHICAL AREAS OF/gi, "")
      .replace(/GEOGRAPHICAL AREA OF/gi, "")
      .replace(/L\.?G\.?A\.?S?/gi, "")
      .replace(/L\.?A\.?A\.?S?/gi, "")
      .replace(/\bAND\b/gi, ",")
      .replace(/&/g, ",")
      .replace(/\//g, ",")
      .replace(/[()]/g, " "),
  );
}

function splitCompositionIntoLgaNames(composition: string) {
  return normalizeLgaCandidate(composition)
    .split(",")
    .map((item) => cleanName(item))
    .filter((item) => item.length > 1 && !item.startsWith("WARD"));
}

async function ensureState(prisma: PrismaClient, stateName: string) {
  return prisma.state.findFirst({
    where: { name: { equals: stateName, mode: "insensitive" } },
    select: { id: true, name: true },
  });
}

async function ensureLga(prisma: PrismaClient, stateId: string, lgaName: string) {
  const existing = await prisma.lGA.findFirst({
    where: {
      stateId,
      name: { equals: lgaName, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });

  if (existing) {
    return existing;
  }

  const baseId = `bootstrap-lga-${stateId}-${lgaName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  let nextId = baseId;
  let suffix = 2;

  for (;;) {
    const existingById = await prisma.lGA.findUnique({
      where: { id: nextId },
      select: { id: true },
    });

    if (!existingById) {
      break;
    }

    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return prisma.lGA.create({
    data: {
      id: nextId,
      stateId,
      name: lgaName,
    },
    select: { id: true, name: true },
  });
}

function pickPrimaryLga(
  constituencyName: string,
  composition: string,
  availableLgas: Array<{ id: string; name: string }>,
) {
  const nameText = normalizeName(constituencyName);
  const compositionText = normalizeLgaCandidate(composition);

  const matched = availableLgas.filter((lga) => {
    const normalizedLga = normalizeName(lga.name);
    return nameText.includes(normalizedLga) || compositionText.includes(normalizedLga);
  });

  if (matched.length > 0) {
    return matched[0];
  }

  return availableLgas[0] || null;
}

export async function ensureNationalConstituencyReference(prisma: PrismaClient) {
  const workbook = readWorkbook();
  const senateByStateId = new Map<string, Array<{ id: string; lgaNames: string[] }>>();

  for (const row of workbook.senate) {
    const state = await ensureState(prisma, row.stateName);
    if (!state) {
      continue;
    }

    const lgaNames = splitCompositionIntoLgaNames(row.composition);
    for (const lgaName of lgaNames) {
      await ensureLga(prisma, state.id, lgaName);
    }

    const existing = await prisma.senatorialDistrict.findFirst({
      where: {
        stateId: state.id,
        OR: [
          { id: toId("sen", row.code) },
          { name: { equals: row.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.senatorialDistrict.update({
        where: { id: existing.id },
        data: { name: row.name, stateId: state.id },
      });
      senateByStateId.set(state.id, [
        ...(senateByStateId.get(state.id) || []),
        { id: existing.id, lgaNames },
      ]);
      continue;
    }

    const created = await prisma.senatorialDistrict.create({
      data: {
        id: toId("sen", row.code),
        name: row.name,
        stateId: state.id,
      },
    });
    senateByStateId.set(state.id, [
      ...(senateByStateId.get(state.id) || []),
      { id: created.id, lgaNames },
    ]);
  }

  for (const row of workbook.federal) {
    const state = await ensureState(prisma, row.stateName);
    if (!state) {
      continue;
    }

    const federalLgaNames = splitCompositionIntoLgaNames(row.composition);
    for (const lgaName of federalLgaNames) {
      await ensureLga(prisma, state.id, lgaName);
    }

    const senateOptions = senateByStateId.get(state.id) || [];
    const matchedDistrict = senateOptions
      .map((district) => ({
        id: district.id,
        score: district.lgaNames.filter((name) => federalLgaNames.includes(name)).length,
      }))
      .sort((left, right) => right.score - left.score)[0];

    if (!matchedDistrict?.id) {
      continue;
    }

    const existing = await prisma.federalConstituency.findFirst({
      where: {
        stateId: state.id,
        OR: [
          { id: toId("fed", row.code) },
          { name: { equals: row.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.federalConstituency.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          stateId: state.id,
          senatorialDistrictId: matchedDistrict.id,
        },
      });
      continue;
    }

    await prisma.federalConstituency.create({
      data: {
        id: toId("fed", row.code),
        name: row.name,
        stateId: state.id,
        senatorialDistrictId: matchedDistrict.id,
      },
    });
  }

  for (const row of workbook.stateAssembly) {
    const state = await ensureState(prisma, row.stateName);
    if (!state) {
      continue;
    }

    const stateLgas = await prisma.lGA.findMany({
      where: { stateId: state.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const compositionLgaNames = splitCompositionIntoLgaNames(row.composition);
    for (const lgaName of compositionLgaNames) {
      await ensureLga(prisma, state.id, lgaName);
    }

    const refreshedStateLgas = compositionLgaNames.length > 0
      ? await prisma.lGA.findMany({
          where: { stateId: state.id },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : stateLgas;

    const primaryLga = pickPrimaryLga(row.name, row.composition, refreshedStateLgas);
    if (!primaryLga) {
      continue;
    }

    const existing = await prisma.stateConstituency.findFirst({
      where: {
        stateId: state.id,
        OR: [
          { id: toId("state-assembly", row.code) },
          { name: { equals: row.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.stateConstituency.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          stateId: state.id,
          lgaId: primaryLga.id,
        },
      });
      continue;
    }

    const baseId = toId("state-assembly", row.code);
    let nextId = baseId;
    let suffix = 2;

    for (;;) {
      const existingById = await prisma.stateConstituency.findUnique({
        where: { id: nextId },
        select: { id: true },
      });

      if (!existingById) {
        break;
      }

      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    await prisma.stateConstituency.create({
      data: {
        id: nextId,
        name: row.name,
        stateId: state.id,
        lgaId: primaryLga.id,
      },
    });
  }
}

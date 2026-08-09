import type { PrismaClient } from "@prisma/client";
import {
  OGUN_IDENTITY_REQUIRED_COUNTS,
  OGUN_STATE_ID,
  type OgunReferenceLevelSummary,
  type OgunReferenceLevelStatus,
} from "@pics-nigeria/shared";
import { getOgunConstituencyWorkbookSummary } from "./inec-constituency-reference";

type CountInput = {
  loaded: number;
  expected: number | null;
  sourceRows: number | null;
  structuralBlockers: string[];
  provenanceMissing: number;
  releaseApplied: boolean;
};

function classifyIdentityLevel(input: CountInput): OgunReferenceLevelStatus {
  if (input.loaded === 0) {
    return input.sourceRows && input.sourceRows > 0 ? "PARTIAL" : "MISSING";
  }

  if (input.structuralBlockers.length > 0) {
    return "BLOCKED";
  }

  if (input.expected !== null && input.loaded !== input.expected) {
    return "PARTIAL";
  }

  if (!input.releaseApplied || input.provenanceMissing > 0) {
    return "PARTIAL";
  }

  return "VERIFIED";
}

function classifyGeodataLevel(input: {
  loadedPollingUnits: number;
  pollingUnitsWithCompleteGeodata: number;
  pollingUnitsMissingGeodata: number;
  declaredGeocodedPollingUnits: number | null;
  releaseApplied: boolean;
}): OgunReferenceLevelStatus {
  if (input.pollingUnitsWithCompleteGeodata === 0) {
    return "MISSING";
  }

  if (input.pollingUnitsMissingGeodata > 0) {
    return "PARTIAL";
  }

  if (input.declaredGeocodedPollingUnits !== null && input.pollingUnitsWithCompleteGeodata !== input.declaredGeocodedPollingUnits) {
    return "BLOCKED";
  }

  if (!input.releaseApplied || input.loadedPollingUnits === 0) {
    return "PARTIAL";
  }

  return "VERIFIED";
}

function jsonCount(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const count = (value as Record<string, unknown>)[key];
  return typeof count === "number" ? count : null;
}

export async function buildOgunReferenceLevelReport(prisma: PrismaClient): Promise<OgunReferenceLevelSummary[]> {
  const prismaAny = prisma as any;
  const source = getOgunConstituencyWorkbookSummary();

  const [
    stateConstituencies,
    lgas,
    wards,
    pollingUnits,
    identityRelease,
    geodataRelease,
  ] = await Promise.all([
    prisma.stateConstituency.findMany({
      where: { stateId: OGUN_STATE_ID },
      select: {
        id: true,
        sourceCode: true,
        sourceCodeNamespace: true,
        referenceImportReleaseId: true,
        federalConstituencyId: true,
        federalConstituency: { select: { stateId: true } },
        lga: { select: { stateId: true } },
      },
    }),
    prisma.lGA.findMany({
      where: { stateId: OGUN_STATE_ID },
      select: { id: true, sourceCode: true, sourceCodeNamespace: true, referenceImportReleaseId: true },
    }),
    prisma.ward.findMany({
      where: { stateId: OGUN_STATE_ID },
      select: {
        id: true,
        lgaId: true,
        sourceCode: true,
        sourceCodeNamespace: true,
        referenceImportReleaseId: true,
        stateConstituencyId: true,
        lga: { select: { stateId: true } },
        stateConstituency: { select: { stateId: true } },
      },
    }),
    prisma.pollingUnit.findMany({
      where: { stateId: OGUN_STATE_ID },
      select: {
        id: true,
        lgaId: true,
        wardId: true,
        sourceCode: true,
        sourceCodeNamespace: true,
        referenceImportReleaseId: true,
        latitude: true,
        longitude: true,
        geoAccuracyMeters: true,
        geoCaptureMethod: true,
        geoCapturedAt: true,
        geoSource: true,
        geofenceRadiusMeters: true,
        geodataImportReleaseId: true,
        lga: { select: { stateId: true } },
        ward: { select: { stateId: true, lgaId: true } },
      },
    }),
    prismaAny.referenceDataImportRelease.findFirst({
      where: { stateId: OGUN_STATE_ID, kind: "OGUN_IDENTITY", status: "APPLIED" },
      orderBy: { appliedAt: "desc" },
      select: { declaredCountsJson: true },
    }),
    prismaAny.referenceDataImportRelease.findFirst({
      where: { stateId: OGUN_STATE_ID, kind: "OGUN_POLLING_UNIT_GEODATA", status: "APPLIED" },
      orderBy: { appliedAt: "desc" },
      select: { declaredCountsJson: true },
    }),
  ]);

  const identityReleaseApplied = Boolean(identityRelease);
  const geodataReleaseApplied = Boolean(geodataRelease);

  const stateConstituencyBlockers = [
    stateConstituencies.some((item) => item.lga.stateId !== OGUN_STATE_ID)
      ? "STATE_CONSTITUENCY_CROSS_STATE_LGA"
      : null,
    stateConstituencies.some((item) => !item.federalConstituencyId || item.federalConstituency?.stateId !== OGUN_STATE_ID)
      ? "STATE_CONSTITUENCY_WITHOUT_OGUN_FEDERAL_PARENT"
      : null,
  ].filter((item): item is string => Boolean(item));

  const wardBlockers = [
    wards.some((item) => item.lga.stateId !== OGUN_STATE_ID) ? "WARD_CROSS_STATE_LGA" : null,
    wards.some((item) => !item.stateConstituencyId || item.stateConstituency?.stateId !== OGUN_STATE_ID)
      ? "WARD_WITHOUT_OGUN_STATE_CONSTITUENCY_PARENT"
      : null,
  ].filter((item): item is string => Boolean(item));

  const pollingUnitBlockers = [
    pollingUnits.some(
      (item) => item.lga.stateId !== OGUN_STATE_ID || item.ward.stateId !== OGUN_STATE_ID || item.ward.lgaId !== item.lgaId,
    )
      ? "POLLING_UNIT_PARENTAGE_MISMATCH"
      : null,
  ].filter((item): item is string => Boolean(item));

  const lgaIdsWithWards = new Set(wards.map((ward) => ward.lgaId));
  const wardIdsWithPollingUnits = new Set(pollingUnits.map((pollingUnit) => pollingUnit.wardId));
  const lgasWithoutWards = lgas.filter((lga) => !lgaIdsWithWards.has(lga.id)).length;
  const wardsWithoutPollingUnits = wards.filter((ward) => !wardIdsWithPollingUnits.has(ward.id)).length;

  if (lgas.length > 0 && lgasWithoutWards > 0) {
    wardBlockers.push("LGA_WITHOUT_WARDS");
  }
  if (wards.length > 0 && wardsWithoutPollingUnits > 0) {
    pollingUnitBlockers.push("WARD_WITHOUT_POLLING_UNITS");
  }

  const missingIdentityProvenance = (items: Array<{ sourceCode: string | null; sourceCodeNamespace: string | null; referenceImportReleaseId: string | null }>) =>
    items.filter((item) => !item.sourceCode || !item.sourceCodeNamespace || !item.referenceImportReleaseId).length;

  const pollingUnitsWithCompleteGeodata = pollingUnits.filter(
    (item) =>
      item.latitude !== null &&
      item.longitude !== null &&
      item.geoAccuracyMeters !== null &&
      Boolean(item.geoCaptureMethod) &&
      Boolean(item.geoCapturedAt) &&
      Boolean(item.geoSource) &&
      item.geofenceRadiusMeters !== null &&
      Boolean(item.geodataImportReleaseId),
  ).length;
  const pollingUnitsMissingGeodata = pollingUnits.length - pollingUnitsWithCompleteGeodata;

  return [
    {
      key: "stateConstituencies",
      label: "State Constituencies",
      expected: OGUN_IDENTITY_REQUIRED_COUNTS.stateConstituencies,
      loaded: stateConstituencies.length,
      sourceRows: source.stateConstituencies,
      verified:
        classifyIdentityLevel({
          loaded: stateConstituencies.length,
          expected: OGUN_IDENTITY_REQUIRED_COUNTS.stateConstituencies,
          sourceRows: source.stateConstituencies,
          structuralBlockers: stateConstituencyBlockers,
          provenanceMissing: missingIdentityProvenance(stateConstituencies),
          releaseApplied: identityReleaseApplied,
        }) === "VERIFIED"
          ? stateConstituencies.length
          : 0,
      status: classifyIdentityLevel({
        loaded: stateConstituencies.length,
        expected: OGUN_IDENTITY_REQUIRED_COUNTS.stateConstituencies,
        sourceRows: source.stateConstituencies,
        structuralBlockers: stateConstituencyBlockers,
        provenanceMissing: missingIdentityProvenance(stateConstituencies),
        releaseApplied: identityReleaseApplied,
      }),
      blockers: stateConstituencyBlockers,
    },
    {
      key: "lgas",
      label: "LGAs",
      expected: OGUN_IDENTITY_REQUIRED_COUNTS.lgas,
      loaded: lgas.length,
      sourceRows: null,
      verified:
        classifyIdentityLevel({
          loaded: lgas.length,
          expected: OGUN_IDENTITY_REQUIRED_COUNTS.lgas,
          sourceRows: null,
          structuralBlockers: [],
          provenanceMissing: missingIdentityProvenance(lgas),
          releaseApplied: identityReleaseApplied,
        }) === "VERIFIED"
          ? lgas.length
          : 0,
      status: classifyIdentityLevel({
        loaded: lgas.length,
        expected: OGUN_IDENTITY_REQUIRED_COUNTS.lgas,
        sourceRows: null,
        structuralBlockers: [],
        provenanceMissing: missingIdentityProvenance(lgas),
        releaseApplied: identityReleaseApplied,
      }),
      blockers: [],
    },
    {
      key: "wards",
      label: "Wards",
      expected: jsonCount(identityRelease?.declaredCountsJson, "wards"),
      loaded: wards.length,
      sourceRows: null,
      verified:
        classifyIdentityLevel({
          loaded: wards.length,
          expected: jsonCount(identityRelease?.declaredCountsJson, "wards"),
          sourceRows: null,
          structuralBlockers: wardBlockers,
          provenanceMissing: missingIdentityProvenance(wards),
          releaseApplied: identityReleaseApplied,
        }) === "VERIFIED"
          ? wards.length
          : 0,
      status: classifyIdentityLevel({
        loaded: wards.length,
        expected: jsonCount(identityRelease?.declaredCountsJson, "wards"),
        sourceRows: null,
        structuralBlockers: wardBlockers,
        provenanceMissing: missingIdentityProvenance(wards),
        releaseApplied: identityReleaseApplied,
      }),
      blockers: wardBlockers,
    },
    {
      key: "pollingUnits",
      label: "Polling Units",
      expected: jsonCount(identityRelease?.declaredCountsJson, "pollingUnits"),
      loaded: pollingUnits.length,
      sourceRows: null,
      verified:
        classifyIdentityLevel({
          loaded: pollingUnits.length,
          expected: jsonCount(identityRelease?.declaredCountsJson, "pollingUnits"),
          sourceRows: null,
          structuralBlockers: pollingUnitBlockers,
          provenanceMissing: missingIdentityProvenance(pollingUnits),
          releaseApplied: identityReleaseApplied,
        }) === "VERIFIED"
          ? pollingUnits.length
          : 0,
      status: classifyIdentityLevel({
        loaded: pollingUnits.length,
        expected: jsonCount(identityRelease?.declaredCountsJson, "pollingUnits"),
        sourceRows: null,
        structuralBlockers: pollingUnitBlockers,
        provenanceMissing: missingIdentityProvenance(pollingUnits),
        releaseApplied: identityReleaseApplied,
      }),
      blockers: pollingUnitBlockers,
    },
    {
      key: "puGeodata",
      label: "PU Geodata",
      expected: jsonCount(geodataRelease?.declaredCountsJson, "geocodedPollingUnits"),
      loaded: pollingUnitsWithCompleteGeodata,
      sourceRows: null,
      verified:
        classifyGeodataLevel({
          loadedPollingUnits: pollingUnits.length,
          pollingUnitsWithCompleteGeodata,
          pollingUnitsMissingGeodata,
          declaredGeocodedPollingUnits: jsonCount(geodataRelease?.declaredCountsJson, "geocodedPollingUnits"),
          releaseApplied: geodataReleaseApplied,
        }) === "VERIFIED"
          ? pollingUnitsWithCompleteGeodata
          : 0,
      status: classifyGeodataLevel({
        loadedPollingUnits: pollingUnits.length,
        pollingUnitsWithCompleteGeodata,
        pollingUnitsMissingGeodata,
        declaredGeocodedPollingUnits: jsonCount(geodataRelease?.declaredCountsJson, "geocodedPollingUnits"),
        releaseApplied: geodataReleaseApplied,
      }),
      blockers: [],
    },
  ];
}

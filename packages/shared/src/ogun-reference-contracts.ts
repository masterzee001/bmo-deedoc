export const OGUN_REFERENCE_IMPORT_CONTRACT_VERSION = 1 as const;

export const OGUN_REFERENCE_IMPORT_KINDS = [
  "OGUN_IDENTITY",
  "OGUN_POLLING_UNIT_GEODATA",
] as const;

export const OGUN_REFERENCE_IMPORT_STATUSES = [
  "STAGED",
  "APPLIED",
  "REJECTED",
] as const;

export const OGUN_REFERENCE_TERRITORY_KINDS = [
  "STATE_CONSTITUENCY",
  "LGA",
  "WARD",
  "POLLING_UNIT",
] as const;

export const OGUN_IDENTITY_REQUIRED_COUNTS = {
  stateConstituencies: 26,
  lgas: 20,
} as const;

export const OGUN_REFERENCE_GATE_SCOPES = ["IDENTITY", "PROVENANCE", "GEODATA"] as const;

export type OgunReferenceImportKind = (typeof OGUN_REFERENCE_IMPORT_KINDS)[number];
export type OgunReferenceImportStatus = (typeof OGUN_REFERENCE_IMPORT_STATUSES)[number];
export type OgunReferenceTerritoryKind = (typeof OGUN_REFERENCE_TERRITORY_KINDS)[number];
export type OgunReferenceGateScope = (typeof OGUN_REFERENCE_GATE_SCOPES)[number];

export type OgunReferenceReleaseManifest = {
  contractVersion: typeof OGUN_REFERENCE_IMPORT_CONTRACT_VERSION;
  releaseId: string;
  kind: OgunReferenceImportKind;
  stateId: string;
  publisher: string;
  sourceUrl?: string | null;
  sourceDocumentId?: string | null;
  retrievedAt: string;
  effectiveAt?: string | null;
  approvedBy: string;
  approvedAt: string;
  supersedesReleaseId?: string | null;
  sourceCodeNamespaces: string[];
  declaredCounts: {
    stateConstituencies?: number;
    lgas?: number;
    wards?: number;
    pollingUnits?: number;
    geocodedPollingUnits?: number;
  };
  files: {
    territories?: { path: string; sha256: string };
    commandRelationships?: { path: string; sha256: string };
    lgaMemberships?: { path: string; sha256: string };
    pollingUnitGeodata?: { path: string; sha256: string };
  };
};

export type OgunReferenceGateBlocker = {
  scope: OgunReferenceGateScope;
  code: string;
  message: string;
};

export type OgunReferenceGateSummary = {
  status: "PASS" | "BLOCKED";
  identityComplete: boolean;
  provenanceComplete: boolean;
  geodataReady: boolean;
  blockers: OgunReferenceGateBlocker[];
};

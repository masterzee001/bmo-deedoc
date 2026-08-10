import type { OperationalTerritory } from "./platform-contracts";

/**
 * Hierarchical command dashboard contracts (Features 059-065, 077, 078).
 *
 * One engine serves every command level. The level is a parameter, not a
 * separate implementation, so authorization, aggregation, and drill-down behave
 * identically wherever an officer stands in the hierarchy. What changes per
 * level is the presentation contract below: the label, the unit being counted,
 * and which child level a user drills into next.
 *
 * LGA never appears as a command level. It stays reference/search/reporting
 * data, so it is absent from this hierarchy entirely.
 */
export const DASHBOARD_LEVELS = [
  "STATE",
  "SENATORIAL_DISTRICT",
  "FEDERAL_CONSTITUENCY",
  "STATE_CONSTITUENCY",
  "WARD",
  "POLLING_UNIT",
] as const;

export type DashboardLevel = (typeof DASHBOARD_LEVELS)[number];

/** The level a user drills into from a given level. Polling Unit is terminal. */
export const DASHBOARD_CHILD_LEVEL: Record<DashboardLevel, DashboardLevel | null> = {
  STATE: "SENATORIAL_DISTRICT",
  SENATORIAL_DISTRICT: "FEDERAL_CONSTITUENCY",
  FEDERAL_CONSTITUENCY: "STATE_CONSTITUENCY",
  STATE_CONSTITUENCY: "WARD",
  WARD: "POLLING_UNIT",
  POLLING_UNIT: null,
};

/**
 * Per-level presentation. Each command level reads as its own dashboard rather
 * than a generic table with a different filter: the singular/plural nouns, the
 * name of the unit being rolled up, and the accent differ by level.
 */
export const DASHBOARD_LEVEL_PRESENTATION: Record<
  DashboardLevel,
  { singular: string; plural: string; childUnitPlural: string; accent: string; summary: string }
> = {
  STATE: {
    singular: "Ogun State",
    plural: "Ogun State",
    childUnitPlural: "Senatorial Districts",
    accent: "#5b21b6",
    summary: "Statewide organisational strength across all three Senatorial Districts.",
  },
  SENATORIAL_DISTRICT: {
    singular: "Senatorial District",
    plural: "Senatorial Districts",
    childUnitPlural: "Federal Constituencies",
    accent: "#1d4ed8",
    summary: "District command view rolling up its Federal Constituencies.",
  },
  FEDERAL_CONSTITUENCY: {
    singular: "Federal Constituency",
    plural: "Federal Constituencies",
    childUnitPlural: "State Constituencies",
    accent: "#0f766e",
    summary: "Federal Constituency view rolling up its State Constituencies.",
  },
  STATE_CONSTITUENCY: {
    singular: "State Constituency",
    plural: "State Constituencies",
    childUnitPlural: "Wards",
    accent: "#b45309",
    summary: "State Constituency view rolling up its Wards.",
  },
  WARD: {
    singular: "Ward",
    plural: "Wards",
    childUnitPlural: "Polling Units",
    accent: "#be123c",
    summary: "Ward command view rolling up its Polling Units.",
  },
  POLLING_UNIT: {
    singular: "Polling Unit",
    plural: "Polling Units",
    childUnitPlural: "Polling Unit",
    accent: "#334155",
    summary: "Ground-level Polling Unit readiness. This is the terminal command level.",
  },
};

/**
 * Strength bands for the heatmap (Feature 077). Thresholds are inclusive lower
 * bounds on the 0-100 strength score.
 */
export const STRENGTH_BANDS = ["CRITICAL", "WEAK", "MODERATE", "STRONG"] as const;

export type StrengthBand = (typeof STRENGTH_BANDS)[number];

export const STRENGTH_BAND_THRESHOLDS: Array<{ band: StrengthBand; minimumScore: number; color: string; label: string }> = [
  { band: "STRONG", minimumScore: 75, color: "#15803d", label: "Strong" },
  { band: "MODERATE", minimumScore: 50, color: "#ca8a04", label: "Moderate" },
  { band: "WEAK", minimumScore: 25, color: "#ea580c", label: "Weak" },
  { band: "CRITICAL", minimumScore: 0, color: "#b91c1c", label: "Critical" },
];

export function strengthBandFor(score: number): StrengthBand {
  return STRENGTH_BAND_THRESHOLDS.find((entry) => score >= entry.minimumScore)?.band || "CRITICAL";
}

/**
 * Operational metrics a leaderboard may rank on (Feature 078).
 *
 * Deliberately limited to approved operational measures. Nothing here derives
 * from political preference, vote choice, or ballot behaviour, and no metric may
 * be added that does.
 */
export const LEADERBOARD_METRICS = [
  "VERIFIED_REFERRALS",
  "REGISTERED_MEMBERS",
  "TASK_COMPLETION",
  "FIELD_ACTIVITY",
  "COVERAGE",
  "READINESS",
] as const;

export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

export const LEADERBOARD_METRIC_LABELS: Record<LeaderboardMetric, string> = {
  VERIFIED_REFERRALS: "Verified referrals",
  REGISTERED_MEMBERS: "Registered members",
  TASK_COMPLETION: "Tasks completed",
  FIELD_ACTIVITY: "Field activity logged",
  COVERAGE: "Polling Unit coverage",
  READINESS: "Operational readiness",
};

export type DashboardMetricTile = {
  key: string;
  label: string;
  value: number;
  target: number | null;
  percentageOfTarget: number | null;
  shortfall: number | null;
};

export type DashboardChildRow = {
  territoryId: string;
  name: string;
  level: DashboardLevel;
  strengthScore: number;
  band: StrengthBand;
  registeredMembers: number;
  verifiedMembers: number;
  coordinators: number;
  pollingUnits: number;
  /** Null when no prior snapshot exists to compare against. */
  trend: "IMPROVING" | "STABLE" | "DECLINING" | null;
};

export type DashboardLeaderboardEntry = {
  rank: number;
  coordinatorUserId: string;
  name: string;
  coordinatorLevel: string | null;
  territoryId: string | null;
  territoryName: string | null;
  metric: LeaderboardMetric;
  value: number;
};

export type HierarchicalDashboard = {
  level: DashboardLevel;
  territoryId: string;
  territoryName: string;
  presentation: (typeof DASHBOARD_LEVEL_PRESENTATION)[DashboardLevel];
  breadcrumb: Array<{ level: DashboardLevel; territoryId: string; name: string }>;
  strengthScore: number;
  band: StrengthBand;
  trend: "IMPROVING" | "STABLE" | "DECLINING" | null;
  tiles: DashboardMetricTile[];
  childLevel: DashboardLevel | null;
  children: DashboardChildRow[];
  leaderboard: DashboardLeaderboardEntry[];
  /** Present only for the terminal Polling Unit level. */
  pollingUnitDetail: {
    operationalStatus: string;
    checkedInAt: string | null;
    coordinatorName: string | null;
    incidentCount: number;
    reportCount: number;
    evidenceCount: number;
  } | null;
  territory: OperationalTerritory;
  generatedAt: string;
  /**
   * True when the level's child records are not yet loaded from an approved
   * Ogun reference release. The dashboard renders with an explicit gap notice
   * rather than implying the hierarchy is empty.
   */
  referenceDataIncomplete: boolean;
};

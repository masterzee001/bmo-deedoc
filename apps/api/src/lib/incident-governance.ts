import type { UserRole } from "@prisma/client";
import type { IncidentGovernanceSummary, IncidentListItem } from "@pics-nigeria/shared";

type Governance = NonNullable<IncidentListItem["governance"]>;
type Flag = Governance["flags"][number];

type ReporterScope = {
  role: UserRole;
  stateId: string | null;
  lgaId: string | null;
  wardId: string | null;
  pollingUnitId: string | null;
};

type IncidentRecord = {
  id: string;
  status: IncidentListItem["status"];
  severity: IncidentListItem["severity"];
  latitude: number | null;
  longitude: number | null;
  stateId: string;
  lgaId: string;
  wardId: string | null;
  pollingUnitId: string | null;
  assignedAdminUserId: string | null;
  escalatedAt?: Date | null;
  reportedByUser: ReporterScope;
};

function territoryMismatch(incident: IncidentRecord): boolean {
  const reporter = incident.reportedByUser;

  if (reporter.stateId && reporter.stateId !== incident.stateId) {
    return true;
  }
  if (reporter.lgaId && reporter.lgaId !== incident.lgaId) {
    return true;
  }
  if (reporter.wardId && incident.wardId && reporter.wardId !== incident.wardId) {
    return true;
  }
  if (reporter.pollingUnitId && incident.pollingUnitId && reporter.pollingUnitId !== incident.pollingUnitId) {
    return true;
  }

  return false;
}

function getReviewPriority(
  severity: IncidentListItem["severity"],
  flags: Flag[],
): Governance["reviewPriority"] {
  if (severity === "CRITICAL" || flags.some((flag) => flag.severity === "HIGH")) {
    return "CRITICAL";
  }

  if (severity === "HIGH" || flags.length > 0) {
    return "PRIORITY";
  }

  return "ROUTINE";
}

export function buildIncidentGovernance(
  incident: IncidentRecord,
  context: {
    duplicateCount: number;
    reporterIncidentCountInWindow: number;
  },
): IncidentListItem["governance"] {
  const flags: Flag[] = [];

  if (context.duplicateCount > 1) {
    flags.push({
      code: "DUPLICATE_REPORT_WINDOW",
      severity: context.duplicateCount > 2 ? "HIGH" : "WARNING",
      message: `${context.duplicateCount} similar incident reports were submitted for this territory in the recent review window.`,
    });
  }

  if (territoryMismatch(incident)) {
    flags.push({
      code: "REPORTER_TERRITORY_MISMATCH",
      severity: "HIGH",
      message: "The report territory does not fully match the reporter's assigned territory.",
    });
  }

  if (incident.latitude === null || incident.longitude === null) {
    flags.push({
      code: "MISSING_LOCATION_DATA",
      severity: "INFO",
      message: "No location coordinates were attached to this incident report.",
    });
  }

  if (context.reporterIncidentCountInWindow >= 3) {
    flags.push({
      code: "REPEATED_REPORTER_VOLUME",
      severity: context.reporterIncidentCountInWindow >= 5 ? "HIGH" : "WARNING",
      message: `This reporter submitted ${context.reporterIncidentCountInWindow} incidents in the recent review window.`,
    });
  }

  if (incident.status === "OPEN" && !incident.assignedAdminUserId) {
    flags.push({
      code: "UNASSIGNED_OPEN_INCIDENT",
      severity: incident.severity === "CRITICAL" ? "HIGH" : "WARNING",
      message: "This incident is still open and has not been assigned to an admin.",
    });
  }

  return {
    reporterRole: incident.reportedByUser.role,
    escalationStatus: incident.escalatedAt ? "ESCALATED" : "NOT_ESCALATED",
    reviewPriority: getReviewPriority(incident.severity, flags),
    flags,
  };
}

export function summarizeIncidentGovernance(incidents: IncidentListItem[]): IncidentGovernanceSummary {
  const byFlagCode = incidents.reduce<Record<string, number>>((accumulator, incident) => {
    for (const flag of incident.governance?.flags || []) {
      accumulator[flag.code] = (accumulator[flag.code] || 0) + 1;
    }

    return accumulator;
  }, {});

  return {
    totalIncidents: incidents.length,
    escalatedIncidents: incidents.filter((incident) => incident.governance?.escalationStatus === "ESCALATED").length,
    flaggedIncidents: incidents.filter((incident) => (incident.governance?.flags.length || 0) > 0).length,
    criticalReviewIncidents: incidents.filter((incident) => incident.governance?.reviewPriority === "CRITICAL").length,
    byFlagCode,
  };
}

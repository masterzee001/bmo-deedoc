"use client";

import type { AuthUserProfile, TerritorySummary } from "@pics-nigeria/shared";

export const MANAGED_ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "CANDIDATE", label: "Candidate" },
  { value: "AGENT", label: "Agent" },
  { value: "VOTER", label: "Voter / Supporter" },
] as const;

export function getManagedRoleLabel(role: string): string {
  return MANAGED_ROLE_OPTIONS.find((item) => item.value === role)?.label || role;
}

export function getScopeTitle(user: AuthUserProfile | null): string {
  if (!user) {
    return "Scoped operations";
  }

  if (user.role === "SUPER_ADMIN") {
    return "Platform-wide oversight";
  }

  const adminLevel = user.adminProfile?.adminLevel;
  if (!adminLevel) {
    return "Scoped operations";
  }

  return `${adminLevel.replace(/_/g, " ")} operations`;
}

export function describeTerritory(territory: TerritorySummary): string {
  return [
    territory.stateId || "National",
    territory.lgaId || null,
    territory.wardId || null,
    territory.pollingUnitId || null,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function matchesTerritoryFilter(
  territory: TerritorySummary,
  filter: { stateId?: string; lgaId?: string; wardId?: string },
): boolean {
  if (filter.stateId && territory.stateId !== filter.stateId) {
    return false;
  }

  if (filter.lgaId && territory.lgaId !== filter.lgaId) {
    return false;
  }

  if (filter.wardId && territory.wardId !== filter.wardId) {
    return false;
  }

  return true;
}

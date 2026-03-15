"use client";

import type { AuthUserProfile, TerritorySummary } from "@pics-nigeria/shared";

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

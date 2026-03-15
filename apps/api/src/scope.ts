import type { AdminLevel, AuthUserProfile, CandidateOfficeType, TerritoryScope } from "@pics-nigeria/shared";

type ScopedCandidate = TerritoryScope & {
  userId?: string;
  politicalPartyId?: string | null;
};

const officeRank: Record<CandidateOfficeType, number> = {
  PRESIDENTIAL: 7,
  GOVERNORSHIP: 5,
  SENATE: 4,
  HOUSE_OF_REP: 3,
  STATE_ASSEMBLY: 2,
  CHAIRMANSHIP: 1,
  COUNCILLOR: 0,
};

const levelRank: Record<AdminLevel, number> = {
  NATIONAL: 7,
  GEO_POLITICAL_ZONE: 6,
  STATE: 5,
  SENATORIAL: 4,
  FEDERAL_CONSTITUENCY: 3,
  STATE_CONSTITUENCY: 2,
  LGA: 1,
  WARD: 0,
};

export function isSuperAdmin(user: AuthUserProfile): boolean {
  return user.role === "SUPER_ADMIN";
}

export function isAdminUser(user: AuthUserProfile): boolean {
  return user.role === "ADMIN" && Boolean(user.adminProfile);
}

export function isCandidateUser(user: AuthUserProfile): boolean {
  return user.role === "CANDIDATE" && Boolean(user.candidateProfile);
}

export function isAdminOrSuperAdmin(user: AuthUserProfile): boolean {
  return isSuperAdmin(user) || isAdminUser(user);
}

export function getActorPoliticalPartyId(user: AuthUserProfile): string | null {
  if (isSuperAdmin(user)) {
    return null;
  }

  if (user.role === "ADMIN") {
    return user.adminProfile?.politicalPartyId || null;
  }

  if (user.role === "CANDIDATE") {
    return user.candidateProfile?.politicalPartyId || null;
  }

  if (user.role === "AGENT") {
    return user.agentProfile?.politicalPartyId || null;
  }

  return null;
}

export function isWithinActorParty(user: AuthUserProfile, politicalPartyId: string | null | undefined): boolean {
  if (isSuperAdmin(user)) {
    return true;
  }

  const actorPartyId = getActorPoliticalPartyId(user);
  return Boolean(actorPartyId) && actorPartyId === (politicalPartyId || null);
}

function matchesAdminScope(actor: AuthUserProfile, target: TerritoryScope): boolean {
  if (isSuperAdmin(actor)) {
    return true;
  }

  if (!actor.adminProfile) {
    return false;
  }

  const scope = actor.adminProfile;

  if (scope.adminLevel === "NATIONAL") {
    return true;
  }

  if (scope.geoPoliticalZoneId && target.geoPoliticalZoneId !== scope.geoPoliticalZoneId) {
    return false;
  }

  if (scope.adminLevel === "GEO_POLITICAL_ZONE") {
    return true;
  }

  if (scope.stateId && target.stateId !== scope.stateId) {
    return false;
  }

  if (scope.adminLevel === "STATE") {
    return true;
  }

  if (scope.senatorialDistrictId && target.senatorialDistrictId && target.senatorialDistrictId !== scope.senatorialDistrictId) {
    return false;
  }

  if (scope.adminLevel === "SENATORIAL") {
    return true;
  }

  if (scope.federalConstituencyId && target.federalConstituencyId !== scope.federalConstituencyId) {
    return false;
  }

  if (scope.adminLevel === "FEDERAL_CONSTITUENCY") {
    return true;
  }

  if (scope.stateConstituencyId && target.stateConstituencyId !== scope.stateConstituencyId) {
    return false;
  }

  if (scope.adminLevel === "STATE_CONSTITUENCY") {
    return true;
  }

  if (scope.lgaId && target.lgaId !== scope.lgaId) {
    return false;
  }

  if (scope.adminLevel === "LGA") {
    return true;
  }

  if (scope.wardId && target.wardId !== scope.wardId) {
    return false;
  }

  return scope.adminLevel === "WARD";
}

export function isWithinAdminScope(actor: AuthUserProfile, target: TerritoryScope): boolean {
  return matchesAdminScope(actor, target);
}

function canManageLevel(actor: AuthUserProfile, targetLevel: AdminLevel): boolean {
  if (isSuperAdmin(actor)) {
    return true;
  }

  if (!actor.adminProfile) {
    return false;
  }

  return levelRank[actor.adminProfile.adminLevel] > levelRank[targetLevel];
}

export function canManageUser(actor: AuthUserProfile, target: AuthUserProfile): boolean {
  if (target.role === "SUPER_ADMIN") {
    return isSuperAdmin(actor);
  }

  if (target.role === "ADMIN" && target.adminProfile) {
    return isWithinActorParty(actor, target.adminProfile.politicalPartyId) && canManageAdmin(actor, {
      adminLevel: target.adminProfile.adminLevel,
      politicalPartyId: target.adminProfile.politicalPartyId,
      geoPoliticalZoneId: target.adminProfile.geoPoliticalZoneId,
      stateId: target.adminProfile.stateId,
      senatorialDistrictId: target.adminProfile.senatorialDistrictId,
      federalConstituencyId: target.adminProfile.federalConstituencyId,
      lgaId: target.adminProfile.lgaId,
      wardId: target.adminProfile.wardId,
      stateConstituencyId: target.adminProfile.stateConstituencyId,
      pollingUnitId: target.adminProfile.pollingUnitId,
    });
  }

  if (target.candidateProfile) {
    return canViewCandidate(actor, {
      ...target.candidateProfile,
      userId: target.id,
    });
  }

  if (target.voterProfile) {
    return matchesAdminScope(actor, target.voterProfile);
  }

  if (target.agentProfile) {
    return isWithinActorParty(actor, target.agentProfile.politicalPartyId) && matchesAdminScope(actor, target.agentProfile);
  }

  return false;
}

export function canManageAdmin(actor: AuthUserProfile, target: TerritoryScope & { adminLevel: AdminLevel; politicalPartyId?: string | null }): boolean {
  return isWithinActorParty(actor, target.politicalPartyId) && canManageLevel(actor, target.adminLevel) && matchesAdminScope(actor, target);
}

export function canManageTerritory(actor: AuthUserProfile, territory: TerritoryScope & { level: AdminLevel }): boolean {
  return canManageLevel(actor, territory.level) && matchesAdminScope(actor, territory);
}

export function canViewCandidate(actor: AuthUserProfile, candidate: ScopedCandidate): boolean {
  if (isSuperAdmin(actor)) {
    return true;
  }

  if (isCandidateUser(actor)) {
    return actor.id === candidate.userId;
  }

  if (isAdminUser(actor)) {
    return isWithinActorParty(actor, candidate.politicalPartyId) && matchesAdminScope(actor, candidate);
  }

  return false;
}

export function canCreateAgentInScope(actor: AuthUserProfile, territory: TerritoryScope): boolean {
  if (isSuperAdmin(actor)) {
    return true;
  }

  if (!isAdminUser(actor)) {
    return false;
  }

  const adminProfile = actor.adminProfile;
  if (!adminProfile) {
    return false;
  }

  if (adminProfile.adminLevel === "LGA") {
    return (
      adminProfile.stateId === territory.stateId &&
      adminProfile.lgaId === territory.lgaId
    );
  }

  if (adminProfile.adminLevel === "WARD") {
    return (
      adminProfile.stateId === territory.stateId &&
      adminProfile.lgaId === territory.lgaId &&
      adminProfile.wardId === territory.wardId
    );
  }

  return matchesAdminScope(actor, territory);
}

export function canManageCandidateOffice(actor: AuthUserProfile, officeType: CandidateOfficeType): boolean {
  if (isSuperAdmin(actor)) {
    return true;
  }

  if (!actor.adminProfile) {
    return false;
  }

  return levelRank[actor.adminProfile.adminLevel] >= officeRank[officeType];
}

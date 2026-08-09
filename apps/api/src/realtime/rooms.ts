import {
  OGUN_STATE_ID,
  type AuthUserProfile,
  type OperationalTerritory,
} from "@pics-nigeria/shared";

export type RealtimeSubscriptionScope = OperationalTerritory;

export function realtimeRoomForScope(scope: RealtimeSubscriptionScope): string {
  if (scope.pollingUnitId) {
    return `election:polling-unit:${scope.pollingUnitId}`;
  }
  if (scope.wardId) {
    return `election:ward:${scope.wardId}`;
  }
  if (scope.stateConstituencyId) {
    return `election:state-constituency:${scope.stateConstituencyId}`;
  }
  if (scope.federalConstituencyId) {
    return `election:federal-constituency:${scope.federalConstituencyId}`;
  }
  if (scope.senatorialDistrictId) {
    return `election:senatorial-district:${scope.senatorialDistrictId}`;
  }
  return `election:state:${scope.stateId}`;
}

export function realtimeRoomsForTerritory(territory: OperationalTerritory | null): string[] {
  if (!territory) {
    return [];
  }

  const rooms = [`election:state:${territory.stateId}`];
  if (territory.senatorialDistrictId) {
    rooms.push(`election:senatorial-district:${territory.senatorialDistrictId}`);
  }
  if (territory.federalConstituencyId) {
    rooms.push(`election:federal-constituency:${territory.federalConstituencyId}`);
  }
  if (territory.stateConstituencyId) {
    rooms.push(`election:state-constituency:${territory.stateConstituencyId}`);
  }
  if (territory.wardId) {
    rooms.push(`election:ward:${territory.wardId}`);
  }
  if (territory.pollingUnitId) {
    rooms.push(`election:polling-unit:${territory.pollingUnitId}`);
  }
  return rooms;
}

export function userPresenceRoom(userId: string): string {
  return `presence:user:${userId}`;
}

export function commandScopeForRealtimeActor(actor: AuthUserProfile): OperationalTerritory | null {
  if (actor.role === "SUPER_ADMIN" || actor.role === "STATE_OFFICER") {
    return { stateId: OGUN_STATE_ID };
  }

  if (actor.role !== "COORDINATOR" || !actor.coordinatorProfile) {
    return null;
  }

  return {
    stateId: actor.coordinatorProfile.stateId || OGUN_STATE_ID,
    senatorialDistrictId: actor.coordinatorProfile.senatorialDistrictId,
    federalConstituencyId: actor.coordinatorProfile.federalConstituencyId,
    stateConstituencyId: actor.coordinatorProfile.stateConstituencyId,
    wardId: actor.coordinatorProfile.wardId,
    pollingUnitId: actor.coordinatorProfile.pollingUnitId,
  };
}

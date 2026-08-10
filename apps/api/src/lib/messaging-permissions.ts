import { OGUN_STATE_ID, type AuthUserProfile, type OperationalTerritory } from "@pics-nigeria/shared";
import { authorizeAction, resolveOperationalTerritory } from "../authorization";
import { getAuthUserProfile } from "../auth/profile";
import { prisma } from "../prisma";

/**
 * Shared Election Day contact-permission rules.
 *
 * Both the REST routes and the Socket.IO gateway must apply the same rule, so
 * these helpers live outside the route module. Direct messaging and voice
 * calling are point-to-point, so an actor may only reach a counterpart when one
 * of the two can command the other's territory.
 */

export function messagingCommandScope(actor: AuthUserProfile): OperationalTerritory | null {
  if (actor.role === "SUPER_ADMIN" || actor.role === "STATE_OFFICER") {
    return { stateId: OGUN_STATE_ID };
  }

  if (actor.role === "COORDINATOR" && actor.coordinatorProfile) {
    return {
      stateId: actor.coordinatorProfile.stateId || OGUN_STATE_ID,
      senatorialDistrictId: actor.coordinatorProfile.senatorialDistrictId,
      federalConstituencyId: actor.coordinatorProfile.federalConstituencyId,
      stateConstituencyId: actor.coordinatorProfile.stateConstituencyId,
      wardId: actor.coordinatorProfile.wardId,
      pollingUnitId: actor.coordinatorProfile.pollingUnitId,
    };
  }

  if (actor.agentProfile?.stateId) {
    return {
      stateId: actor.agentProfile.stateId,
      senatorialDistrictId: actor.agentProfile.senatorialDistrictId || null,
      federalConstituencyId: actor.agentProfile.federalConstituencyId || null,
      stateConstituencyId: actor.agentProfile.stateConstituencyId || null,
      wardId: actor.agentProfile.wardId || null,
      pollingUnitId: actor.agentProfile.pollingUnitId || null,
    };
  }

  return null;
}

/** Resolves the operational territory of a contact target, or null when the account is not reachable. */
export async function contactTerritoryForUser(userId: string): Promise<OperationalTerritory | null> {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      coordinatorProfile: true,
      agentProfile: true,
      voterProfile: true,
      isActive: true,
      accountStatus: true,
    },
  });

  if (!profile?.isActive || profile.accountStatus !== "ACTIVE") {
    return null;
  }

  const territory = profile.coordinatorProfile || profile.agentProfile || profile.voterProfile;
  if (!territory?.stateId) {
    return profile.role === "SUPER_ADMIN" || profile.role === "STATE_OFFICER" ? { stateId: OGUN_STATE_ID } : null;
  }

  return {
    stateId: territory.stateId,
    senatorialDistrictId: territory.senatorialDistrictId || null,
    federalConstituencyId: territory.federalConstituencyId || null,
    stateConstituencyId: territory.stateConstituencyId || null,
    wardId: territory.wardId || null,
    pollingUnitId: territory.pollingUnitId || null,
  };
}

/**
 * True when `actor` may contact `targetUserId` by direct message or voice call.
 * Fails closed: an unresolvable profile, inactive account, or missing territory
 * ancestry denies contact.
 */
export async function canContactUser(actor: AuthUserProfile, targetUserId: string): Promise<boolean> {
  if (actor.id === targetUserId) {
    return false;
  }

  const targetProfile = await getAuthUserProfile(targetUserId);
  const targetTerritory = await contactTerritoryForUser(targetUserId);
  const actorTerritory = messagingCommandScope(actor);
  if (!targetProfile || !targetTerritory || !actorTerritory) {
    return false;
  }

  const resolvedTarget = await resolveOperationalTerritory(prisma, targetTerritory);
  const resolvedActor = await resolveOperationalTerritory(prisma, actorTerritory);
  return authorizeAction(actor, "VIEW_TERRITORY", resolvedTarget) || authorizeAction(targetProfile, "VIEW_TERRITORY", resolvedActor);
}

import "dotenv/config";
import {
  CoordinatorLevel,
  Prisma,
  PrismaClient,
  type AdminLevel,
} from "@prisma/client";
import { OGUN_STATE_ID } from "@pics-nigeria/shared";

type Database = PrismaClient;
type LegacyUser = Prisma.UserGetPayload<{
  include: {
    adminProfile: true;
    candidateProfile: true;
    agentProfile: true;
    voterProfile: true;
  };
}>;

type Assignment = {
  level: CoordinatorLevel;
  stateId: string;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  stateConstituencyId: string | null;
  wardId: string | null;
  pollingUnitId: string | null;
};

export type Phase1MigrationEntry = {
  userId: string;
  email: string;
  sourceRole: string;
  action: string;
  status: "READY" | "BLOCKED" | "UNCHANGED";
  reason?: string;
  assignment?: Assignment;
};

export type Phase1MigrationPlan = {
  generatedAt: string;
  dryRun: boolean;
  entries: Phase1MigrationEntry[];
  totals: Record<Phase1MigrationEntry["status"], number>;
};

type LegacyTerritory = {
  stateId: string | null;
  senatorialDistrictId: string | null;
  federalConstituencyId: string | null;
  stateConstituencyId: string | null;
  wardId: string | null;
  pollingUnitId: string | null;
};

function assignmentFailure(reason: string) {
  return { assignment: null, reason };
}

function matchesDeclared(value: string | null, canonical: string) {
  return !value || value === canonical;
}

async function deriveCoordinatorAssignment(
  database: Database,
  level: CoordinatorLevel,
  profile: LegacyTerritory,
): Promise<{ assignment: Assignment | null; reason?: string }> {
  if (profile.stateId !== OGUN_STATE_ID) {
    return assignmentFailure("Legacy profile is outside Ogun State.");
  }

  if (level === CoordinatorLevel.SENATORIAL_DISTRICT) {
    if (!profile.senatorialDistrictId) {
      return assignmentFailure("Senatorial District is missing.");
    }
    const district = await database.senatorialDistrict.findUnique({
      where: { id: profile.senatorialDistrictId },
      select: { stateId: true },
    });
    if (!district || district.stateId !== OGUN_STATE_ID) {
      return assignmentFailure("Senatorial District is not a canonical Ogun record.");
    }
    return {
      assignment: {
        level,
        stateId: OGUN_STATE_ID,
        senatorialDistrictId: profile.senatorialDistrictId,
        federalConstituencyId: null,
        stateConstituencyId: null,
        wardId: null,
        pollingUnitId: null,
      },
    };
  }

  if (level === CoordinatorLevel.FEDERAL_CONSTITUENCY) {
    if (!profile.federalConstituencyId) {
      return assignmentFailure("Federal Constituency is missing.");
    }
    const federal = await database.federalConstituency.findUnique({
      where: { id: profile.federalConstituencyId },
      select: { stateId: true, senatorialDistrictId: true },
    });
    if (
      !federal ||
      federal.stateId !== OGUN_STATE_ID ||
      !matchesDeclared(profile.senatorialDistrictId, federal.senatorialDistrictId)
    ) {
      return assignmentFailure("Federal Constituency command ancestry is invalid.");
    }
    return {
      assignment: {
        level,
        stateId: OGUN_STATE_ID,
        senatorialDistrictId: federal.senatorialDistrictId,
        federalConstituencyId: profile.federalConstituencyId,
        stateConstituencyId: null,
        wardId: null,
        pollingUnitId: null,
      },
    };
  }

  if (level === CoordinatorLevel.STATE_CONSTITUENCY) {
    if (!profile.stateConstituencyId) {
      return assignmentFailure("State Constituency is missing.");
    }
    const stateConstituency = await database.stateConstituency.findUnique({
      where: { id: profile.stateConstituencyId },
      select: {
        stateId: true,
        federalConstituencyId: true,
        federalConstituency: { select: { senatorialDistrictId: true } },
      },
    });
    if (
      !stateConstituency ||
      stateConstituency.stateId !== OGUN_STATE_ID ||
      !stateConstituency.federalConstituencyId ||
      !stateConstituency.federalConstituency ||
      !matchesDeclared(profile.federalConstituencyId, stateConstituency.federalConstituencyId) ||
      !matchesDeclared(profile.senatorialDistrictId, stateConstituency.federalConstituency.senatorialDistrictId)
    ) {
      return assignmentFailure("State Constituency has no valid constituency-first command ancestry.");
    }
    return {
      assignment: {
        level,
        stateId: OGUN_STATE_ID,
        senatorialDistrictId: stateConstituency.federalConstituency.senatorialDistrictId,
        federalConstituencyId: stateConstituency.federalConstituencyId,
        stateConstituencyId: profile.stateConstituencyId,
        wardId: null,
        pollingUnitId: null,
      },
    };
  }

  const terminalWardId =
    level === CoordinatorLevel.POLLING_UNIT && profile.pollingUnitId
      ? (
          await database.pollingUnit.findUnique({
            where: { id: profile.pollingUnitId },
            select: { stateId: true, wardId: true },
          })
        )
      : null;
  if (level === CoordinatorLevel.POLLING_UNIT) {
    if (!profile.pollingUnitId || !terminalWardId || terminalWardId.stateId !== OGUN_STATE_ID) {
      return assignmentFailure("Polling Unit is missing or is not a canonical Ogun record.");
    }
    if (!matchesDeclared(profile.wardId, terminalWardId.wardId)) {
      return assignmentFailure("Polling Unit does not belong to the declared Ward.");
    }
  }

  const wardId = terminalWardId?.wardId || profile.wardId;
  if (!wardId) {
    return assignmentFailure("Ward is missing.");
  }
  const ward = await database.ward.findUnique({
    where: { id: wardId },
    select: {
      stateId: true,
      stateConstituencyId: true,
      stateConstituency: {
        select: {
          federalConstituencyId: true,
          federalConstituency: { select: { senatorialDistrictId: true } },
        },
      },
    },
  });
  if (
    !ward ||
    ward.stateId !== OGUN_STATE_ID ||
    !ward.stateConstituencyId ||
    !ward.stateConstituency?.federalConstituencyId ||
    !ward.stateConstituency.federalConstituency
  ) {
    return assignmentFailure("Ward has no complete State Constituency command ancestry.");
  }
  const federalId = ward.stateConstituency.federalConstituencyId;
  const senatorialId = ward.stateConstituency.federalConstituency.senatorialDistrictId;
  if (
    !matchesDeclared(profile.stateConstituencyId, ward.stateConstituencyId) ||
    !matchesDeclared(profile.federalConstituencyId, federalId) ||
    !matchesDeclared(profile.senatorialDistrictId, senatorialId)
  ) {
    return assignmentFailure("Ward command ancestry conflicts with the legacy profile.");
  }
  return {
    assignment: {
      level,
      stateId: OGUN_STATE_ID,
      senatorialDistrictId: senatorialId,
      federalConstituencyId: federalId,
      stateConstituencyId: ward.stateConstituencyId,
      wardId,
      pollingUnitId: level === CoordinatorLevel.POLLING_UNIT ? profile.pollingUnitId : null,
    },
  };
}

const adminCoordinatorLevel: Partial<Record<AdminLevel, CoordinatorLevel>> = {
  SENATORIAL: CoordinatorLevel.SENATORIAL_DISTRICT,
  FEDERAL_CONSTITUENCY: CoordinatorLevel.FEDERAL_CONSTITUENCY,
  STATE_CONSTITUENCY: CoordinatorLevel.STATE_CONSTITUENCY,
  WARD: CoordinatorLevel.WARD,
};

function entry(user: LegacyUser, input: Omit<Phase1MigrationEntry, "userId" | "email" | "sourceRole">) {
  return {
    userId: user.id,
    email: user.email,
    sourceRole: user.role,
    ...input,
  };
}

export async function planPhase1IdentityMigration(database: Database): Promise<Phase1MigrationPlan> {
  const users = await database.user.findMany({
    where: { role: { in: ["ADMIN", "CANDIDATE", "AGENT", "VOTER"] } },
    orderBy: { id: "asc" },
    include: { adminProfile: true, candidateProfile: true, agentProfile: true, voterProfile: true },
  });
  const entries: Phase1MigrationEntry[] = [];

  for (const user of users) {
    if (!user.isActive && user.accountStatus === "ACTIVE") {
      entries.push(entry(user, { action: "SYNC_ACCOUNT_STATUS_INACTIVE", status: "READY" }));
    }

    if (user.role === "ADMIN") {
      const profile = user.adminProfile;
      if (!profile) {
        entries.push(entry(user, { action: "MAP_ADMIN_ROLE", status: "BLOCKED", reason: "AdminProfile is missing." }));
        continue;
      }
      if (profile.stateId !== OGUN_STATE_ID) {
        entries.push(entry(user, { action: "MAP_ADMIN_ROLE", status: "BLOCKED", reason: "Admin is outside Ogun State." }));
        continue;
      }
      if (profile.adminLevel === "STATE") {
        entries.push(entry(user, { action: "MAP_ADMIN_TO_STATE_OFFICER", status: "READY" }));
        continue;
      }
      const level = adminCoordinatorLevel[profile.adminLevel];
      if (!level) {
        entries.push(
          entry(user, {
            action: "MAP_ADMIN_ROLE",
            status: "BLOCKED",
            reason:
              profile.adminLevel === "LGA"
                ? "LGA is reference-only and grants no command role."
                : `${profile.adminLevel} has no Ogun Phase 1 target mapping.`,
          }),
        );
        continue;
      }
      const result = await deriveCoordinatorAssignment(database, level, profile);
      entries.push(
        entry(user, {
          action: "MAP_ADMIN_TO_COORDINATOR",
          status: result.assignment ? "READY" : "BLOCKED",
          reason: result.reason,
          assignment: result.assignment || undefined,
        }),
      );
      continue;
    }

    if (user.role === "AGENT") {
      if (!user.agentProfile) {
        entries.push(entry(user, { action: "MAP_AGENT_TO_PU_COORDINATOR", status: "BLOCKED", reason: "AgentProfile is missing." }));
        continue;
      }
      const result = await deriveCoordinatorAssignment(database, CoordinatorLevel.POLLING_UNIT, user.agentProfile);
      entries.push(
        entry(user, {
          action: "MAP_AGENT_TO_PU_COORDINATOR",
          status: result.assignment ? "READY" : "BLOCKED",
          reason: result.reason,
          assignment: result.assignment || undefined,
        }),
      );
      continue;
    }

    if (user.role === "VOTER") {
      entries.push(
        entry(user, {
          action: "MAP_VOTER_TO_MEMBER",
          status: user.voterProfile?.stateId === OGUN_STATE_ID ? "READY" : "BLOCKED",
          reason: user.voterProfile?.stateId === OGUN_STATE_ID ? undefined : "VoterProfile is missing or outside Ogun State.",
        }),
      );
      continue;
    }

    const profile = user.candidateProfile;
    if (!profile?.stateId || profile.stateId !== OGUN_STATE_ID) {
      entries.push(
        entry(user, {
          action: "CREATE_CANDIDATE_DOMAIN",
          status: "BLOCKED",
          reason: "CandidateProfile is missing a canonical Ogun State assignment.",
        }),
      );
      continue;
    }
    const existing = await database.candidate.findUnique({ where: { legacyUserId: user.id }, select: { id: true } });
    const missingRelationCount = existing
      ? (
          await Promise.all([
            database.adminCandidateAssignment.count({ where: { candidateUserId: user.id, candidateId: null } }),
            database.campaignEvent.count({ where: { candidateUserId: user.id, candidateId: null } }),
            database.poll.count({ where: { candidateUserId: user.id, candidateId: null } }),
            database.post.count({ where: { candidateUserId: user.id, candidateId: null } }),
            database.feedback.count({ where: { candidateUserId: user.id, candidateId: null } }),
          ])
        ).reduce((total, count) => total + count, 0)
      : 0;
    entries.push(
      entry(user, {
        action: existing ? "SYNC_CANDIDATE_DOMAIN_RELATIONS" : "CREATE_CANDIDATE_DOMAIN",
        status: existing && missingRelationCount === 0 ? "UNCHANGED" : "READY",
      }),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    entries,
    totals: {
      READY: entries.filter((item) => item.status === "READY").length,
      BLOCKED: entries.filter((item) => item.status === "BLOCKED").length,
      UNCHANGED: entries.filter((item) => item.status === "UNCHANGED").length,
    },
  };
}

async function writeMigrationAudit(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  userId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  await transaction.auditLog.create({
    data: {
      actorUserId,
      action,
      targetType: "User",
      targetId: userId,
      metadataJson: JSON.stringify(metadata),
    },
  });
}

export async function applyPhase1IdentityMigration(database: Database, actorUserId?: string) {
  const actor = actorUserId
    ? await database.user.findFirst({
        where: { id: actorUserId, role: "SUPER_ADMIN", isActive: true, accountStatus: "ACTIVE" },
        select: { id: true },
      })
    : await database.user.findFirst({
        where: { role: "SUPER_ADMIN", isActive: true, accountStatus: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
  if (!actor) {
    throw new Error("A valid Super Admin actor is required to apply the Phase 1 identity migration.");
  }

  const plan = await planPhase1IdentityMigration(database);
  for (const migration of plan.entries.filter((item) => item.status === "READY")) {
    if (migration.action === "SYNC_ACCOUNT_STATUS_INACTIVE") {
      await database.$transaction(async (transaction) => {
        const updated = await transaction.user.updateMany({
          where: { id: migration.userId, accountStatus: "ACTIVE", isActive: false },
          data: { accountStatus: "INACTIVE" },
        });
        if (updated.count > 0) {
          await writeMigrationAudit(transaction, actor.id, migration.userId, "ACCOUNT_STATUS_MIGRATED", {
            fromStatus: "ACTIVE",
            toStatus: "INACTIVE",
          });
        }
      });
      continue;
    }

    if (migration.action === "MAP_ADMIN_TO_STATE_OFFICER") {
      await database.$transaction(async (transaction) => {
        await transaction.user.update({ where: { id: migration.userId }, data: { role: "STATE_OFFICER" } });
        await writeMigrationAudit(transaction, actor.id, migration.userId, "LEGACY_ADMIN_MIGRATED", {
          fromRole: "ADMIN",
          toRole: "STATE_OFFICER",
        });
      });
      continue;
    }

    if (migration.action === "MAP_ADMIN_TO_COORDINATOR" || migration.action === "MAP_AGENT_TO_PU_COORDINATOR") {
      const assignment = migration.assignment!;
      await database.$transaction(async (transaction) => {
        await transaction.coordinatorProfile.upsert({
          where: { userId: migration.userId },
          create: { userId: migration.userId, ...assignment },
          update: assignment,
        });
        await transaction.user.update({ where: { id: migration.userId }, data: { role: "COORDINATOR" } });
        await writeMigrationAudit(transaction, actor.id, migration.userId, "LEGACY_USER_MIGRATED_TO_COORDINATOR", {
          fromRole: migration.sourceRole,
          toRole: "COORDINATOR",
          assignment,
          legacyProfilePreserved: true,
        });
      });
      continue;
    }

    if (migration.action === "MAP_VOTER_TO_MEMBER") {
      await database.$transaction(async (transaction) => {
        await transaction.user.update({ where: { id: migration.userId }, data: { role: "MEMBER" } });
        await writeMigrationAudit(transaction, actor.id, migration.userId, "LEGACY_VOTER_MIGRATED", {
          fromRole: "VOTER",
          toRole: "MEMBER",
          voterProfilePreserved: true,
        });
      });
      continue;
    }

    const user = await database.user.findUniqueOrThrow({
      where: { id: migration.userId },
      include: { candidateProfile: true },
    });
    const profile = user.candidateProfile!;
    await database.$transaction(async (transaction) => {
      let candidate = await transaction.candidate.findUnique({ where: { legacyUserId: user.id } });
      const created = !candidate;
      if (!candidate) {
        candidate = await transaction.candidate.create({
          data: {
            legacyUserId: user.id,
            fullName: user.name,
            officeType: profile.officeType,
            politicalPartyId: profile.politicalPartyId,
            portraitUrl: profile.portraitUrl,
            portraitAssetId: profile.portraitAssetId,
            campaignSlogan: profile.campaignSlogan,
            bio: profile.bio,
            websiteUrl: profile.websiteUrl,
            facebookUrl: profile.facebookUrl,
            instagramUrl: profile.instagramUrl,
            xUrl: profile.xUrl,
            isPublished: profile.isProfilePublished,
            isActive: user.isActive && user.accountStatus === "ACTIVE",
            stateId: profile.stateId!,
            senatorialDistrictId: profile.senatorialDistrictId,
            federalConstituencyId: profile.federalConstituencyId,
            stateConstituencyId: profile.stateConstituencyId,
            lgaId: profile.lgaId,
            wardId: profile.wardId,
            pollingUnitId: profile.pollingUnitId,
          },
        });
      }
      const [assignments, events, polls, posts, feedback] = await Promise.all([
        transaction.adminCandidateAssignment.updateMany({ where: { candidateUserId: user.id, candidateId: null }, data: { candidateId: candidate.id } }),
        transaction.campaignEvent.updateMany({ where: { candidateUserId: user.id, candidateId: null }, data: { candidateId: candidate.id } }),
        transaction.poll.updateMany({ where: { candidateUserId: user.id, candidateId: null }, data: { candidateId: candidate.id } }),
        transaction.post.updateMany({ where: { candidateUserId: user.id, candidateId: null }, data: { candidateId: candidate.id } }),
        transaction.feedback.updateMany({ where: { candidateUserId: user.id, candidateId: null }, data: { candidateId: candidate.id } }),
      ]);
      await writeMigrationAudit(transaction, actor.id, user.id, "LEGACY_CANDIDATE_DOMAIN_MIGRATED", {
        candidateId: candidate.id,
        created,
        legacyAuthenticationPreserved: true,
        relationshipsLinked: {
          assignments: assignments.count,
          events: events.count,
          polls: polls.count,
          posts: posts.count,
          feedback: feedback.count,
        },
      });
    });
  }

  return { ...plan, dryRun: false };
}

async function main() {
  const database = new PrismaClient();
  try {
    const apply = process.argv.includes("--apply");
    const actorArgument = process.argv.find((argument) => argument.startsWith("--actor-user-id="));
    const actorUserId = actorArgument?.slice("--actor-user-id=".length);
    const report = apply
      ? await applyPhase1IdentityMigration(database, actorUserId)
      : await planPhase1IdentityMigration(database);
    console.log(JSON.stringify(report, null, 2));
    if (!apply) {
      console.log("Dry run only. Re-run with --apply after reviewing every BLOCKED and READY entry.");
    }
  } finally {
    await database.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

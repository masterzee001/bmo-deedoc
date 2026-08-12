import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import {
  AgentActivityType,
  AssignmentPermissionType,
  CandidateOfficeType,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  NotificationType,
  Prisma,
  PrismaClient,
  RewardRedemptionStatus,
  RewardType,
  UserRole,
} from "@prisma/client";
import { OGUN_STATE_ID, normalizeEmail } from "@pics-nigeria/shared";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl?.startsWith("file:")) {
  const relativePath = databaseUrl.slice("file:".length);
  if (!path.isAbsolute(relativePath)) {
    process.env.DATABASE_URL = `file:${path.resolve(__dirname, relativePath)}`;
  }
}

const prisma = new PrismaClient();

/**
 * Seed territory, resolved from the real Ogun reference data.
 *
 * The platform operates in Ogun only (feature 001) and Ogun's structure is a
 * fixed, verified fact — nine federal constituencies, twenty LGAs and so on,
 * asserted by the reference-completeness checks. Inventing a seed constituency
 * inside Ogun therefore does not add convenience, it corrupts the reference
 * contract. So the seed attaches to territory that already exists rather than
 * fabricating its own, and only falls back to creating rows when the Ogun
 * reference set has not been imported yet.
 */
type SeedTerritory = {
  stateId: string;
  senatorialDistrictId: string;
  federalConstituencyId: string;
  stateConstituencyId: string;
  lgaId: string;
  wardIds: string[];
  pollingUnitId: string;
};

/**
 * Sample accounts need a place to stand, and in Ogun that place is defined by
 * authoritative reference data. When it has not been loaded the seed creates
 * users without territory-bound profiles rather than inventing an LGA or a
 * state constituency — those counts are verified, and an invented row fails the
 * command-hierarchy check for the entire platform.
 */

/** Ogun's own geo-political zone, read from reference data rather than assumed. */
async function ogunZoneId(): Promise<string | undefined> {
  const ogun = await prisma.state.findUnique({
    where: { id: OGUN_STATE_ID },
    select: { geoPoliticalZoneId: true },
  });
  return ogun?.geoPoliticalZoneId || undefined;
}

async function resolveSeedTerritory(): Promise<SeedTerritory | null> {
  await prisma.state.upsert({
    where: { id: OGUN_STATE_ID },
    update: {},
    create: { id: OGUN_STATE_ID, name: "Ogun" },
  });

  const [district, federal, lga, stateConstituency] = await Promise.all([
    prisma.senatorialDistrict.findFirst({ where: { stateId: OGUN_STATE_ID }, orderBy: { name: "asc" } }),
    prisma.federalConstituency.findFirst({ where: { stateId: OGUN_STATE_ID }, orderBy: { name: "asc" } }),
    prisma.lGA.findFirst({ where: { stateId: OGUN_STATE_ID }, orderBy: { name: "asc" } }),
    prisma.stateConstituency.findFirst({ where: { stateId: OGUN_STATE_ID }, orderBy: { name: "asc" } }),
  ]);
  if (!district || !federal || !lga || !stateConstituency) {
    return null;
  }

  const wards = await prisma.ward.findMany({
    where: { stateId: OGUN_STATE_ID, lgaId: lga.id },
    orderBy: { name: "asc" },
    take: 2,
  });
  if (wards.length === 0) {
    return null;
  }

  const pollingUnit = await prisma.pollingUnit.findFirst({
    where: { stateId: OGUN_STATE_ID, wardId: wards[0].id },
    orderBy: { name: "asc" },
  });
  if (!pollingUnit) {
    return null;
  }

  return {
    stateId: OGUN_STATE_ID,
    senatorialDistrictId: district.id,
    federalConstituencyId: federal.id,
    stateConstituencyId: stateConstituency.id,
    lgaId: lga.id,
    wardIds: wards.map((ward) => ward.id),
    pollingUnitId: pollingUnit.id,
  };
}


const sampleAccounts = {
  stateAdmin: {
    email: "state.admin@pics.ng",
    password: "StateAdmin123!",
    name: "Ogun State Admin",
  },
  candidate: {
    email: "candidate@pics.ng",
    password: "Candidate123!",
    name: "Kemi Adeyemi",
  },
  agent: {
    email: "agent@pics.ng",
    password: "Agent123!",
    name: "Bola Yusuf",
    phone: "08032222222",
  },
  voter: {
    email: "voter@pics.ng",
    password: "Voter123!",
    name: "Ada Okafor",
    phone: "08030000000",
    voterCardNumber: "VIN-SEEDED-0001",
    referralCode: "PICSSEED01",
  },
};

const sampleParty = {
  id: "seed-party-independent-alliance",
  code: "PIA",
  name: "Progressive Independent Alliance",
};

function getBootstrapConfig() {
  const fallback = {
    email: "superadmin@pics.ng",
    password: "ChangeMe123!",
    name: "PICS Nigeria Super Admin",
  };

  if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
    return {
      email: normalizeEmail(process.env.SUPER_ADMIN_EMAIL),
      password: process.env.SUPER_ADMIN_PASSWORD,
      name: process.env.SUPER_ADMIN_NAME?.trim() || fallback.name,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required in production.");
  }

  return fallback;
}

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  const territory = await resolveSeedTerritory();

  await prisma.politicalParty.upsert({
    where: { id: sampleParty.id },
    update: sampleParty,
    create: sampleParty,
  });

  const bootstrap = getBootstrapConfig();
  const hashedBootstrapPassword = await hash(bootstrap.password);
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
    select: { id: true, email: true },
  });

  const superAdmin = existingSuperAdmin
    ? await prisma.user.update({
        where: { id: existingSuperAdmin.id },
        data: {
          name: bootstrap.name,
          email: normalizeEmail(bootstrap.email),
          passwordHash: hashedBootstrapPassword,
          role: UserRole.SUPER_ADMIN,
        },
      })
    : await prisma.user.create({
        data: {
          name: bootstrap.name,
          email: normalizeEmail(bootstrap.email),
          passwordHash: hashedBootstrapPassword,
          role: UserRole.SUPER_ADMIN,
        },
      });

  if (!territory) {
    console.warn(
      "Ogun reference data is not loaded, so territory-bound sample accounts were skipped. " +
        "The super admin and political party are seeded; load the authoritative Ogun structure " +
        "and re-run the seed to create the sample state admin, candidate, agent and member.",
    );
    return;
  }

  const stateAdmin = await prisma.user.upsert({
    where: { email: normalizeEmail(sampleAccounts.stateAdmin.email) },
    update: {
      name: sampleAccounts.stateAdmin.name,
      passwordHash: await hash(sampleAccounts.stateAdmin.password),
      role: UserRole.ADMIN,
      adminProfile: {
        upsert: {
          update: {
            adminLevel: "STATE",
            politicalPartyId: sampleParty.id,
            geoPoliticalZoneId: (await ogunZoneId()),
            stateId: territory.stateId,
          },
          create: {
            adminLevel: "STATE",
            politicalPartyId: sampleParty.id,
            geoPoliticalZoneId: (await ogunZoneId()),
            stateId: territory.stateId,
          },
        },
      },
    },
    create: {
      name: sampleAccounts.stateAdmin.name,
      email: normalizeEmail(sampleAccounts.stateAdmin.email),
      passwordHash: await hash(sampleAccounts.stateAdmin.password),
      role: UserRole.ADMIN,
      adminProfile: {
        create: {
          adminLevel: "STATE",
          politicalPartyId: sampleParty.id,
          geoPoliticalZoneId: (await ogunZoneId()),
          stateId: territory.stateId,
        },
      },
    },
    include: { adminProfile: true },
  });

  const candidate = await prisma.user.upsert({
    where: { email: normalizeEmail(sampleAccounts.candidate.email) },
    update: {
      name: sampleAccounts.candidate.name,
      passwordHash: await hash(sampleAccounts.candidate.password),
      role: UserRole.CANDIDATE,
      candidateProfile: {
        upsert: {
          update: {
            officeType: CandidateOfficeType.HOUSE_OF_REP,
            geoPoliticalZoneId: (await ogunZoneId()),
            politicalPartyId: sampleParty.id,
            stateId: territory.stateId,
            senatorialDistrictId: territory.senatorialDistrictId,
            federalConstituencyId: territory.federalConstituencyId,
          },
          create: {
            officeType: CandidateOfficeType.HOUSE_OF_REP,
            geoPoliticalZoneId: (await ogunZoneId()),
            politicalPartyId: sampleParty.id,
            stateId: territory.stateId,
            senatorialDistrictId: territory.senatorialDistrictId,
            federalConstituencyId: territory.federalConstituencyId,
          },
        },
      },
    },
    create: {
      name: sampleAccounts.candidate.name,
      email: normalizeEmail(sampleAccounts.candidate.email),
      passwordHash: await hash(sampleAccounts.candidate.password),
      role: UserRole.CANDIDATE,
      candidateProfile: {
        create: {
          officeType: CandidateOfficeType.HOUSE_OF_REP,
          geoPoliticalZoneId: (await ogunZoneId()),
          politicalPartyId: sampleParty.id,
          stateId: territory.stateId,
          senatorialDistrictId: territory.senatorialDistrictId,
          federalConstituencyId: territory.federalConstituencyId,
        },
      },
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: normalizeEmail(sampleAccounts.agent.email) },
    update: {
      name: sampleAccounts.agent.name,
      phone: sampleAccounts.agent.phone,
      passwordHash: await hash(sampleAccounts.agent.password),
      role: UserRole.AGENT,
      agentProfile: {
        upsert: {
          update: {
            geoPoliticalZoneId: (await ogunZoneId()),
            stateId: territory.stateId,
            senatorialDistrictId: territory.senatorialDistrictId,
            federalConstituencyId: territory.federalConstituencyId,
            lgaId: territory.lgaId,
            wardId: territory.wardIds[0],
            stateConstituencyId: territory.stateConstituencyId,
            pollingUnitId: territory.pollingUnitId,
            assignedAdminUserId: stateAdmin.id,
          },
          create: {
            geoPoliticalZoneId: (await ogunZoneId()),
            stateId: territory.stateId,
            senatorialDistrictId: territory.senatorialDistrictId,
            federalConstituencyId: territory.federalConstituencyId,
            lgaId: territory.lgaId,
            wardId: territory.wardIds[0],
            stateConstituencyId: territory.stateConstituencyId,
            pollingUnitId: territory.pollingUnitId,
            assignedAdminUserId: stateAdmin.id,
          },
        },
      },
    },
    create: {
      name: sampleAccounts.agent.name,
      email: normalizeEmail(sampleAccounts.agent.email),
      phone: sampleAccounts.agent.phone,
      passwordHash: await hash(sampleAccounts.agent.password),
      role: UserRole.AGENT,
      agentProfile: {
        create: {
          geoPoliticalZoneId: (await ogunZoneId()),
          stateId: territory.stateId,
          senatorialDistrictId: territory.senatorialDistrictId,
          federalConstituencyId: territory.federalConstituencyId,
          lgaId: territory.lgaId,
          wardId: territory.wardIds[0],
          stateConstituencyId: territory.stateConstituencyId,
          pollingUnitId: territory.pollingUnitId,
          assignedAdminUserId: stateAdmin.id,
        },
      },
    },
  });

  const seededVoterProfile: Prisma.VoterProfileUncheckedCreateWithoutUserInput = {
    voterCardNumber: sampleAccounts.voter.voterCardNumber,
    referralCode: sampleAccounts.voter.referralCode,
    geoPoliticalZoneId: (await ogunZoneId()),
    stateId: territory.stateId,
    senatorialDistrictId: territory.senatorialDistrictId,
    federalConstituencyId: territory.federalConstituencyId,
    lgaId: territory.lgaId,
    wardId: territory.wardIds[0],
    stateConstituencyId: territory.stateConstituencyId,
    pollingUnitId: territory.pollingUnitId,
  };

  const seededVoterProfileUpdate: Prisma.VoterProfileUncheckedUpdateWithoutUserInput = {
    voterCardNumber: sampleAccounts.voter.voterCardNumber,
    referralCode: sampleAccounts.voter.referralCode,
    geoPoliticalZoneId: (await ogunZoneId()),
    stateId: territory.stateId,
    senatorialDistrictId: territory.senatorialDistrictId,
    federalConstituencyId: territory.federalConstituencyId,
    lgaId: territory.lgaId,
    wardId: territory.wardIds[0],
    stateConstituencyId: territory.stateConstituencyId,
    pollingUnitId: territory.pollingUnitId,
  };

  const voter = await prisma.user.upsert({
    where: { email: normalizeEmail(sampleAccounts.voter.email) },
    update: {
      name: sampleAccounts.voter.name,
      phone: sampleAccounts.voter.phone,
      passwordHash: await hash(sampleAccounts.voter.password),
      role: UserRole.VOTER,
      voterProfile: {
        upsert: {
          update: seededVoterProfileUpdate,
          create: seededVoterProfile,
        },
      },
    },
    create: {
      name: sampleAccounts.voter.name,
      email: normalizeEmail(sampleAccounts.voter.email),
      phone: sampleAccounts.voter.phone,
      passwordHash: await hash(sampleAccounts.voter.password),
      role: UserRole.VOTER,
      voterProfile: {
        create: seededVoterProfile,
      },
    },
  });

  await prisma.adminCandidateAssignment.upsert({
    where: {
      adminUserId_candidateUserId_permissionType: {
        adminUserId: stateAdmin.id,
        candidateUserId: candidate.id,
        permissionType: AssignmentPermissionType.MANAGE,
      },
    },
    update: {},
    create: {
      adminUserId: stateAdmin.id,
      candidateUserId: candidate.id,
      permissionType: AssignmentPermissionType.MANAGE,
    },
  });

  await prisma.rewardLedger.upsert({
    where: {
      voterUserId_type_relatedUserId: {
        voterUserId: voter.id,
        type: RewardType.PARTICIPATION,
        relatedUserId: candidate.id,
      },
    },
    update: {
      points: 5,
      description: "Seeded participation reward",
    },
    create: {
      voterUserId: voter.id,
      type: RewardType.PARTICIPATION,
      points: 5,
      description: "Seeded participation reward",
      relatedUserId: candidate.id,
    },
  });

  const poll = await prisma.poll.upsert({
    where: { id: "seed-poll-house-of-rep" },
    update: {
      title: "Who is your preferred House of Representatives candidate?",
      description: "Starter sentiment poll",
      candidateUserId: candidate.id,
      officeType: CandidateOfficeType.HOUSE_OF_REP,
      geoPoliticalZoneId: (await ogunZoneId()),
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      federalConstituencyId: territory.federalConstituencyId,
      createdByUserId: superAdmin.id,
      isActive: true,
    },
    create: {
      id: "seed-poll-house-of-rep",
      title: "Who is your preferred House of Representatives candidate?",
      description: "Starter sentiment poll",
      candidateUserId: candidate.id,
      officeType: CandidateOfficeType.HOUSE_OF_REP,
      geoPoliticalZoneId: (await ogunZoneId()),
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      federalConstituencyId: territory.federalConstituencyId,
      createdByUserId: superAdmin.id,
      isActive: true,
    },
  });

  await prisma.pollOption.upsert({
    where: {
      pollId_label: {
        pollId: poll.id,
        label: "Kemi Adeyemi",
      },
    },
    update: {},
    create: {
      pollId: poll.id,
      label: "Kemi Adeyemi",
    },
  });

  await prisma.pollOption.upsert({
    where: {
      pollId_label: {
        pollId: poll.id,
        label: "Undecided",
      },
    },
    update: {},
    create: {
      pollId: poll.id,
      label: "Undecided",
    },
  });

  const post = await prisma.post.upsert({
    where: { id: "seed-post-campaign" },
    update: {
      authorUserId: candidate.id,
      candidateUserId: candidate.id,
      title: "Our campaign priorities",
      content: "We are focused on jobs, accountability, and local development.",
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      federalConstituencyId: territory.federalConstituencyId,
      isPublished: true,
    },
    create: {
      id: "seed-post-campaign",
      authorUserId: candidate.id,
      candidateUserId: candidate.id,
      title: "Our campaign priorities",
      content: "We are focused on jobs, accountability, and local development.",
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      federalConstituencyId: territory.federalConstituencyId,
      isPublished: true,
    },
  });

  await prisma.feedback.upsert({
    where: { id: "seed-feedback-1" },
    update: {
      voterUserId: voter.id,
      candidateUserId: candidate.id,
      geoPoliticalZoneId: (await ogunZoneId()),
      type: "GENERAL_FEEDBACK",
      message: "Road access and youth employment should stay top priorities.",
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      lgaId: territory.lgaId,
      wardId: territory.wardIds[0],
      pollingUnitId: territory.pollingUnitId,
    },
    create: {
      id: "seed-feedback-1",
      voterUserId: voter.id,
      candidateUserId: candidate.id,
      geoPoliticalZoneId: (await ogunZoneId()),
      type: "GENERAL_FEEDBACK",
      message: "Road access and youth employment should stay top priorities.",
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      lgaId: territory.lgaId,
      wardId: territory.wardIds[0],
      pollingUnitId: territory.pollingUnitId,
    },
  });

  await prisma.agentActivity.upsert({
    where: { id: "seed-agent-activity-1" },
    update: {
      agentUserId: agent.id,
      type: AgentActivityType.CHECK_IN,
      latitude: 6.6018,
      longitude: 3.3515,
      accuracyMeters: 15,
      note: "Seeded morning check-in",
      geoPoliticalZoneId: (await ogunZoneId()),
      stateId: territory.stateId,
      lgaId: territory.lgaId,
      wardId: territory.wardIds[0],
      pollingUnitId: territory.pollingUnitId,
    },
    create: {
      id: "seed-agent-activity-1",
      agentUserId: agent.id,
      type: AgentActivityType.CHECK_IN,
      latitude: 6.6018,
      longitude: 3.3515,
      accuracyMeters: 15,
      note: "Seeded morning check-in",
      geoPoliticalZoneId: (await ogunZoneId()),
      stateId: territory.stateId,
      lgaId: territory.lgaId,
      wardId: territory.wardIds[0],
      pollingUnitId: territory.pollingUnitId,
    },
  });

  await prisma.incident.upsert({
    where: { id: "seed-incident-1" },
    update: {
      reportedByUserId: agent.id,
      type: IncidentType.MATERIAL_SHORTAGE,
      title: "Campaign materials running low",
      description: "Leaflets and shirts are almost exhausted at the unit.",
      severity: IncidentSeverity.MEDIUM,
      status: IncidentStatus.OPEN,
      latitude: 6.6018,
      longitude: 3.3515,
      geoPoliticalZoneId: (await ogunZoneId()),
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      lgaId: territory.lgaId,
      wardId: territory.wardIds[0],
      pollingUnitId: territory.pollingUnitId,
      assignedAdminUserId: stateAdmin.id,
      escalatedAt: new Date("2026-03-09T10:00:00.000Z"),
      escalatedByUserId: superAdmin.id,
      escalationNote: "Escalated for urgent logistics follow-up.",
    },
    create: {
      id: "seed-incident-1",
      reportedByUserId: agent.id,
      type: IncidentType.MATERIAL_SHORTAGE,
      title: "Campaign materials running low",
      description: "Leaflets and shirts are almost exhausted at the unit.",
      severity: IncidentSeverity.MEDIUM,
      status: IncidentStatus.OPEN,
      latitude: 6.6018,
      longitude: 3.3515,
      geoPoliticalZoneId: (await ogunZoneId()),
      stateId: territory.stateId,
      senatorialDistrictId: territory.senatorialDistrictId,
      lgaId: territory.lgaId,
      wardId: territory.wardIds[0],
      pollingUnitId: territory.pollingUnitId,
      assignedAdminUserId: stateAdmin.id,
      escalatedAt: new Date("2026-03-09T10:00:00.000Z"),
      escalatedByUserId: superAdmin.id,
      escalationNote: "Escalated for urgent logistics follow-up.",
    },
  });

  await prisma.rewardRedemption.upsert({
    where: { id: "seed-redemption-1" },
    update: {
      voterUserId: voter.id,
      pointsRequested: 10,
      // No amount. A pending redemption carries no monetary figure until
      // approval values it through the payout authority; seeding one would put
      // an amount nothing computed in front of the approve and paid routes.
      amountRequested: null,
      status: RewardRedemptionStatus.PENDING,
      note: "Seeded cashout request",
    },
    create: {
      id: "seed-redemption-1",
      voterUserId: voter.id,
      pointsRequested: 10,
      // No amount. A pending redemption carries no monetary figure until
      // approval values it through the payout authority; seeding one would put
      // an amount nothing computed in front of the approve and paid routes.
      amountRequested: null,
      status: RewardRedemptionStatus.PENDING,
      note: "Seeded cashout request",
    },
  });

  await prisma.notification.upsert({
    where: { id: "seed-notification-1" },
    update: {
      userId: voter.id,
      type: NotificationType.REWARD_REDEMPTION,
      title: "Redemption request received",
      message: "Your sample redemption request is pending review.",
      isRead: false,
    },
    create: {
      id: "seed-notification-1",
      userId: voter.id,
      type: NotificationType.REWARD_REDEMPTION,
      title: "Redemption request received",
      message: "Your sample redemption request is pending review.",
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: { id: "seed-notification-2" },
    update: {
      userId: stateAdmin.id,
      type: NotificationType.INCIDENT_ASSIGNED,
      title: "Incident assigned",
      message: "A seeded incident is assigned to your admin account.",
      isRead: false,
    },
    create: {
      id: "seed-notification-2",
      userId: stateAdmin.id,
      type: NotificationType.INCIDENT_ASSIGNED,
      title: "Incident assigned",
      message: "A seeded incident is assigned to your admin account.",
      isRead: false,
    },
  });

  await prisma.auditLog.upsert({
    where: { id: "seed-audit-log-1" },
    update: {
      actorUserId: superAdmin.id,
      action: "INCIDENT_ESCALATED",
      targetType: "Incident",
      targetId: "seed-incident-1",
      metadataJson: JSON.stringify({ escalationNote: "Escalated for urgent logistics follow-up." }),
    },
    create: {
      id: "seed-audit-log-1",
      actorUserId: superAdmin.id,
      action: "INCIDENT_ESCALATED",
      targetType: "Incident",
      targetId: "seed-incident-1",
      metadataJson: JSON.stringify({ escalationNote: "Escalated for urgent logistics follow-up." }),
    },
  });

  await prisma.participationEvent.upsert({
    where: { id: "seed-participation-1" },
    update: {
      voterUserId: voter.id,
      type: "POLL_RESPONSE",
      description: "Seeded poll participation",
      pointsAwarded: 5,
      relatedPollId: poll.id,
      relatedPostId: post.id,
    },
    create: {
      id: "seed-participation-1",
      voterUserId: voter.id,
      type: "POLL_RESPONSE",
      description: "Seeded poll participation",
      pointsAwarded: 5,
      relatedPollId: poll.id,
      relatedPostId: post.id,
    },
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

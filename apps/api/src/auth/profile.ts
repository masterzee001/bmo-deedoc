import { emptyTerritorySummary, type AuthUserProfile, type TerritorySummary } from "@pics-nigeria/shared";
import { prisma } from "../prisma";

function toTerritorySummary(source: {
  geoPoliticalZoneId?: string | null;
  stateId: string | null;
  senatorialDistrictId?: string | null;
  federalConstituencyId?: string | null;
  lgaId?: string | null;
  wardId?: string | null;
  stateConstituencyId?: string | null;
  pollingUnitId?: string | null;
}): TerritorySummary {
  return {
    ...emptyTerritorySummary(),
    geoPoliticalZoneId: source.geoPoliticalZoneId ?? null,
    stateId: source.stateId ?? null,
    senatorialDistrictId: source.senatorialDistrictId ?? null,
    federalConstituencyId: source.federalConstituencyId ?? null,
    lgaId: source.lgaId ?? null,
    wardId: source.wardId ?? null,
    stateConstituencyId: source.stateConstituencyId ?? null,
    pollingUnitId: source.pollingUnitId ?? null,
  };
}

export async function getAuthUserProfile(userId: string): Promise<AuthUserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      adminProfile: true,
      candidateProfile: true,
      voterProfile: true,
      agentProfile: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    adminProfile: user.adminProfile
      ? {
          adminLevel: user.adminProfile.adminLevel,
          politicalPartyId: user.adminProfile.politicalPartyId,
          ...toTerritorySummary(user.adminProfile),
        }
      : null,
    candidateProfile: user.candidateProfile
      ? {
          officeType: user.candidateProfile.officeType,
          politicalPartyId: user.candidateProfile.politicalPartyId,
          ...toTerritorySummary(user.candidateProfile),
        }
      : null,
    voterProfile: user.voterProfile
      ? {
          voterCardNumber: user.voterProfile.voterCardNumber,
          referralCode: user.voterProfile.referralCode,
          referredByUserId: user.voterProfile.referredByUserId,
          ...toTerritorySummary(user.voterProfile),
        }
      : null,
    agentProfile: user.agentProfile
      ? {
          politicalPartyId: user.agentProfile.politicalPartyId,
          gpsTrackingConsentAt: user.agentProfile.gpsTrackingConsentAt?.toISOString() || null,
          ...toTerritorySummary(user.agentProfile),
        }
      : null,
  };
}

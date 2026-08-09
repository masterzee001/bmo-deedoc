import type { PrismaClient } from "@prisma/client";
import {
  OGUN_STATE_ID,
  type AuthUserProfile,
  type OgunOrganizationTree,
} from "@pics-nigeria/shared";

export type OrganizationTreeBlocker = {
  code: string;
  count: number;
};

export class OrganizationTreeReferenceError extends Error {
  constructor(readonly blockers: OrganizationTreeBlocker[]) {
    super("The Ogun command hierarchy is incomplete and cannot be used operationally.");
  }
}

const expectedOgunCounts = {
  senatorialDistricts: 3,
  federalConstituencies: 9,
  stateConstituencies: 26,
  lgas: 20,
} as const;

function activeCoordinators(
  profiles: Array<{
    user: { id: string; name: string; role: string; isActive: boolean; accountStatus: string };
  }>,
) {
  return profiles
    .filter(
      ({ user }) => user.role === "COORDINATOR" && user.isActive && user.accountStatus === "ACTIVE",
    )
    .map(({ user }) => ({ userId: user.id, name: user.name }));
}

export async function loadOgunOrganizationTree(database: PrismaClient): Promise<OgunOrganizationTree> {
  const [state, stateOfficers, referenceCounts, blockerCounts] = await Promise.all([
    database.state.findUnique({
      where: { id: OGUN_STATE_ID },
      select: {
        id: true,
        name: true,
        senatorialDistricts: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            coordinatorProfiles: {
              where: { level: "SENATORIAL_DISTRICT" },
              select: { user: { select: { id: true, name: true, role: true, isActive: true, accountStatus: true } } },
            },
            federalConstituencies: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                coordinatorProfiles: {
                  where: { level: "FEDERAL_CONSTITUENCY" },
                  select: { user: { select: { id: true, name: true, role: true, isActive: true, accountStatus: true } } },
                },
                stateConstituencies: {
                  orderBy: { name: "asc" },
                  select: {
                    id: true,
                    name: true,
                    coordinatorProfiles: {
                      where: { level: "STATE_CONSTITUENCY" },
                      select: { user: { select: { id: true, name: true, role: true, isActive: true, accountStatus: true } } },
                    },
                    wards: {
                      orderBy: { name: "asc" },
                      select: {
                        id: true,
                        name: true,
                        coordinatorProfiles: {
                          where: { level: "WARD" },
                          select: { user: { select: { id: true, name: true, role: true, isActive: true, accountStatus: true } } },
                        },
                        pollingUnits: {
                          orderBy: { name: "asc" },
                          select: {
                            id: true,
                            name: true,
                            coordinatorProfiles: {
                              where: { level: "POLLING_UNIT" },
                              select: { user: { select: { id: true, name: true, role: true, isActive: true, accountStatus: true } } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    database.user.findMany({
      where: { role: "STATE_OFFICER", isActive: true, accountStatus: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    Promise.all([
      database.senatorialDistrict.count({ where: { stateId: OGUN_STATE_ID } }),
      database.federalConstituency.count({ where: { stateId: OGUN_STATE_ID } }),
      database.stateConstituency.count({ where: { stateId: OGUN_STATE_ID } }),
      database.lGA.count({ where: { stateId: OGUN_STATE_ID } }),
    ]),
    Promise.all([
      database.senatorialDistrict.count({
        where: { stateId: OGUN_STATE_ID, federalConstituencies: { none: {} } },
      }),
      database.federalConstituency.count({
        where: { stateId: OGUN_STATE_ID, stateConstituencies: { none: {} } },
      }),
      database.stateConstituency.count({
        where: { stateId: OGUN_STATE_ID, federalConstituencyId: null },
      }),
      database.stateConstituency.count({
        where: { stateId: OGUN_STATE_ID, wards: { none: {} } },
      }),
      database.ward.count({ where: { stateId: OGUN_STATE_ID, stateConstituencyId: null } }),
      database.ward.count({ where: { stateId: OGUN_STATE_ID, pollingUnits: { none: {} } } }),
    ]),
  ]);

  if (!state) {
    throw new OrganizationTreeReferenceError([{ code: "OGUN_STATE_MISSING", count: 1 }]);
  }

  const blockerCodes = [
    "SENATORIAL_WITHOUT_FEDERAL",
    "FEDERAL_WITHOUT_STATE_CONSTITUENCY",
    "STATE_CONSTITUENCY_WITHOUT_FEDERAL_PARENT",
    "STATE_CONSTITUENCY_WITHOUT_WARD",
    "WARD_WITHOUT_STATE_CONSTITUENCY_PARENT",
    "WARD_WITHOUT_POLLING_UNIT",
  ];
  const referenceCountBlockers = [
    { code: "OGUN_SENATORIAL_DISTRICT_COUNT", actual: referenceCounts[0], expected: expectedOgunCounts.senatorialDistricts },
    { code: "OGUN_FEDERAL_CONSTITUENCY_COUNT", actual: referenceCounts[1], expected: expectedOgunCounts.federalConstituencies },
    { code: "OGUN_STATE_CONSTITUENCY_COUNT", actual: referenceCounts[2], expected: expectedOgunCounts.stateConstituencies },
    { code: "OGUN_LGA_REFERENCE_COUNT", actual: referenceCounts[3], expected: expectedOgunCounts.lgas },
  ]
    .filter((item) => item.actual !== item.expected)
    .map((item) => ({ code: item.code, count: item.actual }));
  const structuralBlockers = blockerCounts
    .map((count, index) => ({ code: blockerCodes[index], count }))
    .filter((item) => item.count > 0);
  const blockers = [...referenceCountBlockers, ...structuralBlockers];
  if (blockers.length > 0) {
    throw new OrganizationTreeReferenceError(blockers);
  }

  return {
    id: state.id,
    name: state.name,
    stateOfficers: stateOfficers.map((user) => ({ userId: user.id, name: user.name })),
    senatorialDistricts: state.senatorialDistricts.map((senatorial) => ({
      id: senatorial.id,
      name: senatorial.name,
      coordinators: activeCoordinators(senatorial.coordinatorProfiles),
      federalConstituencies: senatorial.federalConstituencies.map((federal) => ({
        id: federal.id,
        name: federal.name,
        coordinators: activeCoordinators(federal.coordinatorProfiles),
        stateConstituencies: federal.stateConstituencies.map((stateConstituency) => ({
          id: stateConstituency.id,
          name: stateConstituency.name,
          coordinators: activeCoordinators(stateConstituency.coordinatorProfiles),
          wards: stateConstituency.wards.map((ward) => ({
            id: ward.id,
            name: ward.name,
            coordinators: activeCoordinators(ward.coordinatorProfiles),
            pollingUnits: ward.pollingUnits.map((pollingUnit) => ({
              id: pollingUnit.id,
              name: pollingUnit.name,
              coordinators: activeCoordinators(pollingUnit.coordinatorProfiles),
            })),
          })),
        })),
      })),
    })),
  };
}

export function scopeOrganizationTree(
  tree: OgunOrganizationTree,
  profile: NonNullable<AuthUserProfile["coordinatorProfile"]>,
): OgunOrganizationTree {
  const senatorialDistricts = tree.senatorialDistricts
    .filter((senatorial) => senatorial.id === profile.senatorialDistrictId)
    .map((senatorial) => ({
      ...senatorial,
      federalConstituencies:
        profile.level === "SENATORIAL_DISTRICT"
          ? senatorial.federalConstituencies
          : senatorial.federalConstituencies
              .filter((federal) => federal.id === profile.federalConstituencyId)
              .map((federal) => ({
                ...federal,
                stateConstituencies:
                  profile.level === "FEDERAL_CONSTITUENCY"
                    ? federal.stateConstituencies
                    : federal.stateConstituencies
                        .filter((stateConstituency) => stateConstituency.id === profile.stateConstituencyId)
                        .map((stateConstituency) => ({
                          ...stateConstituency,
                          wards:
                            profile.level === "STATE_CONSTITUENCY"
                              ? stateConstituency.wards
                              : stateConstituency.wards
                                  .filter((ward) => ward.id === profile.wardId)
                                  .map((ward) => ({
                                    ...ward,
                                    pollingUnits:
                                      profile.level === "WARD"
                                        ? ward.pollingUnits
                                        : ward.pollingUnits.filter(
                                            (pollingUnit) => pollingUnit.id === profile.pollingUnitId,
                                          ),
                                  })),
                        })),
              })),
    }));

  return { ...tree, stateOfficers: [], senatorialDistricts };
}

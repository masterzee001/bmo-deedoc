import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "./app";
import { hashPassword } from "./auth/password";
import { prisma } from "./prisma";

type ApiResult = { status: number; payload: Record<string, unknown> };

const password = "PreElection123!";
const stateId = "ng-state-ogun";
const senatorialDistrictId = "pre-election-test-sen";
const federalConstituencyId = "pre-election-test-fed";
const stateConstituencyId = "pre-election-test-state-const";
const lgaId = "pre-election-test-lga";
const wardId = "pre-election-test-ward";
const pollingUnitId = "pre-election-test-pu";
const emailPrefix = "pre-election-test";

let baseUrl = "";
let server: http.Server | null = null;

async function apiRequest(path: string, options?: { token?: string; method?: string; body?: unknown }): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method || "GET",
    headers: {
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, payload: (await response.json()) as Record<string, unknown> };
}

async function login(email: string) {
  const result = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  assert.equal(typeof result.payload.token, "string");
  return result.payload.token as string;
}

function testEmail(label: string) {
  return `${emailPrefix}-${label}@pics.ng`;
}

async function createTerritoryFixtures() {
  await prisma.state.upsert({
    where: { id: stateId },
    update: { name: "Ogun" },
    create: { id: stateId, name: "Ogun" },
  });
  await prisma.lGA.upsert({
    where: { id: lgaId },
    update: { name: "Pre Election Test LGA", stateId },
    create: { id: lgaId, name: "Pre Election Test LGA", stateId },
  });
  await prisma.senatorialDistrict.upsert({
    where: { id: senatorialDistrictId },
    update: { name: "Pre Election Test Senatorial", stateId },
    create: { id: senatorialDistrictId, name: "Pre Election Test Senatorial", stateId },
  });
  await prisma.federalConstituency.upsert({
    where: { id: federalConstituencyId },
    update: { name: "Pre Election Test Federal", stateId, senatorialDistrictId },
    create: { id: federalConstituencyId, name: "Pre Election Test Federal", stateId, senatorialDistrictId },
  });
  await prisma.stateConstituency.upsert({
    where: { id: stateConstituencyId },
    update: { name: "Pre Election Test State Constituency", stateId, lgaId, federalConstituencyId },
    create: { id: stateConstituencyId, name: "Pre Election Test State Constituency", stateId, lgaId, federalConstituencyId },
  });
  await prisma.ward.upsert({
    where: { id: wardId },
    update: { name: "Pre Election Test Ward", stateId, lgaId, stateConstituencyId },
    create: { id: wardId, name: "Pre Election Test Ward", stateId, lgaId, stateConstituencyId },
  });
  await prisma.pollingUnit.upsert({
    where: { id: pollingUnitId },
    update: { name: "Pre Election Test Polling Unit", stateId, lgaId, wardId },
    create: { id: pollingUnitId, name: "Pre Election Test Polling Unit", stateId, lgaId, wardId },
  });
}

async function createUserFixtures() {
  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      name: "Pre Election Test Super Admin",
      email: testEmail("super-admin"),
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  await prisma.user.create({
    data: {
      name: "Pre Election Test Validator",
      email: testEmail("validator"),
      passwordHash,
      role: "VALIDATOR",
    },
  });
  await prisma.user.create({
    data: {
      name: "Pre Election Test Payout Officer",
      email: testEmail("payout"),
      passwordHash,
      role: "PAYOUT_OFFICER",
    },
  });
  await prisma.user.create({
    data: {
      name: "Pre Election Test Other Payout Officer",
      email: testEmail("payout-other"),
      passwordHash,
      role: "PAYOUT_OFFICER",
    },
  });
  await prisma.user.create({
    data: {
      name: "Pre Election Test Coordinator",
      email: testEmail("coordinator"),
      passwordHash,
      role: "COORDINATOR",
      coordinatorProfile: {
        create: {
          level: "WARD",
          stateId,
          senatorialDistrictId,
          federalConstituencyId,
          stateConstituencyId,
          wardId,
        },
      },
    },
  });
}

async function registerMember(label: string, referralCode: string | null, sha256: string) {
  const response = await apiRequest("/auth/register-voter", {
    method: "POST",
    body: {
      fullName: `Pre Election Test Member ${label}`,
      email: testEmail(`member-${label}`),
      phone: `08030000${label.padStart(3, "0")}`,
      password,
      voterCardNumber: `PRE-ELECTION-VIN-${label}`,
      stateId,
      senatorialDistrictId,
      federalConstituencyId,
      stateConstituencyId,
      lgaId,
      wardId,
      pollingUnitId,
      referredByCode: referralCode || undefined,
      acceptTerms: true,
      acceptPrivacy: true,
      contactConsent: true,
      documentProcessingConsent: true,
      confirmAdult: true,
      consentVersion: "pre-election-test-v1",
      voterDocument: {
        originalStorageKey: `voter-verification/test/${label}/${cryptoSafeKey(label)}`,
        originalFileName: `${label}.pdf`,
        mimeType: "application/pdf",
        fileSize: 1024,
        sha256,
      },
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.payload));
  return response.payload.user as { id: string; email: string };
}

function cryptoSafeKey(label: string) {
  return `${label}-aaaaaaaaaaaaaaaaaaaaaaaa`;
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: emailPrefix } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  if (userIds.length > 0) {
    await prisma.payoutTransaction.deleteMany({
      where: { OR: [{ payoutOfficerUserId: { in: userIds } }, { payoutAssignment: { beneficiaryUserId: { in: userIds } } }] },
    });
    await prisma.payoutAssignment.deleteMany({
      where: { OR: [{ payoutOfficerUserId: { in: userIds } }, { beneficiaryUserId: { in: userIds } }] },
    });
    await prisma.payoutBatch.deleteMany({ where: { assignments: { none: {} } } });
    await prisma.payoutCycle.deleteMany({ where: { batches: { none: {} }, assignments: { none: {} } } });
    await prisma.payoutConfiguration.deleteMany({ where: { createdByUserId: { in: userIds } } });
    await prisma.territoryStrengthSnapshot.deleteMany({ where: { territoryId: { in: [stateId, wardId, pollingUnitId] } } });
    await prisma.territoryMetricSnapshot.deleteMany({ where: { territoryId: { in: [stateId, wardId, pollingUnitId] } } });
    await prisma.territoryTarget.deleteMany({ where: { createdByUserId: { in: userIds } } });
    await prisma.strengthWeightConfiguration.deleteMany({ where: { createdByUserId: { in: userIds } } });
    await prisma.strengthMetricDefinition.deleteMany({ where: { createdByUserId: { in: userIds } } });
    await prisma.rewardLedgerEntry.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { relatedUserId: { in: userIds } }] },
    });
    await prisma.rewardEvent.deleteMany({
      where: { OR: [{ referral: { referrerUserId: { in: userIds } } }, { referral: { referredUserId: { in: userIds } } }] },
    });
    await prisma.rewardRuleVersion.deleteMany({
      where: { rewardRule: { createdByUserId: { in: userIds } } },
    });
    await prisma.rewardRule.deleteMany({ where: { createdByUserId: { in: userIds } } });
    await prisma.referral.deleteMany({
      where: { OR: [{ referrerUserId: { in: userIds } }, { referredUserId: { in: userIds } }] },
    });
    await prisma.referralCode.deleteMany({ where: { ownerUserId: { in: userIds } } });
    await prisma.voterVerification.deleteMany({ where: { memberUserId: { in: userIds } } });
    await prisma.rewardLedger.deleteMany({
      where: { OR: [{ voterUserId: { in: userIds } }, { relatedUserId: { in: userIds } }] },
    });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await prisma.pollingUnit.deleteMany({ where: { id: pollingUnitId } });
  await prisma.ward.deleteMany({ where: { id: wardId } });
  await prisma.stateConstituency.deleteMany({ where: { id: stateConstituencyId } });
  await prisma.federalConstituency.deleteMany({ where: { id: federalConstituencyId } });
  await prisma.senatorialDistrict.deleteMany({ where: { id: senatorialDistrictId } });
  await prisma.lGA.deleteMany({ where: { id: lgaId } });
}

export async function runPreElectionTests() {
  await cleanup();
  await createTerritoryFixtures();
  await createUserFixtures();

  server = createApp().listen(0);
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const superAdminToken = await login(testEmail("super-admin"));
    const validatorToken = await login(testEmail("validator"));
    const coordinatorToken = await login(testEmail("coordinator"));
    const payoutToken = await login(testEmail("payout"));
    const otherPayoutToken = await login(testEmail("payout-other"));

    const validatorRuleAttempt = await apiRequest("/pre-election/reward-rules", {
      method: "POST",
      token: validatorToken,
      body: { name: "Validator forbidden rule", directPoints: 10 },
    });
    assert.equal(validatorRuleAttempt.status, 403);

    const payoutDecisionAttempt = await apiRequest("/pre-election/verifications/missing/decision", {
      method: "PATCH",
      token: payoutToken,
      body: { decision: "APPROVE" },
    });
    assert.equal(payoutDecisionAttempt.status, 403);

    const rule = await apiRequest("/pre-election/reward-rules", {
      method: "POST",
      token: superAdminToken,
      body: { name: "Verified referral coordinator rule", directPoints: 25, eligibleRole: "COORDINATOR" },
    });
    assert.equal(rule.status, 201, JSON.stringify(rule.payload));

    const referralCodeResponse = await apiRequest("/pre-election/referral-code", { token: coordinatorToken });
    assert.equal(referralCodeResponse.status, 200, JSON.stringify(referralCodeResponse.payload));
    assert.equal(typeof referralCodeResponse.payload.referralCode, "string");

    const referredMember = await registerMember(
      "001",
      referralCodeResponse.payload.referralCode as string,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const referrer = await prisma.user.findUniqueOrThrow({ where: { email: testEmail("coordinator") }, select: { id: true } });

    assert.equal(await prisma.rewardLedger.count({ where: { voterUserId: referrer.id } }), 0);
    assert.equal(await prisma.rewardLedgerEntry.count({ where: { userId: referrer.id } }), 0);

    const referral = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referredMember.id } });
    assert.equal(referral.status, "PENDING_VERIFICATION");

    const queue = await apiRequest("/pre-election/verifications?status=PENDING", { token: validatorToken });
    assert.equal(queue.status, 200, JSON.stringify(queue.payload));
    const cases = queue.payload.verifications as Array<{ id: string; documents: Array<{ id: string }> }>;
    const verificationCase = cases.find((item) => item.id);
    assert.ok(verificationCase);

    const access = await apiRequest(
      `/pre-election/verifications/${verificationCase.id}/documents/${verificationCase.documents[0].id}/access`,
      { token: validatorToken },
    );
    assert.equal(access.status, 200, JSON.stringify(access.payload));
    assert.equal(typeof access.payload.accessToken, "string");
    assert.equal(/^https?:\/\//i.test(access.payload.storageKey as string), false);

    const claim = await apiRequest(`/pre-election/verifications/${verificationCase.id}/claim`, {
      method: "POST",
      token: validatorToken,
    });
    assert.equal(claim.status, 200, JSON.stringify(claim.payload));

    const approve = await apiRequest(`/pre-election/verifications/${verificationCase.id}/decision`, {
      method: "PATCH",
      token: validatorToken,
      body: { decision: "APPROVE", note: "Evidence matched voter record." },
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.payload));

    assert.equal(await prisma.rewardLedgerEntry.count({ where: { userId: referrer.id, category: "VERIFIED_REFERRAL" } }), 1);
    const processedReferral = await prisma.referral.findUniqueOrThrow({ where: { id: referral.id } });
    assert.equal(processedReferral.status, "REWARD_PROCESSED");

    const rewardBalance = await apiRequest(`/pre-election/rewards/balance?userId=${referrer.id}`, {
      token: superAdminToken,
    });
    assert.equal(rewardBalance.status, 200, JSON.stringify(rewardBalance.payload));
    assert.equal(rewardBalance.payload.confirmedPoints, 25);
    assert.equal(rewardBalance.payload.availablePoints, 25);

    const referralStats = await apiRequest(`/pre-election/referrals/stats?territoryType=WARD&territoryId=${wardId}`, {
      token: coordinatorToken,
    });
    assert.equal(referralStats.status, 200, JSON.stringify(referralStats.payload));
    assert.equal(referralStats.payload.directRegistrations, 1);
    assert.equal(referralStats.payload.directVerifiedRegistrations, 1);

    const payoutConfigDenied = await apiRequest("/pre-election/payout/configurations", {
      method: "POST",
      token: payoutToken,
      body: { minimumPoints: 25, pointConversionRate: 2, frequency: "WEEKLY" },
    });
    assert.equal(payoutConfigDenied.status, 403);

    const payoutConfig = await apiRequest("/pre-election/payout/configurations", {
      method: "POST",
      token: superAdminToken,
      body: { minimumPoints: 25, pointConversionRate: 2, frequency: "WEEKLY" },
    });
    assert.equal(payoutConfig.status, 201, JSON.stringify(payoutConfig.payload));

    const payoutCycle = await apiRequest("/pre-election/payout/cycles", {
      method: "POST",
      token: superAdminToken,
      body: {
        name: "Pre Election Test Weekly Cycle",
        opensAt: "2026-08-10T00:00:00.000Z",
        closesAt: "2026-08-12T00:00:00.000Z",
        payoutDate: "2026-08-13T00:00:00.000Z",
      },
    });
    assert.equal(payoutCycle.status, 201, JSON.stringify(payoutCycle.payload));
    const payoutCycleId = (payoutCycle.payload.payoutCycle as { id: string }).id;
    const payoutOfficer = await prisma.user.findUniqueOrThrow({ where: { email: testEmail("payout") }, select: { id: true } });

    const payoutBatch = await apiRequest(`/pre-election/payout/cycles/${payoutCycleId}/batches`, {
      method: "POST",
      token: superAdminToken,
      body: { payoutOfficerUserId: payoutOfficer.id, beneficiaryUserIds: [referrer.id] },
    });
    assert.equal(payoutBatch.status, 201, JSON.stringify(payoutBatch.payload));
    const assignments = (payoutBatch.payload.payoutBatch as { assignments: Array<{ id: string; points: number; amount: string }> })
      .assignments;
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].points, 25);
    assert.equal(assignments[0].amount, "50.00");

    const duplicatePayoutBatch = await apiRequest(`/pre-election/payout/cycles/${payoutCycleId}/batches`, {
      method: "POST",
      token: superAdminToken,
      body: { payoutOfficerUserId: payoutOfficer.id, beneficiaryUserIds: [referrer.id] },
    });
    assert.equal(duplicatePayoutBatch.status, 400);

    const assignmentId = assignments[0].id;
    const approveBatch = await apiRequest(`/pre-election/payout/batches/${(payoutBatch.payload.payoutBatch as { id: string }).id}/approve`, {
      method: "PATCH",
      token: superAdminToken,
    });
    assert.equal(approveBatch.status, 200, JSON.stringify(approveBatch.payload));

    const unauthorizedPayout = await apiRequest(`/pre-election/payout/assignments/${assignmentId}/status`, {
      method: "PATCH",
      token: otherPayoutToken,
      body: { status: "PROCESSING" },
    });
    assert.equal(unauthorizedPayout.status, 403);

    const processingPayout = await apiRequest(`/pre-election/payout/assignments/${assignmentId}/status`, {
      method: "PATCH",
      token: payoutToken,
      body: { status: "PROCESSING" },
    });
    assert.equal(processingPayout.status, 200, JSON.stringify(processingPayout.payload));

    const paidPayout = await apiRequest(`/pre-election/payout/assignments/${assignmentId}/status`, {
      method: "PATCH",
      token: payoutToken,
      body: {
        status: "PAID",
        paymentReference: "PRE-ELECTION-PAYOUT-REF-001",
        proofStorageKey: "payout-proofs/pre-election-test/ref-001.pdf",
        note: "Paid by transfer.",
      },
    });
    assert.equal(paidPayout.status, 200, JSON.stringify(paidPayout.payload));
    assert.equal(await prisma.payoutTransaction.count({ where: { payoutAssignmentId: assignmentId } }), 1);

    const finalizedPayoutChange = await apiRequest(`/pre-election/payout/assignments/${assignmentId}/status`, {
      method: "PATCH",
      token: payoutToken,
      body: { status: "HELD" },
    });
    assert.equal(finalizedPayoutChange.status, 409);

    const postPayoutBalance = await apiRequest(`/pre-election/rewards/balance?userId=${referrer.id}`, {
      token: superAdminToken,
    });
    assert.equal(postPayoutBalance.status, 200, JSON.stringify(postPayoutBalance.payload));
    assert.equal(postPayoutBalance.payload.reservedPayoutPoints, 25);
    assert.equal(postPayoutBalance.payload.availablePoints, 0);

    const strengthMetric = await apiRequest("/pre-election/strength/metrics", {
      method: "POST",
      token: superAdminToken,
      body: { metric: "VERIFIED_MEMBERS", description: "Verified members in scope" },
    });
    assert.equal(strengthMetric.status, 201, JSON.stringify(strengthMetric.payload));

    const strengthWeight = await apiRequest("/pre-election/strength/weights", {
      method: "POST",
      token: superAdminToken,
      body: { metric: "VERIFIED_MEMBERS", weight: 1 },
    });
    assert.equal(strengthWeight.status, 201, JSON.stringify(strengthWeight.payload));

    const strengthTarget = await apiRequest("/pre-election/strength/targets", {
      method: "POST",
      token: superAdminToken,
      body: {
        territoryType: "WARD",
        territoryId: wardId,
        metric: "VERIFIED_MEMBERS",
        targetValue: 1,
        startDate: "2026-08-01T00:00:00.000Z",
      },
    });
    assert.equal(strengthTarget.status, 201, JSON.stringify(strengthTarget.payload));

    const strengthSnapshot = await apiRequest("/pre-election/strength/snapshots/calculate", {
      method: "POST",
      token: superAdminToken,
      body: { territoryType: "WARD", territoryId: wardId },
    });
    assert.equal(strengthSnapshot.status, 201, JSON.stringify(strengthSnapshot.payload));
    const breakdown = (strengthSnapshot.payload.strengthSnapshot as { breakdown: Array<{ metric: string; actualValue: number }> }).breakdown;
    const verifiedMembersMetric = breakdown.find((item) => item.metric === "VERIFIED_MEMBERS");
    assert.ok(verifiedMembersMetric);
    assert.equal(verifiedMembersMetric.actualValue, 1);

    const targetProgress = await apiRequest(`/pre-election/strength/targets/progress?territoryType=WARD&territoryId=${wardId}`, {
      token: superAdminToken,
    });
    assert.equal(targetProgress.status, 200, JSON.stringify(targetProgress.payload));
    assert.equal((targetProgress.payload.progress as Array<{ metric: string; actualValue: number }>)[0].actualValue, 1);

    const approveAgain = await apiRequest(`/pre-election/verifications/${verificationCase.id}/decision`, {
      method: "PATCH",
      token: validatorToken,
      body: { decision: "APPROVE" },
    });
    assert.equal(approveAgain.status, 409);
    assert.equal(await prisma.rewardLedgerEntry.count({ where: { userId: referrer.id, category: "VERIFIED_REFERRAL" } }), 1);

    const duplicateMember = await registerMember(
      "002",
      null,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const duplicateVerification = await prisma.voterVerification.findUniqueOrThrow({
      where: { memberUserId: duplicateMember.id },
    });
    assert.equal(duplicateVerification.isFlagged, true);
    assert.equal(duplicateVerification.fraudReason, "DUPLICATE_DOCUMENT_HASH");

    console.log("pre_election_tests=passed");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = null;
    await cleanup();
  }
}

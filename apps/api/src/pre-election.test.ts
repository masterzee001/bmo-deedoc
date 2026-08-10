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

async function textRequest(path: string, options?: { token?: string; method?: string; body?: unknown }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method || "GET",
    headers: {
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, body: await response.text() };
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
      where: {
        OR: [
          { referral: { referrerUserId: { in: userIds } } },
          { referral: { referredUserId: { in: userIds } } },
          // Milestone bonus events carry no referral link, so they are matched
          // through the rule version that produced them.
          { rewardRuleVersion: { rewardRule: { createdByUserId: { in: userIds } } } },
        ],
      },
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
    const referredMemberToken = await login(testEmail("member-001"));
    const referrer = await prisma.user.findUniqueOrThrow({ where: { email: testEmail("coordinator") }, select: { id: true } });

    assert.equal(await prisma.rewardLedger.count({ where: { voterUserId: referrer.id } }), 0);
    assert.equal(await prisma.rewardLedgerEntry.count({ where: { userId: referrer.id } }), 0);

    const referral = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referredMember.id } });
    assert.equal(referral.status, "PENDING_VERIFICATION");

    const memberVerification = await apiRequest("/pre-election/verifications/me", { token: referredMemberToken });
    assert.equal(memberVerification.status, 200, JSON.stringify(memberVerification.payload));
    assert.equal((memberVerification.payload.verification as { status: string }).status, "PENDING");

    const resubmission = await apiRequest("/pre-election/verifications/me/documents", {
      method: "POST",
      token: referredMemberToken,
      body: {
        documentProcessingConsent: true,
        voterDocument: {
          originalStorageKey: `voter-verification/test/001/resubmission-${cryptoSafeKey("001")}`,
          originalFileName: "001-resubmission.pdf",
          mimeType: "application/pdf",
          fileSize: 2048,
          sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
    });
    assert.equal(resubmission.status, 201, JSON.stringify(resubmission.payload));
    assert.equal(await prisma.rewardLedgerEntry.count({ where: { userId: referrer.id } }), 0);

    const queue = await apiRequest("/pre-election/verifications?status=PENDING", { token: validatorToken });
    assert.equal(queue.status, 200, JSON.stringify(queue.payload));
    const cases = queue.payload.verifications as Array<{ id: string; documents: Array<{ id: string }> }>;
    const verificationCase = cases.find((item) => item.id);
    assert.ok(verificationCase);
    assert.ok(verificationCase.documents.length >= 2);

    const verificationCsv = await textRequest("/pre-election/verifications?status=PENDING&export=csv", { token: validatorToken });
    assert.equal(verificationCsv.status, 200);
    assert.match(verificationCsv.body, /memberName/);

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

    const referralManagement = await apiRequest(`/pre-election/referrals?territoryType=WARD&territoryId=${wardId}`, {
      token: coordinatorToken,
    });
    assert.equal(referralManagement.status, 200, JSON.stringify(referralManagement.payload));
    assert.equal((referralManagement.payload.referrals as Array<{ status: string }>).length, 1);

    const rewardLedger = await apiRequest(`/pre-election/rewards/ledger?userId=${referrer.id}`, {
      token: superAdminToken,
    });
    assert.equal(rewardLedger.status, 200, JSON.stringify(rewardLedger.payload));
    assert.equal((rewardLedger.payload.rewardLedgerEntries as Array<{ category: string }>)[0].category, "VERIFIED_REFERRAL");

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

    const payoutOfficers = await apiRequest("/pre-election/payout/officers", { token: superAdminToken });
    assert.equal(payoutOfficers.status, 200, JSON.stringify(payoutOfficers.payload));
    assert.ok((payoutOfficers.payload.payoutOfficers as Array<{ id: string }>).some((item) => item.id === payoutOfficer.id));

    const payoutEligibility = await apiRequest(`/pre-election/payout/eligibility?cycleId=${payoutCycleId}`, { token: superAdminToken });
    assert.equal(payoutEligibility.status, 200, JSON.stringify(payoutEligibility.payload));
    assert.equal((payoutEligibility.payload.payoutEligibility as Array<{ userId: string }>)[0].userId, referrer.id);

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

    const payoutBatches = await apiRequest("/pre-election/payout/batches", { token: superAdminToken });
    assert.equal(payoutBatches.status, 200, JSON.stringify(payoutBatches.payload));
    assert.ok((payoutBatches.payload.payoutBatches as Array<{ id: string }>).some((item) => item.id === (payoutBatch.payload.payoutBatch as { id: string }).id));

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

    const payoutOfficerAssignments = await apiRequest("/pre-election/payout/assignments?status=PROCESSING", {
      token: payoutToken,
    });
    assert.equal(payoutOfficerAssignments.status, 200, JSON.stringify(payoutOfficerAssignments.payload));
    assert.equal((payoutOfficerAssignments.payload.payoutAssignments as Array<{ id: string }>)[0].id, assignmentId);

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

    const strengthDashboard = await apiRequest(`/pre-election/strength/dashboard?territoryType=WARD&territoryId=${wardId}`, {
      token: coordinatorToken,
    });
    assert.equal(strengthDashboard.status, 200, JSON.stringify(strengthDashboard.payload));
    assert.equal((strengthDashboard.payload.dashboard as { coordinatorPerformance: Array<{ userId: string }> }).coordinatorPerformance[0].userId, referrer.id);

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

    // --- Feature 043: system-controlled bonus points -------------------------

    // Only a Super Admin may define a bonus rule. A Payout Officer, who moves
    // money, must not be able to create the rule that decides how much exists.
    const payoutBonusAttempt = await apiRequest("/pre-election/reward-rules", {
      method: "POST",
      token: payoutToken,
      body: {
        name: "Payout officer forbidden bonus",
        directPoints: 500,
        qualifyingEvent: "REFERRAL_MILESTONE_REACHED",
        milestoneThreshold: 1,
      },
    });
    assert.equal(payoutBonusAttempt.status, 403, JSON.stringify(payoutBonusAttempt.payload));

    // A bonus rule with no system trigger is rejected: bonus points may only
    // come into existence through a computed milestone.
    const untriggeredBonus = await apiRequest("/pre-election/reward-rules", {
      method: "POST",
      token: superAdminToken,
      body: { name: "Bonus without trigger", directPoints: 50, qualifyingEvent: "REFERRAL_MILESTONE_REACHED" },
    });
    assert.equal(untriggeredBonus.status, 400, JSON.stringify(untriggeredBonus.payload));

    const bonusRule = await apiRequest("/pre-election/reward-rules", {
      method: "POST",
      token: superAdminToken,
      body: {
        name: "Two qualified referrals milestone",
        directPoints: 100,
        qualifyingEvent: "REFERRAL_MILESTONE_REACHED",
        milestoneThreshold: 2,
        eligibleRole: "COORDINATOR",
      },
    });
    assert.equal(bonusRule.status, 201, JSON.stringify(bonusRule.payload));

    // Not yet awarded: the coordinator has one qualified referral, not two.
    assert.equal(await prisma.rewardLedgerEntry.count({ where: { userId: referrer.id, category: "BONUS" } }), 0);

    // A second qualified referral crosses the threshold.
    const secondReferred = await registerMember(
      "003",
      referralCodeResponse.payload.referralCode as string,
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    );
    const secondCase = await prisma.voterVerification.findUniqueOrThrow({ where: { memberUserId: secondReferred.id } });
    const secondApprove = await apiRequest(`/pre-election/verifications/${secondCase.id}/decision`, {
      method: "PATCH",
      token: validatorToken,
      body: { decision: "APPROVE", note: "Second referral verified." },
    });
    assert.equal(secondApprove.status, 200, JSON.stringify(secondApprove.payload));

    const bonusEntries = await prisma.rewardLedgerEntry.findMany({
      where: { userId: referrer.id, category: "BONUS" },
    });
    assert.equal(bonusEntries.length, 1, "the milestone must award exactly one bonus");
    assert.equal(bonusEntries[0].points, 100);
    assert.equal(bonusEntries[0].sourceEventType, "REFERRAL_MILESTONE_REACHED");
    // The amount comes from a versioned rule, never an operator-supplied value.
    assert.ok(bonusEntries[0].rewardRuleVersionId, "a bonus must reference the rule version that produced it");

    // Re-processing must never pay the same milestone twice.
    const bonusEvent = await prisma.rewardEvent.findFirstOrThrow({
      where: { eventType: "REFERRAL_MILESTONE_REACHED", sourceId: `${referrer.id}:2` },
    });
    assert.equal(bonusEvent.status, "PROCESSED");
    assert.equal(
      await prisma.rewardEvent.count({ where: { eventType: "REFERRAL_MILESTONE_REACHED", sourceId: `${referrer.id}:2` } }),
      1,
    );

    // --- Features 059-065, 077, 078: hierarchical dashboard ------------------

    // One engine, every level. A Super Admin walks the full hierarchy and each
    // level must present its own identity, its own child unit, and a heatmap
    // band for every child.
    const levels = [
      { level: "STATE", territoryId: stateId, childUnit: "Senatorial Districts" },
      { level: "SENATORIAL_DISTRICT", territoryId: senatorialDistrictId, childUnit: "Federal Constituencies" },
      { level: "FEDERAL_CONSTITUENCY", territoryId: federalConstituencyId, childUnit: "State Constituencies" },
      { level: "STATE_CONSTITUENCY", territoryId: stateConstituencyId, childUnit: "Wards" },
      { level: "WARD", territoryId: wardId, childUnit: "Polling Units" },
    ] as const;

    for (const entry of levels) {
      const view = await apiRequest(`/dashboard?level=${entry.level}&territoryId=${entry.territoryId}`, {
        token: superAdminToken,
      });
      assert.equal(view.status, 200, `${entry.level}: ${JSON.stringify(view.payload)}`);
      const dashboard = view.payload.dashboard as {
        level: string;
        territoryName: string;
        presentation: { childUnitPlural: string; accent: string; singular: string };
        breadcrumb: Array<{ level: string; name: string }>;
        strengthScore: number;
        band: string;
        tiles: Array<{ key: string; value: number }>;
        childLevel: string | null;
        children: Array<{ band: string; strengthScore: number; level: string }>;
        referenceDataIncomplete: boolean;
      };

      assert.equal(dashboard.level, entry.level);
      assert.equal(dashboard.presentation.childUnitPlural, entry.childUnit, "each level must name its own child unit");
      assert.ok(dashboard.presentation.accent, "each level must carry a distinct visual accent");
      assert.ok(dashboard.breadcrumb.length >= 1, "every level must be navigable back up the hierarchy");
      assert.equal(dashboard.breadcrumb[0].level, "STATE");
      assert.ok(dashboard.strengthScore >= 0 && dashboard.strengthScore <= 100);
      assert.ok(["CRITICAL", "WEAK", "MODERATE", "STRONG"].includes(dashboard.band));
      assert.ok(dashboard.tiles.some((tile) => tile.key === "REGISTERED_MEMBERS"));
      assert.equal(dashboard.referenceDataIncomplete, false, `${entry.level} has fixture children loaded`);

      // Heatmap: every child carries a band so the grid can always be coloured.
      assert.ok(dashboard.children.length > 0, `${entry.level} should list children`);
      for (const child of dashboard.children) {
        assert.ok(["CRITICAL", "WEAK", "MODERATE", "STRONG"].includes(child.band));
        assert.equal(child.level, dashboard.childLevel);
      }
    }

    // The terminal level stops the drill-down and exposes ground truth instead.
    const pollingUnitView = await apiRequest(`/dashboard?level=POLLING_UNIT&territoryId=${pollingUnitId}`, {
      token: superAdminToken,
    });
    assert.equal(pollingUnitView.status, 200, JSON.stringify(pollingUnitView.payload));
    const pollingUnitDashboard = pollingUnitView.payload.dashboard as {
      childLevel: string | null;
      children: unknown[];
      pollingUnitDetail: { operationalStatus: string; incidentCount: number } | null;
      breadcrumb: Array<{ level: string }>;
    };
    assert.equal(pollingUnitDashboard.childLevel, null, "Polling Unit is the terminal command level");
    assert.equal(pollingUnitDashboard.children.length, 0);
    assert.ok(pollingUnitDashboard.pollingUnitDetail, "the terminal level must expose Polling Unit readiness");
    assert.equal(pollingUnitDashboard.breadcrumb.length, 6, "full ancestry from State to Polling Unit");

    // A coordinator with no explicit scope lands on the territory they command.
    const coordinatorDefault = await apiRequest("/dashboard", { token: coordinatorToken });
    assert.equal(coordinatorDefault.status, 200, JSON.stringify(coordinatorDefault.payload));
    assert.equal((coordinatorDefault.payload.dashboard as { level: string }).level, "WARD");

    // Leaderboards rank on approved operational metrics only.
    const leaderboardView = await apiRequest(
      `/dashboard?level=WARD&territoryId=${wardId}&leaderboardMetric=VERIFIED_REFERRALS`,
      { token: coordinatorToken },
    );
    assert.equal(leaderboardView.status, 200, JSON.stringify(leaderboardView.payload));
    const leaderboard = (leaderboardView.payload.dashboard as {
      leaderboard: Array<{ rank: number; coordinatorUserId: string; value: number; metric: string }>;
    }).leaderboard;
    assert.ok(leaderboard.length >= 1, "the ward coordinator should appear on its own leaderboard");
    assert.equal(leaderboard[0].rank, 1);
    assert.equal(leaderboard[0].metric, "VERIFIED_REFERRALS");
    assert.equal(leaderboard[0].coordinatorUserId, referrer.id);
    assert.equal(leaderboard[0].value, 2, "two qualified referrals were created above");

    // Authorization is applied by the same engine at every level: a Validator
    // holds no command territory and cannot read a command dashboard.
    const validatorDenied = await apiRequest(`/dashboard?level=WARD&territoryId=${wardId}`, { token: validatorToken });
    assert.equal(validatorDenied.status, 403, JSON.stringify(validatorDenied.payload));

    // A Payout Officer likewise commands no territory.
    const payoutDenied = await apiRequest("/dashboard", { token: payoutToken });
    assert.equal(payoutDenied.status, 403, JSON.stringify(payoutDenied.payload));

    console.log("pre_election_tests=passed");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = null;
    await cleanup();
  }
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuthUserProfile, RewardHistoryItem, RewardLedgerItem, RewardRedemptionItem } from "@pics-nigeria/shared";
import {
  ApiError,
  fetchAdminRedemptions,
  fetchAdminRewardLedger,
  fetchCurrentUser,
} from "../../../lib/api";
import { AdminNav } from "../../../components/admin-nav";
import { describeTerritory } from "../../../components/admin-management-utils";

function countByStatus(redemptions: RewardRedemptionItem[], status: RewardRedemptionItem["status"]) {
  return redemptions.filter((item) => item.status === status).length;
}

export default function AdminRewardsPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [rewardLedger, setRewardLedger] = useState<RewardLedgerItem[]>([]);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPage(token: string) {
    const [currentUser, ledgerData, visibleRedemptions] = await Promise.all([
      fetchCurrentUser(token),
      fetchAdminRewardLedger(token),
      fetchAdminRedemptions(token),
    ]);

    if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
      throw new ApiError("This page is available to admins only.", 403);
    }

    setUser(currentUser);
    setRewardLedger(ledgerData.rewardLedger);
    setRewardHistory(ledgerData.rewardHistory);
    setRedemptions(visibleRedemptions);
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    loadPage(token)
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Could not load reward accountability."))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => ({
    pending: countByStatus(redemptions, "PENDING"),
    approved: countByStatus(redemptions, "APPROVED"),
    paid: countByStatus(redemptions, "PAID"),
    rejected: countByStatus(redemptions, "REJECTED"),
    postedPoints: rewardLedger.reduce((sum, item) => sum + item.points, 0),
  }), [redemptions, rewardLedger]);

  const ledgerTypeBreakdown = useMemo(() => {
    return rewardLedger.reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.type] = (accumulator[entry.type] || 0) + 1;
      return accumulator;
    }, {});
  }, [rewardLedger]);

  if (loading && !user) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading rewards...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load rewards</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <Link href="/admin/dashboard">Return to admin overview</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Reward accountability</p>
        <h1>Rewards and redemptions</h1>
        <p>Visible scope: {describeTerritory(user.adminProfile || {
          geoPoliticalZoneId: null,
          stateId: null,
          senatorialDistrictId: null,
          federalConstituencyId: null,
          lgaId: null,
          wardId: null,
          stateConstituencyId: null,
          pollingUnitId: null,
        })}</p>
      </section>

      <AdminNav />
      {error ? <p className="error">{error}</p> : null}

      <section className="grid stats">
        <article className="panel card">
          <h2>Pending review</h2>
          <div className="value">{summary.pending}</div>
        </article>
        <article className="panel card">
          <h2>Approved</h2>
          <div className="value">{summary.approved}</div>
        </article>
        <article className="panel card">
          <h2>Paid</h2>
          <div className="value">{summary.paid}</div>
        </article>
        <article className="panel card">
          <h2>Rejected</h2>
          <div className="value">{summary.rejected}</div>
        </article>
        <article className="panel card">
          <h2>Posted points</h2>
          <div className="value">{summary.postedPoints}</div>
        </article>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <div className="section-head">
          <div>
            <h2>Visible reward history</h2>
            <p className="muted">This list combines posted ledger entries with redemption review status inside your allowed scope.</p>
          </div>
          <span className="status-pill">{rewardHistory.length} entries</span>
        </div>
        {rewardLedger.length > 0 ? (
          <div className="badge-row" style={{ marginBottom: 16 }}>
            {Object.entries(ledgerTypeBreakdown).map(([label, count]) => (
              <span key={label} className="status-badge live">
                {label}: {count}
              </span>
            ))}
          </div>
        ) : null}

        {rewardHistory.length === 0 ? (
          <p className="muted">No reward history is visible in your current scope.</p>
        ) : (
          <div className="reward-list">
            {rewardHistory.slice(0, 20).map((entry) => (
              <article key={`${entry.kind}-${entry.id}`} className="reward-item">
                <strong>{entry.title}</strong>
                <p>{entry.description}</p>
                <p className="muted">
                  {entry.kind === "EARNED" ? "Earned entry" : "Redemption"} | {entry.status} | {entry.points} points
                </p>
                {entry.amount !== null ? <p className="muted">Amount: {entry.amount}</p> : null}
                <p className="muted">
                  Created {new Date(entry.createdAt).toLocaleString()}
                  {entry.reviewedAt ? ` | Reviewed ${new Date(entry.reviewedAt).toLocaleString()}` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <div className="section-head">
          <div>
            <h2>Redemption review queue</h2>
            <p className="muted">Approval and payment actions continue to use the existing protected backend review flow.</p>
          </div>
          <span className="status-pill">{redemptions.length} requests</span>
        </div>

        {redemptions.length === 0 ? (
          <p className="muted">No redemption requests are currently visible in your scope.</p>
        ) : (
          <div className="reward-list">
            {redemptions.slice(0, 20).map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.status}</strong>
                <p>{item.pointsRequested} points requested</p>
                {item.amountRequested !== null ? <p className="muted">Requested amount: {item.amountRequested}</p> : null}
                <p className="muted">
                  Submitted {new Date(item.createdAt).toLocaleString()}
                  {item.reviewedAt ? ` | Reviewed ${new Date(item.reviewedAt).toLocaleString()}` : ""}
                </p>
                {item.note ? <p className="muted">Review note: {item.note}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

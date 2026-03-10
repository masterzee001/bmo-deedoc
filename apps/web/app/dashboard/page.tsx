"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { AuthUserProfile, NotificationItem, RewardBalanceSummary, RewardRedemptionItem, RewardsSummary } from "@pics-nigeria/shared";
import {
  ApiError,
  createVoterRedemption,
  fetchCurrentUser,
  fetchNotifications,
  fetchVoterRedemptions,
  fetchVoterRewards,
} from "../../lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [balance, setBalance] = useState<RewardBalanceSummary | null>(null);
  const [redemptions, setRedemptions] = useState<RewardRedemptionItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ pointsRequested: "", amountRequested: "", note: "" });
  const [message, setMessage] = useState("");

  async function loadDashboard(token: string) {
    const [currentUser, rewardSummary, redemptionData, notificationItems] = await Promise.all([
      fetchCurrentUser(token),
      fetchVoterRewards(token),
      fetchVoterRedemptions(token),
      fetchNotifications(token),
    ]);

    if (currentUser.role !== "VOTER") {
      throw new ApiError("This starter dashboard is available to voters only.", 403);
    }

    setUser(currentUser);
    setRewards(rewardSummary);
    setBalance(redemptionData.balance);
    setRedemptions(redemptionData.redemptions);
    setNotifications(notificationItems);
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaToken");

    if (!token) {
      window.location.href = "/login";
      return;
    }
    const authToken = token;

    async function loadDashboardData() {
      try {
        await loadDashboard(authToken);
      } catch (caughtError) {
        localStorage.removeItem("picsNigeriaToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load your dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardData();
  }, []);

  async function handleRedemptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setMessage("");

    try {
      await createVoterRedemption(token, {
        pointsRequested: Number(form.pointsRequested),
        amountRequested: form.amountRequested ? Number(form.amountRequested) : undefined,
        note: form.note || undefined,
      });
      setForm({ pointsRequested: "", amountRequested: "", note: "" });
      setMessage("Redemption request submitted.");
      await loadDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Redemption request failed.");
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading voter dashboard...</h1>
          <p>Please wait while your account data is being prepared.</p>
        </section>
      </main>
    );
  }

  if (error || !user || !rewards || !balance) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load dashboard</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <p>
            <Link href="/login">Return to login</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <h1>Welcome, {user.name}</h1>
        <p>
          Your referral code is <strong>{user.voterProfile?.referralCode}</strong>.
        </p>
      </section>

      <section className="grid stats">
        <article className="panel card">
          <h2>Total Points</h2>
          <div className="value">{rewards.totalPoints}</div>
        </article>
        <article className="panel card">
          <h2>Participation</h2>
          <div className="value">{rewards.totalParticipationPoints}</div>
        </article>
        <article className="panel card">
          <h2>Referral</h2>
          <div className="value">{rewards.totalReferralPoints}</div>
        </article>
        <article className="panel card">
          <h2>Available Balance</h2>
          <div className="value">{balance.availablePoints}</div>
        </article>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Recent Reward Activity</h2>
        {rewards.recentRewards.length === 0 ? (
          <p className="muted">No reward activity yet.</p>
        ) : (
          <div className="reward-list">
            {rewards.recentRewards.map((reward) => (
              <article key={reward.id} className="reward-item">
                <strong>{reward.type}</strong>
                <p>{reward.description}</p>
                <p className="muted">
                  {reward.points} points | {new Date(reward.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Request Redemption</h2>
          <form className="form" onSubmit={handleRedemptionSubmit}>
            <label className="field">
              <span>Points Requested</span>
              <input value={form.pointsRequested} onChange={(event) => setForm({ ...form, pointsRequested: event.target.value })} required />
            </label>
            <label className="field">
              <span>Amount Requested</span>
              <input value={form.amountRequested} onChange={(event) => setForm({ ...form, amountRequested: event.target.value })} />
            </label>
            <label className="field">
              <span>Note</span>
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </label>
            {message ? <p className="muted">{message}</p> : null}
            <button className="button" type="submit">Submit redemption</button>
          </form>
        </section>

        <section className="panel card">
          <h2>Notifications</h2>
          {notifications.length === 0 ? (
            <p className="muted">No notifications yet.</p>
          ) : (
            <div className="reward-list">
              {notifications.slice(0, 5).map((item) => (
                <article key={item.id} className="reward-item">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Redemption History</h2>
        {redemptions.length === 0 ? (
          <p className="muted">No redemption requests yet.</p>
        ) : (
          <div className="reward-list">
            {redemptions.map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.status}</strong>
                <p>{item.pointsRequested} points requested</p>
                <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

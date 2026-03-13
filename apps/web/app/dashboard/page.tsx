"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { AuthUserProfile, CampaignEventItem, NotificationItem, PostListItem, RewardBalanceSummary, RewardRedemptionItem, RewardsSummary, VoterEngagementTaskItem } from "@pics-nigeria/shared";
import {
  ApiError,
  claimVoterEngagementTask,
  createVoterRedemption,
  fetchCurrentUser,
  fetchNotifications,
  fetchVoterEvents,
  fetchVoterEngagementTasks,
  fetchVoterPosts,
  fetchVoterRedemptions,
  fetchVoterRewards,
  rsvpToCampaignEvent,
} from "../../lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [balance, setBalance] = useState<RewardBalanceSummary | null>(null);
  const [redemptions, setRedemptions] = useState<RewardRedemptionItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [events, setEvents] = useState<CampaignEventItem[]>([]);
  const [engagementTasks, setEngagementTasks] = useState<VoterEngagementTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ pointsRequested: "", amountRequested: "", note: "" });
  const [message, setMessage] = useState("");

  async function loadDashboard(token: string) {
    const [currentUser, rewardSummary, redemptionData, notificationItems, visiblePosts, visibleEvents, nextEngagementTasks] = await Promise.all([
      fetchCurrentUser(token),
      fetchVoterRewards(token),
      fetchVoterRedemptions(token),
      fetchNotifications(token),
      fetchVoterPosts(token),
      fetchVoterEvents(token),
      fetchVoterEngagementTasks(token),
    ]);

    if (currentUser.role !== "VOTER") {
      throw new ApiError("This starter dashboard is available to voters only.", 403);
    }

    setUser(currentUser);
    setRewards(rewardSummary);
    setBalance(redemptionData.balance);
    setRedemptions(redemptionData.redemptions);
    setNotifications(notificationItems);
    setPosts(visiblePosts);
    setEvents(visibleEvents);
    setEngagementTasks(nextEngagementTasks);
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

  async function handleClaimTask(taskId: string) {
    const token = localStorage.getItem("picsNigeriaToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setMessage("");
    try {
      const result = await claimVoterEngagementTask(token, taskId);
      setMessage(result.message);
      await loadDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not claim engagement task.");
    }
  }

  async function handleEventRsvp(eventId: string, status: "INTERESTED" | "GOING") {
    const token = localStorage.getItem("picsNigeriaToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setMessage("");
    try {
      const result = await rsvpToCampaignEvent(token, eventId, { status });
      setMessage(result.message);
      await loadDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save your event RSVP.");
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
      <section className="panel hero voter-hero">
        <div>
          <p className="eyebrow">Grassroots participation</p>
          <h1>Welcome, {user.name}</h1>
          <p>
            Your referral code is <strong>{user.voterProfile?.referralCode}</strong>.
          </p>
        </div>
        <div className="hero-callout">
          <strong>{events.length}</strong>
          <span>live events in your territory</span>
        </div>
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
        <div className="section-head">
          <div>
            <h2>Upcoming campaign events</h2>
            <p className="muted">RSVP to published rallies, ward meetings, town halls, and voter-mobilization activities in your territory.</p>
          </div>
          <Link href="/candidates">Browse candidates</Link>
        </div>
        {events.length === 0 ? (
          <p className="muted">No published campaign events are currently visible in your territory.</p>
        ) : (
          <div className="campaign-event-grid">
            {events.slice(0, 6).map((item) => (
              <article key={item.id} className="campaign-event-card">
                {item.coverImageUrl ? (
                  <img src={item.coverImageUrl} alt={item.title} className="campaign-event-cover" />
                ) : (
                  <div className="campaign-event-cover fallback">Event</div>
                )}
                <div className="campaign-event-copy">
                  <p className="eyebrow">{item.candidate?.name || "Campaign event"}</p>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <p className="muted">{new Date(item.startsAt).toLocaleString()} | {item.venue}</p>
                  <p className="muted">{item.territoryLabels.state || "National"}{item.territoryLabels.lga ? ` | ${item.territoryLabels.lga}` : ""}</p>
                  <div className="action-row">
                    <button className="button secondary" type="button" onClick={() => void handleEventRsvp(item.id, "INTERESTED")}>
                      {item.rsvp?.status === "INTERESTED" ? "Interested" : "Mark interested"}
                    </button>
                    <button className="button" type="button" onClick={() => void handleEventRsvp(item.id, "GOING")}>
                      {item.rsvp?.status === "GOING" ? "Going" : "RSVP going"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Optional Engagement Tasks</h2>
        {engagementTasks.length === 0 ? (
          <p className="muted">No optional engagement tasks are active in your territory right now.</p>
        ) : (
          <div className="reward-list">
            {engagementTasks.slice(0, 6).map((task) => (
              <article key={task.id} className="reward-item">
                <strong>{task.title}</strong>
                <p>{task.description}</p>
                <p className="muted">
                  {task.type} | {task.progressCount}/{task.targetCount || 1} | {task.rewardPoints} points
                </p>
                <button className="button secondary" type="button" disabled={!task.completed || task.claimed} onClick={() => void handleClaimTask(task.id)}>
                  {task.claimed ? "Claimed" : task.completed ? "Claim task" : "In progress"}
                </button>
              </article>
            ))}
          </div>
        )}
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
        <h2>Campaign Updates</h2>
        {posts.length === 0 ? (
          <p className="muted">No campaign updates are currently visible in your territory.</p>
        ) : (
          <div className="reward-list">
            {posts.slice(0, 6).map((post) => (
              <article key={post.id} className="reward-item">
                <strong>{post.title}</strong>
                <p>{post.content}</p>
                <p className="muted">{new Date(post.createdAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
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

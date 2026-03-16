"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  AdminDashboardSummary,
  AgentActivitySummary,
  AuthUserProfile,
  NotificationItem,
  PollingUnitCoverageSummary,
  RewardRedemptionItem,
} from "@pics-nigeria/shared";
import { emptyTerritorySummary } from "@pics-nigeria/shared";
import {
  ApiError,
  fetchAdminAgentActivitySummaries,
  fetchAdminPollingUnitCoverage,
  fetchAdminRedemptions,
  fetchAdminSummary,
  fetchCurrentUser,
  fetchNotifications,
} from "../../../lib/api";
import { AdminNav } from "../../../components/admin-nav";
import { describeTerritory, getScopeTitle } from "../../../components/admin-management-utils";

type DashboardData = {
  user: AuthUserProfile;
  summary: AdminDashboardSummary;
  coverage: PollingUnitCoverageSummary;
  notifications: NotificationItem[];
  redemptions: RewardRedemptionItem[];
  agentActivity: AgentActivitySummary[];
};

async function loadDashboard(token: string): Promise<DashboardData> {
  const [user, summary, coverage, notifications, redemptions, agentActivity] = await Promise.all([
    fetchCurrentUser(token),
    fetchAdminSummary(token),
    fetchAdminPollingUnitCoverage(token),
    fetchNotifications(token),
    fetchAdminRedemptions(token),
    fetchAdminAgentActivitySummaries(token),
  ]);

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw new ApiError("This dashboard is available to admins only.", 403);
  }

  return { user, summary, coverage, notifications, redemptions, agentActivity };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    loadDashboard(token)
      .then(setData)
      .catch((caughtError) => {
        localStorage.removeItem("picsNigeriaAdminToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load the admin dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  const territoryLabel = useMemo(
    () => describeTerritory(data?.user.adminProfile || emptyTerritorySummary()),
    [data?.user.adminProfile],
  );

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading admin overview...</h1>
          <p>Please wait while your scoped workspace is prepared.</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load dashboard</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <Link href="/admin/login">Return to admin login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">{getScopeTitle(data.user)}</p>
        <h1>{data.user.name}</h1>
        <p>Current territory scope: {territoryLabel}</p>
        <p className="muted">
          The overview shows only operational signals and next actions. Management, territory filtering, and account workflows now live on dedicated pages.
        </p>
      </section>

      <AdminNav />

      <section className="grid stats">
        <article className="panel card">
          <h2>Agents in Scope</h2>
          <div className="value">{data.summary.totalAgentsInScope}</div>
        </article>
        <article className="panel card">
          <h2>Voters in Scope</h2>
          <div className="value">{data.summary.totalVotersInScope}</div>
        </article>
        <article className="panel card">
          <h2>Open Incidents</h2>
          <div className="value">{data.summary.totalIncidentsOpen}</div>
        </article>
        <article className="panel card">
          <h2>Critical Incidents</h2>
          <div className="value">{data.summary.totalIncidentsCritical}</div>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <section className="panel card">
          <h2>Territory Coverage</h2>
          {data.coverage.scopeWarning ? <p className="muted">{data.coverage.scopeWarning}</p> : null}
          <div className="reward-list">
            <article className="reward-item">
              <strong>States in scope</strong>
              <p>{data.coverage.totalStatesInScope}</p>
            </article>
            <article className="reward-item">
              <strong>LGAs in scope</strong>
              <p>{data.coverage.totalLgasInScope}</p>
            </article>
            <article className="reward-item">
              <strong>Wards in scope</strong>
              <p>{data.coverage.totalWardsInScope}</p>
            </article>
            <article className="reward-item">
              <strong>Polling units in scope</strong>
              <p>{data.coverage.totalPollingUnitsInScope}</p>
            </article>
            <article className="reward-item">
              <strong>Assigned agents</strong>
              <p>{data.coverage.pollingUnitsWithAssignedAgents}</p>
            </article>
            <article className="reward-item">
              <strong>Recent activity</strong>
              <p>{data.coverage.pollingUnitsWithRecentActivity}</p>
            </article>
            <article className="reward-item">
              <strong>Units without recent activity</strong>
              <p>{data.coverage.pollingUnitsWithoutActivity}</p>
            </article>
          </div>
        </section>

        <section className="panel card">
          <h2>Priority Actions</h2>
          <div className="reward-list">
            <article className="reward-item">
              <strong>Manage users</strong>
              <p>Use the navigation above to open role-aware user lists with territory filters and lifecycle actions.</p>
            </article>
            <article className="reward-item">
              <strong>Review incidents</strong>
              <p>Use the navigation above to review flagged reports, escalation state, and open governance issues inside your scope.</p>
            </article>
            <article className="reward-item">
              <strong>Coverage intelligence</strong>
              <p>Use the navigation above to identify weak wards, polling units without agents, and areas with missing recent field signals.</p>
            </article>
            <article className="reward-item">
              <strong>Select territory</strong>
              <p>Use the navigation above to drill into state, LGA, and ward views before running management tasks.</p>
            </article>
            <article className="reward-item">
              <strong>Send communications</strong>
              <p>Use the navigation above to preview recipient counts and send scoped broadcasts by role, territory, party, and workflow filter.</p>
            </article>
            <article className="reward-item">
              <strong>Account and exports</strong>
              <p>Use the navigation above for profile changes, password updates, and protected exports.</p>
            </article>
          </div>
        </section>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Recent Field Activity</h2>
          {data.agentActivity.length === 0 ? (
            <p className="muted">No recent agent activity is visible in this territory.</p>
          ) : (
            <div className="reward-list">
              {data.agentActivity.slice(0, 5).map((item) => (
                <article key={item.agentUserId} className="reward-item">
                  <strong>{item.name}</strong>
                  <p>{item.latestActivityType || "No recent activity"}</p>
                  <p className="muted">{item.latestActivityAt ? new Date(item.latestActivityAt).toLocaleString() : "No timestamp"}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <h2>Notifications</h2>
          {data.notifications.length === 0 ? (
            <p className="muted">No notifications yet.</p>
          ) : (
            <div className="reward-list">
              {data.notifications.slice(0, 5).map((item) => (
                <article key={item.id} className="reward-item">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <h2>Redemption Queue</h2>
          {data.redemptions.length === 0 ? (
            <p className="muted">No redemption requests are waiting in this scope.</p>
          ) : (
            <div className="reward-list">
              {data.redemptions.slice(0, 5).map((item) => (
                <article key={item.id} className="reward-item">
                  <strong>{item.status}</strong>
                  <p>{item.pointsRequested} points requested</p>
                  <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuthUserProfile, CoverageInsights } from "@pics-nigeria/shared";
import { ApiError, fetchAdminCoverageInsights, fetchCurrentUser } from "../../../../lib/api";
import { AdminNav } from "../../../../components/admin-nav";
import { describeTerritory } from "../../../../components/admin-management-utils";

export default function AdminCoveragePage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [insights, setInsights] = useState<CoverageInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const unitsWithoutAgents = useMemo(
    () => insights?.pollingUnits.filter((unit) => !unit.hasAssignedAgent) || [],
    [insights],
  );
  const unitsWithoutRecentActivity = useMemo(
    () => insights?.pollingUnits.filter((unit) => !unit.hasRecentActivity) || [],
    [insights],
  );
  const unitsWithIncidentPressure = useMemo(
    () => insights?.pollingUnits.filter((unit) => unit.openIncidentCount > 0) || [],
    [insights],
  );
  const wardsWithNoAgents = useMemo(
    () => insights?.wards.filter((ward) => ward.pollingUnitsWithoutAgents > 0).slice(0, 8) || [],
    [insights],
  );
  const wardsWithNoRecentActivity = useMemo(
    () => insights?.wards.filter((ward) => ward.pollingUnitsWithoutRecentActivity > 0).slice(0, 8) || [],
    [insights],
  );

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    Promise.all([fetchCurrentUser(token), fetchAdminCoverageInsights(token)])
      .then(([currentUser, nextInsights]) => {
        if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
          throw new ApiError("This page is available to admins only.", 403);
        }

        setUser(currentUser);
        setInsights(nextInsights);
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Could not load coverage insights."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading coverage insights...</h1>
        </section>
      </main>
    );
  }

  if (!user || !insights) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load coverage insights</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <Link href="/admin/dashboard">Return to admin overview</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Field intelligence</p>
        <h1>Territory coverage</h1>
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
          <h2>Polling units</h2>
          <div className="value">{insights.summary.totalPollingUnitsInScope}</div>
        </article>
        <article className="panel card">
          <h2>Wards in scope</h2>
          <div className="value">{insights.summary.wardsInScope}</div>
        </article>
        <article className="panel card">
          <h2>Weak coverage</h2>
          <div className="value">{insights.summary.weakCoveragePollingUnits}</div>
        </article>
        <article className="panel card">
          <h2>No assigned agents</h2>
          <div className="value">{insights.summary.pollingUnitsWithoutAssignedAgents}</div>
        </article>
        <article className="panel card">
          <h2>No recent activity</h2>
          <div className="value">{insights.summary.pollingUnitsWithoutActivity}</div>
        </article>
        <article className="panel card">
          <h2>Open incident pressure</h2>
          <div className="value">{insights.summary.pollingUnitsWithIncidents}</div>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="panel card">
          <div className="section-head">
            <div>
              <h2>Priority wards</h2>
              <p className="muted">Wards are sorted by missing agents, missing recent activity, and open incident pressure.</p>
            </div>
            <span className="status-pill">{insights.wards.length} wards</span>
          </div>
          {insights.wards.length === 0 ? (
            <p className="muted">No ward coverage data is available in the current scope.</p>
          ) : (
            <div className="reward-list">
              {insights.wards.slice(0, 12).map((ward) => (
                <article key={ward.wardId} className="reward-item">
                  <strong>{ward.wardName}</strong>
                  <p>{ward.lgaName}</p>
                  <p className="muted">
                    {ward.pollingUnitCount} polling units | {ward.pollingUnitsWithoutAgents} without agents | {ward.pollingUnitsWithoutRecentActivity} without recent activity
                  </p>
                  <p className="muted">{ward.openIncidentCount} open incidents</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <div className="section-head">
            <div>
              <h2>Polling units needing attention</h2>
              <p className="muted">These units currently have no assigned agents, no recent activity, or active incident pressure.</p>
            </div>
            <span className="status-pill">
              {insights.pollingUnits.filter((unit) => unit.requiresAttention).length} flagged
            </span>
          </div>
          {insights.pollingUnits.length === 0 ? (
            <p className="muted">No polling-unit coverage data is available in the current scope.</p>
          ) : (
            <div className="reward-list">
              {insights.pollingUnits.filter((unit) => unit.requiresAttention).slice(0, 16).map((unit) => (
                <article key={unit.pollingUnitId} className="reward-item">
                  <strong>{unit.pollingUnitName}</strong>
                  <p>{unit.wardName} | {unit.lgaName}</p>
                  <p className="muted">
                    Agents: {unit.assignedAgentCount} | Recent signals: {unit.recentActivityCount} | Open incidents: {unit.openIncidentCount}
                  </p>
                  <p className="muted">
                    {unit.hasAssignedAgent ? "Assigned" : "No assigned agent"} | {unit.hasRecentActivity ? "Recent activity present" : "No recent activity"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="panel card">
          <div className="section-head">
            <div>
              <h2>Agent assignment gaps</h2>
              <p className="muted">Use this queue to identify wards and polling units that need agent coverage first.</p>
            </div>
            <span className="status-pill">{unitsWithoutAgents.length} units</span>
          </div>
          {unitsWithoutAgents.length === 0 ? (
            <p className="muted">All visible polling units currently have assigned agents.</p>
          ) : (
            <div className="reward-list">
              {wardsWithNoAgents.length ? wardsWithNoAgents.map((ward) => (
                <article key={`gap-${ward.wardId}`} className="reward-item">
                  <strong>{ward.wardName}</strong>
                  <p>{ward.lgaName}</p>
                  <p className="muted">{ward.pollingUnitsWithoutAgents} polling units without assigned agents</p>
                </article>
              )) : null}
            </div>
          )}
        </section>

        <section className="panel card">
          <div className="section-head">
            <div>
              <h2>Activity follow-up</h2>
              <p className="muted">These areas have visible polling units without recent field signals in the current window.</p>
            </div>
            <span className="status-pill">{unitsWithoutRecentActivity.length} units</span>
          </div>
          {unitsWithoutRecentActivity.length === 0 ? (
            <p className="muted">All visible polling units have recent field activity.</p>
          ) : (
            <div className="reward-list">
              {wardsWithNoRecentActivity.map((ward) => (
                <article key={`activity-${ward.wardId}`} className="reward-item">
                  <strong>{ward.wardName}</strong>
                  <p>{ward.lgaName}</p>
                  <p className="muted">{ward.pollingUnitsWithoutRecentActivity} polling units without recent activity</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <div className="section-head">
            <div>
              <h2>Incident pressure</h2>
              <p className="muted">Polling units with open incident pressure should be checked against tasking and incident review.</p>
            </div>
            <span className="status-pill">{unitsWithIncidentPressure.length} units</span>
          </div>
          {unitsWithIncidentPressure.length === 0 ? (
            <p className="muted">No visible polling units currently carry open incident pressure.</p>
          ) : (
            <div className="reward-list">
              {unitsWithIncidentPressure.slice(0, 12).map((unit) => (
                <article key={`incident-${unit.pollingUnitId}`} className="reward-item">
                  <strong>{unit.pollingUnitName}</strong>
                  <p>{unit.wardName} | {unit.lgaName}</p>
                  <p className="muted">{unit.openIncidentCount} open incidents | {unit.assignedAgentCount} assigned agents</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminUserItem, AgentUserItem, AuthUserProfile, CandidateListItem, ManagedUserItem } from "@pics-nigeria/shared";
import { ApiError, fetchAdminCandidates, fetchAdminUsers, fetchAgents, fetchCurrentUser, fetchManagedUsers, setUserActivation } from "../../../lib/api";
import { AdminNav } from "../../../components/admin-nav";

export default function AdminManagePage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [agents, setAgents] = useState<AgentUserItem[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData(token: string) {
    const [currentUser, nextAdmins, nextCandidates, nextAgents, nextManagedUsers] = await Promise.all([
      fetchCurrentUser(token),
      fetchAdminUsers(token, ""),
      fetchAdminCandidates(token),
      fetchAgents(token),
      fetchManagedUsers(token, { limit: 24 }),
    ]);

    if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
      throw new ApiError("This page is available to admins only.", 403);
    }

    setUser(currentUser);
    setAdminUsers(nextAdmins);
    setCandidates(nextCandidates);
    setAgents(nextAgents);
    setManagedUsers(nextManagedUsers);
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    loadData(token)
      .catch((caughtError) => {
        localStorage.removeItem("picsNigeriaAdminToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load management workspace.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleUser(userId: string, isActive: boolean) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      setMessage("");
      await setUserActivation(token, userId, isActive);
      await loadData(token);
      setMessage(isActive ? "User reactivated." : "User deactivated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update user status.");
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading management workspace...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load management workspace</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <Link href="/admin/login">Return to admin login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Management workspace</p>
        <h1>Users and campaign roles</h1>
        <p>Use this page for day-to-day management access while the main dashboard stays focused on operations, incidents, coverage, and activity.</p>
      </section>

      <AdminNav />

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      <section className="grid stats">
        <article className="panel card">
          <h2>Admins</h2>
          <div className="value">{adminUsers.length}</div>
          <Link href="/admin/dashboard#admin-management">Open admin management</Link>
        </article>
        <article className="panel card">
          <h2>Candidates</h2>
          <div className="value">{candidates.length}</div>
          <Link href="/admin/dashboard#candidate-management">Open candidate management</Link>
        </article>
        <article className="panel card">
          <h2>Agents</h2>
          <div className="value">{agents.length}</div>
          <Link href="/admin/dashboard#agent-management">Open agent management</Link>
        </article>
        <article className="panel card">
          <h2>Unified users</h2>
          <div className="value">{managedUsers.length}</div>
          <Link href="/admin/dashboard#unified-management">Open unified control</Link>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Recent admins</h2>
          <div className="reward-list">
            {adminUsers.slice(0, 6).map((item) => (
              <article key={item.userId} className="reward-item">
                <strong>{item.name}</strong>
                <p className="muted">{item.adminLevel}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel card">
          <h2>Recent candidates</h2>
          <div className="reward-list">
            {candidates.slice(0, 6).map((item) => (
              <article key={item.userId} className="reward-item">
                <strong>{item.name}</strong>
                <p className="muted">{item.officeType}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel card">
          <h2>Recent agents</h2>
          <div className="reward-list">
            {agents.slice(0, 6).map((item) => (
              <article key={item.userId} className="reward-item">
                <strong>{item.name}</strong>
                <p className="muted">{item.phone || "No phone"}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Scoped unified control</h2>
        <p className="muted">Fast activation control across the users visible to your current admin scope.</p>
        <div className="reward-list">
          {managedUsers.map((item) => (
            <article key={item.userId} className="reward-item">
              <strong>{item.name}</strong>
              <p className="muted">{item.role} | {item.isActive ? "Active" : "Inactive"}</p>
              <button className="button secondary" type="button" onClick={() => void handleToggleUser(item.userId, !item.isActive)}>
                {item.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

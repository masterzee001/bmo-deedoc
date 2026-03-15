"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { emptyTerritorySummary } from "@pics-nigeria/shared";
import type { AuthUserProfile, ManagedUserItem } from "@pics-nigeria/shared";
import {
  ApiError,
  deleteManagedUser,
  fetchCurrentUser,
  fetchManagedUsers,
  setUserActivation,
} from "../../../../lib/api";
import { AdminNav } from "../../../../components/admin-nav";
import {
  describeTerritory,
  getManagedRoleLabel,
} from "../../../../components/admin-management-utils";

export default function AdminManageUsersPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUserItem[]>([]);
  const [locator, setLocator] = useState({
    stateId: "",
    lgaId: "",
    wardId: "",
    role: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPage(token: string, nextLocator: { stateId: string; lgaId: string; wardId: string; role: string; search: string }) {
    const [currentUser, users] = await Promise.all([
      fetchCurrentUser(token),
      nextLocator.role
        ? fetchManagedUsers(token, {
            role: nextLocator.role as "ADMIN" | "CANDIDATE" | "AGENT" | "VOTER",
            stateId: nextLocator.stateId || undefined,
            lgaId: nextLocator.lgaId || undefined,
            wardId: nextLocator.wardId || undefined,
            search: nextLocator.search || undefined,
            limit: 100,
          })
        : Promise.resolve([]),
    ]);

    if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
      throw new ApiError("This page is available to admins only.", 403);
    }

    setUser(currentUser);
    setManagedUsers(users);
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextLocator = {
      stateId: params.get("stateId") || "",
      lgaId: params.get("lgaId") || "",
      wardId: params.get("wardId") || "",
      role: params.get("role") || "",
      search: params.get("search") || "",
    };
    setLocator(nextLocator);

    loadPage(token, nextLocator)
      .catch((caughtError) => {
        localStorage.removeItem("picsNigeriaAdminToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load scoped users.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleUser(userId: string, nextIsActive: boolean) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    const confirmed = window.confirm(
      nextIsActive ? "Reactivate this account?" : "Deactivate this account? The user will lose access until reactivated.",
    );
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      const result = await setUserActivation(token, userId, nextIsActive);
      setMessage(result.message);
      await loadPage(token, locator);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update account status.");
    }
  }

  async function handleDeleteUser(item: ManagedUserItem) {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${item.name}'s account? This is permanent and only succeeds when no operational records still depend on it.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      const result = await deleteManagedUser(token, item.userId);
      setMessage(result.message);
      await loadPage(token, locator);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete the account.");
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading user management...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load users</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <Link href="/admin/login">Return to admin login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Scoped management</p>
        <h1>Manage users</h1>
        <p>Visible scope: {describeTerritory(user.adminProfile || emptyTerritorySummary())}</p>
      </section>

      <AdminNav />

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      <section className="grid stats">
        <article className="panel card">
          <h2>Total in view</h2>
          <div className="value">{managedUsers.length}</div>
        </article>
        <article className="panel card">
          <h2>Active</h2>
          <div className="value">{managedUsers.filter((item) => item.isActive).length}</div>
        </article>
        <article className="panel card">
          <h2>Inactive</h2>
          <div className="value">{managedUsers.filter((item) => !item.isActive).length}</div>
        </article>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <div className="section-head">
          <div>
            <h2>User list</h2>
            <p className="muted">
              {locator.role
                ? `${getManagedRoleLabel(locator.role)} records in ${describeTerritory({
                    ...emptyTerritorySummary(),
                    stateId: locator.stateId || null,
                    lgaId: locator.lgaId || null,
                    wardId: locator.wardId || null,
                  })}.`
                : "Start from the locator to choose territory and role before loading records."}
            </p>
          </div>
          <div className="action-row">
            <Link href="/admin/manage/territory">Open locator</Link>
            {locator.role !== "VOTER" ? (
              <Link href={locator.role ? `/admin/manage/create?role=${encodeURIComponent(locator.role)}&stateId=${encodeURIComponent(locator.stateId)}&lgaId=${encodeURIComponent(locator.lgaId)}&wardId=${encodeURIComponent(locator.wardId)}` : "/admin/manage/create"}>
                Create user
              </Link>
            ) : null}
          </div>
        </div>

        {!locator.role ? (
          <p className="muted">Select a role and territory from the locator before opening scoped users.</p>
        ) : managedUsers.length === 0 ? (
          <p className="muted">No users found in this territory for the selected role.</p>
        ) : (
          <div className="reward-list">
            {managedUsers.map((item) => (
              <article key={item.userId} className="reward-item">
                <div className="section-head compact">
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted">{item.email}</p>
                  </div>
                  <span className={`status-pill ${item.isActive ? "active" : "inactive"}`}>
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p>
                  {item.role}
                  {item.adminLevel ? ` | ${item.adminLevel}` : ""}
                  {item.officeType ? ` | ${item.officeType}` : ""}
                </p>
                <p className="muted">{describeTerritory(item.territory)}</p>
                <div className="action-row">
                  {(item.role === "ADMIN" || item.role === "CANDIDATE" || item.role === "AGENT") ? (
                    <Link
                      className="button secondary"
                      href={`/admin/manage/create?mode=edit&role=${encodeURIComponent(item.role)}&userId=${encodeURIComponent(item.userId)}`}
                    >
                      Edit User
                    </Link>
                  ) : null}
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void handleToggleUser(item.userId, !item.isActive)}
                  >
                    {item.isActive ? "Deactivate Account" : "Reactivate Account"}
                  </button>
                  {!item.isActive ? (
                    <button className="button danger" type="button" onClick={() => void handleDeleteUser(item)}>
                      Delete Account
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

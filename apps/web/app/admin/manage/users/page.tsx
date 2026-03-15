"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  matchesTerritoryFilter,
} from "../../../../components/admin-management-utils";

export default function AdminManageUsersPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUserItem[]>([]);
  const [territoryFilter, setTerritoryFilter] = useState({
    stateId: "",
    lgaId: "",
    wardId: "",
    role: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPage(token: string) {
    const [currentUser, users] = await Promise.all([
      fetchCurrentUser(token),
      fetchManagedUsers(token, { limit: 100 }),
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
    setTerritoryFilter({
      stateId: params.get("stateId") || "",
      lgaId: params.get("lgaId") || "",
      wardId: params.get("wardId") || "",
      role: params.get("role") || "",
      search: params.get("search") || "",
    });

    loadPage(token)
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
      await loadPage(token);
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
      await loadPage(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete the account.");
    }
  }

  const filteredUsers = useMemo(() => {
    return managedUsers.filter((item) => {
      if (territoryFilter.role && item.role !== territoryFilter.role) {
        return false;
      }

      if (territoryFilter.search) {
        const term = territoryFilter.search.toLowerCase();
        const matchesSearch = item.name.toLowerCase().includes(term) || item.email.toLowerCase().includes(term);
        if (!matchesSearch) {
          return false;
        }
      }

      return matchesTerritoryFilter(item.territory, territoryFilter);
    });
  }, [managedUsers, territoryFilter]);

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
          <div className="value">{filteredUsers.length}</div>
        </article>
        <article className="panel card">
          <h2>Active</h2>
          <div className="value">{filteredUsers.filter((item) => item.isActive).length}</div>
        </article>
        <article className="panel card">
          <h2>Inactive</h2>
          <div className="value">{filteredUsers.filter((item) => !item.isActive).length}</div>
        </article>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <div className="section-head">
          <div>
            <h2>User list</h2>
            <p className="muted">Use the territory selector to refine the list before acting on accounts.</p>
          </div>
          <Link href="/admin/manage/territory">Change territory</Link>
        </div>

        {filteredUsers.length === 0 ? (
          <p className="muted">No users found in this territory.</p>
        ) : (
          <div className="reward-list">
            {filteredUsers.map((item) => (
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

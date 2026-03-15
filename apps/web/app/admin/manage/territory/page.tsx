"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { emptyTerritorySummary } from "@pics-nigeria/shared";
import type { AuthUserProfile, LgaItem, StateItem, WardItem } from "@pics-nigeria/shared";
import { ApiError, fetchCurrentUser, fetchLgas, fetchStates, fetchWards } from "../../../../lib/api";
import { AdminNav } from "../../../../components/admin-nav";
import { describeTerritory } from "../../../../components/admin-management-utils";

export default function AdminManageTerritoryPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [states, setStates] = useState<StateItem[]>([]);
  const [lgas, setLgas] = useState<LgaItem[]>([]);
  const [wards, setWards] = useState<WardItem[]>([]);
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedLgaId, setSelectedLgaId] = useState("");
  const [selectedWardId, setSelectedWardId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    fetchCurrentUser(token)
      .then(async (currentUser) => {
        if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
          throw new ApiError("This page is available to admins only.", 403);
        }

        setUser(currentUser);
        const nextStates = await fetchStates(token, currentUser.adminProfile?.geoPoliticalZoneId || undefined);
        setStates(nextStates);
        setSelectedStateId(currentUser.adminProfile?.stateId || "");
      })
      .catch((caughtError) => {
        localStorage.removeItem("picsNigeriaAdminToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load territory controls.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token || !selectedStateId) {
      setLgas([]);
      setSelectedLgaId("");
      return;
    }

    fetchLgas(token, selectedStateId).then(setLgas).catch(() => setLgas([]));
  }, [selectedStateId]);

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAdminToken");
    if (!token || !selectedStateId || !selectedLgaId) {
      setWards([]);
      setSelectedWardId("");
      return;
    }

    fetchWards(token, selectedStateId, selectedLgaId).then(setWards).catch(() => setWards([]));
  }, [selectedStateId, selectedLgaId]);

  const nextHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedStateId) {
      params.set("stateId", selectedStateId);
    }
    if (selectedLgaId) {
      params.set("lgaId", selectedLgaId);
    }
    if (selectedWardId) {
      params.set("wardId", selectedWardId);
    }

    const query = params.toString();
    return query ? `/admin/manage/users?${query}` : "/admin/manage/users";
  }, [selectedLgaId, selectedStateId, selectedWardId]);

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading territory selector...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load territory selector</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <Link href="/admin/login">Return to admin login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Territory-first workflow</p>
        <h1>Select territory</h1>
        <p>Current authority: {describeTerritory(user.adminProfile || emptyTerritorySummary())}</p>
      </section>

      <AdminNav />

      <section className="panel card">
        <h2>Choose scope</h2>
        <p className="muted">Only territories already visible to your current admin account should be selected here.</p>
        <div className="form">
          <label className="field">
            <span>State</span>
            <select value={selectedStateId} onChange={(event) => setSelectedStateId(event.target.value)}>
              <option value="">All allowed states</option>
              {states
                .filter((item) => !user.adminProfile?.stateId || item.id === user.adminProfile.stateId)
                .map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>LGA</span>
            <select value={selectedLgaId} onChange={(event) => setSelectedLgaId(event.target.value)} disabled={!selectedStateId}>
              <option value="">All allowed LGAs</option>
              {lgas
                .filter((item) => !user.adminProfile?.lgaId || item.id === user.adminProfile.lgaId)
                .map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Ward</span>
            <select value={selectedWardId} onChange={(event) => setSelectedWardId(event.target.value)} disabled={!selectedLgaId}>
              <option value="">All allowed wards</option>
              {wards
                .filter((item) => !user.adminProfile?.wardId || item.id === user.adminProfile.wardId)
                .map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
            </select>
          </label>
        </div>
        <div className="action-row" style={{ marginTop: 16 }}>
          <Link className="button" href={nextHref}>View users in this scope</Link>
          <Link className="button secondary" href="/admin/manage">Back to management</Link>
        </div>
      </section>
    </main>
  );
}

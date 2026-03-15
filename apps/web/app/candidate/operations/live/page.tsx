"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AdminMapSummary, AgentActivitySummary, AuthUserProfile } from "@pics-nigeria/shared";
import {
  ApiError,
  fetchCandidateAgentActivitySummaries,
  fetchCandidateMapSummary,
  fetchCurrentUser,
} from "../../../../lib/api";
import { describeTerritory } from "../../../../components/admin-management-utils";

type Marker = {
  id: string;
  kind: "agent" | "incident";
  label: string;
  detail: string;
  x: number;
  y: number;
};

function buildMarkers(mapSummary: AdminMapSummary): Marker[] {
  const points = [
    ...mapSummary.activeAgents
      .filter((item) => item.latestLatitude !== null && item.latestLongitude !== null)
      .map((item) => ({
        id: item.agentUserId,
        kind: "agent" as const,
        label: item.name,
        detail: item.latestActivityType || "No recent activity",
        latitude: item.latestLatitude as number,
        longitude: item.latestLongitude as number,
      })),
    ...mapSummary.incidents
      .filter((item) => item.latitude !== null && item.longitude !== null)
      .map((item) => ({
        id: item.id,
        kind: "incident" as const,
        label: item.title,
        detail: `${item.type} | ${item.status}`,
        latitude: item.latitude as number,
        longitude: item.longitude as number,
      })),
  ];

  if (points.length === 0) {
    return [];
  }

  const latitudes = points.map((item) => item.latitude);
  const longitudes = points.map((item) => item.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.08);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.08);

  return points.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    detail: item.detail,
    x: 10 + ((item.longitude - minLongitude) / longitudeSpan) * 80,
    y: 12 + (1 - (item.latitude - minLatitude) / latitudeSpan) * 76,
  }));
}

export default function CandidateLiveOperationsPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [mapSummary, setMapSummary] = useState<AdminMapSummary | null>(null);
  const [activity, setActivity] = useState<AgentActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (!token) {
      window.location.href = "/candidate/login";
      return;
    }

    Promise.all([
      fetchCurrentUser(token),
      fetchCandidateMapSummary(token),
      fetchCandidateAgentActivitySummaries(token),
    ])
      .then(([currentUser, nextMapSummary, nextActivity]) => {
        if (currentUser.role !== "CANDIDATE") {
          throw new ApiError("This page is available to candidates only.", 403);
        }

        setUser(currentUser);
        setMapSummary(nextMapSummary);
        setActivity(nextActivity);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load campaign live tracking.");
      })
      .finally(() => setLoading(false));
  }, []);

  const markers = useMemo(() => (mapSummary ? buildMarkers(mapSummary) : []), [mapSummary]);

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading campaign live tracking...</h1>
        </section>
      </main>
    );
  }

  if (!user || !mapSummary) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load campaign live tracking</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <Link href="/candidate/dashboard">Return to candidate dashboard</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <p className="eyebrow">Campaign live tracking</p>
        <h1>Field agent activity</h1>
        <p>Visible territory: {describeTerritory(user.candidateProfile || {
          geoPoliticalZoneId: null, stateId: null, senatorialDistrictId: null, federalConstituencyId: null, lgaId: null, wardId: null, stateConstituencyId: null, pollingUnitId: null,
        })}</p>
      </section>

      <section className="live-map-layout">
        <section className="panel card live-map-frame">
          <div className="section-head">
            <div>
              <h2>Live map</h2>
              <p className="muted">Your campaign can monitor active field positions and reported incidents inside scope.</p>
            </div>
            <Link href="/candidate/dashboard">Back to dashboard</Link>
          </div>
          <div className="live-map-stage">
            <div className="live-map-grid" />
            {markers.length === 0 ? (
              <div className="live-map-empty">
                <strong>No live coordinates available.</strong>
              </div>
            ) : (
              markers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  className={`map-marker ${marker.kind}`}
                  style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  title={`${marker.label} | ${marker.detail}`}
                >
                  <span className="map-marker-pulse" />
                </button>
              ))
            )}
          </div>
        </section>

        <section className="live-map-side">
          <section className="panel card">
            <h2>Recent agent activity</h2>
            {activity.length === 0 ? (
              <p className="muted">No agent activity is visible in your campaign scope yet.</p>
            ) : (
              <div className="reward-list">
                {activity.slice(0, 8).map((item) => (
                  <article key={item.agentUserId} className="reward-item">
                    <strong>{item.name}</strong>
                    <p>{item.latestActivityType || "No recent activity"}</p>
                    <p className="muted">{item.latestActivityAt ? new Date(item.latestActivityAt).toLocaleString() : "No timestamp"}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

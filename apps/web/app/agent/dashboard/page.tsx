"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { AuthUserProfile, NotificationItem } from "@pics-nigeria/shared";
import {
  ApiError,
  createAgentActivity,
  createAgentIncident,
  fetchAgentActivities,
  fetchCurrentUser,
  fetchNotifications,
} from "../../../lib/api";

type AgentActivityItem = Awaited<ReturnType<typeof fetchAgentActivities>>[number];

export default function AgentDashboardPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [activities, setActivities] = useState<AgentActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityMessage, setActivityMessage] = useState("");
  const [incidentMessage, setIncidentMessage] = useState("");
  const [locationForm, setLocationForm] = useState({
    latitude: "",
    longitude: "",
    accuracyMeters: "",
    note: "",
    pollingUnitId: "",
  });
  const [incidentForm, setIncidentForm] = useState({
    type: "OTHER",
    title: "",
    description: "",
    severity: "MEDIUM",
    pollingUnitId: "",
    latitude: "",
    longitude: "",
  });

  async function loadAgentDashboard(token: string) {
    const [currentUser, recentActivities, notificationItems] = await Promise.all([
      fetchCurrentUser(token),
      fetchAgentActivities(token),
      fetchNotifications(token),
    ]);

    if (currentUser.role !== "AGENT") {
      throw new ApiError("This dashboard is available to agents only.", 403);
    }

    setUser(currentUser);
    setActivities(recentActivities);
    setNotifications(notificationItems);
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAgentToken");

    if (!token) {
      window.location.href = "/agent/login";
      return;
    }

    loadAgentDashboard(token)
      .catch((caughtError) => {
        localStorage.removeItem("picsNigeriaAgentToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load your agent dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleActivity(path: "check-in" | "check-out") {
    const token = localStorage.getItem("picsNigeriaAgentToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setActivityMessage("");
    try {
      await createAgentActivity(token, path, {});
      setActivityMessage(path === "check-in" ? "Check-in recorded." : "Check-out recorded.");
      await loadAgentDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Activity submission failed.");
    }
  }

  async function handleLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaAgentToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setActivityMessage("");
    try {
      await createAgentActivity(token, "location", {
        latitude: locationForm.latitude ? Number(locationForm.latitude) : undefined,
        longitude: locationForm.longitude ? Number(locationForm.longitude) : undefined,
        accuracyMeters: locationForm.accuracyMeters ? Number(locationForm.accuracyMeters) : undefined,
        note: locationForm.note || undefined,
        pollingUnitId: locationForm.pollingUnitId || undefined,
      });
      setActivityMessage("Location ping submitted.");
      setLocationForm({ latitude: "", longitude: "", accuracyMeters: "", note: "", pollingUnitId: "" });
      await loadAgentDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Location submission failed.");
    }
  }

  async function handleIncidentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaAgentToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setIncidentMessage("");
    try {
      await createAgentIncident(token, {
        type: incidentForm.type,
        title: incidentForm.title,
        description: incidentForm.description,
        severity: incidentForm.severity,
        pollingUnitId: incidentForm.pollingUnitId || undefined,
        latitude: incidentForm.latitude ? Number(incidentForm.latitude) : undefined,
        longitude: incidentForm.longitude ? Number(incidentForm.longitude) : undefined,
      });
      setIncidentMessage("Incident submitted.");
      setIncidentForm({
        type: "OTHER",
        title: "",
        description: "",
        severity: "MEDIUM",
        pollingUnitId: "",
        latitude: "",
        longitude: "",
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Incident submission failed.");
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading agent dashboard...</h1>
          <p>Please wait while your field profile is prepared.</p>
        </section>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="shell">
        <section className="panel card">
          <h1>Unable to load dashboard</h1>
          <p className="error">{error || "Authentication is required."}</p>
          <p>
            <Link href="/agent/login">Return to agent login</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <h1>{user.name}</h1>
        <p>
          Assigned territory: <strong>{user.agentProfile?.stateId}</strong> | {user.agentProfile?.lgaId} |{" "}
          {user.agentProfile?.wardId}
        </p>
        <p className="muted">Polling unit: {user.agentProfile?.pollingUnitId || "Not assigned"}</p>
      </section>

      <section className="grid stats">
        <article className="panel card">
          <h2>Recent Activity</h2>
          <div className="value">{activities.length}</div>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Attendance</h2>
          <div className="action-row">
            <button className="button" type="button" onClick={() => void handleActivity("check-in")}>
              Check in
            </button>
            <button className="button secondary" type="button" onClick={() => void handleActivity("check-out")}>
              Check out
            </button>
          </div>
          {activityMessage ? <p className="muted">{activityMessage}</p> : null}
        </section>

        <section className="panel card">
          <h2>Location Ping</h2>
          <form className="form" onSubmit={handleLocationSubmit}>
            <label className="field">
              <span>Latitude</span>
              <input value={locationForm.latitude} onChange={(event) => setLocationForm({ ...locationForm, latitude: event.target.value })} />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input value={locationForm.longitude} onChange={(event) => setLocationForm({ ...locationForm, longitude: event.target.value })} />
            </label>
            <label className="field">
              <span>Accuracy Meters</span>
              <input value={locationForm.accuracyMeters} onChange={(event) => setLocationForm({ ...locationForm, accuracyMeters: event.target.value })} />
            </label>
            <label className="field">
              <span>Polling Unit Id</span>
              <input value={locationForm.pollingUnitId} onChange={(event) => setLocationForm({ ...locationForm, pollingUnitId: event.target.value })} />
            </label>
            <label className="field">
              <span>Note</span>
              <input value={locationForm.note} onChange={(event) => setLocationForm({ ...locationForm, note: event.target.value })} />
            </label>
            <button className="button" type="submit">Submit location</button>
          </form>
        </section>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Quick Incident Submission</h2>
        <form className="form" onSubmit={handleIncidentSubmit}>
          <label className="field">
            <span>Type</span>
            <input value={incidentForm.type} onChange={(event) => setIncidentForm({ ...incidentForm, type: event.target.value })} />
          </label>
          <label className="field">
            <span>Title</span>
            <input value={incidentForm.title} onChange={(event) => setIncidentForm({ ...incidentForm, title: event.target.value })} required />
          </label>
          <label className="field">
            <span>Description</span>
            <input value={incidentForm.description} onChange={(event) => setIncidentForm({ ...incidentForm, description: event.target.value })} required />
          </label>
          <label className="field">
            <span>Severity</span>
            <input value={incidentForm.severity} onChange={(event) => setIncidentForm({ ...incidentForm, severity: event.target.value })} />
          </label>
          <label className="field">
            <span>Polling Unit Id</span>
            <input value={incidentForm.pollingUnitId} onChange={(event) => setIncidentForm({ ...incidentForm, pollingUnitId: event.target.value })} />
          </label>
          <button className="button" type="submit">Submit incident</button>
        </form>
        {incidentMessage ? <p className="muted">{incidentMessage}</p> : null}
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Recent Own Activity</h2>
        {activities.length === 0 ? (
          <p className="muted">No activity recorded yet.</p>
        ) : (
          <div className="reward-list">
            {activities.map((activity) => (
              <article key={activity.id} className="reward-item">
                <strong>{activity.type}</strong>
                <p>{activity.note || "No note"}</p>
                <p className="muted">{new Date(activity.createdAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Notifications</h2>
        {notifications.length === 0 ? (
          <p className="muted">No notifications yet.</p>
        ) : (
          <div className="reward-list">
            {notifications.slice(0, 5).map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.title}</strong>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

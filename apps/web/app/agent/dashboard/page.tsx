"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { AuthUserProfile, FieldTaskItem, NotificationItem } from "@pics-nigeria/shared";
import {
  ApiError,
  createAgentActivity,
  createAgentIncident,
  fetchAgentActivities,
  fetchAgentTasks,
  fetchCurrentUser,
  fetchNotifications,
  updateAgentTask,
} from "../../../lib/api";

type AgentActivityItem = Awaited<ReturnType<typeof fetchAgentActivities>>[number];

export default function AgentDashboardPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [activities, setActivities] = useState<AgentActivityItem[]>([]);
  const [tasks, setTasks] = useState<FieldTaskItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gpsGateError, setGpsGateError] = useState("");
  const [activityMessage, setActivityMessage] = useState("");
  const [incidentMessage, setIncidentMessage] = useState("");
  const [trackingActive, setTrackingActive] = useState(false);
  const [locationPending, setLocationPending] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState("");
  const [lastPingAt, setLastPingAt] = useState("");
  const [incidentForm, setIncidentForm] = useState({
    type: "OTHER",
    title: "",
    description: "",
    severity: "MEDIUM",
    pollingUnitId: "",
    latitude: "",
    longitude: "",
  });
  const trackerWatchId = useRef<number | null>(null);
  const lastTrackerSendAt = useRef(0);

  async function loadAgentDashboard(token: string) {
    const [currentUser, recentActivities, taskItems, notificationItems] = await Promise.all([
      fetchCurrentUser(token),
      fetchAgentActivities(token),
      fetchAgentTasks(token),
      fetchNotifications(token),
    ]);

    if (currentUser.role !== "AGENT") {
      throw new ApiError("This dashboard is available to agents only.", 403);
    }

    setUser(currentUser);
    setActivities(recentActivities);
    setTasks(taskItems);
    setNotifications(notificationItems);
  }

  function requireGpsForDashboard() {
    return new Promise<void>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Device GPS is required for agent access."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => reject(new Error("Turn on device GPS and allow location access to access the agent dashboard.")),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20_000,
        },
      );
    });
  }

  async function handleTaskStatusUpdate(taskId: string, status: FieldTaskItem["status"]) {
    const token = localStorage.getItem("picsNigeriaAgentToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    try {
      setError("");
      await updateAgentTask(token, taskId, { status });
      await loadAgentDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Task update failed.");
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaAgentToken");

    if (!token) {
      window.location.href = "/agent/login";
      return;
    }

    requireGpsForDashboard()
      .then(() => loadAgentDashboard(token))
      .catch((caughtError) => {
        setGpsGateError(caughtError instanceof Error ? caughtError.message : "Device GPS is required.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (trackerWatchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(trackerWatchId.current);
      }
    };
  }, []);

  function readCurrentPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Device GPS is not available on this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20_000,
      });
    });
  }

  async function sendDeviceLocation(path: "check-in" | "check-out" | "location", options?: { refreshDashboard?: boolean }) {
    const token = localStorage.getItem("picsNigeriaAgentToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setLocationPending(true);

    try {
      const position = await readCurrentPosition();
      const result = (await createAgentActivity(token, path, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
      })) as { message?: string };

      const message =
        typeof result?.message === "string"
          ? result.message
          : path === "location"
            ? "Live location synced."
            : path === "check-in"
              ? "Check-in recorded."
              : "Check-out recorded.";

      if (path === "location") {
        setTrackerStatus(message);
        setLastPingAt(new Date().toISOString());
      } else {
        setActivityMessage(message);
      }

      if (options?.refreshDashboard) {
        await loadAgentDashboard(token);
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Location access failed.";
      if (path === "location") {
        setTrackerStatus(message);
      } else {
        setError(message);
      }
    } finally {
      setLocationPending(false);
    }
  }

  async function handleActivity(path: "check-in" | "check-out") {
    setActivityMessage("");
    void sendDeviceLocation(path, { refreshDashboard: true });
  }

  async function handleStartTracking() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Device GPS is not available on this browser.");
      return;
    }

    const token = localStorage.getItem("picsNigeriaAgentToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    if (trackerWatchId.current !== null) {
      navigator.geolocation.clearWatch(trackerWatchId.current);
      trackerWatchId.current = null;
    }

    setError("");
    setTrackerStatus("Live tracking is starting. Allow GPS access on your device.");
    setTrackingActive(true);
    lastTrackerSendAt.current = 0;

    trackerWatchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (now - lastTrackerSendAt.current < 30_000) {
          return;
        }

        lastTrackerSendAt.current = now;
        try {
          const result = (await createAgentActivity(token, "location", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
          })) as { message?: string };
          setTrackerStatus(typeof result?.message === "string" ? result.message : "Live location synced.");
          setLastPingAt(new Date().toISOString());
        } catch (caughtError) {
          setTrackerStatus(caughtError instanceof Error ? caughtError.message : "Live tracking failed.");
        }
      },
      (geoError) => {
        trackerWatchId.current = null;
        setTrackingActive(false);
        setTrackerStatus(geoError.message || "Live tracking permission was denied.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20_000,
      },
    );
  }

  function handleStopTracking() {
    if (trackerWatchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(trackerWatchId.current);
      trackerWatchId.current = null;
    }

    setTrackingActive(false);
    setTrackerStatus("Live tracking is paused.");
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
          <p className="error">{gpsGateError || error || "Authentication is required."}</p>
          {gpsGateError ? (
            <p>
              <button className="button" type="button" onClick={() => window.location.reload()}>
                Retry GPS check
              </button>
            </p>
          ) : null}
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
        <p style={{ marginTop: 12 }}>
          <Link href="/agent/election-report" className="button">
            Submit Election Report
          </Link>
        </p>
      </section>

      <section className="grid stats">
        <article className="panel card">
          <h2>Recent Activity</h2>
          <div className="value">{activities.length}</div>
        </article>
        <article className="panel card">
          <h2>Open Tasks</h2>
          <div className="value">{tasks.filter((task) => task.status !== "DONE").length}</div>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel card">
          <h2>Attendance</h2>
          <div className="action-row">
            <button className="button" type="button" onClick={() => void handleActivity("check-in")} disabled={locationPending}>
              {locationPending ? "Waiting for GPS..." : "Check in"}
            </button>
            <button className="button secondary" type="button" onClick={() => void handleActivity("check-out")} disabled={locationPending}>
              {locationPending ? "Waiting for GPS..." : "Check out"}
            </button>
          </div>
          <p className="muted">Attendance records now use device GPS coordinates instead of typed location values.</p>
          {activityMessage ? <p className="muted">{activityMessage}</p> : null}
        </section>

        <section className="panel card">
          <h2>Live Tracking</h2>
          <p className="muted">Use device GPS and network position to send live polling-unit field location to the admin tracker map.</p>
          <div className="action-row">
            <button className="button" type="button" onClick={() => void handleStartTracking()} disabled={trackingActive || locationPending}>
              {trackingActive ? "Tracking live" : "Start live tracking"}
            </button>
            <button className="button secondary" type="button" onClick={handleStopTracking} disabled={!trackingActive}>
              Stop tracking
            </button>
            <button className="button secondary" type="button" onClick={() => void sendDeviceLocation("location")} disabled={locationPending}>
              {locationPending ? "Syncing..." : "Send location now"}
            </button>
          </div>
          {trackerStatus ? <p className="muted">{trackerStatus}</p> : null}
          {lastPingAt ? <p className="muted">Last live ping: {new Date(lastPingAt).toLocaleString()}</p> : null}
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
        <h2>Assigned Tasks</h2>
        {tasks.length === 0 ? (
          <p className="muted">No tasks assigned yet.</p>
        ) : (
          <div className="reward-list">
            {tasks.map((task) => (
              <article key={task.id} className="reward-item">
                <div className="section-head compact">
                  <div>
                    <strong>{task.title}</strong>
                    <p className="muted">{task.priority} | {task.status}</p>
                  </div>
                  <span className={`status-pill ${task.status === "DONE" ? "active" : task.status === "BLOCKED" ? "inactive" : ""}`}>{task.status}</span>
                </div>
                <p>{task.description}</p>
                <p className="muted">
                  Created by {task.creatorName} | Due {task.dueAt ? new Date(task.dueAt).toLocaleString() : "not set"}
                </p>
                <div className="action-row">
                  <button className="button secondary" type="button" onClick={() => void handleTaskStatusUpdate(task.id, "IN_PROGRESS")}>Start</button>
                  <button className="button secondary" type="button" onClick={() => void handleTaskStatusUpdate(task.id, "BLOCKED")}>Block</button>
                  <button className="button" type="button" onClick={() => void handleTaskStatusUpdate(task.id, "DONE")}>Complete</button>
                </div>
              </article>
            ))}
          </div>
        )}
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

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthUserProfile, FeedbackListItem, IncidentListItem, NotificationItem, PostListItem } from "@pics-nigeria/shared";
import { ApiError, fetchCandidateFeedback, fetchCandidateIncidents, fetchCandidatePosts, fetchCurrentUser, fetchNotifications } from "../../../lib/api";

export default function CandidateDashboardPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackListItem[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [incidentCount, setIncidentCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      window.location.href = "/candidate/login";
      return;
    }
    const authToken = token;

    async function loadDashboard() {
      try {
        const [currentUser, nextPosts, nextFeedback, nextIncidents, nextNotifications] = await Promise.all([
          fetchCurrentUser(authToken),
          fetchCandidatePosts(authToken),
          fetchCandidateFeedback(authToken),
          fetchCandidateIncidents(authToken),
          fetchNotifications(authToken),
        ]);

        if (currentUser.role !== "CANDIDATE") {
          throw new ApiError("This dashboard is available to candidates only.", 403);
        }

        setUser(currentUser);
        setPosts(nextPosts);
        setFeedback(nextFeedback.feedback);
        setFeedbackCount(nextFeedback.totalFeedback);
        setIncidents(nextIncidents.incidents);
        setIncidentCount(nextIncidents.totalIncidents);
        setNotifications(nextNotifications);
      } catch (caughtError) {
        localStorage.removeItem("picsNigeriaCandidateToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load your candidate dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="shell">
        <section className="panel hero">
          <h1>Loading candidate dashboard...</h1>
          <p>Please wait while your candidate data is being prepared.</p>
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
            <Link href="/candidate/login">Return to candidate login</Link>
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
          Office: <strong>{user.candidateProfile?.officeType || "N/A"}</strong>
        </p>
        <p className="muted">
          Territory: {user.candidateProfile?.stateId || "national"} |{" "}
          {user.candidateProfile?.federalConstituencyId || user.candidateProfile?.lgaId || "broad scope"}
        </p>
      </section>

      <section className="grid stats">
        <article className="panel card">
          <h2>Authored Posts</h2>
          <div className="value">{posts.length}</div>
        </article>
        <article className="panel card">
          <h2>Visible Feedback</h2>
          <div className="value">{feedbackCount}</div>
        </article>
        <article className="panel card">
          <h2>Visible Incidents</h2>
          <div className="value">{incidentCount}</div>
        </article>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Posts</h2>
        {posts.length === 0 ? (
          <p className="muted">No posts authored yet.</p>
        ) : (
          <div className="reward-list">
            {posts.map((post) => (
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
        <h2>Feedback Summary</h2>
        {feedback.length === 0 ? (
          <p className="muted">No feedback visible yet.</p>
        ) : (
          <div className="reward-list">
            {feedback.slice(0, 5).map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.type}</strong>
                <p>{item.message}</p>
                <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <h2>Incident Summary</h2>
        {incidents.length === 0 ? (
          <p className="muted">No incidents visible yet.</p>
        ) : (
          <div className="reward-list">
            {incidents.slice(0, 5).map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.title}</strong>
                <p>{item.type} | {item.severity} | {item.status}</p>
                <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
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

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { AuthUserProfile, FeedbackListItem, IncidentListItem, NotificationItem, PostListItem } from "@pics-nigeria/shared";
import {
  ApiError,
  createCandidatePost,
  fetchCandidateFeedback,
  fetchCandidateIncidents,
  fetchCandidatePosts,
  fetchCurrentUser,
  fetchNotifications,
  markAllNotificationsRead,
} from "../../../lib/api";

type CandidateDashboardData = {
  currentUser: AuthUserProfile;
  nextPosts: PostListItem[];
  nextFeedback: { totalFeedback: number; feedback: FeedbackListItem[] };
  nextIncidents: { totalIncidents: number; incidents: IncidentListItem[] };
  nextNotifications: NotificationItem[];
};

async function loadCandidateDashboard(token: string): Promise<CandidateDashboardData> {
  const [currentUser, nextPosts, nextFeedback, nextIncidents, nextNotifications] = await Promise.all([
    fetchCurrentUser(token),
    fetchCandidatePosts(token),
    fetchCandidateFeedback(token),
    fetchCandidateIncidents(token),
    fetchNotifications(token),
  ]);

  if (currentUser.role !== "CANDIDATE") {
    throw new ApiError("This dashboard is available to candidates only.", 403);
  }

  return {
    currentUser,
    nextPosts,
    nextFeedback,
    nextIncidents,
    nextNotifications,
  };
}

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
  const [postMessage, setPostMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [markingNotifications, setMarkingNotifications] = useState(false);
  const [postForm, setPostForm] = useState({
    title: "",
    content: "",
    audience: "ALL" as "VOTERS" | "AGENTS" | "ALL",
  });

  async function hydrateDashboard(token: string) {
    const data = await loadCandidateDashboard(token);
    setUser(data.currentUser);
    setPosts(data.nextPosts);
    setFeedback(data.nextFeedback.feedback);
    setFeedbackCount(data.nextFeedback.totalFeedback);
    setIncidents(data.nextIncidents.incidents);
    setIncidentCount(data.nextIncidents.totalIncidents);
    setNotifications(data.nextNotifications);
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      window.location.href = "/candidate/login";
      return;
    }

    hydrateDashboard(token)
      .catch((caughtError) => {
        localStorage.removeItem("picsNigeriaCandidateToken");
        setError(caughtError instanceof Error ? caughtError.message : "Could not load your candidate dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handlePostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setPostMessage("");
    setSubmittingPost(true);

    try {
      await createCandidatePost(token, {
        title: postForm.title,
        content: postForm.content,
        isPublished: true,
        audience: postForm.audience,
      });
      setPostForm({ title: "", content: "", audience: postForm.audience });
      setPostMessage("Post published successfully.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not publish your post.");
    } finally {
      setSubmittingPost(false);
    }
  }

  async function handleMarkNotificationsRead() {
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setNotificationMessage("");
    setMarkingNotifications(true);

    try {
      await markAllNotificationsRead(token);
      setNotificationMessage("Notifications marked as read.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update notifications.");
    } finally {
      setMarkingNotifications(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("picsNigeriaCandidateToken");
    window.location.href = "/candidate/login";
  }

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

  if (error && !user) {
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

  if (!user) {
    return null;
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <div className="section-head">
          <div>
            <h1>{user.name}</h1>
            <p>
              Office: <strong>{user.candidateProfile?.officeType || "N/A"}</strong>
            </p>
            <p className="muted">
              Territory: {user.candidateProfile?.stateId || "national"} |{" "}
              {user.candidateProfile?.federalConstituencyId || user.candidateProfile?.lgaId || "broad scope"}
            </p>
          </div>
          <div className="action-row">
            <button className="button secondary" type="button" onClick={() => void handleMarkNotificationsRead()} disabled={markingNotifications}>
              {markingNotifications ? "Updating..." : "Mark notifications read"}
            </button>
            <button className="button" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {notificationMessage ? <p className="muted">{notificationMessage}</p> : null}
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

      <section className="grid" style={{ marginTop: 24, gridTemplateColumns: "minmax(280px, 1.1fr) minmax(280px, 1fr)" }}>
        <section className="panel card">
          <h2>Publish Campaign Post</h2>
          <p className="muted">
            Communication is delivered through scoped posts plus notifications to supporters and agents in your campaign territory.
          </p>
          <form className="form" onSubmit={handlePostSubmit}>
            <label className="field">
              <span>Title</span>
              <input
                value={postForm.title}
                onChange={(event) => setPostForm({ ...postForm, title: event.target.value })}
                minLength={3}
                required
              />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea
                rows={6}
                value={postForm.content}
                onChange={(event) => setPostForm({ ...postForm, content: event.target.value })}
                minLength={10}
                required
              />
            </label>
            <label className="field">
              <span>Audience</span>
              <select
                value={postForm.audience}
                onChange={(event) => setPostForm({ ...postForm, audience: event.target.value as "VOTERS" | "AGENTS" | "ALL" })}
              >
                <option value="ALL">Supporters and agents</option>
                <option value="VOTERS">Supporters only</option>
                <option value="AGENTS">Agents only</option>
              </select>
            </label>
            <button className="button" type="submit" disabled={submittingPost}>
              {submittingPost ? "Publishing..." : "Publish post"}
            </button>
          </form>
          {postMessage ? <p className="muted">{postMessage}</p> : null}
        </section>

        <section className="panel card">
          <h2>Recent Notifications</h2>
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
    </main>
  );
}

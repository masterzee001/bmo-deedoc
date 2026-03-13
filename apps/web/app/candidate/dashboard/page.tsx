"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type {
  AuthUserProfile,
  BroadcastMessageItem,
  CandidateProfileEditorItem,
  CandidateVoterItem,
  FeedbackListItem,
  IncidentListItem,
  NotificationItem,
  PostListItem,
} from "@pics-nigeria/shared";
import {
  ApiError,
  createCandidateBroadcast,
  createCandidatePost,
  deleteCandidatePost,
  fetchCandidateBroadcasts,
  fetchCandidateFeedback,
  fetchCandidateIncidents,
  fetchCandidatePosts,
  fetchCandidateProfileEditor,
  fetchCandidateVoters,
  fetchCurrentUser,
  fetchNotifications,
  markAllNotificationsRead,
  updateCandidatePost,
  updateCandidateProfile,
} from "../../../lib/api";

const officeLabels: Record<string, string> = {
  PRESIDENTIAL: "Presidential",
  GOVERNORSHIP: "Governorship",
  SENATE: "Senate",
  HOUSE_OF_REP: "House of Representatives",
  STATE_ASSEMBLY: "State Assembly",
  CHAIRMANSHIP: "Chairmanship",
  COUNCILLOR: "Councillor",
};

type CandidateDashboardData = {
  currentUser: AuthUserProfile;
  profile: CandidateProfileEditorItem;
  nextPosts: PostListItem[];
  nextBroadcasts: BroadcastMessageItem[];
  nextVoters: CandidateVoterItem[];
  nextFeedback: { totalFeedback: number; feedback: FeedbackListItem[] };
  nextIncidents: { totalIncidents: number; incidents: IncidentListItem[] };
  nextNotifications: NotificationItem[];
};

async function loadCandidateDashboard(token: string): Promise<CandidateDashboardData> {
  const [currentUser, profile, nextPosts, nextBroadcasts, nextVoters, nextFeedback, nextIncidents, nextNotifications] =
    await Promise.all([
      fetchCurrentUser(token),
      fetchCandidateProfileEditor(token),
      fetchCandidatePosts(token),
      fetchCandidateBroadcasts(token),
      fetchCandidateVoters(token),
      fetchCandidateFeedback(token),
      fetchCandidateIncidents(token),
      fetchNotifications(token),
    ]);

  if (currentUser.role !== "CANDIDATE") {
    throw new ApiError("This dashboard is available to candidates only.", 403);
  }

  return {
    currentUser,
    profile,
    nextPosts,
    nextBroadcasts,
    nextVoters,
    nextFeedback,
    nextIncidents,
    nextNotifications,
  };
}

function resolveTerritoryLabel(profile: CandidateProfileEditorItem | null) {
  if (!profile) {
    return "Campaign territory unavailable";
  }

  return (
    profile.territory.pollingUnitId ||
    profile.territory.wardId ||
    profile.territory.lgaId ||
    profile.territory.stateConstituencyId ||
    profile.territory.federalConstituencyId ||
    profile.territory.senatorialDistrictId ||
    profile.territory.stateId ||
    "National campaign"
  );
}

export default function CandidateDashboardPage() {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [profile, setProfile] = useState<CandidateProfileEditorItem | null>(null);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessageItem[]>([]);
  const [voters, setVoters] = useState<CandidateVoterItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackListItem[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [incidentCount, setIncidentCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);
  const [markingNotifications, setMarkingNotifications] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    portraitUrl: "",
    campaignSlogan: "",
    bio: "",
    websiteUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    xUrl: "",
    isProfilePublished: false,
  });
  const [materialForm, setMaterialForm] = useState({
    title: "",
    content: "",
    mediaType: "TEXT" as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT",
    mediaUrl: "",
    thumbnailUrl: "",
    isPublished: true,
    audience: "ALL" as "VOTERS" | "AGENTS" | "ALL",
  });
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
  });

  async function hydrateDashboard(token: string) {
    const data = await loadCandidateDashboard(token);
    setUser(data.currentUser);
    setProfile(data.profile);
    setPosts(data.nextPosts);
    setBroadcasts(data.nextBroadcasts);
    setVoters(data.nextVoters);
    setFeedback(data.nextFeedback.feedback);
    setFeedbackCount(data.nextFeedback.totalFeedback);
    setIncidents(data.nextIncidents.incidents);
    setIncidentCount(data.nextIncidents.totalIncidents);
    setNotifications(data.nextNotifications);
    setProfileForm({
      portraitUrl: data.profile.portraitUrl || "",
      campaignSlogan: data.profile.campaignSlogan || "",
      bio: data.profile.bio || "",
      websiteUrl: data.profile.websiteUrl || "",
      facebookUrl: data.profile.facebookUrl || "",
      instagramUrl: data.profile.instagramUrl || "",
      xUrl: data.profile.xUrl || "",
      isProfilePublished: data.profile.isProfilePublished,
    });
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

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");
    setSubmittingProfile(true);

    try {
      const result = await updateCandidateProfile(token, profileForm);
      setProfile(result.profile);
      setStatusMessage(result.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update your candidate profile.");
    } finally {
      setSubmittingProfile(false);
    }
  }

  async function handleMaterialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");
    setSubmittingMaterial(true);

    try {
      if (editingMaterialId) {
        await updateCandidatePost(token, editingMaterialId, {
          title: materialForm.title,
          content: materialForm.content,
          mediaType: materialForm.mediaType,
          mediaUrl: materialForm.mediaUrl,
          thumbnailUrl: materialForm.thumbnailUrl,
          isPublished: materialForm.isPublished,
        });
        setStatusMessage("Campaign material updated successfully.");
      } else {
        await createCandidatePost(token, materialForm);
        setStatusMessage("Campaign material saved successfully.");
      }

      setEditingMaterialId(null);
      setMaterialForm({
        title: "",
        content: "",
        mediaType: "TEXT",
        mediaUrl: "",
        thumbnailUrl: "",
        isPublished: true,
        audience: "ALL",
      });
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save your campaign material.");
    } finally {
      setSubmittingMaterial(false);
    }
  }

  async function handleBroadcastSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");
    setSubmittingBroadcast(true);

    try {
      await createCandidateBroadcast(token, broadcastForm);
      setBroadcastForm({ title: "", message: "" });
      setStatusMessage("Campaign message sent to consented voters.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not send your campaign message.");
    } finally {
      setSubmittingBroadcast(false);
    }
  }

  async function handleMarkNotificationsRead() {
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");
    setMarkingNotifications(true);

    try {
      await markAllNotificationsRead(token);
      setStatusMessage("Notifications marked as read.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update notifications.");
    } finally {
      setMarkingNotifications(false);
    }
  }

  function beginEditMaterial(post: PostListItem) {
    setEditingMaterialId(post.id);
    setMaterialForm({
      title: post.title,
      content: post.content,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl || "",
      thumbnailUrl: post.thumbnailUrl || "",
      isPublished: post.isPublished,
      audience: "ALL",
    });
  }

  async function handleToggleMaterial(post: PostListItem) {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");

    try {
      await updateCandidatePost(token, post.id, { isPublished: !post.isPublished });
      setStatusMessage(post.isPublished ? "Campaign material moved to draft." : "Campaign material published.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update campaign material status.");
    }
  }

  async function handleDeleteMaterial(postId: string) {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");

    try {
      await deleteCandidatePost(token, postId);
      if (editingMaterialId === postId) {
        setEditingMaterialId(null);
      }
      setStatusMessage("Campaign material deleted successfully.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete campaign material.");
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
          <p>Please wait while your campaign workspace is being prepared.</p>
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

  if (!user || !profile) {
    return null;
  }

  return (
    <main className="shell">
      <section className="panel hero candidate-hero">
        <div className="candidate-identity">
          {profileForm.portraitUrl ? (
            <img src={profileForm.portraitUrl} alt={`${user.name} portrait`} className="candidate-portrait" />
          ) : (
            <div className="candidate-portrait fallback">{user.name.slice(0, 1)}</div>
          )}
          <div>
            <h1>{user.name}</h1>
            <p className="candidate-office">{officeLabels[profile.officeType] || profile.officeType}</p>
            <p className="muted">{resolveTerritoryLabel(profile)}</p>
            <div className="badge-row">
              <span className={`status-badge ${profile.isProfilePublished ? "live" : "draft"}`}>
                {profile.isProfilePublished ? "Public profile live" : "Profile draft"}
              </span>
              <Link href={`/candidates/${user.id}`}>Preview public profile</Link>
            </div>
          </div>
        </div>
        <div className="action-row">
          <button className="button secondary" type="button" onClick={() => void handleMarkNotificationsRead()} disabled={markingNotifications}>
            {markingNotifications ? "Updating..." : "Mark notifications read"}
          </button>
          <button className="button" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {statusMessage ? <p className="muted">{statusMessage}</p> : null}
      </section>

      <section className="grid stats">
        <article className="panel card">
          <h2>Campaign Materials</h2>
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
        <article className="panel card">
          <h2>Consented Voters</h2>
          <div className="value">{voters.length}</div>
        </article>
      </section>

      <section className="candidate-dashboard-grid">
        <section className="panel card">
          <h2>Public Profile</h2>
          <p className="muted">Keep your public-facing candidate profile polished before publishing it to voters.</p>
          <form className="form" onSubmit={handleProfileSubmit}>
            <label className="field">
              <span>Portrait URL</span>
              <input value={profileForm.portraitUrl} onChange={(event) => setProfileForm({ ...profileForm, portraitUrl: event.target.value })} />
            </label>
            <label className="field">
              <span>Campaign slogan</span>
              <input value={profileForm.campaignSlogan} onChange={(event) => setProfileForm({ ...profileForm, campaignSlogan: event.target.value })} maxLength={160} />
            </label>
            <label className="field">
              <span>Bio / manifesto summary</span>
              <textarea rows={5} value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} maxLength={2000} />
            </label>
            <label className="field">
              <span>Website URL</span>
              <input value={profileForm.websiteUrl} onChange={(event) => setProfileForm({ ...profileForm, websiteUrl: event.target.value })} />
            </label>
            <label className="field">
              <span>Facebook URL</span>
              <input value={profileForm.facebookUrl} onChange={(event) => setProfileForm({ ...profileForm, facebookUrl: event.target.value })} />
            </label>
            <label className="field">
              <span>Instagram URL</span>
              <input value={profileForm.instagramUrl} onChange={(event) => setProfileForm({ ...profileForm, instagramUrl: event.target.value })} />
            </label>
            <label className="field">
              <span>X URL</span>
              <input value={profileForm.xUrl} onChange={(event) => setProfileForm({ ...profileForm, xUrl: event.target.value })} />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={profileForm.isProfilePublished}
                onChange={(event) => setProfileForm({ ...profileForm, isProfilePublished: event.target.checked })}
              />
              <span>Publish this profile for voter discovery</span>
            </label>
            <button className="button" type="submit" disabled={submittingProfile}>
              {submittingProfile ? "Saving..." : "Save profile"}
            </button>
          </form>
        </section>

        <section className="panel card">
          <h2>{editingMaterialId ? "Edit Campaign Material" : "Create Campaign Material"}</h2>
          <p className="muted">Use text, banners, videos, and posters to build a professional public campaign gallery.</p>
          <form className="form" onSubmit={handleMaterialSubmit}>
            <label className="field">
              <span>Title</span>
              <input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} minLength={3} required />
            </label>
            <label className="field">
              <span>Description / caption</span>
              <textarea rows={5} value={materialForm.content} onChange={(event) => setMaterialForm({ ...materialForm, content: event.target.value })} minLength={3} required />
            </label>
            <label className="field">
              <span>Media type</span>
              <select value={materialForm.mediaType} onChange={(event) => setMaterialForm({ ...materialForm, mediaType: event.target.value as typeof materialForm.mediaType })}>
                <option value="TEXT">Text update</option>
                <option value="IMAGE">Banner / image</option>
                <option value="VIDEO">Video</option>
                <option value="DOCUMENT">Document / flyer</option>
              </select>
            </label>
            {materialForm.mediaType !== "TEXT" ? (
              <>
                <label className="field">
                  <span>Media URL</span>
                  <input value={materialForm.mediaUrl} onChange={(event) => setMaterialForm({ ...materialForm, mediaUrl: event.target.value })} required />
                </label>
                <label className="field">
                  <span>Thumbnail URL</span>
                  <input value={materialForm.thumbnailUrl} onChange={(event) => setMaterialForm({ ...materialForm, thumbnailUrl: event.target.value })} />
                </label>
              </>
            ) : null}
            {!editingMaterialId ? (
              <label className="field">
                <span>Audience notification</span>
                <select value={materialForm.audience} onChange={(event) => setMaterialForm({ ...materialForm, audience: event.target.value as typeof materialForm.audience })}>
                  <option value="ALL">Supporters and agents</option>
                  <option value="VOTERS">Supporters only</option>
                  <option value="AGENTS">Agents only</option>
                </select>
              </label>
            ) : null}
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={materialForm.isPublished}
                onChange={(event) => setMaterialForm({ ...materialForm, isPublished: event.target.checked })}
              />
              <span>Publish immediately</span>
            </label>
            <div className="action-row">
              <button className="button" type="submit" disabled={submittingMaterial}>
                {submittingMaterial ? "Saving..." : editingMaterialId ? "Update material" : "Create material"}
              </button>
              {editingMaterialId ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setEditingMaterialId(null);
                    setMaterialForm({
                      title: "",
                      content: "",
                      mediaType: "TEXT",
                      mediaUrl: "",
                      thumbnailUrl: "",
                      isPublished: true,
                      audience: "ALL",
                    });
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </section>

      <section className="candidate-dashboard-grid">
        <section className="panel card">
          <h2>Campaign Materials</h2>
          {posts.length === 0 ? (
            <p className="muted">No campaign materials yet. Create your first public update, banner, or video.</p>
          ) : (
            <div className="candidate-material-list">
              {posts.map((post) => (
                <article key={post.id} className="candidate-material-item">
                  <div>
                    <strong>{post.title}</strong>
                    <p className="muted">
                      {post.mediaType} | {post.isPublished ? "Published" : "Draft"} | {new Date(post.createdAt).toLocaleString()}
                    </p>
                    <p>{post.content}</p>
                  </div>
                  <div className="action-row">
                    <button className="button secondary" type="button" onClick={() => beginEditMaterial(post)}>
                      Edit
                    </button>
                    <button className="button secondary" type="button" onClick={() => void handleToggleMaterial(post)}>
                      {post.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button className="button danger" type="button" onClick={() => void handleDeleteMaterial(post.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <h2>Consent-Based Voter Messaging</h2>
          <p className="muted">This reaches only active voters in your territory who opted in during registration.</p>
          <form className="form" onSubmit={handleBroadcastSubmit}>
            <label className="field">
              <span>Title</span>
              <input value={broadcastForm.title} onChange={(event) => setBroadcastForm({ ...broadcastForm, title: event.target.value })} minLength={3} required />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea rows={5} value={broadcastForm.message} onChange={(event) => setBroadcastForm({ ...broadcastForm, message: event.target.value })} minLength={10} required />
            </label>
            <button className="button" type="submit" disabled={submittingBroadcast}>
              {submittingBroadcast ? "Sending..." : "Send to consented voters"}
            </button>
          </form>
        </section>
      </section>

      <section className="candidate-dashboard-grid">
        <section className="panel card">
          <h2>Voter Register Snapshot</h2>
          {voters.length === 0 ? (
            <p className="muted">No consented voters are available in your territory yet.</p>
          ) : (
            <div className="reward-list">
              {voters.slice(0, 8).map((voter) => (
                <article key={voter.userId} className="reward-item">
                  <strong>{voter.name}</strong>
                  <p>{voter.emailMask} | {voter.phoneMask}</p>
                  <p className="muted">{voter.territory.pollingUnitId || voter.territory.wardId || "Scoped territory voter"}</p>
                </article>
              ))}
            </div>
          )}
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

      <section className="candidate-dashboard-grid">
        <section className="panel card">
          <h2>Recent Campaign Messages</h2>
          {broadcasts.length === 0 ? (
            <p className="muted">No direct voter messages sent yet.</p>
          ) : (
            <div className="reward-list">
              {broadcasts.slice(0, 6).map((broadcast) => (
                <article key={broadcast.id} className="reward-item">
                  <strong>{broadcast.title}</strong>
                  <p>{broadcast.message}</p>
                  <p className="muted">{broadcast.recipientCount} consented voters | {new Date(broadcast.createdAt).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel card">
          <h2>Feedback and Incidents</h2>
          <div className="candidate-mini-grid">
            <article>
              <strong>Feedback</strong>
              <div className="value small">{feedbackCount}</div>
            </article>
            <article>
              <strong>Incidents</strong>
              <div className="value small">{incidentCount}</div>
            </article>
          </div>
          <div className="reward-list">
            {feedback.slice(0, 3).map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.type}</strong>
                <p>{item.message}</p>
              </article>
            ))}
            {incidents.slice(0, 3).map((item) => (
              <article key={item.id} className="reward-item">
                <strong>{item.title}</strong>
                <p>{item.type} | {item.severity} | {item.status}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

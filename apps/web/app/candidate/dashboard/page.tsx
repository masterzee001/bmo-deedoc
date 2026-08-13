"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type {
  AuthUserProfile,
  BroadcastMessageItem,
  CampaignEventItem,
  CandidateProfileEditorItem,
  CandidateVoterItem,
  FeedbackListItem,
  IncidentListItem,
  LgaItem,
  NotificationItem,
  PollingUnitItem,
  PostListItem,
  StateItem,
  WardItem,
} from "@pics-nigeria/shared";
import {
  ApiError,
  createCandidateBroadcast,
  createCandidateEvent,
  createCandidatePost,
  deleteCandidateEvent,
  deleteCandidatePost,
  fetchCandidateBroadcasts,
  fetchCandidateEvents,
  fetchCandidateFeedback,
  fetchCandidateIncidents,
  fetchCandidatePosts,
  fetchCandidateProfileEditor,
  fetchCandidateVoters,
  fetchCurrentUser,
  fetchNotifications,
  fetchPublicLgas,
  fetchPublicPollingUnits,
  fetchPublicStates,
  fetchPublicWards,
  logoutCurrentUser,
  markAllNotificationsRead,
  uploadCandidateImage,
  updateCandidatePost,
  updateCandidateEvent,
  updateCandidateProfile,
} from "../../../lib/api";
import { clearSession } from "../../../lib/session";

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
  nextEvents: CampaignEventItem[];
  nextBroadcasts: BroadcastMessageItem[];
  nextVoters: CandidateVoterItem[];
  nextFeedback: { totalFeedback: number; feedback: FeedbackListItem[] };
  nextIncidents: { totalIncidents: number; incidents: IncidentListItem[] };
  nextNotifications: NotificationItem[];
};

async function loadCandidateDashboard(token: string): Promise<CandidateDashboardData> {
  const [currentUser, profile, nextPosts, nextEvents, nextBroadcasts, nextVoters, nextFeedback, nextIncidents, nextNotifications] =
    await Promise.all([
      fetchCurrentUser(token),
      fetchCandidateProfileEditor(token),
      fetchCandidatePosts(token),
      fetchCandidateEvents(token),
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
    nextEvents,
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
  const [events, setEvents] = useState<CampaignEventItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessageItem[]>([]);
  const [voters, setVoters] = useState<CandidateVoterItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackListItem[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [incidentCount, setIncidentCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [states, setStates] = useState<StateItem[]>([]);
  const [lgas, setLgas] = useState<LgaItem[]>([]);
  const [wards, setWards] = useState<WardItem[]>([]);
  const [pollingUnits, setPollingUnits] = useState<PollingUnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [markingNotifications, setMarkingNotifications] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    portraitAssetId: "",
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
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    venue: "",
    coverImageAssetId: "",
    coverImageUrl: "",
    stateId: "",
    lgaId: "",
    wardId: "",
    pollingUnitId: "",
    startsAt: "",
    endsAt: "",
    isPublished: true,
  });
  const canNarrowEventTerritory = Boolean(
    profile &&
      !profile.territory.senatorialDistrictId &&
      !profile.territory.federalConstituencyId &&
      !profile.territory.stateConstituencyId,
  );

  async function hydrateDashboard(token: string) {
    const data = await loadCandidateDashboard(token);
    setUser(data.currentUser);
    setProfile(data.profile);
    setPosts(data.nextPosts);
    setEvents(data.nextEvents);
    setBroadcasts(data.nextBroadcasts);
    setVoters(data.nextVoters);
    setFeedback(data.nextFeedback.feedback);
    setFeedbackCount(data.nextFeedback.totalFeedback);
    setIncidents(data.nextIncidents.incidents);
    setIncidentCount(data.nextIncidents.totalIncidents);
    setNotifications(data.nextNotifications);
    setProfileForm({
      portraitUrl: data.profile.portraitUrl || "",
      portraitAssetId: data.profile.portraitAssetId || "",
      campaignSlogan: data.profile.campaignSlogan || "",
      bio: data.profile.bio || "",
      websiteUrl: data.profile.websiteUrl || "",
      facebookUrl: data.profile.facebookUrl || "",
      instagramUrl: data.profile.instagramUrl || "",
      xUrl: data.profile.xUrl || "",
      isProfilePublished: data.profile.isProfilePublished,
    });
    setStates(await fetchPublicStates());
  }

  useEffect(() => {
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      window.location.href = "/candidate/login";
      return;
    }

    hydrateDashboard(token)
      .catch((caughtError) => {
        clearSession();
        setError(caughtError instanceof Error ? caughtError.message : "Could not load your candidate dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!eventForm.stateId) {
      setLgas([]);
      return;
    }

    fetchPublicLgas(eventForm.stateId)
      .then(setLgas)
      .catch(() => setLgas([]));
  }, [eventForm.stateId]);

  useEffect(() => {
    if (!eventForm.stateId || !eventForm.lgaId) {
      setWards([]);
      return;
    }

    fetchPublicWards(eventForm.stateId, eventForm.lgaId)
      .then(setWards)
      .catch(() => setWards([]));
  }, [eventForm.stateId, eventForm.lgaId]);

  useEffect(() => {
    if (!eventForm.stateId || !eventForm.lgaId || !eventForm.wardId) {
      setPollingUnits([]);
      return;
    }

    fetchPublicPollingUnits(eventForm.stateId, eventForm.lgaId, eventForm.wardId)
      .then(setPollingUnits)
      .catch(() => setPollingUnits([]));
  }, [eventForm.stateId, eventForm.lgaId, eventForm.wardId]);

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

  async function handleProfileImageUpload(file: File | null) {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (!token || !file) {
      return;
    }

    setError("");
    setStatusMessage("");
    try {
      const result = await uploadCandidateImage(token, "profile-photo", file);
      setProfileForm((current) => ({
        ...current,
        portraitAssetId: result.asset.id,
        portraitUrl: result.asset.fileUrl || current.portraitUrl,
      }));
      setStatusMessage(result.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not upload profile photo.");
    }
  }

  async function handleEventCoverUpload(file: File | null) {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (!token || !file) {
      return;
    }

    setError("");
    setStatusMessage("");
    try {
      const result = await uploadCandidateImage(token, "event-cover", file);
      setEventForm((current) => ({
        ...current,
        coverImageAssetId: result.asset.id,
        coverImageUrl: result.asset.fileUrl || current.coverImageUrl,
      }));
      setStatusMessage(result.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not upload event cover.");
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

  async function handleEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("picsNigeriaCandidateToken");

    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");
    setSubmittingEvent(true);

    try {
      if (editingEventId) {
        await updateCandidateEvent(token, editingEventId, {
          title: eventForm.title,
          description: eventForm.description,
          venue: eventForm.venue,
          coverImageAssetId: eventForm.coverImageAssetId || undefined,
          stateId: eventForm.stateId || undefined,
          lgaId: eventForm.lgaId || undefined,
          wardId: eventForm.wardId || undefined,
          pollingUnitId: eventForm.pollingUnitId || undefined,
          startsAt: new Date(eventForm.startsAt).toISOString(),
          endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : null,
          isPublished: eventForm.isPublished,
        });
        setStatusMessage("Campaign event updated successfully.");
      } else {
        await createCandidateEvent(token, {
          title: eventForm.title,
          description: eventForm.description,
          venue: eventForm.venue,
          coverImageAssetId: eventForm.coverImageAssetId || undefined,
          stateId: eventForm.stateId || undefined,
          lgaId: eventForm.lgaId || undefined,
          wardId: eventForm.wardId || undefined,
          pollingUnitId: eventForm.pollingUnitId || undefined,
          startsAt: new Date(eventForm.startsAt).toISOString(),
          endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : undefined,
          isPublished: eventForm.isPublished,
        });
        setStatusMessage(eventForm.isPublished ? "Campaign event published successfully." : "Campaign event saved as draft.");
      }

      setEditingEventId(null);
      setEventForm({
        title: "",
        description: "",
        venue: "",
        coverImageAssetId: "",
        coverImageUrl: "",
        stateId: "",
        lgaId: "",
        wardId: "",
        pollingUnitId: "",
        startsAt: "",
        endsAt: "",
        isPublished: true,
      });
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save your campaign event.");
    } finally {
      setSubmittingEvent(false);
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

  function beginEditEvent(item: CampaignEventItem) {
    setEditingEventId(item.id);
    setEventForm({
      title: item.title,
      description: item.description,
      venue: item.venue,
      coverImageUrl: item.coverImageUrl || "",
      coverImageAssetId: item.coverImageAssetId || "",
      stateId: item.territory.stateId || "",
      lgaId: item.territory.lgaId || "",
      wardId: item.territory.wardId || "",
      pollingUnitId: item.territory.pollingUnitId || "",
      startsAt: item.startsAt.slice(0, 16),
      endsAt: item.endsAt ? item.endsAt.slice(0, 16) : "",
      isPublished: item.isPublished,
    });
  }

  async function handleToggleEvent(item: CampaignEventItem) {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");

    try {
      await updateCandidateEvent(token, item.id, { isPublished: !item.isPublished });
      setStatusMessage(item.isPublished ? "Campaign event moved to draft." : "Campaign event published.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update campaign event status.");
    }
  }

  async function handleDeleteEvent(eventId: string) {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (!token) {
      setError("Authentication is required.");
      return;
    }

    setError("");
    setStatusMessage("");

    try {
      await deleteCandidateEvent(token, eventId);
      if (editingEventId === eventId) {
        setEditingEventId(null);
      }
      setStatusMessage("Campaign event deleted successfully.");
      await hydrateDashboard(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete campaign event.");
    }
  }

  function handleLogout() {
    const token = localStorage.getItem("picsNigeriaCandidateToken");
    if (token) {
      void logoutCurrentUser(token).catch(() => undefined);
    }
    clearSession();
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
      {/* Candidate accounts no longer sign in: in the Ogun model a candidate is
          a record the organisation maintains, not an operator. Existing sessions
          keep working rather than being cut off mid-use, but they are told what
          is happening instead of discovering it at the sign-in page. */}
      <section className="notice notice-legacy" style={{ marginBottom: 16 }}>
        <div className="notice-body">
          <span className="notice-title">Candidate sign-in is being retired</span>
          <span>
            Candidate profiles are now maintained by your state office as organisation records. This workspace still
            works for your current session, but new sign-ins are not issued for candidate accounts. Contact your state
            office for changes to your profile.
          </span>
        </div>
      </section>

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
          <h2>Upcoming Events</h2>
          <div className="value">{events.length}</div>
        </article>
        <article className="panel card">
          <h2>Visible Feedback</h2>
          <div className="value">{feedbackCount}</div>
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
              <span>Profile photo upload</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleProfileImageUpload(event.target.files?.[0] || null)} />
            </label>
            {profileForm.portraitUrl ? (
              <div className="candidate-identity">
                <img src={profileForm.portraitUrl} alt={`${user.name} portrait preview`} className="candidate-portrait" />
                <p className="muted">Uploaded portrait preview. Use a clear office-ready headshot.</p>
              </div>
            ) : null}
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
          <h2>{editingEventId ? "Edit Campaign Event" : "Create Campaign Event"}</h2>
          <p className="muted">Publish rallies, town halls, ward meetings, and mobilization activities inside your campaign territory.</p>
          <form className="form" onSubmit={handleEventSubmit}>
            <label className="field">
              <span>Event title</span>
              <input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} minLength={3} required />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea rows={5} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} minLength={10} required />
            </label>
            <label className="field">
              <span>Venue</span>
              <input value={eventForm.venue} onChange={(event) => setEventForm({ ...eventForm, venue: event.target.value })} minLength={3} required />
            </label>
            <label className="field">
              <span>Event cover upload</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleEventCoverUpload(event.target.files?.[0] || null)} />
            </label>
            {eventForm.coverImageUrl ? <img src={eventForm.coverImageUrl} alt="Event cover preview" className="campaign-event-cover" /> : null}
            {canNarrowEventTerritory ? (
              <>
                <label className="field">
                  <span>Target state</span>
                  <select value={eventForm.stateId} onChange={(event) => setEventForm({ ...eventForm, stateId: event.target.value, lgaId: "", wardId: "", pollingUnitId: "" })}>
                    <option value="">All eligible states in territory</option>
                    {states
                      .filter((state) => !profile.territory.stateId || state.id === profile.territory.stateId)
                      .map((state) => (
                        <option key={state.id} value={state.id}>{state.name}</option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>Target LGA</span>
                  <select value={eventForm.lgaId} onChange={(event) => setEventForm({ ...eventForm, lgaId: event.target.value, wardId: "", pollingUnitId: "" })} disabled={!eventForm.stateId}>
                    <option value="">All LGAs in territory</option>
                    {lgas
                      .filter((lga) => !profile.territory.lgaId || lga.id === profile.territory.lgaId)
                      .map((lga) => (
                        <option key={lga.id} value={lga.id}>{lga.name}</option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>Target ward</span>
                  <select value={eventForm.wardId} onChange={(event) => setEventForm({ ...eventForm, wardId: event.target.value, pollingUnitId: "" })} disabled={!eventForm.lgaId}>
                    <option value="">All wards in territory</option>
                    {wards
                      .filter((ward) => !profile.territory.wardId || ward.id === profile.territory.wardId)
                      .map((ward) => (
                        <option key={ward.id} value={ward.id}>{ward.name}</option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>Target polling unit</span>
                  <select value={eventForm.pollingUnitId} onChange={(event) => setEventForm({ ...eventForm, pollingUnitId: event.target.value })} disabled={!eventForm.wardId}>
                    <option value="">All polling units in territory</option>
                    {pollingUnits
                      .filter((unit) => !profile.territory.pollingUnitId || unit.id === profile.territory.pollingUnitId)
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                      ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="muted">
                This office already maps to a fixed constituency. Published events can reach voters in that assigned territory, and voters confirm attendance in-app with RSVP.
              </p>
            )}
            <label className="field">
              <span>Starts at</span>
              <input type="datetime-local" value={eventForm.startsAt} onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })} required />
            </label>
            <label className="field">
              <span>Ends at</span>
              <input type="datetime-local" value={eventForm.endsAt} onChange={(event) => setEventForm({ ...eventForm, endsAt: event.target.value })} />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={eventForm.isPublished}
                onChange={(event) => setEventForm({ ...eventForm, isPublished: event.target.checked })}
              />
              <span>Publish for voter discovery in the selected place</span>
            </label>
            <div className="action-row">
              <button className="button" type="submit" disabled={submittingEvent}>
                {submittingEvent ? "Saving..." : editingEventId ? "Update event" : "Create event"}
              </button>
              {editingEventId ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setEditingEventId(null);
                    setEventForm({
                      title: "",
                      description: "",
                      venue: "",
                      coverImageAssetId: "",
                      coverImageUrl: "",
                      stateId: "",
                      lgaId: "",
                      wardId: "",
                      pollingUnitId: "",
                      startsAt: "",
                      endsAt: "",
                      isPublished: true,
                    });
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
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
          <h2>Campaign Events</h2>
          {events.length === 0 ? (
            <p className="muted">No campaign events yet. Publish your next town hall, ward meeting, or rally here.</p>
          ) : (
            <div className="campaign-event-grid compact">
              {events.map((item) => (
                <article key={item.id} className="campaign-event-card">
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt={item.title} className="campaign-event-cover" />
                  ) : (
                    <div className="campaign-event-cover fallback">Event</div>
                  )}
                  <div className="campaign-event-copy">
                    <p className="eyebrow">{item.territoryLabels.state || "National event"}</p>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <p className="muted">{new Date(item.startsAt).toLocaleString()} | {item.venue}</p>
                    <p className="muted">{item.rsvpCount} RSVP{item.rsvpCount === 1 ? "" : "s"} | {item.isPublished ? "Published" : "Draft"}</p>
                    <div className="action-row">
                      <button className="button secondary" type="button" onClick={() => beginEditEvent(item)}>Edit</button>
                      <button className="button secondary" type="button" onClick={() => void handleToggleEvent(item)}>
                        {item.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button className="button danger" type="button" onClick={() => void handleDeleteEvent(item.id)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

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
        <div className="action-row">
          <Link href="/candidate/operations/live" className="button">
            Track agent activity
          </Link>
        </div>
      </section>
      </section>
    </main>
  );
}

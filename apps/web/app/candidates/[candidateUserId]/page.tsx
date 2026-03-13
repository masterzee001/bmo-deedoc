"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CandidatePublicProfile } from "@pics-nigeria/shared";
import { ApiError, fetchPublicCandidateProfile } from "../../../lib/api";

const officeLabels: Record<string, string> = {
  PRESIDENTIAL: "Presidential",
  GOVERNORSHIP: "Governorship",
  SENATE: "Senate",
  HOUSE_OF_REP: "House of Representatives",
  STATE_ASSEMBLY: "State Assembly",
  CHAIRMANSHIP: "Chairmanship",
  COUNCILLOR: "Councillor",
};

type Props = {
  params: Promise<{ candidateUserId: string }>;
};

function renderMaterialPreview(material: CandidatePublicProfile["materials"][number]) {
  if (material.mediaType === "IMAGE" && material.mediaUrl) {
    return <img src={material.thumbnailUrl || material.mediaUrl} alt={material.title} className="campaign-material-preview" />;
  }

  if (material.mediaType === "VIDEO" && material.mediaUrl) {
    return (
      <video className="campaign-material-preview" controls preload="metadata">
        <source src={material.mediaUrl} />
      </video>
    );
  }

  return <div className="campaign-material-preview fallback">{material.mediaType}</div>;
}

export default function CandidateDetailPage({ params }: Props) {
  const [candidate, setCandidate] = useState<CandidatePublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    params
      .then(async ({ candidateUserId: resolvedId }) => {
        const nextCandidate = await fetchPublicCandidateProfile(resolvedId);
        setCandidate(nextCandidate);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load candidate profile.");
      })
      .finally(() => setLoading(false));
  }, [params]);

  if (loading) {
    return (
      <main className="shell">
        <section className="panel card">
          <p>Loading candidate profile...</p>
        </section>
      </main>
    );
  }

  if (error || !candidate) {
    return (
      <main className="shell">
        <section className="panel card empty-state">
          <h1>Candidate profile unavailable</h1>
          <p className="muted">{error || "This candidate profile is not currently published."}</p>
          <Link href="/candidates">Back to candidate directory</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero candidate-profile-hero">
        <div className="candidate-identity">
          {candidate.portraitUrl ? (
            <img src={candidate.portraitUrl} alt={`${candidate.name} portrait`} className="candidate-portrait" />
          ) : (
            <div className="candidate-portrait fallback">{candidate.name.slice(0, 1)}</div>
          )}
          <div>
            <p className="eyebrow">{officeLabels[candidate.officeType] || candidate.officeType}</p>
            <h1>{candidate.name}</h1>
            <p className="candidate-office">{candidate.party?.name || "Independent / party not listed"}</p>
            <p>{candidate.campaignSlogan || "Campaign slogan not provided."}</p>
            <div className="badge-row">
              <span className="status-badge live">Published profile</span>
              <span className="muted">{candidate.territoryLabels.state || "National campaign"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="candidate-dashboard-grid">
        <section className="panel card">
          <h2>About this campaign</h2>
          <p>{candidate.bio || "No manifesto summary has been published yet."}</p>
          <div className="candidate-link-list">
            {candidate.websiteUrl ? <a href={candidate.websiteUrl} target="_blank" rel="noreferrer">Website</a> : null}
            {candidate.facebookUrl ? <a href={candidate.facebookUrl} target="_blank" rel="noreferrer">Facebook</a> : null}
            {candidate.instagramUrl ? <a href={candidate.instagramUrl} target="_blank" rel="noreferrer">Instagram</a> : null}
            {candidate.xUrl ? <a href={candidate.xUrl} target="_blank" rel="noreferrer">X</a> : null}
          </div>
        </section>

        <section className="panel card">
          <h2>Territory</h2>
          <div className="reward-list">
            <article className="reward-item">
              <strong>State</strong>
              <p>{candidate.territoryLabels.state || "National"}</p>
            </article>
            {candidate.territoryLabels.lga ? (
              <article className="reward-item">
                <strong>LGA</strong>
                <p>{candidate.territoryLabels.lga}</p>
              </article>
            ) : null}
            {candidate.territoryLabels.ward ? (
              <article className="reward-item">
                <strong>Ward</strong>
                <p>{candidate.territoryLabels.ward}</p>
              </article>
            ) : null}
            {candidate.territoryLabels.senatorialDistrict ? (
              <article className="reward-item">
                <strong>Senatorial district</strong>
                <p>{candidate.territoryLabels.senatorialDistrict}</p>
              </article>
            ) : null}
            {candidate.territoryLabels.federalConstituency ? (
              <article className="reward-item">
                <strong>Federal constituency</strong>
                <p>{candidate.territoryLabels.federalConstituency}</p>
              </article>
            ) : null}
            {candidate.territoryLabels.stateConstituency ? (
              <article className="reward-item">
                <strong>State constituency</strong>
                <p>{candidate.territoryLabels.stateConstituency}</p>
              </article>
            ) : null}
          </div>
        </section>
      </section>

      <section className="panel card">
        <div className="section-head">
          <div>
            <h2>Campaign materials</h2>
            <p className="muted">Published campaign updates, banners, flyers, and media from this candidate.</p>
          </div>
          <Link href="/candidates">Browse other candidates</Link>
        </div>
        {candidate.materials.length === 0 ? (
          <section className="empty-state">
            <h3>No published campaign materials yet</h3>
            <p className="muted">Return later to see speeches, flyers, videos, and manifesto updates.</p>
          </section>
        ) : (
          <div className="candidate-material-gallery">
            {candidate.materials.map((material) => (
              <article key={material.id} className="candidate-material-card">
                {renderMaterialPreview(material)}
                <div className="candidate-material-copy">
                  <p className="eyebrow">{material.mediaType}</p>
                  <h3>{material.title}</h3>
                  <p>{material.content}</p>
                  {material.mediaUrl ? (
                    <a href={material.mediaUrl} target="_blank" rel="noreferrer">
                      Open media
                    </a>
                  ) : null}
                  <p className="muted">{new Date(material.createdAt).toLocaleString()}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PoliticalPartyPublicProfile } from "@pics-nigeria/shared";
import { ApiError, fetchPublicPartyProfile } from "../../../lib/api";

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
  params: Promise<{ partyId: string }>;
};

export default function PartyDetailPage({ params }: Props) {
  const [party, setParty] = useState<PoliticalPartyPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    params
      .then(async ({ partyId }) => {
        setParty(await fetchPublicPartyProfile(partyId));
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load political party profile.");
      })
      .finally(() => setLoading(false));
  }, [params]);

  if (loading) {
    return (
      <main className="shell">
        <section className="panel card">
          <p>Loading political party profile...</p>
        </section>
      </main>
    );
  }

  if (error || !party) {
    return (
      <main className="shell">
        <section className="panel card empty-state">
          <h1>Political party unavailable</h1>
          <p className="muted">{error || "This party profile is not available right now."}</p>
          <Link href="/parties">Back to party directory</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel hero candidate-profile-hero">
        <div className="candidate-identity">
          <div className="candidate-portrait fallback">{party.code}</div>
          <div>
            <p className="eyebrow">Political party</p>
            <h1>{party.name}</h1>
            <p>{party.description || `${party.name} is listed for candidate discovery and public campaign browsing.`}</p>
            <div className="badge-row">
              {party.isApprovedByInec ? <span className="status-badge live">INEC listed</span> : <span className="status-badge draft">Custom party record</span>}
              <span className="muted">{party.candidates.length} published candidates</span>
            </div>
          </div>
        </div>
      </section>

      <section className="candidate-dashboard-grid">
        <section className="panel card">
          <h2>Party profile</h2>
          <div className="reward-list">
            <article className="reward-item">
              <strong>Party code</strong>
              <p>{party.code}</p>
            </article>
            {party.officialWebsite ? (
              <article className="reward-item">
                <strong>Official website</strong>
                <p><a href={party.officialWebsite} target="_blank" rel="noreferrer">{party.officialWebsite}</a></p>
              </article>
            ) : null}
            {party.inecSourceUrl ? (
              <article className="reward-item">
                <strong>INEC source</strong>
                <p><a href={party.inecSourceUrl} target="_blank" rel="noreferrer">Open official listing</a></p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="panel card">
          <h2>Candidate discovery</h2>
          <p className="muted">Browse only candidates with published public profiles under this party.</p>
          <p><Link href={`/candidates?partyId=${party.id}`}>Open party candidates in the candidate directory</Link></p>
        </section>
      </section>

      <section className="panel card" style={{ marginTop: 24 }}>
        <div className="section-head">
          <div>
            <h2>Published candidates</h2>
            <p className="muted">Profiles and campaign materials already visible to voters under this party.</p>
          </div>
        </div>
        {party.candidates.length === 0 ? (
          <section className="empty-state">
            <h3>No published candidates yet</h3>
            <p className="muted">Return later when candidates from this party publish their public profiles.</p>
          </section>
        ) : (
          <div className="candidate-grid">
            {party.candidates.map((candidate) => (
              <article key={candidate.userId} className="panel card candidate-card">
                {candidate.portraitUrl ? (
                  <img src={candidate.portraitUrl} alt={`${candidate.name} portrait`} className="candidate-card-media" />
                ) : (
                  <div className="candidate-card-media fallback">{candidate.name.slice(0, 1)}</div>
                )}
                <div className="candidate-card-body">
                  <p className="eyebrow">{officeLabels[candidate.officeType] || candidate.officeType}</p>
                  <h2>{candidate.name}</h2>
                  <p>{candidate.campaignSlogan || candidate.bio || "Campaign profile coming soon."}</p>
                  <p className="muted">{candidate.territoryLabels.state || "National campaign"}</p>
                  <Link href={`/candidates/${candidate.userId}`}>View candidate profile</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

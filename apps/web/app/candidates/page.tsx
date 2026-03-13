"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CANDIDATE_OFFICE_TYPES, type CandidateOfficeType, type CandidatePublicListItem, type StateItem } from "@pics-nigeria/shared";
import { ApiError, fetchPublicCandidates, fetchPublicStates } from "../../lib/api";

const officeLabels: Record<string, string> = {
  PRESIDENTIAL: "Presidential",
  GOVERNORSHIP: "Governorship",
  SENATE: "Senate",
  HOUSE_OF_REP: "House of Representatives",
  STATE_ASSEMBLY: "State Assembly",
  CHAIRMANSHIP: "Chairmanship",
  COUNCILLOR: "Councillor",
};

export default function CandidatesPage() {
  const [states, setStates] = useState<StateItem[]>([]);
  const [candidates, setCandidates] = useState<CandidatePublicListItem[]>([]);
  const [search, setSearch] = useState("");
  const [stateId, setStateId] = useState("");
  const [officeType, setOfficeType] = useState<CandidateOfficeType | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDirectory(nextSearch = search, nextStateId = stateId, nextOfficeType = officeType) {
    setError("");
    const [nextStates, nextCandidates] = await Promise.all([
      fetchPublicStates(),
      fetchPublicCandidates({
        search: nextSearch || undefined,
        stateId: nextStateId || undefined,
        officeType: nextOfficeType || undefined,
      }),
    ]);

    setStates(nextStates);
    setCandidates(nextCandidates);
  }

  useEffect(() => {
    loadDirectory()
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load candidate directory.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleApplyFilters() {
    setLoading(true);
    try {
      await loadDirectory(search, stateId, officeType);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not apply candidate filters.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel hero candidate-discovery-hero">
        <h1>Candidate Directory</h1>
        <p>Search published candidate profiles, compare offices, and browse campaign materials by territory.</p>
        <div className="candidate-filter-row">
          <label className="field">
            <span>Search by name</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidates" />
          </label>
          <label className="field">
            <span>State</span>
            <select value={stateId} onChange={(event) => setStateId(event.target.value)}>
              <option value="">All states</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Office</span>
            <select value={officeType} onChange={(event) => setOfficeType(event.target.value as CandidateOfficeType | "")}>
              <option value="">All offices</option>
              {CANDIDATE_OFFICE_TYPES.map((office) => (
                <option key={office} value={office}>
                  {officeLabels[office]}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="button" onClick={() => void handleApplyFilters()} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      {loading ? (
        <section className="panel card">
          <p>Loading candidate directory...</p>
        </section>
      ) : candidates.length === 0 ? (
        <section className="panel card empty-state">
          <h2>No published candidates found</h2>
          <p className="muted">Try widening your filters or return when more campaign profiles are published.</p>
        </section>
      ) : (
        <section className="candidate-grid">
          {candidates.map((candidate) => (
            <article key={candidate.userId} className="panel card candidate-card">
              {candidate.portraitUrl ? (
                <img src={candidate.portraitUrl} alt={`${candidate.name} portrait`} className="candidate-card-media" />
              ) : (
                <div className="candidate-card-media fallback">{candidate.name.slice(0, 1)}</div>
              )}
              <div className="candidate-card-body">
                <p className="eyebrow">{officeLabels[candidate.officeType] || candidate.officeType}</p>
                <h2>{candidate.name}</h2>
                <p className="muted">{candidate.party?.name || "Independent / party not listed"}</p>
                <p>{candidate.campaignSlogan || candidate.bio || "Campaign profile coming soon."}</p>
                <p className="muted">{candidate.territoryLabels.state || "National"} {candidate.territoryLabels.lga ? `• ${candidate.territoryLabels.lga}` : ""}</p>
                <Link href={`/candidates/${candidate.userId}`}>View profile</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

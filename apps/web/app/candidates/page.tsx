"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CANDIDATE_OFFICE_TYPES, type CandidateOfficeType, type CandidatePublicListItem, type PoliticalPartyItem, type StateItem } from "@pics-nigeria/shared";
import { ApiError, fetchPublicCandidates, fetchPublicParties, fetchPublicStates } from "../../lib/api";

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
  const [parties, setParties] = useState<PoliticalPartyItem[]>([]);
  const [candidates, setCandidates] = useState<CandidatePublicListItem[]>([]);
  const [search, setSearch] = useState("");
  const [stateId, setStateId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [officeType, setOfficeType] = useState<CandidateOfficeType | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const officeBreakdown = useMemo(() => {
    return candidates.reduce<Record<string, number>>((accumulator, candidate) => {
      accumulator[candidate.officeType] = (accumulator[candidate.officeType] || 0) + 1;
      return accumulator;
    }, {});
  }, [candidates]);

  const approvedPartyCount = useMemo(() => {
    return new Set(
      candidates
        .filter((candidate) => candidate.party?.isApprovedByInec)
        .map((candidate) => candidate.party!.id),
    ).size;
  }, [candidates]);

  const visibleStateCount = useMemo(() => {
    return new Set(candidates.map((candidate) => candidate.territory.stateId).filter(Boolean)).size;
  }, [candidates]);

  async function loadDirectory(nextSearch = search, nextStateId = stateId, nextPartyId = partyId, nextOfficeType = officeType) {
    setError("");
    const [nextStates, nextParties, nextCandidates] = await Promise.all([
      fetchPublicStates(),
      fetchPublicParties(),
      fetchPublicCandidates({
        search: nextSearch || undefined,
        stateId: nextStateId || undefined,
        partyId: nextPartyId || undefined,
        officeType: nextOfficeType || undefined,
      }),
    ]);

    setStates(nextStates);
    setParties(nextParties);
    setCandidates(nextCandidates);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextSearch = params.get("search") || "";
    const nextStateId = params.get("stateId") || "";
    const nextPartyId = params.get("partyId") || "";
    const nextOfficeType = (params.get("officeType") as CandidateOfficeType | "") || "";

    setSearch(nextSearch);
    setStateId(nextStateId);
    setPartyId(nextPartyId);
    setOfficeType(nextOfficeType);

    loadDirectory(nextSearch, nextStateId, nextPartyId, nextOfficeType)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load candidate directory.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleApplyFilters() {
    setLoading(true);
    try {
      await loadDirectory(search, stateId, partyId, officeType);
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
        <p>Search published candidate profiles, compare offices, and browse campaign materials by territory and party.</p>
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
            <span>Party</span>
            <select value={partyId} onChange={(event) => setPartyId(event.target.value)}>
              <option value="">All parties</option>
              <option value="independent">Independent</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.code} - {party.name}
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
        <p className="muted">
          Browse by party or jump to the <Link href="/parties">party portfolio</Link>.
        </p>
        {error ? <p className="error">{error}</p> : null}
      </section>

      {!loading ? (
        <section className="grid stats" style={{ marginTop: 24 }}>
          <article className="panel card">
            <h2>Visible candidates</h2>
            <div className="value">{candidates.length}</div>
          </article>
          <article className="panel card">
            <h2>States in result</h2>
            <div className="value">{visibleStateCount}</div>
          </article>
          <article className="panel card">
            <h2>INEC-listed parties</h2>
            <div className="value">{approvedPartyCount}</div>
          </article>
        </section>
      ) : null}

      {!loading && candidates.length > 0 ? (
        <section className="panel card" style={{ marginTop: 24 }}>
          <div className="section-head">
            <div>
              <h2>Office coverage</h2>
              <p className="muted">Quick view of the published candidates currently matching your filters.</p>
            </div>
          </div>
          <div className="action-row" style={{ flexWrap: "wrap" }}>
            {Object.entries(officeBreakdown).map(([office, count]) => (
              <button
                key={office}
                className="button secondary"
                type="button"
                onClick={() => {
                  setOfficeType(office as CandidateOfficeType);
                  void loadDirectory(search, stateId, partyId, office as CandidateOfficeType);
                }}
              >
                {officeLabels[office] || office} ({count})
              </button>
            ))}
          </div>
        </section>
      ) : null}

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
                {candidate.party?.isApprovedByInec ? <p className="muted">INEC listed party</p> : null}
                <p>{candidate.campaignSlogan || candidate.bio || "Campaign profile coming soon."}</p>
                <p className="muted">
                  {[
                    candidate.territoryLabels.state || "National",
                    candidate.territoryLabels.senatorialDistrict,
                    candidate.territoryLabels.federalConstituency,
                    candidate.territoryLabels.stateConstituency,
                    candidate.territoryLabels.lga,
                    candidate.territoryLabels.ward,
                  ].filter(Boolean).join(" | ")}
                </p>
                <div className="action-row">
                  <Link href={`/candidates/${candidate.userId}`}>View profile</Link>
                  {candidate.party ? <Link href={`/parties/${candidate.party.id}`}>View party</Link> : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

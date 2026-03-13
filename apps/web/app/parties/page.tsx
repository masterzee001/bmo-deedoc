"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PoliticalPartyItem } from "@pics-nigeria/shared";
import { ApiError, fetchPublicParties } from "../../lib/api";

export default function PartiesPage() {
  const [parties, setParties] = useState<PoliticalPartyItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadParties(nextSearch = search) {
    setError("");
    const nextParties = await fetchPublicParties({ search: nextSearch || undefined });
    setParties(nextParties);
  }

  useEffect(() => {
    loadParties()
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load political parties.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSearch() {
    setLoading(true);
    try {
      await loadParties(search);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not filter political parties.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel hero candidate-discovery-hero">
        <h1>Political Parties</h1>
        <p>Browse INEC-listed parties, open their portfolios, and explore published candidates under each party.</p>
        <div className="candidate-filter-row" style={{ gridTemplateColumns: "2fr auto" }}>
          <label className="field">
            <span>Search by party name or code</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search political parties" />
          </label>
          <button className="button" type="button" onClick={() => void handleSearch()} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
        <p className="muted">
          Looking for candidates instead? <Link href="/candidates">Open candidate discovery</Link>.
        </p>
        {error ? <p className="error">{error}</p> : null}
      </section>

      {loading ? (
        <section className="panel card">
          <p>Loading political parties...</p>
        </section>
      ) : parties.length === 0 ? (
        <section className="panel card empty-state">
          <h2>No parties found</h2>
          <p className="muted">Try a wider search or check again after the reference data refresh.</p>
        </section>
      ) : (
        <section className="candidate-grid">
          {parties.map((party) => (
            <article key={party.id} className="panel card candidate-card">
              <div className="candidate-card-media fallback">{party.code}</div>
              <div className="candidate-card-body">
                <p className="eyebrow">{party.code}</p>
                <h2>{party.name}</h2>
                <p>{party.description || `${party.name} is available in the public party directory for candidate discovery.`}</p>
                <p className="muted">
                  {party.isApprovedByInec ? "INEC listed" : "Custom party record"} | {party.candidateCount || 0} published candidates
                </p>
                <Link href={`/parties/${party.id}`}>Open party profile</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

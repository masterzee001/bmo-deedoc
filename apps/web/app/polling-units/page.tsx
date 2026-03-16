"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchPublicLgas, fetchPublicPollingUnits, fetchPublicStates, fetchPublicWards } from "../../lib/api";

type OptionItem = {
  id: string;
  name: string;
};

export default function PollingUnitSearchPage() {
  const [states, setStates] = useState<OptionItem[]>([]);
  const [lgas, setLgas] = useState<OptionItem[]>([]);
  const [wards, setWards] = useState<OptionItem[]>([]);
  const [pollingUnits, setPollingUnits] = useState<OptionItem[]>([]);
  const [filters, setFilters] = useState({
    stateId: "",
    lgaId: "",
    wardId: "",
    search: "",
  });
  const [error, setError] = useState("");
  const [loadingPollingUnits, setLoadingPollingUnits] = useState(false);

  useEffect(() => {
    fetchPublicStates()
      .then(setStates)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load states.");
      });
  }, []);

  useEffect(() => {
    if (!filters.stateId) {
      setLgas([]);
      setWards([]);
      setPollingUnits([]);
      setFilters((current) => ({ ...current, lgaId: "", wardId: "" }));
      return;
    }

    setFilters((current) => ({ ...current, lgaId: "", wardId: "" }));
    setWards([]);
    setPollingUnits([]);
    fetchPublicLgas(filters.stateId)
      .then(setLgas)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load local governments.");
      });
  }, [filters.stateId]);

  useEffect(() => {
    if (!filters.stateId || !filters.lgaId) {
      setWards([]);
      setPollingUnits([]);
      setFilters((current) => ({ ...current, wardId: "" }));
      return;
    }

    setFilters((current) => ({ ...current, wardId: "" }));
    setPollingUnits([]);
    fetchPublicWards(filters.stateId, filters.lgaId)
      .then(setWards)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load wards.");
      });
  }, [filters.lgaId, filters.stateId]);

  useEffect(() => {
    if (!filters.stateId || !filters.lgaId || !filters.wardId) {
      setPollingUnits([]);
      return;
    }

    setLoadingPollingUnits(true);
    fetchPublicPollingUnits(filters.stateId, filters.lgaId, filters.wardId)
      .then(setPollingUnits)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load polling units.");
      })
      .finally(() => setLoadingPollingUnits(false));
  }, [filters.lgaId, filters.stateId, filters.wardId]);

  const selectedState = useMemo(() => states.find((item) => item.id === filters.stateId)?.name || "", [filters.stateId, states]);
  const selectedLga = useMemo(() => lgas.find((item) => item.id === filters.lgaId)?.name || "", [filters.lgaId, lgas]);
  const selectedWard = useMemo(() => wards.find((item) => item.id === filters.wardId)?.name || "", [filters.wardId, wards]);

  const visiblePollingUnits = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) {
      return pollingUnits;
    }

    return pollingUnits.filter((item) => item.name.toLowerCase().includes(search));
  }, [filters.search, pollingUnits]);

  return (
    <main className="shell">
      <section className="panel hero">
        <h1>Find Your Polling Unit</h1>
        <p>Search by state, local government, and ward to confirm the polling unit location attached to your voter registration.</p>
        <p>
          <Link href="/register">Register as voter</Link> | <Link href="/login">Voter login</Link>
        </p>
      </section>

      <section className="panel card" style={{ maxWidth: 860 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label className="field">
            <span>State</span>
            <select value={filters.stateId} onChange={(event) => setFilters((current) => ({ ...current, stateId: event.target.value }))}>
              <option value="">Select state</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Local Government Area</span>
            <select
              value={filters.lgaId}
              onChange={(event) => setFilters((current) => ({ ...current, lgaId: event.target.value }))}
              disabled={!filters.stateId}
            >
              <option value="">Select LGA</option>
              {lgas.map((lga) => (
                <option key={lga.id} value={lga.id}>
                  {lga.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Ward</span>
            <select
              value={filters.wardId}
              onChange={(event) => setFilters((current) => ({ ...current, wardId: event.target.value }))}
              disabled={!filters.lgaId}
            >
              <option value="">Select ward</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Search polling unit</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Type polling unit name"
              disabled={!filters.wardId}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {!filters.wardId ? <p className="muted">Select your ward to load polling-unit locations.</p> : null}
        {loadingPollingUnits ? <p className="muted">Loading polling units...</p> : null}

        {filters.wardId ? (
          <section style={{ marginTop: 24 }}>
            <div className="section-head">
              <div>
                <h2>Polling units in this ward</h2>
                <p className="muted">
                  {selectedState} | {selectedLga} | {selectedWard}
                </p>
              </div>
              <span className="status-pill">{visiblePollingUnits.length} visible</span>
            </div>

            {visiblePollingUnits.length === 0 ? (
              <p className="muted">No polling units matched this search inside the selected ward.</p>
            ) : (
              <div className="reward-list">
                {visiblePollingUnits.map((pollingUnit) => (
                  <article key={pollingUnit.id} className="reward-item">
                    <strong>{pollingUnit.name}</strong>
                    <p>{selectedWard}</p>
                    <p className="muted">
                      {selectedLga}, {selectedState}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

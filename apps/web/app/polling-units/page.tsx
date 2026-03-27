"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicAccessShell } from "../../components/public-access-shell";
import {
  fetchPublicLgas,
  fetchPublicPollingUnits,
  fetchPublicStates,
  fetchPublicWards,
} from "../../lib/api";

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
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingLgas, setLoadingLgas] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingPollingUnits, setLoadingPollingUnits] = useState(false);

  useEffect(() => {
    setError("");
    setLoadingStates(true);

    fetchPublicStates()
      .then(setStates)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load states.");
      })
      .finally(() => setLoadingStates(false));
  }, []);

  useEffect(() => {
    if (!filters.stateId) {
      setLgas([]);
      setWards([]);
      setPollingUnits([]);
      setLoadingLgas(false);
      setLoadingWards(false);
      setFilters((current) => ({ ...current, lgaId: "", wardId: "" }));
      return;
    }

    setError("");
    setLoadingLgas(true);
    setFilters((current) => ({ ...current, lgaId: "", wardId: "" }));
    setWards([]);
    setPollingUnits([]);

    fetchPublicLgas(filters.stateId)
      .then(setLgas)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load local governments.");
      })
      .finally(() => setLoadingLgas(false));
  }, [filters.stateId]);

  useEffect(() => {
    if (!filters.stateId || !filters.lgaId) {
      setWards([]);
      setPollingUnits([]);
      setLoadingWards(false);
      setFilters((current) => ({ ...current, wardId: "" }));
      return;
    }

    setError("");
    setLoadingWards(true);
    setFilters((current) => ({ ...current, wardId: "" }));
    setPollingUnits([]);

    fetchPublicWards(filters.stateId, filters.lgaId)
      .then(setWards)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load wards.");
      })
      .finally(() => setLoadingWards(false));
  }, [filters.lgaId, filters.stateId]);

  useEffect(() => {
    if (!filters.stateId || !filters.lgaId || !filters.wardId) {
      setPollingUnits([]);
      setLoadingPollingUnits(false);
      return;
    }

    setError("");
    setLoadingPollingUnits(true);

    fetchPublicPollingUnits(filters.stateId, filters.lgaId, filters.wardId)
      .then(setPollingUnits)
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load polling units.");
      })
      .finally(() => setLoadingPollingUnits(false));
  }, [filters.lgaId, filters.stateId, filters.wardId]);

  const selectedState = useMemo(
    () => states.find((item) => item.id === filters.stateId)?.name || "",
    [filters.stateId, states],
  );
  const selectedLga = useMemo(
    () => lgas.find((item) => item.id === filters.lgaId)?.name || "",
    [filters.lgaId, lgas],
  );
  const selectedWard = useMemo(
    () => wards.find((item) => item.id === filters.wardId)?.name || "",
    [filters.wardId, wards],
  );

  const visiblePollingUnits = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) {
      return pollingUnits;
    }

    return pollingUnits.filter((item) => item.name.toLowerCase().includes(search));
  }, [filters.search, pollingUnits]);

  const helperText = loadingStates
    ? "Loading states..."
    : loadingLgas
      ? "Loading local governments..."
      : loadingWards
        ? "Loading wards..."
        : !filters.stateId
          ? "Select your state to begin."
          : !filters.lgaId
            ? "Select your local government area."
            : !filters.wardId
              ? "Select your ward to load polling-unit locations."
              : loadingPollingUnits
                ? "Loading polling units..."
                : `${visiblePollingUnits.length} polling unit${visiblePollingUnits.length === 1 ? "" : "s"} visible.`;

  return (
    <PublicAccessShell
      brandSubtitle="Public Polling Unit Search"
      authTitle="Find Your Polling Unit"
      authDescription="Search by state, local government, and ward to confirm the polling unit attached to your voter registration."
      footerNote={
        <>
          <Link href="/register">Register as voter</Link> {" | "} <Link href="/login">Return to voter login</Link>
        </>
      }
    >
      <div className="starter-form starter-form--stacked">
        <div className="starter-form__grid">
          <label className="starter-form__field">
            <span>State</span>
            <select
              value={filters.stateId}
              onChange={(event) => setFilters((current) => ({ ...current, stateId: event.target.value }))}
            >
              <option value="">Select state</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>

          <label className="starter-form__field">
            <span>Local Government Area</span>
            <select
              value={filters.lgaId}
              onChange={(event) => setFilters((current) => ({ ...current, lgaId: event.target.value }))}
              disabled={!filters.stateId || loadingLgas}
            >
              <option value="">{loadingLgas ? "Loading LGAs..." : "Select LGA"}</option>
              {lgas.map((lga) => (
                <option key={lga.id} value={lga.id}>
                  {lga.name}
                </option>
              ))}
            </select>
          </label>

          <label className="starter-form__field">
            <span>Ward</span>
            <select
              value={filters.wardId}
              onChange={(event) => setFilters((current) => ({ ...current, wardId: event.target.value }))}
              disabled={!filters.lgaId || loadingWards}
            >
              <option value="">{loadingWards ? "Loading wards..." : "Select ward"}</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </label>

          <label className="starter-form__field">
            <span>Search polling unit</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Type polling unit name"
              disabled={!filters.wardId || loadingPollingUnits}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}
        <p className="starter-form__note">{helperText}</p>

        {filters.wardId ? (
          <section className="starter-results">
            <div className="starter-results__head">
              <div>
                <h3>Polling units in this ward</h3>
                <p>
                  {selectedState} | {selectedLga} | {selectedWard}
                </p>
              </div>
              <span className="starter-results__count">{visiblePollingUnits.length} visible</span>
            </div>

            {visiblePollingUnits.length === 0 ? (
              <p className="starter-form__note">No polling units matched this search inside the selected ward.</p>
            ) : (
              <div className="starter-results__list">
                {visiblePollingUnits.map((pollingUnit) => (
                  <article key={pollingUnit.id} className="starter-results__item">
                    <strong>{pollingUnit.name}</strong>
                    <p>{selectedWard}</p>
                    <p>
                      {selectedLga}, {selectedState}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </PublicAccessShell>
  );
}

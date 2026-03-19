"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPublicLgas, fetchPublicPollingUnits, fetchPublicStates, fetchPublicWards, registerVoterUser } from "../../lib/api";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  voterCardNumber: string;
  stateId: string;
  lgaId: string;
  wardId: string;
  pollingUnitId: string;
  referredByCode: string;
  acceptTerms: boolean;
  contactConsent: boolean;
  confirmAdult: boolean;
};

const initialForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  voterCardNumber: "",
  stateId: "",
  lgaId: "",
  wardId: "",
  pollingUnitId: "",
  referredByCode: "",
  acceptTerms: false,
  contactConsent: false,
  confirmAdult: false,
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [states, setStates] = useState<Array<{ id: string; name: string }>>([]);
  const [lgas, setLgas] = useState<Array<{ id: string; name: string }>>([]);
  const [wards, setWards] = useState<Array<{ id: string; name: string }>>([]);
  const [pollingUnits, setPollingUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadStates() {
      try {
        setStates(await fetchPublicStates());
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load registration options.");
      }
    }

    void loadStates();
  }, []);

  useEffect(() => {
    if (!form.stateId) {
      setLgas([]);
      setWards([]);
      setPollingUnits([]);
      setForm((current) => ({ ...current, lgaId: "", wardId: "", pollingUnitId: "" }));
      return;
    }

    async function loadLgas() {
      try {
        const nextLgas = await fetchPublicLgas(form.stateId);
        setLgas(nextLgas);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load local governments.");
      }
    }

    setForm((current) => ({ ...current, lgaId: "", wardId: "", pollingUnitId: "" }));
    setWards([]);
    setPollingUnits([]);
    void loadLgas();
  }, [form.stateId]);

  useEffect(() => {
    if (!form.stateId || !form.lgaId) {
      setWards([]);
      setPollingUnits([]);
      setForm((current) => ({ ...current, wardId: "", pollingUnitId: "" }));
      return;
    }

    async function loadWards() {
      try {
        const nextWards = await fetchPublicWards(form.stateId, form.lgaId);
        setWards(nextWards);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load wards.");
      }
    }

    setForm((current) => ({ ...current, wardId: "", pollingUnitId: "" }));
    setPollingUnits([]);
    void loadWards();
  }, [form.stateId, form.lgaId]);

  useEffect(() => {
    if (!form.stateId || !form.lgaId || !form.wardId) {
      setPollingUnits([]);
      setForm((current) => ({ ...current, pollingUnitId: "" }));
      return;
    }

    async function loadPollingUnits() {
      try {
        const nextPollingUnits = await fetchPublicPollingUnits(form.stateId, form.lgaId, form.wardId);
        setPollingUnits(nextPollingUnits);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load polling units.");
      }
    }

    setForm((current) => ({ ...current, pollingUnitId: "" }));
    void loadPollingUnits();
  }, [form.stateId, form.lgaId, form.wardId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!form.acceptTerms || !form.contactConsent || !form.confirmAdult) {
        throw new Error("You must accept the terms and confirm eligibility before registering.");
      }

      const result = await registerVoterUser({
        ...form,
        referredByCode: form.referredByCode.trim() || undefined,
        acceptTerms: true,
        contactConsent: true,
        confirmAdult: true,
      });

      setMessage(result.message);
      setForm(initialForm);
      router.push("/login");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <h1>PICS Nigeria Voter Registration</h1>
        <p>Create a voter account to participate, track rewards, and follow campaign updates in your ward.</p>
        <p>
          Already registered? <Link href="/login">Go to voter login</Link>
        </p>
        <p>
          Need to confirm your polling unit first? <Link href="/polling-units">Find polling unit location</Link>
        </p>
      </section>

      <section className="panel card" style={{ maxWidth: 720 }}>
        <h2>Create Voter Account</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Full Name</span>
            <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </label>

          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>

          <label className="field">
            <span>Phone</span>
            <input
              type="tel"
              inputMode="numeric"
              pattern="\d{7,15}"
              minLength={7}
              maxLength={15}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "") })}
              required
            />
            <small className="muted">Enter digits only. Use at least 7 digits and no more than 15.</small>
          </label>

          <label className="field">
            <span>Password</span>
            <input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            <small className="muted">Use at least 8 characters.</small>
          </label>

          <label className="field">
            <span>Voter Card Number</span>
            <input
              value={form.voterCardNumber}
              minLength={5}
              onChange={(event) => setForm({ ...form, voterCardNumber: event.target.value.toUpperCase() })}
              required
            />
            <small className="muted">Enter the voter card number exactly as printed on your PVC.</small>
          </label>

          <label className="field">
            <span>State</span>
            <select value={form.stateId} onChange={(event) => setForm({ ...form, stateId: event.target.value })} required>
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
            <select value={form.lgaId} onChange={(event) => setForm({ ...form, lgaId: event.target.value })} required disabled={!form.stateId}>
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
            <select value={form.wardId} onChange={(event) => setForm({ ...form, wardId: event.target.value })} required disabled={!form.lgaId}>
              <option value="">Select ward</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Polling Unit</span>
            <select
              value={form.pollingUnitId}
              onChange={(event) => setForm({ ...form, pollingUnitId: event.target.value })}
              required
              disabled={!form.wardId}
            >
              <option value="">Select polling unit</option>
              {pollingUnits.map((pollingUnit) => (
                <option key={pollingUnit.id} value={pollingUnit.id}>
                  {pollingUnit.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Referral Code (Optional)</span>
            <input
              value={form.referredByCode}
              onChange={(event) => setForm({ ...form, referredByCode: event.target.value })}
              placeholder="Enter a voter referral code"
            />
          </label>

          <label className="field" style={{ alignItems: "flex-start" }}>
            <span>Terms and Consent</span>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(event) =>
                  setForm({
                    ...form,
                    acceptTerms: event.target.checked,
                    contactConsent: event.target.checked,
                  })
                }
                required
              />
              <span>
                I agree to the <Link href="/terms">terms and conditions</Link>, including consent for election and civic updates within my registered territory, and contact handling by authorized platform operators.
              </span>
            </label>
          </label>

          <label className="field" style={{ alignItems: "flex-start" }}>
            <span>Age Confirmation</span>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.confirmAdult}
                onChange={(event) => setForm({ ...form, confirmAdult: event.target.checked })}
                required
              />
              <span>I confirm that I am 18 years old or above and legally eligible to register as a voter.</span>
            </label>
          </label>

          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="muted">{message}</p> : null}

          <button className="button" type="submit" disabled={loading || !form.acceptTerms || !form.confirmAdult}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

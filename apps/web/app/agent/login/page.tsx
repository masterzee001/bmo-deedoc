"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "../../../lib/api";

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gpsConsent, setGpsConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionReason =
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("reason") || "";
  const sessionNotice =
    sessionReason === "gps-required"
      ? "Device GPS must stay turned on to use the agent dashboard."
      : sessionReason === "session-ended"
        ? "Your previous agent session ended. Sign in again to continue."
        : "";

  function verifyGpsAccess() {
    return new Promise<void>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Device GPS is required for agent access."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => reject(new Error("Turn on device GPS and allow location access to continue.")),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20_000,
        },
      );
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!gpsConsent) {
        throw new Error("You must agree to the agent GPS tracking terms before signing in.");
      }

      await verifyGpsAccess();
      const data = await loginUser(email, password, { agentGpsConsent: gpsConsent });

      if (data.user.role !== "AGENT") {
        setError("This login page is for agents only.");
        return;
      }

      localStorage.setItem("picsNigeriaAgentToken", data.token);
      router.push("/agent/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <h1>PICS Nigeria Agent Access</h1>
        <p>Sign in to check in, send location updates, and report field incidents.</p>
        <p>
          <Link href="/login">Voter login</Link> | <Link href="/admin/login">Admin login</Link> |{" "}
          <Link href="/candidate/login">Candidate login</Link>
        </p>
      </section>

      <section className="panel card" style={{ maxWidth: 520 }}>
        <h2>Agent Login</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label className="field" style={{ alignItems: "flex-start" }}>
            <span>GPS access agreement</span>
            <label className="checkbox-row">
              <input type="checkbox" checked={gpsConsent} onChange={(event) => setGpsConsent(event.target.checked)} required />
              <span>I agree that PICS Nigeria may use this device GPS for agent attendance, live field tracking, and operational transparency while I am signed in.</span>
            </label>
          </label>
          <p className="muted">GPS must be turned on before agent access is granted and remain available during the session.</p>
          {sessionNotice ? <p className="muted">{sessionNotice}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="button" type="submit" disabled={loading || !gpsConsent}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

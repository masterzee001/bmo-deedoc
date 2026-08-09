"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicAccessShell } from "../../../components/public-access-shell";
import { loginUser } from "../../../lib/api";

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gpsConsent, setGpsConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReason, setSessionReason] = useState("");

  const sessionNotice =
    sessionReason === "gps-required"
      ? "Device GPS must stay turned on to use the agent dashboard."
      : sessionReason === "session-ended"
        ? "Your previous agent session ended. Sign in again to continue."
        : "";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionReason(params.get("reason") || "");
  }, []);

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

      const hasPollingUnitFieldAccess =
        data.user.role === "AGENT" ||
        (data.user.role === "COORDINATOR" && data.user.coordinatorProfile?.level === "POLLING_UNIT" && data.user.agentProfile);
      if (!hasPollingUnitFieldAccess) {
        setError("This login page is for Polling Unit field coordinators only.");
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
    <PublicAccessShell
      currentAccess="AGENT"
      brandSubtitle="Agent Access"
      authTitle="Agent Sign In"
      authDescription="Sign in to check in, send location updates, and report field incidents with active device GPS."
      footerNote="Agent access keeps GPS consent and device-location checks while matching the main landing-page structure."
    >
      <form className="starter-form" onSubmit={handleSubmit}>
        <label className="starter-form__field">
          <span>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="agent@picsnigeria.ng"
            required
          />
        </label>

        <label className="starter-form__field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />
        </label>

        <div className="starter-form__field">
          <span>GPS access agreement</span>
          <label className="starter-checkbox-row">
            <input
              type="checkbox"
              checked={gpsConsent}
              onChange={(event) => setGpsConsent(event.target.checked)}
              required
            />
            <span>
              I agree that PICS Nigeria may use this device GPS for agent attendance, live field tracking, and
              operational transparency while I am signed in.
            </span>
          </label>
        </div>

        <p className="starter-form__note">
          GPS must be turned on before agent access is granted and remain available during the session.
        </p>
        {sessionNotice ? <p className="starter-form__note">{sessionNotice}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <button className="starter-form__submit" type="submit" disabled={loading || !gpsConsent}>
          {loading ? "Signing in..." : "Sign in to agent portal"}
        </button>
      </form>
    </PublicAccessShell>
  );
}

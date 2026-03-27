"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicAccessShell } from "../../../components/public-access-shell";
import { loginUser } from "../../../lib/api";

export default function CandidateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginUser(email, password);

      if (data.user.role !== "CANDIDATE") {
        setError("This login page is for candidates only.");
        return;
      }

      localStorage.setItem("picsNigeriaCandidateToken", data.token);
      router.push("/candidate/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicAccessShell
      currentAccess="CANDIDATE"
      brandSubtitle="Candidate Access"
      authTitle="Candidate Sign In"
      authDescription="Sign in to review your office profile, campaign content, voter visibility, and field operations."
      footerNote="Candidate access keeps the landing-page structure while routing into campaign-specific tools."
    >
      <form className="starter-form" onSubmit={handleSubmit}>
        <label className="starter-form__field">
          <span>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="candidate@picsnigeria.ng"
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

        {error ? <p className="error">{error}</p> : null}

        <button className="starter-form__submit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in to candidate portal"}
        </button>
      </form>
    </PublicAccessShell>
  );
}

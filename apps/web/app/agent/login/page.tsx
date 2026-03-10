"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "../../../lib/api";

export default function AgentLoginPage() {
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
          {error ? <p className="error">{error}</p> : null}
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

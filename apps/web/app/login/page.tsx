"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "../../lib/api";

export default function LoginPage() {
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

      if (data.user.role !== "VOTER") {
        setError("This starter login page is currently for voters only.");
        return;
      }

      localStorage.setItem("picsNigeriaToken", data.token);
      router.push("/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel hero">
        <h1>PICS Nigeria Voter Access</h1>
        <p>Sign in with your voter account to view your referral code and reward activity.</p>
        <p>
          New voter? <Link href="/register">Create your account</Link>
        </p>
        <p>
          Need your polling unit? <Link href="/polling-units">Find polling unit location</Link>
        </p>
        <p>
          <Link href="/admin/login">Admin login</Link> | <Link href="/candidate/login">Candidate login</Link> |{" "}
          <Link href="/agent/login">Agent login</Link>
        </p>
      </section>

      <section className="panel card" style={{ maxWidth: 520 }}>
        <h2>Voter Login</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ada@example.com"
              required
            />
          </label>

          <label className="field">
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

          <button className="button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

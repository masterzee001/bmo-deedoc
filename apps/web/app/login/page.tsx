"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicAccessShell } from "../../components/public-access-shell";
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
        setError("This login page is for voters only.");
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
    <PublicAccessShell
      currentAccess="VOTER"
      brandSubtitle="Voter Access Portal"
      authTitle="Voter Sign In"
      authDescription="Sign in with your voter account to view your referral code, reward activity, and civic updates."
      footerNote="Use the same public access hub to register, sign in, or confirm your polling unit."
    >
      <form className="starter-form" onSubmit={handleSubmit}>
        <label className="starter-form__field">
          <span>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ada@example.com"
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
          {loading ? "Signing in..." : "Sign in to your account"}
        </button>

        <p className="starter-form__meta">
          <Link href="/register">Create voter account</Link> {" | "}
          <Link href="/polling-units">Find polling unit location</Link>
        </p>
      </form>
    </PublicAccessShell>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicAccessShell } from "../../../components/public-access-shell";
import { loginUser } from "../../../lib/api";

export default function AdminLoginPage() {
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

      const hasCommandAccess = ["ADMIN", "SUPER_ADMIN", "STATE_OFFICER", "COORDINATOR"].includes(data.user.role);
      if (!hasCommandAccess) {
        setError("This login page is for authorized command users only.");
        return;
      }

      localStorage.setItem("picsNigeriaAdminToken", data.token);
      router.push(data.user.role === "ADMIN" || data.user.role === "SUPER_ADMIN" ? "/admin/dashboard" : "/platform");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicAccessShell
      currentAccess="ADMIN"
      brandSubtitle="Administrative Access"
      authTitle="Admin Sign In"
      authDescription="Sign in to review scope summaries, visible candidates, reference coverage, and operational activity."
      footerNote="Admin access uses the same public entry layout, with role-specific routing after authentication."
    >
      <form className="starter-form" onSubmit={handleSubmit}>
        <label className="starter-form__field">
          <span>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@picsnigeria.ng"
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
          {loading ? "Signing in..." : "Sign in to admin portal"}
        </button>
      </form>
    </PublicAccessShell>
  );
}

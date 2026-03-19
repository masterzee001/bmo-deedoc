"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "../lib/api";

function NigeriaFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 3 2"
      className={className}
      aria-label="Nigerian flag"
      role="img"
    >
      <rect x="0" y="0" width="1" height="2" fill="#008751" />
      <rect x="1" y="0" width="1" height="2" fill="#ffffff" />
      <rect x="2" y="0" width="1" height="2" fill="#008751" />
    </svg>
  );
}

const accessCards = [
  {
    href: "/admin/login",
    title: "Admin Login",
    description: "System administration & management",
    icon: "A",
  },
  {
    href: "/candidate/login",
    title: "Candidate Login",
    description: "Campaign management portal",
    icon: "C",
  },
  {
    href: "/agent/login",
    title: "Agent Login",
    description: "Field agent operations dashboard",
    icon: "G",
  },
];

export default function HomePage() {
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
    <main className="starter-page">
      <div className="starter-page__bar" />

      <div className="starter-page__container">
        <section className="starter-page__brand">
          <div className="starter-page__brand-mark">
            <NigeriaFlag className="starter-page__flag" />
          </div>

          <div>
            <h1>PICS Nigeria</h1>
            <p>Voter Access Portal</p>
          </div>
        </section>

        <section className="starter-auth-card">
          <div className="starter-auth-card__header">
            <h2>Voter Sign In</h2>
            <p>
              Sign in with your voter account to view your referral code and reward
              activity.
            </p>
          </div>

          <form className="starter-form" onSubmit={handleSubmit}>
            <label className="starter-form__field">
              <span>Email address</span>
              <input
                type="email"
                placeholder="ada@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="starter-form__field">
              <span>Password</span>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <button type="submit" className="starter-form__submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in to your account"}
            </button>

            <p className="starter-form__meta">
              New voter? <Link href="/register">Create your account</Link>
            </p>
          </form>
        </section>

        <section className="starter-access">
          <p className="starter-access__label">Other access</p>

          <div className="starter-access__list">
            {accessCards.map((card) => (
              <Link key={card.href} href={card.href} className="starter-access-card">
                <div className="starter-access-card__icon" aria-hidden="true">
                  {card.icon}
                </div>
                <div>
                  <span>{card.title}</span>
                  <p>{card.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <Link href="/polling-units" className="starter-polling-card">
          <div className="starter-polling-card__icon" aria-hidden="true">
            P
          </div>
          <div>
            <span>Find your polling unit</span>
            <p>Locate your nearest polling station</p>
          </div>
        </Link>

        <p className="starter-page__footer">© 2026 PICS Nigeria. All rights reserved.</p>
      </div>
    </main>
  );
}

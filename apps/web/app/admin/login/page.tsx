"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Command and specialist sign-in moved to the single door.
 *
 * Kept as a redirect rather than deleted: these URLs are bookmarked, printed in
 * onboarding notes, and linked from the public shell. A 404 would read as the
 * platform being down.
 */
export default function RedirectToSignIn() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <main className="shell">
      <section className="panel card">
        <h1>Taking you to sign in…</h1>
        <p className="muted">Command and specialist sign-in moved to the single door.</p>
      </section>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Field sign-in moved to the single door; the GPS step is preselected.
 *
 * Kept as a redirect rather than deleted: these URLs are bookmarked, printed in
 * onboarding notes, and linked from the public shell. A 404 would read as the
 * platform being down.
 */
export default function RedirectToSignIn() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?field=1");
  }, [router]);

  return (
    <main className="shell">
      <section className="panel card">
        <h1>Taking you to sign in…</h1>
        <p className="muted">Field sign-in moved to the single door; the GPS step is preselected.</p>
      </section>
    </main>
  );
}

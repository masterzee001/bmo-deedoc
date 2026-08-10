/**
 * Liveness probe for the web container.
 *
 * Deliberately does not call the API: this reports only whether the Next.js
 * server itself is serving. Coupling it to the API would make the web container
 * restart during an unrelated API outage.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "web" });
}

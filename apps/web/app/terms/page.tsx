import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="shell">
      <section className="panel hero">
        <h1>PICS Nigeria Terms and Conditions</h1>
        <p>These terms explain how voter registration data and campaign communication consent are handled on the platform.</p>
      </section>

      <section className="panel card" style={{ maxWidth: 860 }}>
        <h2>Voter Registration Consent</h2>
        <p>
          By creating a voter account, you confirm that your registration details, including your polling unit and contact details, are accurate and belong to you.
        </p>
        <p>
          You consent to receive election, civic participation, campaign, and operational messages connected to your registered territory from authorized PICS Nigeria administrators and candidates operating within their permitted scope.
        </p>
        <p>
          Contact details are not open to all users. Export of voter email and phone records is restricted to the super admin for authorized operational use.
        </p>
        <p>
          Your territory relationship data may be used to organize outreach by polling unit, ward, local government, constituency, state, or other lawful political scope.
        </p>
        <p>
          <Link href="/register">Return to voter registration</Link>
        </p>
      </section>
    </main>
  );
}

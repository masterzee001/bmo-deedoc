"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/manage", label: "Management" },
  { href: "/admin/operations/live", label: "Live Ops" },
  { href: "/admin/operations/coverage", label: "Coverage" },
  { href: "/admin/communications", label: "Communications" },
  { href: "/admin/incidents", label: "Incidents" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/manage/territory", label: "Select Territory" },
  { href: "/admin/manage/users", label: "Manage Users" },
  { href: "/admin/manage/create", label: "Create User" },
  { href: "/admin/reference", label: "Reference Data" },
  { href: "/admin/account", label: "Account" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="action-row" style={{ marginTop: 16, marginBottom: 24, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`button ${pathname === item.href ? "" : "secondary"}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

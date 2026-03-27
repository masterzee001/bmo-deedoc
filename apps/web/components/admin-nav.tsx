"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavGroup = {
  title: string;
  items: Array<{ href: string; label: string }>;
};

const groups: AdminNavGroup[] = [
  {
    title: "Core",
    items: [
      { href: "/admin/dashboard", label: "Overview" },
      { href: "/admin/rewards", label: "Rewards" },
      { href: "/admin/activity", label: "Activity" },
      { href: "/admin/reference", label: "Reference Data" },
      { href: "/admin/account", label: "Account" },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/admin/manage", label: "Management" },
      { href: "/admin/manage/territory", label: "Select Territory" },
      { href: "/admin/manage/users", label: "Manage Users" },
      { href: "/admin/manage/create", label: "Create User" },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { href: "/admin/operations/live", label: "Live Ops" },
      { href: "/admin/operations/coverage", label: "Coverage" },
      { href: "/admin/incidents", label: "Incidents" },
      { href: "/admin/election-reports", label: "Election Reports" },
      { href: "/admin/communications", label: "Communications" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {groups.map((group) => (
        <section key={group.title} className="admin-nav__group">
          <p className="admin-nav__title">{group.title}</p>
          <div className="action-row admin-nav__links">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`button ${pathname === item.href ? "" : "secondary"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/manage", label: "Management" },
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

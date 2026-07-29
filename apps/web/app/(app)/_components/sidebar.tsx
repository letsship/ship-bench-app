"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/classes", label: "Classes" },
  { href: "/bookings", label: "Bookings" },
  { href: "/members", label: "Members" },
  { href: "/packages", label: "Packages" },
  { href: "/invoices", label: "Invoices" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className="sb-nav-link" data-active={active}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

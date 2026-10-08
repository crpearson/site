"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Fleet" },
  { href: "/bakeoff", label: "Bake-off" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About the data" },
] as const;

export function SiteHeader({
  lastIngest,
  rowCount,
  sessionCount,
}: {
  lastIngest: string;
  rowCount: number;
  sessionCount: number;
}) {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6">
            <rect
              x="2.5"
              y="6"
              width="16"
              height="12"
              rx="2.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="M19 9.2h1.4a1 1 0 0 1 1 1v3.6a1 1 0 0 1-1 1H19" fill="currentColor" />
            <rect x="5" y="8.6" width="8.2" height="6.8" rx="1" fill="currentColor" />
          </svg>
        </span>
        <span>
          <span className="brand-name">LostPennyFPV</span>
          <span className="brand-sub">LiPo fleet health</span>
        </span>
      </Link>
      <nav className="nav" aria-label="Primary">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "nav-link is-active" : "nav-link"}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <p className="header-meta">
        {rowCount} measurements · {sessionCount} nights · through {lastIngest}
      </p>
    </header>
  );
}

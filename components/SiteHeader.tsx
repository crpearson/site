"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/batteries/", label: "Batteries" },
  { href: "/builds/", label: "Drone Builds" },
  { href: "/gear/", label: "Suggested Equipment", short: "Gear" },
  { href: "/howtos/", label: "HOWTOs" },
  { href: "/about/", label: "About" },
] as const;

const batteryLinks = [
  { href: "/batteries/", label: "Fleet" },
  { href: "/batteries/next-charge/", label: "Next charge" },
  { href: "/batteries/bakeoff/", label: "Brand comparison" },
  { href: "/batteries/methodology/", label: "How I test" },
  { href: "/batteries/terms-and-rules/", label: "Terms and rules" },
] as const;

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function normalize(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function formatUpdated(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = months[Number(match[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

function inBatterySection(pathname: string) {
  const path = normalize(pathname);
  return (
    path === "/batteries" ||
    path.startsWith("/batteries/") ||
    path.startsWith("/pack/") ||
    path.startsWith("/slot/")
  );
}

function topCurrent(href: string, pathname: string) {
  const path = normalize(pathname);
  const target = normalize(href);
  if (target === "/") return path === "/";
  if (target === "/batteries") return inBatterySection(pathname);
  if (target === "/about") return path === "/about";
  return path === target || path.startsWith(`${target}/`);
}

function subCurrent(href: string, pathname: string) {
  const path = normalize(pathname);
  const target = normalize(href);
  if (target === "/batteries") return path === "/batteries";
  return path === target || path.startsWith(`${target}/`);
}

function MainNav({ pathname, label, scroll = false }: { pathname: string; label: string; scroll?: boolean }) {
  return (
    <nav className="topnav" aria-label={label} data-scroll-ok={scroll ? "" : undefined}>
      {links.map((link) => {
        const current = topCurrent(link.href, pathname);
        return (
          <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
            {"short" in link ? (
              <>
                <span className="full">{link.label}</span>
                <span className="short">{link.short}</span>
              </>
            ) : (
              link.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeader({ lastIngest, sessionCount }: { lastIngest: string; sessionCount: number }) {
  const pathname = usePathname() || "/";
  const showBatteryNav = inBatterySection(pathname);

  return (
    <>
      <header className="site-header">
        <div className="bar">
          <Link href="/" className="brand" aria-label="Lost Penny FPV home">
            <img className="badge" src="/favicon.svg" alt="" width={28} height={28} />
            <img className="wm" src="/assets/lostpenny-wordmark-on-dark.svg" alt="Lost Penny" height={24} />
          </Link>
          <MainNav pathname={pathname} label="Main" />
        </div>
        <div className="navrow">
          <MainNav pathname={pathname} label="Main (phone)" scroll />
        </div>
      </header>
      {showBatteryNav ? (
        <nav className="subnav" aria-label="Batteries">
          <div className="row">
            <span className="label">Battery tracker</span>
            <div className="tabs" data-scroll-ok="">
              {batteryLinks.map((link) => {
                const current = subCurrent(link.href, pathname);
                return (
                  <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <span className="meta">
              Updated through {formatUpdated(lastIngest)} · {sessionCount} charge nights
            </span>
          </div>
        </nav>
      ) : null}
    </>
  );
}

import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { siteMeta } from "@/lib/fleet";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cliff Pearson · LiPo fleet health",
    template: "%s · LiPo fleet health",
  },
  description:
    "Health over time for 12 LiPo packs: internal resistance, intra-pack spread, start floor, and inter-pack rest delta from iCharger DX8 storage charges.",
};

export const viewport: Viewport = {
  themeColor: "#080b10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[var(--ink)]">
        <a className="skip" href="#content">
          Skip to content
        </a>
        <SiteHeader
          lastIngest={siteMeta.lastIngest}
          rowCount={siteMeta.rowCount}
          sessionCount={siteMeta.sessionCount}
        />
        <main id="content" className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-16 sm:px-6">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-[1180px] px-4 pb-10 sm:px-6">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {siteMeta.source}. Last ingest {siteMeta.lastIngest}. {siteMeta.rowCount} store
            rows across {siteMeta.sessionCount} sessions. Partial nights are never interpolated.
          </p>
        </footer>
      </body>
    </html>
  );
}

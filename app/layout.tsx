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

const description =
  "Health over time for 12 LiPo packs: internal resistance, intra-pack spread, start floor, and inter-pack rest delta from iCharger DX8 storage charges.";

const title = {
  default: "LostPennyFPV · LiPo fleet health",
  template: "%s · LiPo fleet health",
} as const;

export const metadata: Metadata = {
  title,
  applicationName: "LostPennyFPV",
  description,
  openGraph: {
    title,
    description,
    siteName: "LostPennyFPV",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
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
            {siteMeta.source}. Logged through {siteMeta.lastIngest}. {siteMeta.rowCount}{" "}
            measurements across {siteMeta.sessionCount} nights. A partial night is left incomplete.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Data processing and site production by Grok Bot and{" "}
            <a
              href="https://cursor.com"
              rel="noopener"
              className="underline decoration-[var(--faint)] underline-offset-2 hover:text-[var(--ink)]"
            >
              Cursor
            </a>
            .
          </p>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { siteMeta } from "@/lib/fleet";
import "./fonts.css";
import "./globals.css";

const description =
  "Lost Penny FPV: my drones, my batteries, and what I've learned the hard way.";

const title = {
  default: "Lost Penny FPV — wtfpv.com",
  template: "%s — Lost Penny FPV",
} as const;

export const metadata: Metadata = {
  title,
  applicationName: "LostPennyFPV",
  description,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon-180.png",
  },
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
  themeColor: "#0b0b0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--bg)] font-sans text-[var(--ink)]">
        <a className="skip" href="#content">
          Skip to content
        </a>
        <SiteHeader lastIngest={siteMeta.lastIngest} sessionCount={siteMeta.sessionCount} />
        <main id="content" className="site-main">
          {children}
        </main>
        <SiteFooter
          source={siteMeta.source}
          lastIngest={siteMeta.lastIngest}
          rowCount={siteMeta.rowCount}
          sessionCount={siteMeta.sessionCount}
        />
      </body>
    </html>
  );
}

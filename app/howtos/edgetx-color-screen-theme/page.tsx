import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { EDGE_TX_THEME_SLUG, parseHowto } from "@/lib/howto";

export const metadata: Metadata = {
  title: "EdgeTX color-screen theme",
  description:
    "How I built Lost Penny, a copper-and-black theme for EdgeTX color-screen radios.",
};

export default function EdgeTxThemeHowtoPage() {
  const markdown = readFileSync(
    path.join(process.cwd(), "content/howtos", `${EDGE_TX_THEME_SLUG}.md`),
    "utf8",
  );
  const doc = parseHowto(markdown);

  return (
    <div className="howto">
      <header className="page-head">
        <p className="pointer">
          <Link href="/howtos/">HOWTOs</Link>
        </p>
        <p className="eyebrow">Guide</p>
        <h1 id={doc.titleId} className="h1">
          {doc.title}
        </h1>
        <div className="howto-intro" dangerouslySetInnerHTML={{ __html: doc.introHtml }} />
      </header>
      <div className="howto-sections">
        {doc.sections.map((section) => (
          <Panel key={section.id} title={section.title} titleId={section.id} accent="copper">
            <div className="md-body" dangerouslySetInnerHTML={{ __html: section.html }} />
          </Panel>
        ))}
      </div>
    </div>
  );
}

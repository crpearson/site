import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Panel, type PanelAccent } from "@/components/Panel";
import { publicProse } from "@/lib/format";
import { parseMethodology } from "@/lib/methodology";

export const metadata: Metadata = {
  title: "How I test",
};

const accents: PanelAccent[] = [
  "signal",
  "muted",
  "floor",
  "ruleb",
  "rulea",
  "off",
  "signal",
  "muted",
  "floor",
  "off",
  "ruleb",
];

export default function MethodologyPage() {
  const markdown = publicProse(
    readFileSync(path.join(process.cwd(), "content/methodology.md"), "utf8").replace(
      "Older nights used `S` + their lowest file number (e.g. `S413`) and keep those names.",
      "Older nights have no calendar date in this record.",
    ),
  );
  const doc = parseMethodology(markdown);

  return (
    <div className="methodology space-y-8">
      <header>
        <h1 id={doc.titleId} className="h1">
          {doc.title}
        </h1>
        <div className="page-intro mt-4" dangerouslySetInnerHTML={{ __html: doc.introHtml }} />
      </header>
      {doc.sections.map((section, index) => (
        <Panel
          key={section.id}
          title={section.title}
          titleId={section.id}
          accent={accents[index % accents.length]}
        >
          <div className="md-body" dangerouslySetInnerHTML={{ __html: section.html }} />
        </Panel>
      ))}
    </div>
  );
}

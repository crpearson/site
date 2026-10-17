import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Panel, type PanelAccent } from "@/components/Panel";
import { parseMethodology } from "@/lib/methodology";

export const metadata: Metadata = {
  title: "Methodology",
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
  const markdown = readFileSync(path.join(process.cwd(), "content/methodology.md"), "utf8");
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

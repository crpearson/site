import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { marked } from "marked";
import { UcBanner } from "@/components/UnderConstruction";

export function SectionStub({
  dir,
  title,
  outlineTitle,
  outline,
}: {
  dir: string;
  title: string;
  outlineTitle: string;
  outline: { title: string; body: string }[];
}) {
  const raw = readFileSync(path.join(process.cwd(), "content", dir, "index.md"), "utf8");
  const html = marked.parse(raw, { async: false });

  return (
    <div>
      <header className="page-head">
        <p className="eyebrow">Section</p>
        <h1 className="h1">{title}</h1>
      </header>
      <UcBanner />
      <section className="stub-empty">
        <svg className="art" viewBox="0 0 320 240" role="img" aria-label="">
          <rect x="0" y="0" width="320" height="240" rx="12" fill="var(--panel-2)" />
          <path d="M80 40h36v124h92v36H80z" fill="var(--line-strong)" />
          <circle cx="214" cy="104" r="32" fill="var(--copper)" />
          <path d="M24 216h272" stroke="var(--line)" strokeWidth="2" strokeDasharray="6 8" />
        </svg>
        <div>
          <span className="tag">Coming soon</span>
          <div className="stub-copy" style={{ marginTop: "var(--space-4)" }} dangerouslySetInnerHTML={{ __html: html }} />
          <div className="btn-row" style={{ marginTop: "var(--space-5)" }}>
            <Link className="btn btn-primary" href="/batteries/">
              See the battery tracker
            </Link>
            <Link className="btn btn-ghost" href="/">
              Back to Home
            </Link>
          </div>
        </div>
      </section>
      <section className="stub-outline">
        <h2 className="section-title">{outlineTitle}</h2>
        <ul>
          {outline.map((item) => (
            <li key={item.title}>
              <b>{item.title}</b>
              {item.body}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

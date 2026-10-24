import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";
import { EDGE_TX_THEME_SLUG, parseHowto } from "@/lib/howto";

export const metadata: Metadata = {
  title: "HOWTOs",
  description: "Step-by-step guides for the jobs I do over and over.",
};

export default function HowtosPage() {
  const intro = readFileSync(path.join(process.cwd(), "content/howtos/index.md"), "utf8");
  const introHtml = marked.parse(intro, { async: false });
  const article = readFileSync(
    path.join(process.cwd(), "content/howtos", `${EDGE_TX_THEME_SLUG}.md`),
    "utf8",
  );
  const doc = parseHowto(article);

  return (
    <div className="howto-index">
      <header className="page-head">
        <p className="eyebrow">Section</p>
        <h1 className="h1">HOWTOs</h1>
        <div className="page-intro" dangerouslySetInnerHTML={{ __html: introHtml }} />
      </header>
      <ul className="howto-index-list">
        <li>
          <Link className="card howto-index-card" href={`/howtos/${EDGE_TX_THEME_SLUG}/`}>
            <span className="tag">Guide</span>
            <h2>{doc.title}</h2>
            <p>
              How I made a copper-and-black theme for EdgeTX color-screen radios: the folder, theme.yml, and
              the mistakes I made.
            </p>
            <span className="go">Read the guide →</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

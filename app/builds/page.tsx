import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";
import { listBuilds } from "@/lib/builds";

export const metadata: Metadata = {
  title: "Drone Builds",
  description: "Build logs for the quads I fly. Each one has the story, the parts, the photos, and where it stands now.",
};

export default function BuildsPage() {
  const intro = readFileSync(path.join(process.cwd(), "content/builds/index.md"), "utf8");
  const introHtml = marked.parse(intro, { async: false });
  const builds = listBuilds();

  return (
    <div className="howto-index build-index">
      <header className="page-head">
        <p className="eyebrow">Section</p>
        <h1 className="h1">Drone Builds</h1>
        <div className="page-intro" dangerouslySetInnerHTML={{ __html: introHtml }} />
      </header>
      <ul className="howto-index-list">
        {builds.map((build, index) => (
          <li key={build.slug}>
            <Link className="card howto-index-card build-index-card" href={`/builds/${build.slug}/`}>
              <img
                src={build.cover}
                alt={build.coverAlt}
                width={build.coverWidth}
                height={build.coverHeight}
                fetchPriority={index === 0 ? "high" : undefined}
                loading={index === 0 ? undefined : "lazy"}
              />
              <span className="build-tags">
                <span className="tag">Iteration {build.iteration}</span>
                <span className="tag">{build.size}</span>
                <span className="tag">{build.statusLabel}</span>
              </span>
              <h2>{build.title}</h2>
              <p className="build-line">{build.line}</p>
              <p>{build.summary}</p>
              <p className="build-card-meta">
                Posted <time dateTime={build.date}>{build.date}</time>
                {build.updated ? (
                  <>
                    {" "}
                    · Updated <time dateTime={build.updated}>{build.updated}</time>
                  </>
                ) : null}
                {build.cardNote ? `. ${build.cardNote}` : null}
              </p>
              <span className="go">Read the build →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

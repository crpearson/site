import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/Panel";
import { getBuild, listBuildPages } from "@/lib/builds";

export const dynamicParams = false;

export function generateStaticParams() {
  return listBuildPages().map((build) => ({ slug: build.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/builds/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const build = getBuild(slug);
  if (!build) return { title: "Drone build" };
  const deadEnd = build.status === "dead-end";
  const title = deadEnd ? build.title : `${build.title}, iteration ${build.iteration}`;
  const description = deadEnd
    ? build.summary
    : `Iteration ${build.iteration} of the ${build.line} build: ${build.title}. It still does not fly right.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default async function BuildPage({ params }: PageProps<"/builds/[slug]">) {
  const { slug } = await params;
  const build = getBuild(slug);
  if (!build) notFound();
  const { doc } = build;
  const deadEnd = build.status === "dead-end";

  return (
    <div className="howto build">
      <header className="page-head">
        <p className="pointer">
          <Link href="/builds/">Drone Builds</Link>
        </p>
        <p className="eyebrow">{deadEnd ? "Dead end" : "Drone build"}</p>
        <div className="title-row">
          <h1 id={doc.titleId} className="h1">
            {doc.title}
          </h1>
          {deadEnd ? null : <span className="tag">Iteration {build.iteration}</span>}
        </div>
        <div className="howto-intro" dangerouslySetInnerHTML={{ __html: doc.introHtml }} />
        <ul className="build-meta">
          <li>{build.line}</li>
          <li>{build.size}</li>
          <li>{build.statusLabel}</li>
          <li>
            Posted <time dateTime={build.date}>{build.date}</time>
          </li>
          {build.updated ? (
            <li>
              Updated <time dateTime={build.updated}>{build.updated}</time>
            </li>
          ) : null}
        </ul>
        <figure className="build-cover-figure">
          <img
            className="build-cover"
            src={build.cover}
            alt={build.coverAlt}
            width={build.coverWidth}
            height={build.coverHeight}
            fetchPriority="high"
          />
          {deadEnd ? <figcaption>{build.coverAlt}</figcaption> : null}
        </figure>
      </header>
      <div className="howto-sections">
        {doc.sections.map((section) => (
          <Panel
            key={section.id}
            title={section.title}
            titleId={section.id}
            accent="copper"
          >
            <div
              className={section.title.toLowerCase().startsWith("photos") ? "md-body build-gallery" : "md-body"}
              dangerouslySetInnerHTML={{ __html: section.html }}
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}

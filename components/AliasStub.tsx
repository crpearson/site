import Link from "next/link";

/** Case alias. Browsers follow the refresh; the canonical link names the permanent URL. */
export function AliasStub({ href, title }: { href: string; title: string }) {
  return (
    <div className="space-y-4">
      <link rel="canonical" href={href} />
      <meta httpEquiv="refresh" content={`0; url=${href}`} />
      <p className="eyebrow">Same pack</p>
      <h1 className="h1">{title}</h1>
      <p className="page-intro">
        <Link href={href} className="pack-link">
          Open {title}
        </Link>
        .
      </p>
    </div>
  );
}

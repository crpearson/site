import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <p className="eyebrow">404</p>
      <h1 className="h1 mt-3">No page at this address</h1>
      <p className="page-intro mt-4">The home page, the battery tracker, and the section stubs are the pages on this site.</p>
      <p className="mt-6">
        <Link href="/" className="pack-link">
          Back to home
        </Link>
      </p>
    </div>
  );
}

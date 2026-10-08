import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <p className="eyebrow">404</p>
      <h1 className="h1 mt-3">No page at this address</h1>
      <p className="page-intro mt-4">
        The fleet lives on the dashboard, a pack drill-down, the brand bake-off, and the data notes.
      </p>
      <Link href="/" className="pack-link mt-6 inline-block">
        Back to the fleet
      </Link>
    </div>
  );
}

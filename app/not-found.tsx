import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <p className="eyebrow">404</p>
      <h1 className="h1 mt-3">Nothing here</h1>
      <p className="page-intro mt-4">There&apos;s no page at this address. Try the home page, or pick a section from the menu above.</p>
      <p className="mt-6">
        <Link href="/" className="pack-link">
          Back to home
        </Link>
      </p>
    </div>
  );
}

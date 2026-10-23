import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";

export const metadata: Metadata = {
  title: "About Lost Penny",
  description: "I fly FPV as Lost Penny. Online I'm LostPennyFPV. This site is where I keep my notes.",
};

export default function AboutLostPennyPage() {
  const raw = readFileSync(path.join(process.cwd(), "content/about.md"), "utf8");
  const html = marked.parse(raw, { async: false });

  return (
    <div>
      <header className="page-head">
        <p className="pointer">
          Looking for the battery terms and rules? They&apos;re under{" "}
          <Link href="/batteries/terms-and-rules/">Batteries › Terms and rules</Link>.
        </p>
        <div className="title-row">
          <h1 className="h1">About Lost Penny</h1>
          <span className="tag">DRAFT</span>
        </div>
      </header>
      <div className="prose-block" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

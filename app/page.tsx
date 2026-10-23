import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { UcButton } from "@/components/UnderConstruction";
import { ProvisionalMark } from "@/components/ProvisionalMark";
import { chargedIndividually, headline, siteMeta, statusRows } from "@/lib/fleet";
import { IR_UNIT } from "@/lib/ir";

export const metadata: Metadata = {
  title: { absolute: "Lost Penny FPV — wtfpv.com" },
  description: "Lost Penny FPV: my drones, my batteries, and what I've learned the hard way.",
};

function heroWordmark() {
  const raw = readFileSync(path.join(process.cwd(), "public/assets/lostpenny-wordmark-on-dark.svg"), "utf8").trim();
  return raw.replace("<svg ", '<svg class="hero-wm" role="img" aria-label="Lost Penny" ');
}

export default function HomePage() {
  const stats = headline();
  const individualPacks = chargedIndividually();
  const rows = statusRows();
  const fleetIncludesProvisional = rows.some((row) => !row.excluded && row.provisional);
  const wordmark = heroWordmark();

  return (
    <div className="home">
      <section className="hero" aria-label="Lost Penny FPV">
        <div dangerouslySetInnerHTML={{ __html: wordmark }} />
        <h1 className="h1">Lost Penny FPV: my drones, my batteries, and what I&apos;ve learned the hard way.</h1>
        <p className="lead">
          This is where I keep track of my LiPo packs, my builds, the gear I actually use, and how-tos for the
          stuff I had to figure out.
        </p>
      </section>

      <section className="home-section">
        <h2 className="section-title">Pick a section</h2>
        <div className="grid g4 cols-collapse">
          <Link className="card section-card" href="/batteries/">
            <h3>Batteries</h3>
            <p>Battery tracker: fleet health, the next charge plan, and how I test.</p>
            <span className="go">Open Batteries →</span>
          </Link>
          <Link className="card section-card is-stub" href="/builds/">
            <h3>Drone Builds</h3>
            <UcButton />
            <p>Build logs are on the way.</p>
            <span className="go">Preview →</span>
          </Link>
          <Link className="card section-card is-stub" href="/gear/">
            <h3>Suggested Equipment</h3>
            <UcButton />
            <p>A short list of gear I&apos;d actually recommend.</p>
            <span className="go">Preview →</span>
          </Link>
          <Link className="card section-card" href="/howtos/">
            <h3>HOWTOs</h3>
            <p>Step-by-step guides for the jobs I do over and over.</p>
            <span className="go">Open HOWTOs →</span>
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Battery snapshot</h2>
            <p className="page-intro" style={{ marginTop: 6 }}>
              Where the packs stand right now.
            </p>
          </div>
          <p className="faint" style={{ color: "var(--faint)" }}>
            Updated through{" "}
            <span className="mono">
              <span className="nw">{siteMeta.lastIngest}</span>
            </span>{" "}
            · {siteMeta.sessionCount} charge nights
          </p>
        </div>
        <div className="grid g4">
          <article className="stat" data-tone="ok">
            <p className="eyebrow">Parallel Go</p>
            <p className="stat-value">{stats.ok.length}</p>
            <p className="stat-sub">packs</p>
          </article>
          <article className="stat" data-tone="caution">
            <p className="eyebrow">Parallel Caution</p>
            <p className="stat-value">{stats.caution.length}</p>
            <p className="stat-sub">packs</p>
          </article>
          <article className="stat" data-tone="off">
            <p className="eyebrow">Charged individually</p>
            <p className="stat-value">{individualPacks.length}</p>
            <p className="stat-sub">packs</p>
          </article>
          <article className="stat" data-tone="signal">
            <p className="eyebrow">Mean IR</p>
            <p className="stat-value">
              <span className="nw">
                {stats.mean.toFixed(2)}
                {fleetIncludesProvisional ? <ProvisionalMark /> : null} {IR_UNIT}
              </span>
            </p>
            <p className="stat-sub">across {stats.counted} packs</p>
          </article>
        </div>
        <div className="btn-row" style={{ marginTop: "var(--space-5)" }}>
          <Link className="btn btn-primary" href="/batteries/">
            Open Batteries
          </Link>
          <Link className="btn btn-ghost" href="/batteries/next-charge/">
            Next charge
          </Link>
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">What&apos;s new</h2>
        <ul className="updates">
          <li>
            <time dateTime="2026-10-23">
              <span className="nw">2026-10-23</span>
            </time>
            <span>
              New guide: how to make an EdgeTX color-screen theme.{" "}
              <Link href="/howtos/edgetx-color-screen-theme/">Read the HOWTO</Link>
            </span>
          </li>
          <li>
            <time dateTime={siteMeta.lastIngest}>
              <span className="nw">{siteMeta.lastIngest}</span>
            </time>
            <span>
              Battery log updated through <span className="nw">{siteMeta.lastIngest}</span>: {siteMeta.rowCount}{" "}
              measurements across {siteMeta.sessionCount} nights. <Link href="/batteries/">Fleet</Link>
            </span>
          </li>
          <li>
            <time dateTime="2026-10-18">
              <span className="nw">2026-10-18</span>
            </time>
            <span>
              Rest tests passed: <span className="nw">C2-P2</span> cell 6 and <span className="nw">C1-P4</span> cell
              1 (<span className="nw">C1-P1</span> cell 6 passed on <span className="nw">2026-10-17</span>).{" "}
              <span className="nw">C1-P4</span> and <span className="nw">C2-P2</span> are back in rotation.
            </span>
          </li>
          <li>
            <time dateTime="2026-10-17">
              <span className="nw">2026-10-17</span>
            </time>
            <span>
              Charge rules updated to v7. <Link href="/batteries/methodology/">How I test</Link>
            </span>
          </li>
          <li>
            <time dateTime="2026-10-13">
              <span className="nw">2026-10-13</span>
            </time>
            <span>
              C3 and C4 join the rotation: CNHL V2 6S 1300 Black.{" "}
              <Link href="/batteries/bakeoff/">Brand comparison</Link>
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

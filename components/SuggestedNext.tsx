import type { NextChargeV4, PlannerPlan, SuggestedNext as SuggestedNextBlock, SuggestedSet } from "@/lib/next-charge.mjs";
import type { PlanResult } from "@/lib/plan-runs.mjs";
import { FileCount, RunSheet } from "@/components/RunSheet";

type Advisory = {
  pack: string;
  text: string;
  chip: "PULLED" | "CHECK FIRST" | "ALONE";
  tone: "caution" | "off";
  anchor: "pulled" | "check-before-connecting" | "charge-alone";
  rank: number;
};

function asSet(value: SuggestedSet | string | null | undefined): SuggestedSet {
  if (typeof value === "string") return { label: value };
  if (value && typeof value === "object") return value;
  return {};
}

function setTitle(set: SuggestedSet): string {
  if (set.title) return set.title;
  if (set.label) return set.label;
  if (set.name) return set.name;
  if (set.series?.length) return set.series.join(" + ");
  if (set.packs?.length) return set.packs.join(" + ");
  if (set.labels?.length) return set.labels.join(" + ");
  if (set.id) return set.id;
  return "Set";
}

function explicitPacks(set: SuggestedSet): string[] {
  return [...new Set([...(set.packs ?? []), ...(set.labels ?? [])].filter((label) => label.length > 0))];
}

/** Packs in the suggested pairing. Explicit pack lists win; otherwise expand series through home channels. */
function pairingPacks(doc: NextChargeV4, block: SuggestedNextBlock): string[] {
  if (block.status !== "ok" || block.pick == null) return [];
  const pick = asSet(block.pick);
  const named = explicitPacks(pick);
  if (named.length > 0) return named;
  const series = new Set(pick.series ?? []);
  if (series.size === 0 && pick.id) {
    const match = block.sets.map((item) => asSet(item)).find((item) => item.id === pick.id || item.label === pick.id);
    if (match) {
      const fromMatch = explicitPacks(match);
      if (fromMatch.length > 0) return fromMatch;
      for (const id of match.series ?? []) series.add(id);
    }
  }
  if (series.size === 0) return [];
  return doc.home_channels
    .filter((row) => series.has(row.series) && row.state !== "empty" && row.label.length > 0)
    .map((row) => row.label);
}

/**
 * One advisory per pack in the pairing. Most severe wins: PULLED, then CHECK FIRST, then ALONE.
 */
function advisoriesFor(doc: NextChargeV4, packs: string[]): Advisory[] {
  const want = new Set(packs);
  const byPack = new Map<string, Advisory>();
  function consider(item: Advisory) {
    if (!want.has(item.pack)) return;
    const previous = byPack.get(item.pack);
    if (!previous || item.rank > previous.rank) byPack.set(item.pack, item);
  }
  for (const item of doc.pulled) {
    consider({
      pack: item.label,
      text: item.reason,
      chip: "PULLED",
      tone: "off",
      anchor: "pulled",
      rank: 3,
    });
  }
  for (const item of doc.check_before_connecting) {
    consider({
      pack: item.label,
      text: item.note,
      chip: "CHECK FIRST",
      tone: "caution",
      anchor: "check-before-connecting",
      rank: 2,
    });
  }
  for (const item of doc.charge_alone) {
    consider({
      pack: item.label,
      text: item.reason,
      chip: "ALONE",
      tone: "off",
      anchor: "charge-alone",
      rank: 1,
    });
  }
  return [...byPack.values()].sort((a, b) => b.rank - a.rank || a.pack.localeCompare(b.pack));
}

function flownPlan(plan: PlannerPlan | null): PlanResult | null {
  if (plan == null || plan.files == null || plan.channels == null || plan.rounds == null) return null;
  const dx1 = plan.files["DX8-1"];
  const dx2 = plan.files["DX8-2"];
  if (typeof dx1 !== "number" || typeof dx2 !== "number" || dx1 + dx2 <= 0) return null;
  return plan as PlanResult;
}

function SetList({ sets }: { sets: SuggestedNextBlock["sets"] }) {
  if (sets.length === 0) return null;
  return (
    <ul className="suggest-sets">
      {sets.map((item, index) => {
        const set = asSet(item);
        const packs = explicitPacks(set);
        const key = set.id || setTitle(set) || String(index);
        return (
          <li key={key}>
            <p className="set-name">{setTitle(set)}</p>
            {packs.length > 0 ? <p className="mono suggest-packs">{packs.join(" · ")}</p> : null}
            {set.last_flown ? (
              <p className="note">
                Last flown <span className="nw">{set.last_flown}</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AdvisoryList({ items }: { items: Advisory[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="suggest-advisories">
      {items.map((item) => (
        <li key={item.pack} className="suggest-advisory">
          <span className="mono">{item.pack}</span>
          <span className={`status-chip status-chip-${item.tone === "caution" ? "caution" : "alone"}`}>{item.chip}</span>
          <a href={`#${item.anchor}`}>Details</a>
          <p className="note">{item.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function SuggestedNext({ doc }: { doc: NextChargeV4 }) {
  const block = doc.suggested_next;
  if (!block) return null;
  const ok = block.status === "ok";
  const plan = ok ? flownPlan(block.plan_if_flown) : null;
  const advisories = advisoriesFor(doc, pairingPacks(doc, block));

  return (
    <section className="panel suggest-next" data-accent={ok ? "signal" : "muted"} aria-labelledby="suggested-next-heading">
      {ok && block.pick ? (
        <>
          <p className="eyebrow">Suggested next</p>
          <h2 id="suggested-next-heading" className="section-title">
            {setTitle(asSet(block.pick))}
          </h2>
        </>
      ) : (
        <h2 id="suggested-next-heading" className="section-title">
          No suggested sets this time
        </h2>
      )}
      <p className="suggest-reason">{block.reason}</p>
      <p className="note suggest-basis">
        based on lifetime storage cycles through <span className="nw">{block.as_of_date}</span>
      </p>
      <SetList sets={block.sets} />
      {ok && plan ? (
        <div className="suggest-plan">
          <FileCount files={plan.files} />
          <RunSheet plan={plan} />
        </div>
      ) : null}
      {ok && !plan ? (
        <p className="suggest-plan-link">
          <a href="#charge-planner">Open the charge planner</a>
        </p>
      ) : null}
      {ok && block.alt_pick ? (
        <p className="suggest-alt">
          Alternate <span className="set-name">{setTitle(asSet(block.alt_pick))}</span>
        </p>
      ) : null}
      <AdvisoryList items={advisories} />
    </section>
  );
}

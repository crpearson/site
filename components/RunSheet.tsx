import Link from "next/link";
import { PLANNER_CHANNELS, channelName } from "@/lib/plan-runs.mjs";
import type { PlanResult } from "@/lib/plan-runs.mjs";

const CHARGERS = ["DX8-1", "DX8-2"] as const;

export function fileCountLine(files: PlanResult["files"]): string {
  return `DX8-1: ${files["DX8-1"] ?? 0} files, DX8-2: ${files["DX8-2"] ?? 0} files`;
}

export function FileCount({ files, live = false }: { files: PlanResult["files"]; live?: boolean }) {
  return (
    <p className={live ? "planner-files-live" : "planner-files"} aria-live={live ? "polite" : undefined}>
      {fileCountLine(files)}
    </p>
  );
}

function PackLink({ label }: { label: string }) {
  return (
    <Link href={`/pack/${label}`} className="pack-link">
      {label}
    </Link>
  );
}

export function RunSheet({ plan }: { plan: PlanResult }) {
  return (
    <div className="planner-sheet">
      <div className="planner-columns">
        {PLANNER_CHANNELS.map(([charger, channel]) => {
          const name = channelName(charger, channel);
          const packs = plan.channels[name] ?? [];
          return (
            <section key={name} className="panel planner-channel" data-accent="signal" aria-label={name}>
              <h3 className="panel-title">{name}</h3>
              {packs.length === 0 ? (
                <p className="note mt-2">No packs.</p>
              ) : (
                <ol className="planner-order">
                  {packs.map((label) => (
                    <li key={label}>
                      <PackLink label={label} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
      <div className="planner-rounds">
        {CHARGERS.map((charger) => {
          const rounds = plan.rounds[charger] ?? [];
          return (
            <section key={charger} className="panel" data-accent="muted" aria-label={`${charger} rounds`}>
              <h3 className="panel-title">{charger} rounds</h3>
              {rounds.length === 0 ? (
                <p className="note mt-2">No packs.</p>
              ) : (
                <ol className="planner-round-list">
                  {rounds.map((pair, index) => (
                    <RoundLine key={`${charger}-${index}`} charger={charger} pair={pair} index={index} />
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RoundLine({
  charger,
  pair,
  index,
}: {
  charger: "DX8-1" | "DX8-2";
  pair: [string | null, string | null];
  index: number;
}) {
  const items = [
    pair[0] ? { channel: 1 as const, label: pair[0] } : null,
    pair[1] ? { channel: 2 as const, label: pair[1] } : null,
  ].filter((item) => item !== null);
  return (
    <li>
      Round {index + 1}:{" "}
      {items.map((item, itemIndex) => (
        <span key={item.channel}>
          {itemIndex > 0 ? ", " : ""}
          {channelName(charger, item.channel)} <PackLink label={item.label} />
        </span>
      ))}
      {items.length === 1 ? " alone" : ""}
    </li>
  );
}

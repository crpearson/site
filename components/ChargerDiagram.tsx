import { BenchPack, type BenchPackRow } from "@/components/BenchPack";
import type { StorageChargerView } from "@/lib/next-charge.mjs";

function ChargerFace() {
  return (
    <svg viewBox="0 0 148 86" className="bench-face" aria-hidden="true">
      <rect x="1.5" y="1.5" width="145" height="83" rx="12" fill="#0c141c" stroke="rgba(168,196,220,0.38)" />
      <rect x="12" y="12" width="84" height="62" rx="7" fill="#080c11" stroke="rgba(46,230,199,0.4)" />
      <path
        d="M22 50 H36 L43 26 L51 58 L59 34 L68 48 H88"
        fill="none"
        stroke="#2ee6c7"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M22 58 H40 L48 40 L57 66 L70 44 H88"
        fill="none"
        stroke="#c4a1ff"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="122" cy="28" r="13" fill="none" stroke="#9aafc0" strokeWidth="1.6" />
      <circle cx="122" cy="28" r="2" fill="#9aafc0" />
      <path d="M122 28 L128 20" stroke="#2ee6c7" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="114" cy="62" r="3.2" fill="#3ddc97" />
      <circle cx="126" cy="62" r="3.2" fill="#f5b942" />
    </svg>
  );
}

function ChannelPort({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 240 64" className="bench-port" role="img">
      <title>{name}</title>
      <rect x="1" y="1" width="238" height="62" rx="11" fill="#101820" stroke="rgba(168,196,220,0.3)" />
      <text
        x="14"
        y="22"
        fill="#9aafc0"
        fontSize="12"
        fontFamily="IBM Plex Mono, ui-monospace, monospace"
        letterSpacing="0.08em"
      >
        {name}
      </text>
      <rect x="14" y="32" width="46" height="20" rx="4" fill="none" stroke="#2ee6c7" strokeWidth="1.6" />
      <rect x="23" y="36" width="6" height="12" rx="1" fill="#2ee6c7" />
      <rect x="35" y="36" width="6" height="12" rx="1" fill="#2ee6c7" />
      <path d="M60 42 H88" stroke="#9aafc0" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="88" y="32" width="34" height="20" rx="3" fill="none" stroke="#c4a1ff" strokeWidth="1.5" />
      <path d="M95 37.5 v9 M101 37.5 v9 M107 37.5 v9 M113 37.5 v9" stroke="#c4a1ff" strokeWidth="1.25" />
      <circle cx="214" cy="42" r="6" fill="none" stroke="#6d8294" strokeWidth="1.4" />
      <path d="M214 38.5 v7" stroke="#6d8294" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChargerDiagram({
  charger,
  resolve,
}: {
  charger: StorageChargerView;
  resolve: (label: string) => BenchPackRow;
}) {
  return (
    <article className="panel bench-charger" data-accent="signal">
      <header className="bench-charger-head">
        <ChargerFace />
        <div className="min-w-0">
          <p className="eyebrow">Storage charger</p>
          <h3 className="panel-title">{charger.charger}</h3>
        </div>
      </header>
      <div className="bench-bays">
        {charger.channels.map((channel) => (
          <section key={channel.channel} className="bench-bay" aria-label={`${charger.charger} ${channel.channel}`}>
            <ChannelPort name={channel.channel} />
            {channel.runs.map((run) => (
              <div key={run.run} className="bench-run">
                <p className="eyebrow">Run {run.run}</p>
                <BenchPack pack={resolve(run.label)} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

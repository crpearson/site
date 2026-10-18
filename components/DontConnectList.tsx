import { BenchPack, type BenchPackRow } from "@/components/BenchPack";
import { publicProse } from "@/lib/format";
import type { DoNotConnectItem } from "@/lib/next-charge.mjs";

function BlockedJack() {
  return (
    <svg viewBox="0 0 56 28" className="bench-jack" aria-hidden="true">
      <rect x="2" y="4" width="38" height="20" rx="4" fill="#0c141c" stroke="#ff5c7a" strokeWidth="1.6" />
      <rect x="11" y="9" width="5" height="10" rx="1" fill="#ff5c7a" />
      <rect x="22" y="9" width="5" height="10" rx="1" fill="#ff5c7a" />
      <path d="M44 6 H52" stroke="#ff5c7a" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="46" cy="16" r="7" fill="none" stroke="#ff5c7a" strokeWidth="1.6" />
      <path d="M41.5 20.5 L50.5 11.5" stroke="#ff5c7a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DontConnectList({
  items,
  resolve,
}: {
  items: DoNotConnectItem[];
  resolve: (label: string) => BenchPackRow;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="bench-hold-list">
      {items.map((item) => (
        <li key={item.label} className="panel bench-hold" data-accent="off">
          <BlockedJack />
          <div className="min-w-0">
            <BenchPack pack={resolve(item.label)} />
            <p className="bench-field">{item.uid}</p>
            <p className="note mt-2">{publicProse(item.reason)}</p>
            <p className="bench-return">Pool {item.pool}</p>
            <p className="bench-return">7-day reading due {item.return_date}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

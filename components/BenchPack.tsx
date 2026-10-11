import type { CSSProperties } from "react";
import Link from "next/link";
import { StatusChip } from "@/components/StatusChip";
import { seriesColor } from "@/lib/color";
import type { StatusRow } from "@/lib/fleet";

export type BenchPackRow = Pick<StatusRow, "uid" | "label" | "series" | "status" | "chargeMode">;

export function BenchPack({ pack, note }: { pack: BenchPackRow; note?: string }) {
  return (
    <Link
      href={`/pack/${pack.uid}`}
      className="bench-pack"
      style={{ "--series": seriesColor(pack.series) } as CSSProperties}
    >
      <span className="bench-pack-swatch" aria-hidden="true" />
      <span className="bench-pack-name">{pack.label}</span>
      <StatusChip status={pack.status} chargeMode={pack.chargeMode} />
      {note ? <span className="bench-pack-note">{note}</span> : null}
    </Link>
  );
}

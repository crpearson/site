import type { CSSProperties } from "react";
import Link from "next/link";
import { StatusChip } from "@/components/StatusChip";
import { seriesColor } from "@/lib/color";
import type { StatusRow } from "@/lib/fleet";
import { conditionalJoinNote } from "@/lib/lamp";
import { packPath } from "@/lib/pack-url";

export type BenchPackRow = Pick<StatusRow, "uid" | "label" | "series" | "status" | "chargeMode">;

export function BenchPack({ pack, note }: { pack: BenchPackRow; note?: string }) {
  const condition = conditionalJoinNote(pack.status);
  return (
    <Link
      href={packPath(pack.uid)}
      className="bench-pack"
      style={{ "--series": seriesColor(pack.series) } as CSSProperties}
    >
      <span className="bench-pack-swatch" aria-hidden="true" />
      <span className="bench-pack-name">{pack.label}</span>
      <StatusChip status={pack.status} chargeMode={pack.chargeMode} />
      {condition ? <span className="bench-pack-note">{condition}</span> : null}
      {note ? <span className="bench-pack-note">{note}</span> : null}
    </Link>
  );
}

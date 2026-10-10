import Link from "next/link";
import { Sparkline } from "@/components/Sparkline";
import { StatusChip } from "@/components/StatusChip";
import { formatValue } from "@/lib/format";
import { chipTone, statusChip } from "@/lib/lamp";
import { IR_UNIT } from "@/lib/ir";
import { vacationFrom, type SlotTile } from "@/lib/fleet";

export function PackTile({ slot }: { slot: SlotTile }) {
  if (slot.empty || !slot.uid) {
    const moved = vacationFrom(slot.label);
    if (moved) {
      return (
        <Link href={`/pack/${moved.uid}`} className="tile is-vacated">
          <span className="tile-label font-mono text-sm">{slot.label}</span>
          <span className="vacated-note">Vacated: moved to {moved.to}</span>
        </Link>
      );
    }
    return (
      <Link href={`/slot/${slot.label}`} className="tile is-empty">
        <span className="tile-label font-mono text-sm">{slot.label}</span>
        <span className="vacated-note">empty</span>
      </Link>
    );
  }

  const chip = slot.status ? statusChip(slot.status, slot.chargeMode) : null;
  return (
    <Link href={`/pack/${slot.uid}`} className="tile" data-tone={chip ? chipTone(chip) : "pool"}>
      <span className="tile-head">
        <span className="tile-label font-mono text-sm">{slot.label}</span>
        {slot.status ? <StatusChip status={slot.status} chargeMode={slot.chargeMode} /> : null}
      </span>
      {slot.badge ? <span className="badge">{slot.badge}</span> : null}
      <Sparkline
        values={slot.avgSeries}
        color={slot.color}
        service={slot.service}
        logged={slot.logged}
        rest={slot.rest}
      />
      {slot.status ? (
        <span className="tile-call" title={slot.status}>
          {slot.status}
        </span>
      ) : null}
      <span className="note">
        <span>{slot.latestSession ? slot.latestSession.slice(5) : "—"}</span>
        {slot.sr == null ? null : (
          <span className="num">
            · S_R {formatValue("ir", slot.sr)} {IR_UNIT}
          </span>
        )}
        {slot.lowGap == null ? null : <span className="num">· gap {slot.lowGap} mV</span>}
      </span>
      <span className="tile-metrics">
        <span className="tile-metric">
          <span className="metric-label">IR</span>
          <span className="metric-value">{slot.avg == null ? "—" : `${formatValue("ir", slot.avg)} ${IR_UNIT}`}</span>
        </span>
        <span className="tile-metric">
          <span className="metric-label">Spread</span>
          <span className="metric-value">
            {slot.spread == null ? "—" : `${formatValue("ir", slot.spread)} ${IR_UNIT}`}
          </span>
        </span>
        <span className="tile-metric">
          <span className="metric-label">Floor</span>
          <span className="metric-value">{slot.floor == null ? "—" : `${slot.floor} mV`}</span>
        </span>
      </span>
    </Link>
  );
}

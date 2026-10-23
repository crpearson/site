import Link from "next/link";
import { occupancyLabel } from "@/lib/format";
import { getSlot } from "@/lib/fleet";
import { packPath } from "@/lib/pack-url";

/** Position page: who is in the slot now, and who was, with dates. History stays on the serial page. */
export function SlotDetail({ label }: { label: string }) {
  const slot = getSlot(label);
  if (!slot) return null;
  const current = slot.current;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/batteries/" className="pack-link">
            Fleet
          </Link>
          {" · "}
          Slot {slot.label}
          {slot.series === "D" ? " · individual, not parallel" : ""}
        </p>
        {current ? (
          <h1 className="h1">
            <Link href={packPath(current.uid)} className="slot-occupant">
              {current.label}
            </Link>
            <span className="pack-serial"> · {current.uid}</span>
          </h1>
        ) : (
          <>
            <h1 className="h1">{slot.label}</h1>
            <p className="page-intro">This slot is empty.</p>
          </>
        )}
        {slot.vacated ? (
          <p className="text-lg">
            Vacated {slot.vacated.date}. Moved to {slot.vacated.to}.{" "}
            <Link href={packPath(slot.vacated.uid)} className="pack-link">
              {slot.vacated.uid}
            </Link>
            .
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="section-title">Past occupants</h2>
        {slot.past.length === 0 ? (
          <p className="note">No earlier occupant is recorded for this slot.</p>
        ) : (
          <ul className="space-y-3">
            {slot.past.map((range) => (
              <li key={`${range.uid}-${range.start}`} className="panel" data-accent="muted">
                <p className="font-mono text-sm">
                  <Link href={packPath(range.uid)} className="pack-link">
                    {range.uid}
                  </Link>
                </p>
                <p className="note mt-1">{occupancyLabel(range.start, range.end)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

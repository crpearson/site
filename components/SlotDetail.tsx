import Link from "next/link";
import { Lamp } from "@/components/Lamp";
import { getPack, getSlot, latestCall, restTestsFor } from "@/lib/fleet";

export function SlotDetail({ label }: { label: string }) {
  const slot = getSlot(label);
  if (!slot) return null;
  const current = slot.current ? getPack(slot.current.uid) : null;
  const call = slot.current ? latestCall(slot.current.uid) : undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link href="/" className="pack-link">
            Fleet
          </Link>
          {" · "}
          {slot.series}
          {slot.series === "D" ? " · individual, not parallel" : ""}
        </p>
        <h1 className="h1">{slot.label}</h1>
        {slot.lineage ? <p className="text-lg">{slot.lineage}</p> : null}
        {slot.current ? (
          <p className="page-intro">
            Current occupant{" "}
            <Link href={`/pack/${slot.current.uid}/`} className="pack-link">
              {slot.current.uid}
            </Link>
            .
          </p>
        ) : (
          <p className="page-intro">This slot is empty.</p>
        )}
        {slot.vacated ? (
          <p className="text-lg">
            Vacated {slot.vacated.date}.{" "}
            <Link href={`/pack/${slot.vacated.to}/`} className="pack-link">
              Moved to {slot.vacated.to}
            </Link>
            {" / "}
            <Link href={`/pack/${slot.vacated.uid}/`} className="pack-link">
              {slot.vacated.uid}
            </Link>
            .
          </p>
        ) : null}
      </header>

      {current && call ? (
        <article className={current.excluded ? "panel opacity-80" : "panel"} data-accent="signal">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="panel-title">{current.label}</h2>
            <Lamp status={call.status} />
            {current.badge ? <span className="badge">{current.badge}</span> : null}
          </div>
          <p className="note mt-2 font-mono">{current.uid}</p>
          {current.lineage ? <p className="mt-2">{current.lineage}</p> : null}
          <p className="mt-3 leading-relaxed">{call.reason}</p>
          {restTestsFor(current.uid).map((test) => (
            <p key={test.id} className="note mt-2">
              Rest pool · day 0 {test.readingDate || test.start} · 7-day reading due {test.due}
            </p>
          ))}
          <p className="note mt-2">
            Purchase {current.purchaseDate} · price {current.priceUsd} · vendor {current.vendor}
          </p>
          <p className="mt-3">
            <Link href={`/pack/${current.uid}/`} className="pack-link">
              Open pack history
            </Link>
          </p>
        </article>
      ) : (
        <article className="panel" data-accent="muted">
          <h2 className="panel-title">No current occupant</h2>
          <p className="note mt-2">
            This slot is empty. Measurements for a pack that left stay on that pack&apos;s own page,
            not here.
          </p>
        </article>
      )}

      <section className="space-y-3">
        <h2 className="section-title">Past occupants</h2>
        {slot.past.length === 0 ? (
          <p className="note">No earlier occupant is recorded for this slot.</p>
        ) : (
          <ul className="space-y-3">
            {slot.past.map((range) => (
              <li key={`${range.uid}-${range.start}`} className="panel" data-accent="muted">
                <p className="font-mono text-sm">
                  <Link href={`/pack/${range.uid}/`} className="pack-link">
                    {range.uid}
                  </Link>
                </p>
                <p className="note mt-1">
                  {range.start} → {range.end ?? "present"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

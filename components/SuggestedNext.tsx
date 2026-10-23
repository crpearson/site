import type { SuggestedNext as SuggestedNextBlock, SuggestedPlan, NextChargeV4 } from "@/lib/next-charge.mjs";

function pairTitle(pick: [string, string] | string[]): string {
  return `${pick[0]} + ${pick[1]}`;
}

function oneDecimal(value: number): string {
  return value.toFixed(1);
}

function StoragePlan({ plan }: { plan: SuggestedPlan }) {
  return (
    <div className="suggest-plan">
      <h3 className="panel-title">Storage plan if flown</h3>
      <ol className="suggest-channels">
        {plan.channels.map((channel) => (
          <li key={channel.channel}>
            <p className="suggest-channel">{channel.channel}</p>
            {channel.packs.length === 0 ? (
              <p className="note">None.</p>
            ) : (
              <ol className="suggest-packs">
                {channel.packs.map((pack, index) => (
                  <li key={`${channel.channel}-${index}`}>{pack}</li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
      {plan.advisories.length > 0 ? (
        <>
          <h3 className="panel-title">Advisories</h3>
          <ul className="suggest-advisories">
            {plan.advisories.map((item) => (
              <li key={`${item.pack}-${item.text}`}>
                <span className="suggest-pack">{item.pack}</span>
                <span className="suggest-advisory-text">{item.text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Suggestion only. Renders suggested_next as given. Null or absent omits the card. */
export function SuggestedNext({ doc }: { doc: NextChargeV4 }) {
  const block: SuggestedNextBlock | null | undefined = doc.suggested_next;
  if (block == null) return null;
  const alt = block.alt_pick;

  return (
    <section className="panel section-card suggest-next" data-accent="copper" aria-labelledby="suggested-next-heading">
      <p className="eyebrow">Suggestion only</p>
      <h2 id="suggested-next-heading" className="section-title">
        Suggested next: fly {pairTitle(block.pick)}
      </h2>
      <p className="suggest-reason">{block.reason}</p>
      <p className="note suggest-basis">
        Suggestion only. This does not change the charge rules. The planner still follows the series that flew.
        Basis: lifetime storage cycles per pack.
      </p>
      <table className="suggest-counts">
        <caption className="sr-only">Lifetime storage cycles by series</caption>
        <tbody>
          {block.sets.map((row) => (
            <tr key={row.series} className={row.eligible ? undefined : "is-ineligible"}>
              <th scope="row">{row.series}</th>
              <td>
                <span className="suggest-stat">
                  <span className="mono">{row.packs}</span> packs
                </span>
                <span className="suggest-stat">
                  <span className="mono">{row.lifetime_storage_cycles}</span> lifetime storage cycles
                </span>
                <span className="suggest-stat">
                  <span className="mono">{oneDecimal(row.avg_cycles_per_pack)}</span> avg per pack
                </span>
                <span className="suggest-stat">
                  Last flown {row.last_flown ? <span className="nw">{row.last_flown}</span> : "—"}
                </span>
                {row.eligible ? null : (
                  <span className="suggest-skip">Ineligible.{row.skip_reason ? ` ${row.skip_reason}` : ""}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <StoragePlan plan={block.plan_if_flown} />
      {alt ? (
        <details className="suggest-alt">
          <summary>Other pairing: fly {pairTitle(alt.pick)}</summary>
          <p className="suggest-reason">{alt.reason}</p>
          <StoragePlan plan={alt.plan_if_flown} />
        </details>
      ) : null}
    </section>
  );
}

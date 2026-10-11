import { PROVISIONAL_LEGEND, PROVISIONAL_MARK } from "@/lib/ir-validation.mjs";

export function ProvisionalMark() {
  return (
    <sup className="provisional-mark" title={PROVISIONAL_LEGEND}>
      <span aria-hidden="true">{PROVISIONAL_MARK}</span>
      <span className="sr-only">, {PROVISIONAL_LEGEND}</span>
    </sup>
  );
}

export function ProvisionalLegend() {
  return (
    <p className="provisional-legend note">
      <span aria-hidden="true">{PROVISIONAL_MARK} </span>
      {PROVISIONAL_LEGEND}
    </p>
  );
}

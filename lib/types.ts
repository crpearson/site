export type PackStatus = "OK" | "Caution" | "OFF";

export type ValueFormat = "ir" | "int" | "volt";

export type Category = {
  id: string;
  label: string;
  partial: boolean;
};

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
  /**
   * Service span per night, aligned with values. Null means the pack was not
   * in service (before commission, or after retirement). A move starts a new
   * span so a dotted join never crosses it. Omit on a series-level line: every
   * night is in scope, and a null value is a skipped night.
   */
  service?: (string | null)[];
  /** True when a measurement row exists that night. Omit to treat a value as the row. */
  logged?: boolean[];
  /**
   * True when this line ran that night but the metric does not apply. The night
   * is still drawn as a skip, with the tooltip "N/A: <night>".
   */
  na?: boolean[];
};

export type Guide = {
  y: number;
  label: string;
  color: string;
};

export type Band = {
  from: number;
  to: number;
  color: string;
};

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

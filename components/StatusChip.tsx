import { statusChip } from "@/lib/lamp";

export function StatusChip({ status, chargeMode }: { status: string; chargeMode?: string | null }) {
  const chip = statusChip(status, chargeMode);
  return <span className={`status-chip status-chip-${chip.toLowerCase()}`}>{chip}</span>;
}

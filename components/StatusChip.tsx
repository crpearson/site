import { conditionalJoinNote, statusChip } from "@/lib/lamp";

export function StatusChip({ status, chargeMode }: { status: string; chargeMode?: string | null }) {
  const chip = statusChip(status, chargeMode);
  const conditional = conditionalJoinNote(status) != null;
  return (
    <span className={`status-chip status-chip-${chip.toLowerCase()}${conditional ? " status-chip-conditional" : ""}`}>
      {chip}
    </span>
  );
}

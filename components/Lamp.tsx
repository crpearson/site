import type { PackStatus } from "@/lib/types";

export function Lamp({ status }: { status: PackStatus }) {
  return (
    <span className={`lamp lamp-${status.toLowerCase()}`}>
      <span className="lamp-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

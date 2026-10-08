import { lampTone } from "@/lib/lamp";

export function Lamp({ status }: { status: string }) {
  const tone = lampTone(status);
  return (
    <span className={`lamp lamp-${tone}`}>
      <span className="lamp-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

import type { ReactNode } from "react";

export function Panel({
  id,
  accent = "signal",
  eyebrow,
  title,
  heading = "h2",
  action,
  children,
  className = "",
}: {
  id?: string;
  accent?: "signal" | "rulea" | "floor" | "ruleb" | "muted" | "off";
  eyebrow?: string;
  title: string;
  heading?: "h2" | "h3";
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const Title = heading;
  return (
    <section id={id} className={`panel ${className}`} data-accent={accent}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <Title className="panel-title">{title}</Title>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

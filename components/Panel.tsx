import type { ReactNode } from "react";

export type PanelAccent = "signal" | "rulea" | "floor" | "ruleb" | "muted" | "off";

export function Panel({
  id,
  accent = "signal",
  eyebrow,
  title,
  titleId,
  heading = "h2",
  action,
  children,
  className = "",
}: {
  id?: string;
  accent?: PanelAccent;
  eyebrow?: string;
  title: string;
  titleId?: string;
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
          <Title id={titleId} className="panel-title">
            {title}
          </Title>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SiteFooter({
  source,
  lastIngest,
  rowCount,
  sessionCount,
}: {
  source: string;
  lastIngest: string;
  rowCount: number;
  sessionCount: number;
}) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="row">
          <img src="/favicon.svg" alt="" width={20} height={20} />
          <strong>LostPennyFPV</strong>
          <span>wtfpv.com</span>
          <a href="/about/">About</a>
          <span>© 2026</span>
        </div>
        <p className="credit">
          {source}, logged through {lastIngest}: {rowCount} measurements across {sessionCount} nights. Partial
          nights are left as they are.
        </p>
        <p className="credit">
          Data processing and site production by Grok Bot and{" "}
          <a href="https://cursor.com" rel="noopener">
            Cursor
          </a>
          .
        </p>
      </div>
    </footer>
  );
}

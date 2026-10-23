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
          <span>© 2026 Lost Penny FPV</span>
        </div>
        <p className="credit">
          {source}. Logged through {lastIngest}. {rowCount} measurements across {sessionCount} nights. A
          partial night is left incomplete.
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

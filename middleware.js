/**
 * Maintenance mode switch.
 *
 * true  — every page returns 503.
 * false — the static site is served.
 *
 * Turn it off by changing MAINTENANCE to false, then redeploy.
 */
const MAINTENANCE = true;
const RETRY_AFTER_SECONDS = "3600";

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#080b10" />
  <meta name="color-scheme" content="dark" />
  <meta name="robots" content="noindex" />
  <title>LostPennyFPV</title>
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <style>
    @font-face {
      font-family: "IBM Plex Sans";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("/fonts/ibm-plex-sans-latin-400-normal.woff2") format("woff2");
    }
    @font-face {
      font-family: "IBM Plex Sans";
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url("/fonts/ibm-plex-sans-latin-500-normal.woff2") format("woff2");
    }
    @font-face {
      font-family: "IBM Plex Mono";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("/fonts/ibm-plex-mono-latin-400-normal.woff2") format("woff2");
    }
    :root {
      --bg: #080b10;
      --ink: #e8eef4;
      --muted: #9aafc0;
      --line: rgba(168, 196, 220, 0.16);
      --signal: #2ee6c7;
      color-scheme: dark;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      background-color: var(--bg);
      background-image:
        radial-gradient(ellipse 70% 42% at 8% -12%, rgba(46, 230, 199, 0.09), transparent 55%),
        radial-gradient(ellipse 50% 36% at 100% -8%, rgba(196, 161, 255, 0.08), transparent 50%),
        linear-gradient(rgba(148, 176, 204, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 176, 204, 0.035) 1px, transparent 1px);
      background-size: auto, auto, 56px 56px, 56px 56px;
      background-attachment: fixed;
      color: var(--ink);
      font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    }
    .topbar {
      display: flex;
      align-items: center;
      gap: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--bg) 84%, transparent);
      padding: 0.75rem 1rem;
      backdrop-filter: blur(16px);
      position: relative;
    }
    .topbar::after {
      content: "";
      position: absolute;
      right: 0;
      bottom: -1px;
      left: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(46, 230, 199, 0.7), rgba(196, 161, 255, 0.7), transparent);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      color: inherit;
    }
    .mark {
      display: grid;
      height: 2.1rem;
      width: 2.1rem;
      place-items: center;
      border-radius: 9px;
      background: rgba(46, 230, 199, 0.1);
      color: var(--signal);
    }
    .mark svg { height: 1.5rem; width: 1.5rem; }
    .brand-name, .brand-sub { display: block; line-height: 1.15; }
    .brand-name {
      font-size: 0.95rem;
      font-weight: 500;
      letter-spacing: -0.02em;
    }
    .brand-sub {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.68rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    main {
      max-width: 40rem;
      margin: 0 auto;
      padding: 4.5rem 1.25rem 5rem;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.7rem, 4vw, 2.6rem);
      font-weight: 500;
      letter-spacing: -0.045em;
      line-height: 1.15;
    }
    @media (max-width: 640px) {
      main { padding-top: 3rem; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="2.5" y="6" width="16" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"></rect>
          <path d="M19 9.2h1.4a1 1 0 0 1 1 1v3.6a1 1 0 0 1-1 1H19" fill="currentColor"></path>
          <rect x="5" y="8.6" width="8.2" height="6.8" rx="1" fill="currentColor"></rect>
        </svg>
      </span>
      <span>
        <span class="brand-name">LostPennyFPV</span>
        <span class="brand-sub">LiPo fleet health</span>
      </span>
    </div>
  </header>
  <main>
    <h1>Down for maintenance: we're correcting how internal resistance is displayed. Back soon.</h1>
  </main>
</body>
</html>
`;

function next() {
  return new Response(null, {
    headers: { "x-middleware-next": "1" },
  });
}

function isStaticAsset(pathname) {
  if (pathname === "/favicon.ico" || pathname === "/icon.svg" || pathname === "/apple-icon.png") {
    return true;
  }
  if (pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/image")) {
    return true;
  }
  return /^\/fonts\/[a-z0-9.-]+\.woff2$/i.test(pathname);
}

function middleware(request) {
  const { pathname } = new URL(request.url);
  if (!MAINTENANCE || isStaticAsset(pathname)) return next();
  return new Response(PAGE, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": RETRY_AFTER_SECONDS,
      "Cache-Control": "no-store",
    },
  });
}

module.exports = middleware;
module.exports.default = middleware;
module.exports.config = { runtime: "nodejs" };

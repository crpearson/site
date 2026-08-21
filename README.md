# Cliff Pearson

Public starter site for [Cliff Pearson](https://github.com/crpearson). It is a small [Next.js](https://nextjs.org) App Router landing page, meant to go live on [Vercel](https://vercel.com) later.

This repository is not a collection of UCSC systems scripts.

## Run locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The page reloads as you edit files under `app/`.

To check a production build:

```bash
npm run build
```

That command writes a static export to `out/`. You can preview the export with any static file server, for example:

```bash
npx --yes serve out
```

## Deploy to Vercel

This project is set up as a standard Next.js app with a static export (`output: "export"` in `next.config.ts`). It does not use environment variables, auth, a CMS, or analytics.

When you are ready to publish:

1. Import this GitHub repository in the [Vercel dashboard](https://vercel.com/new).
2. Leave the defaults (Next.js is detected automatically; the build command is `npm run build`).
3. Deploy from `main` or from a preview branch. No extra Vercel CLI setup is required.

Do not attach a custom domain until you choose to.

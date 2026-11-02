import { escapeHtml, figureHtml, parseProse, type ProseFigure } from "@/lib/prose";

export const EDGE_TX_THEME_SLUG = "edgetx-color-screen-theme";

export type HowtoSection = {
  id: string;
  title: string;
  html: string;
};

export type HowtoDoc = {
  title: string;
  titleId: string;
  introHtml: string;
  sections: HowtoSection[];
};

/** Alt text and captions for the figures in the EdgeTX theme guide. */
const FIGURES: Record<string, ProseFigure> = {
  "hero-radio-photo.jpg": {
    alt: "My copper-and-black theme on an EdgeTX radio: copper top bar, timer, channel bars and the L-dot model image",
    caption: "The theme running on my radio.",
    width: 1248,
    height: 780,
    full: true,
    eager: true,
  },
  "palette-swatches.png": {
    alt: "The 11 theme.yml colors as swatches with key names and hex values",
    caption: "The whole palette: 11 keys, SECONDARY1 and EDIT share #C66521.",
    width: 1200,
    height: 500,
    full: true,
  },
  "background-480x272.png": {
    alt: "The dark copper smoke background with verdigris at the edges, shown at 2x",
    caption: "background_480x272.png at 2x, so you can see the dithering.",
    width: 960,
    height: 544,
    pixel: true,
  },
  "logo-2x.png": {
    alt: "The theme's logo tile: the L-dot above the wordmark",
    caption: "logo.png at 2x.",
    width: 450,
    height: 256,
    pixel: true,
  },
  "screenshots-strip.png": {
    alt: "Three theme screenshots: main screen, model setup and model select",
    caption: "screenshot1-3.png: main screen, model setup, model select.",
    width: 1500,
    height: 316,
    full: true,
  },
  "radio-themes-menu.jpg": {
    alt: "The radio's Themes page with my theme selected",
    caption: "The radio's Themes page with my theme highlighted.",
    width: 1200,
    height: 800,
    full: true,
  },
  "banding-vs-smoke.jpg": {
    alt: "Simulation: a smooth dark gradient breaks into rings at RGB565, next to the dithered smoke background",
    caption: "Simulation: a smooth gradient bands on a 16-bit screen; the dithered smoke doesn't.",
    width: 1600,
    height: 600,
    full: true,
  },
  "copper-comparison.jpg": {
    alt: "Simulation: old copper #B57131 comes out tan on the screen; final #C66521 stays warmer",
    caption: "Simulation: #B57131 vs #C66521 on this screen, from photos of the real radio.",
    width: 1200,
    height: 600,
    full: true,
  },
  "center-clear-before-after.jpg": {
    alt: "Before: a faint L-dot logo in the background behind the channel values. After: a clear center with only the model image",
    caption: "Before and after: taking the logo out of the middle.",
    width: 1600,
    height: 600,
    full: true,
  },
  "model-image.png": {
    alt: "The 192x114 L-dot model image at 2x on a checkerboard and on black",
    caption: "The model image has a transparent background.",
    width: 800,
    height: 300,
    pixel: true,
  },
};

export function parseHowto(markdown: string): HowtoDoc {
  const usedFigures = new Set<string>();
  const doc = parseProse(markdown, {
    errorLabel: "HOWTO",
    image({ file }) {
      const figure = FIGURES[file];
      if (!figure) throw new Error(`HOWTO image is not in the figure set: ${file}`);
      usedFigures.add(file);
      return figureHtml(`/howtos/${EDGE_TX_THEME_SLUG}/${file}`, figure);
    },
    link({ href, title, label }) {
      if (href !== "/downloads/lost_penny.zip") return null;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a class="howto-download" href="${escapeHtml(href)}" download="lost_penny.zip"${titleAttr}>${label}</a>`;
    },
  });

  const missing = Object.keys(FIGURES).filter((file) => !usedFigures.has(file));
  if (missing.length) {
    throw new Error(`HOWTO figures were not used: ${missing.join(", ")}`);
  }

  const html = `${doc.introHtml}\n${doc.sections.map((section) => section.html).join("\n")}`;
  if (!html.includes('href="/downloads/lost_penny.zip"') || !html.includes("Download lost_penny.zip")) {
    throw new Error("HOWTO is missing the lost_penny.zip download link");
  }
  if (!html.includes("IG_Coffee") || !html.includes("InGage FPV")) {
    throw new Error("HOWTO is missing the IG_Coffee by InGage FPV credit");
  }
  if (!html.includes("https://github.com/EdgeTX/themes/tree/main/THEMES/ingage_coffee")) {
    throw new Error("HOWTO is missing the IG_Coffee theme link");
  }
  if (!html.includes('id="select-it-on-the-radio"')) {
    throw new Error("HOWTO is missing the select-it-on-the-radio anchor");
  }
  for (const figure of Object.values(FIGURES)) {
    if (!html.includes(escapeHtml(figure.alt)) || !html.includes(escapeHtml(figure.caption))) {
      throw new Error(`HOWTO is missing figure text: ${figure.caption}`);
    }
  }

  return doc;
}

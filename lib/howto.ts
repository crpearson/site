import { Marked, type Token, type Tokens, type TokensList } from "marked";
import { slugify } from "@/lib/methodology";

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

type Figure = {
  alt: string;
  caption: string;
  width: number;
  height: number;
  pixel?: boolean;
  full?: boolean;
};

/** Alt text and captions for the figures in the EdgeTX theme guide. */
const FIGURES: Record<string, Figure> = {
  "hero-radio-photo.jpg": {
    alt: "The Lost Penny theme on an EdgeTX radio: copper top bar, timer, channel bars and the L-dot model image",
    caption: "Lost Penny running on the real radio.",
    width: 1248,
    height: 780,
    full: true,
  },
  "palette-swatches.png": {
    alt: "The 11 Lost Penny theme.yml colours as swatches with key names and hex values",
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
    alt: "The Lost Penny theme logo tile: L-dot above the LOST PENNY wordmark",
    caption: "logo.png at 2x.",
    width: 450,
    height: 256,
    pixel: true,
  },
  "screenshots-strip.png": {
    alt: "Three Lost Penny screenshots: main screen, model setup and model select",
    caption: "screenshot1-3.png: main screen, model setup, model select.",
    width: 1500,
    height: 316,
    full: true,
  },
  "radio-themes-menu.jpg": {
    alt: "Themes page with Lost Penny selected",
    caption: "The radio's Themes page with Lost Penny highlighted.",
    width: 1200,
    height: 800,
    full: true,
  },
  "banding-vs-smoke.jpg": {
    alt: "Simulation: a smooth dark gradient breaks into rings at RGB565, next to the dithered smoke background",
    caption: "Simulation: a smooth gradient banding on a 16-bit screen vs dithered smoke.",
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
    alt: "Before: a faint L-dot logo in the background behind the channel values. After: a clear centre with only the model image",
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function renderTokens(marked: Marked, tokens: Token[]): string {
  const list = tokens as TokensList;
  list.links = list.links ?? {};
  const html = marked.parser(list);
  if (typeof html !== "string") {
    throw new Error("HOWTO markdown did not render to a string");
  }
  return html;
}

function fileName(href: string): string {
  const clean = href.split("?")[0]?.split("#")[0] ?? "";
  return clean.split("/").pop() ?? "";
}

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return trimmed;
  } catch {
    return null;
  }
  return null;
}

function figureHtml(file: string, figure: Figure): string {
  const classes = ["howto-figure"];
  if (figure.full) classes.push("is-full");
  if (figure.pixel) classes.push("is-pixel");
  const src = `/howtos/${EDGE_TX_THEME_SLUG}/${file}`;
  const eager = file === "hero-radio-photo.jpg";
  return `<figure class="${classes.join(" ")}">
<img src="${escapeHtml(src)}" alt="${escapeHtml(figure.alt)}" width="${figure.width}" height="${figure.height}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'}>
<figcaption>${escapeHtml(figure.caption)}</figcaption>
</figure>
`;
}

export function parseHowto(markdown: string): HowtoDoc {
  const source = markdown.replace(/<!--[\s\S]*?-->/g, "");
  const usedIds = new Set<string>();
  const usedFigures = new Set<string>();
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const plain = decodeHtml(html.replace(/<[^>]+>/g, ""));
        const id = uniqueId(slugify(plain), usedIds);
        return `<h${depth} id="${escapeHtml(id)}">${html}</h${depth}>\n`;
      },
      paragraph({ tokens }) {
        const chunks: string[] = [];
        let inline: Token[] = [];
        const flush = () => {
          const meaningful = inline.some((token) => {
            if (token.type === "text" || token.type === "escape") return token.text.trim().length > 0;
            return true;
          });
          if (meaningful) chunks.push(`<p>${this.parser.parseInline(inline)}</p>\n`);
          inline = [];
        };
        for (const token of tokens) {
          if (token.type === "image") {
            flush();
            chunks.push(this.image(token as Tokens.Image));
            continue;
          }
          inline.push(token);
        }
        flush();
        return chunks.join("");
      },
      image({ href }) {
        const file = fileName(href);
        const figure = FIGURES[file];
        if (!figure) throw new Error(`HOWTO image is not in the figure set: ${file}`);
        usedFigures.add(file);
        return figureHtml(file, figure);
      },
      codespan({ text }) {
        return `<code class="md-code">${escapeHtml(text)}</code>`;
      },
      code({ text, lang, escaped }) {
        const body = escaped ? text : escapeHtml(text);
        const className = lang ? ` class="language-${escapeHtml(lang)}"` : "";
        return `<div class="code-wrap" data-scroll-ok=""><pre><code${className}>${body}</code></pre></div>\n`;
      },
      link({ href, title, text, tokens, autolink }) {
        const label = autolink ? escapeHtml(text) : this.parser.parseInline(tokens);
        const safe = safeHref(href);
        if (!safe) return label;
        const hrefAttr = escapeHtml(safe);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        if (safe === "/downloads/lost_penny.zip") {
          return `<a class="howto-download" href="${hrefAttr}" download="lost_penny.zip"${titleAttr}>${label}</a>`;
        }
        const external = safe.startsWith("https:") || safe.startsWith("http:");
        const rel = external ? ` rel="noopener noreferrer"` : "";
        return `<a href="${hrefAttr}"${titleAttr}${rel}>${label}</a>`;
      },
      html({ text }) {
        const stripped = text.replace(/<!--[\s\S]*?-->/g, "").trim();
        return stripped ? escapeHtml(stripped) : "";
      },
      table(token) {
        let header = "";
        for (const cell of token.header) header += this.tablecell(cell);
        const headRow = this.tablerow({ text: header });
        let body = "";
        for (const row of token.rows) {
          let cells = "";
          for (const cell of row) cells += this.tablecell(cell);
          body += this.tablerow({ text: cells });
        }
        if (body) body = `<tbody>${body}</tbody>`;
        return `<div class="table-wrap" data-scroll-ok=""><table><thead>${headRow}</thead>${body}</table></div>\n`;
      },
    },
  });

  const tokens = marked.lexer(source);
  const first = tokens[0];
  if (!first || first.type !== "heading" || first.depth !== 1) {
    throw new Error("HOWTO markdown must start with an H1");
  }

  const title = first.text;
  const titleId = uniqueId(slugify(title), usedIds);
  const intro: Token[] = [];
  const sections: { title: string; id: string; tokens: Token[] }[] = [];

  for (const token of tokens.slice(1)) {
    if (token.type === "heading" && (token as Tokens.Heading).depth === 2) {
      const heading = token as Tokens.Heading;
      sections.push({
        title: heading.text,
        id: uniqueId(slugify(heading.text), usedIds),
        tokens: [],
      });
      continue;
    }
    if (sections.length === 0) intro.push(token);
    else sections[sections.length - 1].tokens.push(token);
  }

  const introHtml = renderTokens(marked, intro);
  const rendered = sections.map((section) => ({
    id: section.id,
    title: section.title,
    html: renderTokens(marked, section.tokens),
  }));

  const missing = Object.keys(FIGURES).filter((file) => !usedFigures.has(file));
  if (missing.length) {
    throw new Error(`HOWTO figures were not used: ${missing.join(", ")}`);
  }

  const html = `${introHtml}\n${rendered.map((section) => section.html).join("\n")}`;
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

  return { title, titleId, introHtml, sections: rendered };
}

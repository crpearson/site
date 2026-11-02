import { Marked, type Token, type Tokens, type TokensList } from "marked";
import { slugify } from "@/lib/methodology";

export type ProseSection = {
  id: string;
  title: string;
  html: string;
};

export type ProseDoc = {
  title: string;
  titleId: string;
  introHtml: string;
  sections: ProseSection[];
};

export type ProseFigure = {
  alt: string;
  caption: string;
  width: number;
  height: number;
  pixel?: boolean;
  full?: boolean;
  eager?: boolean;
};

export type ProseImage = {
  href: string;
  file: string;
  alt: string;
};

export type ProseLink = {
  href: string;
  title: string | null;
  label: string;
};

type ProseOptions = {
  errorLabel?: string;
  image?: (image: ProseImage) => string;
  link?: (link: ProseLink) => string | null;
};

export function escapeHtml(value: string): string {
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

export function figureHtml(src: string, figure: ProseFigure): string {
  const classes = ["howto-figure"];
  if (figure.full) classes.push("is-full");
  if (figure.pixel) classes.push("is-pixel");
  return `<figure class="${classes.join(" ")}">
<img src="${escapeHtml(src)}" alt="${escapeHtml(figure.alt)}" width="${figure.width}" height="${figure.height}"${figure.eager ? ' fetchpriority="high"' : ' loading="lazy"'}>
<figcaption>${escapeHtml(figure.caption)}</figcaption>
</figure>
`;
}

function renderTokens(marked: Marked, tokens: Token[], label: string): string {
  const list = tokens as TokensList;
  list.links = list.links ?? {};
  const html = marked.parser(list);
  if (typeof html !== "string") {
    throw new Error(`${label} markdown did not render to a string`);
  }
  return html;
}

export function parseProse(markdown: string, options: ProseOptions = {}): ProseDoc {
  const label = options.errorLabel ?? "Markdown";
  const source = markdown.replace(/<!--[\s\S]*?-->/g, "");
  const usedIds = new Set<string>();
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
      image({ href, text }) {
        const file = fileName(href);
        if (!options.image) throw new Error(`${label} image is not in the figure set: ${file}`);
        return options.image({ href, file, alt: text });
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
        const linkLabel = autolink ? escapeHtml(text) : this.parser.parseInline(tokens);
        const safe = safeHref(href);
        if (!safe) return linkLabel;
        const custom = options.link?.({ href: safe, title: title ?? null, label: linkLabel });
        if (custom != null) return custom;
        const hrefAttr = escapeHtml(safe);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        const external = safe.startsWith("https:") || safe.startsWith("http:");
        const rel = external ? ` rel="noopener noreferrer"` : "";
        return `<a href="${hrefAttr}"${titleAttr}${rel}>${linkLabel}</a>`;
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
    throw new Error(`${label} markdown must start with an H1`);
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

  return {
    title,
    titleId,
    introHtml: renderTokens(marked, intro, label),
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      html: renderTokens(marked, section.tokens, label),
    })),
  };
}

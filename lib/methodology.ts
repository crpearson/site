import { Marked, type Token, type Tokens, type TokensList } from "marked";

export type MethodologySection = {
  id: string;
  title: string;
  html: string;
};

export type MethodologyDoc = {
  title: string;
  titleId: string;
  introHtml: string;
  sections: MethodologySection[];
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

export function slugify(text: string): string {
  const slug = decodeHtml(text)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
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
    throw new Error("Methodology markdown did not render to a string");
  }
  return html;
}

export function parseMethodology(markdown: string): MethodologyDoc {
  const used = new Set<string>();
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const plain = decodeHtml(html.replace(/<[^>]+>/g, ""));
        const id = uniqueId(slugify(plain), used);
        return `<h${depth} id="${escapeHtml(id)}">${html}</h${depth}>\n`;
      },
      codespan({ text }) {
        return `<code class="md-code">${escapeHtml(text)}</code>`;
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
        return `<div class="table-wrap"><table><thead>${headRow}</thead>${body}</table></div>\n`;
      },
    },
  });

  const tokens = marked.lexer(markdown);
  const first = tokens[0];
  if (!first || first.type !== "heading" || first.depth !== 1) {
    throw new Error("Methodology markdown must start with an H1");
  }

  const title = first.text;
  const titleId = uniqueId(slugify(title), used);
  const intro: Token[] = [];
  const sections: { title: string; id: string; tokens: Token[] }[] = [];

  for (const token of tokens.slice(1)) {
    if (token.type === "heading" && (token as Tokens.Heading).depth === 2) {
      const heading = token as Tokens.Heading;
      sections.push({
        title: heading.text,
        id: uniqueId(slugify(heading.text), used),
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
    introHtml: renderTokens(marked, intro),
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      html: renderTokens(marked, section.tokens),
    })),
  };
}

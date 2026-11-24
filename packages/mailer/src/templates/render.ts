import juice from 'juice';
import { Marked, type Token, type Tokens } from 'marked';
import { localeDirection, type Locale } from '../locale';
import { emailLinkHint } from './catalog';
import { LAYOUT_PLACEHOLDERS, type EmailLayout } from './layout';
import type { EmailText } from './types';

export interface EmailSite {
  name: string;
  url: string;
  logoUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The text of an email is Markdown. HTML typed into it stays text: markup belongs to the layout.
const htmlMarkdown = new Marked({
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
});

const plainMarkdown = new Marked({
  breaks: true,
  renderer: {
    heading({ tokens }) {
      return `${this.parser.parseInline(tokens)}\n\n`;
    },
    paragraph({ tokens }) {
      return `${this.parser.parseInline(tokens)}\n\n`;
    },
    blockquote({ tokens }) {
      return this.parser.parse(tokens);
    },
    list({ items, ordered, start }) {
      const first = typeof start === 'number' ? start : 1;
      const lines = items.map((item, index) => {
        const marker = ordered ? `${first + index}.` : '-';
        const parts = item.tokens.map((token) => {
          const part = this.parser.parse([token]);
          return token.type === 'list' ? `\n${part.trim().replace(/^/gm, '  ')}\n` : part;
        });
        return `${marker} ${parts
          .join('')
          .replace(/\n{2,}/g, '\n')
          .trim()}`;
      });
      return `${lines.join('\n')}\n\n`;
    },
    checkbox({ checked }) {
      return checked ? '[x] ' : '[ ] ';
    },
    table({ header, rows }) {
      const line = (cells: Tokens.TableCell[]) =>
        cells.map((cell) => this.parser.parseInline(cell.tokens)).join(' | ');
      return `${[header, ...rows].map(line).join('\n')}\n\n`;
    },
    strong({ tokens }) {
      return this.parser.parseInline(tokens);
    },
    em({ tokens }) {
      return this.parser.parseInline(tokens);
    },
    del({ tokens }) {
      return this.parser.parseInline(tokens);
    },
    link({ tokens, href, raw }) {
      const label = this.parser.parseInline(tokens);
      if (label === href.replace(/^mailto:/, '')) return label;
      return label === raw ? href : `${label} (${href})`;
    },
    image({ text }) {
      return text;
    },
    codespan({ text }) {
      return text;
    },
    code({ text }) {
      return `${text}\n\n`;
    },
    br() {
      return '\n';
    },
    hr() {
      return '';
    },
    html({ text }) {
      return text;
    },
    text(token) {
      return 'tokens' in token && token.tokens ? this.parser.parseInline(token.tokens) : token.text;
    },
  },
});

const VARIABLE = /\{(\w+)\}/g;

// One pass, so a value that holds "{ref}" stays as it is. A name with no value stays too.
function fill(text: string, value: (name: string) => string | undefined): string {
  return text.replace(VARIABLE, (match, name: string) => value(name) ?? match);
}

function unknownNames(written: string, names: string[]): string[] {
  const used = [...written.matchAll(VARIABLE)].map((match) => match[1]);
  return [...new Set(used)].filter((name) => !names.includes(name));
}

// Saving refuses a name that nothing fills: a recipient would read it as it is written.
export function unknownEmailVariables(text: EmailText, variables: string[]): string[] {
  return unknownNames(`${text.subject} ${text.body} ${text.button}`, variables);
}

export function unknownLayoutPlaceholders(html: string): string[] {
  return unknownNames(
    html,
    LAYOUT_PLACEHOLDERS.map((placeholder) => placeholder.name),
  );
}

// Marked encodes an address before a renderer gets it, and fill then cannot find {ref} there.
// The value goes in first, encoded, so a title stays part of the address and cannot change
// its scheme.
function fillAddresses(value: (name: string) => string | undefined) {
  return (token: Token) => {
    if (token.type !== 'link' && token.type !== 'image') return;
    token.href = fill(token.href, (name) => {
      const raw = value(name);
      return raw === undefined ? undefined : encodeURIComponent(raw);
    });
  };
}

function actionHtml(label: string, url: string, locale: Locale): string {
  const href = escapeHtml(url);
  const link = `<a href="${href}" dir="ltr">${href}</a>`;
  if (!label) return `<p class="link">${link}</p>`;
  return (
    `<p><a class="button" href="${href}">${escapeHtml(label)}</a></p>` +
    `<p class="link">${escapeHtml(emailLinkHint(locale))} ${link}</p>`
  );
}

function withStyles(html: string, css: string): string {
  const style = `<style>${css}</style>`;
  // A replacer function, so a `$` in the CSS is not read as a replacement pattern.
  return html.includes('</head>') ? html.replace('</head>', () => `${style}</head>`) : style + html;
}

// The values come from people (a name, an issue title), so they go in after the Markdown is
// read and are escaped there: a title never turns into a link or a tag. A subject takes one
// line, since it becomes a header.
export function renderEmail(input: {
  text: EmailText;
  layout: EmailLayout;
  locale: Locale;
  vars: Record<string, string>;
  url?: string | null;
  site: EmailSite;
}): RenderedEmail {
  const { text, layout, locale, vars, url, site } = input;
  const value = (name: string) => (Object.hasOwn(vars, name) ? vars[name] : undefined);
  const htmlValue = (name: string) => {
    const raw = value(name);
    return raw === undefined ? undefined : escapeHtml(raw).replace(/\n/g, '<br>');
  };

  const subject = fill(text.subject, (name) => value(name)?.replace(/[\r\n]+/g, ' '));
  const parseOptions = { async: false, walkTokens: fillAddresses(value) } as const;
  const plain = fill(plainMarkdown.parse(text.body, parseOptions).trim(), value);
  const parts: Record<string, string> = {
    content: fill(htmlMarkdown.parse(text.body, parseOptions), htmlValue),
    button: url ? actionHtml(fill(text.button, value), url, locale) : '',
    subject: escapeHtml(subject),
    lang: locale,
    dir: localeDirection(locale),
    site_name: escapeHtml(site.name),
    site_url: escapeHtml(site.url),
    logo_url: escapeHtml(site.logoUrl),
  };
  const filled = fill(layout.html, (name) =>
    Object.hasOwn(parts, name) ? parts[name] : undefined,
  );
  return {
    subject,
    text: url ? `${plain}\n\n${url}` : plain,
    html: juice(withStyles(filled, layout.css), {
      preserveImportant: true,
      applyWidthAttributes: false,
    }),
  };
}

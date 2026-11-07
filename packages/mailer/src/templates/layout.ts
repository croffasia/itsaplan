export interface EmailLayout {
  html: string;
  css: string;
}

const DEFAULT_HTML = `<!doctype html>
<html lang="{lang}" dir="{dir}">
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
</head>
<body class="page">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrap">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" dir="{dir}">
        <tr><td class="header">
          <img src="{logo_url}" alt="{site_name}" height="24">
        </td></tr>
        <tr><td class="content">
          {content}
          {button}
        </td></tr>
        <tr><td class="footer">
          {site_name} · {site_url}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const DEFAULT_CSS = `.page {
  margin: 0;
  background: #f4f4f5;
  font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.wrap { padding: 32px 16px; }
.card {
  width: 100%;
  max-width: 560px;
  background: #ffffff;
  border-radius: 12px;
}
.header { padding: 24px 32px 0; }
.content {
  padding: 24px 32px;
  color: #1c1c1c;
  font-size: 15px;
  line-height: 1.6;
}
.content p, .content ul, .content ol { margin: 0 0 14px; }
.content h1 { margin: 0 0 14px; font-size: 22px; line-height: 1.3; }
.content h2 { margin: 0 0 14px; font-size: 18px; line-height: 1.35; }
.content blockquote {
  margin: 0 0 14px;
  padding-inline-start: 12px;
  border-inline-start: 3px solid #e2e2e2;
  color: #555555;
}
.button {
  display: inline-block;
  padding: 10px 18px;
  border-radius: 8px;
  background: #262626;
  color: #fafafa;
  text-decoration: none;
}
.link {
  color: #6b6b6b;
  font-size: 12px;
  word-break: break-all;
}
.footer {
  padding: 0 32px 24px;
  color: #8a8a8a;
  font-size: 12px;
}`;

export const DEFAULT_EMAIL_LAYOUT: EmailLayout = { html: DEFAULT_HTML, css: DEFAULT_CSS };

export const LAYOUT_PLACEHOLDERS = [
  { name: 'content', required: true },
  { name: 'button', required: true },
  { name: 'subject', required: false },
  { name: 'lang', required: false },
  { name: 'dir', required: false },
  { name: 'site_name', required: false },
  { name: 'site_url', required: false },
  { name: 'logo_url', required: false },
];

export function missingLayoutPlaceholders(html: string): string[] {
  return LAYOUT_PLACEHOLDERS.filter((p) => p.required && !html.includes(`{${p.name}}`)).map(
    (p) => p.name,
  );
}

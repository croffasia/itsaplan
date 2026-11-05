import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_EMAIL_LAYOUT,
  LOCALES,
  defaultEmailText,
  emailTemplate,
  emailTemplates,
  missingLayoutPlaceholders,
  renderEmail,
  setExtraEmailTemplates,
  unknownEmailVariables,
  unknownLayoutPlaceholders,
  type EmailLayout,
  type EmailText,
  type Locale,
} from '../index';

const site = {
  name: "It's a Plan",
  url: 'https://plan.test',
  logoUrl: 'https://plan.test/logo.png',
};
const bare: EmailLayout = { html: '<html><body>{content}{button}</body></html>', css: '' };

function render(
  text: Partial<EmailText>,
  options: {
    vars?: Record<string, string>;
    url?: string | null;
    locale?: Locale;
    layout?: EmailLayout;
  } = {},
) {
  return renderEmail({
    text: { subject: 'Subject', body: 'Body', button: 'Open', ...text },
    layout: options.layout ?? bare,
    locale: options.locale ?? 'en',
    vars: options.vars ?? {},
    url: options.url,
    site,
  });
}

describe('renderEmail', () => {
  it('fills the variables in the subject, the text and the button', () => {
    const email = render(
      { subject: '{ref}: new', body: '{actor} commented', button: 'Open {ref}' },
      { vars: { ref: 'WEB-1', actor: 'Maria' }, url: 'https://plan.test/i/1' },
    );
    expect(email.subject).toBe('WEB-1: new');
    expect(email.text).toBe('Maria commented\n\nhttps://plan.test/i/1');
    expect(email.html).toContain('<p>Maria commented</p>');
    expect(email.html).toContain('>Open WEB-1</a>');
  });

  it('escapes a value and keeps its Markdown as text', () => {
    const title = '<img src=x onerror=alert(1)> **bold** [link](https://evil.test)';
    const email = render({ body: '**{title}**' }, { vars: { title } });
    expect(email.html).toContain(
      '<strong>&lt;img src=x onerror=alert(1)&gt; **bold** [link](https://evil.test)</strong>',
    );
    expect(email.html).not.toContain('<img');
    expect(email.html).not.toContain('href="https://evil.test"');
    expect(email.text).toBe(title);
  });

  it('keeps a value inside a single-quoted attribute of a layout', () => {
    const html =
      "<html><head><meta name='x' content='{subject}'></head><body>{content}{button}</body></html>";
    const email = render(
      { subject: '{title}' },
      { vars: { title: "' onload='alert(1)" }, layout: { html, css: '' } },
    );
    expect(email.html).not.toContain('onload="');
  });

  it('does not expand a variable that a value holds', () => {
    const email = render({ body: '{title} {ref}' }, { vars: { title: '{ref}', ref: 'WEB-1' } });
    expect(email.text).toBe('{ref} WEB-1');
  });

  it('leaves a name with no value in place, also one every object inherits', () => {
    expect(render({ body: '{nothing} {constructor}' }).text).toBe('{nothing} {constructor}');
  });

  it('keeps a subject on one line', () => {
    const email = render({ subject: '{title}' }, { vars: { title: 'One\r\nBcc: x@evil.test' } });
    expect(email.subject).toBe('One Bcc: x@evil.test');
  });

  it('keeps the line breaks of a value in the HTML', () => {
    const email = render({ body: '{quote}' }, { vars: { quote: 'one\ntwo' } });
    expect(email.html).toContain('one<br>two');
  });

  it('renders the Markdown of the text, and leaves plain words in the text part', () => {
    const body = [
      '# Title',
      '',
      '**Bold**, *italic*, ~~gone~~ and [a link](https://plan.test/a).',
      '',
      '- one',
      '- two',
      '',
      '1. first',
      '2. second',
      '',
      '> quoted',
      '',
      'R&D <team>',
    ].join('\n');
    const email = render({ body });
    expect(email.html).toContain('<h1>Title</h1>');
    expect(email.html).toContain('<strong>Bold</strong>');
    expect(email.html).toContain('<a href="https://plan.test/a">a link</a>');
    expect(email.html).toContain('<li>one</li>');
    expect(email.html).toContain('<blockquote>');
    expect(email.html).toContain('R&amp;D');
    expect(email.html).not.toContain('<team>');
    expect(email.text).toBe(
      [
        'Title',
        '',
        'Bold, italic, gone and a link (https://plan.test/a).',
        '',
        '- one',
        '- two',
        '',
        '1. first',
        '2. second',
        '',
        'quoted',
        '',
        'R&D <team>',
      ].join('\n'),
    );
  });

  it('fills a variable in a link address, encoded, in both parts', () => {
    const body = '[Help](https://plan.test/{ref}) and https://plan.test/{ref}';
    const email = render({ body }, { vars: { ref: 'A B/1' } });
    expect(email.html).toContain('<a href="https://plan.test/A%20B%2F1">Help</a>');
    expect(email.text).toBe('Help (https://plan.test/A%20B%2F1) and https://plan.test/A%20B%2F1');
  });

  it('keeps a value in a link address from changing its scheme', () => {
    const email = render({ body: '[Open]({title})' }, { vars: { title: 'javascript:alert(1)' } });
    expect(email.html).toContain('<a href="javascript%3Aalert(1)">Open</a>');
  });

  it('keeps the link when the button has no text', () => {
    const email = render({ button: '' }, { url: 'https://plan.test/reset' });
    expect(email.html).not.toContain('class="button"');
    expect(email.html).toContain('href="https://plan.test/reset"');
    expect(email.text).toEndWith('https://plan.test/reset');
  });

  it('adds no button to an email with no link', () => {
    const email = render({}, { url: null });
    expect(email.html).not.toContain('<a ');
    expect(email.text).toBe('Body');
  });

  it('names the link in the language of the email', () => {
    const email = render({}, { url: 'https://plan.test/a', locale: 'ru' });
    expect(email.html).toContain('Или откройте ссылку:');
  });

  it('fills the layout and writes its CSS onto the elements', () => {
    const email = render(
      {},
      {
        locale: 'ar',
        layout: {
          html: '<html lang="{lang}" dir="{dir}"><head><title>{subject}</title></head><body class="page">{content}{button}<footer>{site_name} {site_url}</footer></body></html>',
          css: '.page { margin: 0; }\n@media (max-width: 600px) { .page { margin: 4px; } }',
        },
      },
    );
    expect(email.html).toContain('lang="ar"');
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain('<title>Subject</title>');
    expect(email.html).toContain('class="page" style="margin: 0;"');
    expect(email.html).toContain('@media (max-width: 600px)');
    expect(email.html).toContain('It&#39;s a Plan https://plan.test');
  });

  it('renders the default layout', () => {
    const email = render({}, { layout: DEFAULT_EMAIL_LAYOUT, url: 'https://plan.test/a' });
    expect(email.html).toContain('class="button"');
    expect(email.html).toContain('src="https://plan.test/logo.png"');
    expect(email.html).not.toContain('{');
  });
});

describe('unknownEmailVariables', () => {
  it('writes tables, task lists, nested lists and addresses as plain words in the text part', () => {
    const body = [
      '| Name | Role |',
      '| --- | --- |',
      '| Maria | Owner |',
      '',
      '- [x] done',
      '- [ ] to do',
      '',
      'Then:',
      '',
      '1. a',
      '   - b',
      '   - c',
      '2. d',
      '',
      'Write to support@acme.com.',
    ].join('\n');
    expect(render({ body }).text).toBe(
      [
        'Name | Role',
        'Maria | Owner',
        '',
        '- [x] done',
        '- [ ] to do',
        '',
        'Then:',
        '',
        '1. a',
        '  - b',
        '  - c',
        '2. d',
        '',
        'Write to support@acme.com.',
      ].join('\n'),
    );
  });

  it('names each variable the template does not have, once', () => {
    const text = { subject: '{ref} {nope}', body: '{nope} {other}', button: '{last}' };
    expect(unknownEmailVariables(text, ['ref'])).toEqual(['nope', 'other', 'last']);
  });
});

describe('the layout', () => {
  it('names the placeholders it still needs', () => {
    expect(missingLayoutPlaceholders('<p>{content}</p>')).toEqual(['button']);
    expect(missingLayoutPlaceholders('{content}{button}')).toEqual([]);
  });

  it('names the placeholders nothing fills, and leaves CSS alone', () => {
    const html = '<style>a{color:red}</style>{content}{logo}{logo}{site_name}';
    expect(unknownLayoutPlaceholders(html)).toEqual(['logo']);
    expect(unknownLayoutPlaceholders(DEFAULT_EMAIL_LAYOUT.html)).toEqual([]);
  });
});

describe('the default texts', () => {
  const namesIn = (text: EmailText) =>
    [...`${text.subject} ${text.body} ${text.button}`.matchAll(/\{(\w+)\}/g)]
      .map((match) => match[1])
      .sort();

  it('use only the variables their template declares, the same ones in every language', () => {
    for (const template of emailTemplates()) {
      const english = namesIn(template.texts.en);
      expect(english.filter((name) => !(name in template.samples))).toEqual([]);
      for (const locale of LOCALES) {
        const names = namesIn(defaultEmailText(template, locale));
        expect({ template: template.key, locale, names: [...new Set(names)] }).toEqual({
          template: template.key,
          locale,
          names: [...new Set(english)],
        });
      }
    }
  });

  it('have a subject and a text in every language, and a button where there is a link', () => {
    for (const template of emailTemplates()) {
      for (const locale of LOCALES) {
        const text = defaultEmailText(template, locale);
        expect(text.subject).not.toBe('');
        expect(text.body).not.toBe('');
        expect(text.button !== '').toBe(template.samplePath !== null);
      }
    }
  });
});

describe('setExtraEmailTemplates', () => {
  const extra = {
    key: 'formReply',
    group: 'forms',
    samples: { title: 'A request' },
    samplePath: '/p/requests/example',
    texts: { en: { subject: 'New reply: {title}', body: '{title}', button: 'Open' } },
  };

  it('adds templates beside the core ones, and a language it lacks sends English', () => {
    setExtraEmailTemplates([extra]);
    expect(emailTemplate('formReply')).toBe(extra);
    expect(defaultEmailText(extra, 'ru').subject).toBe('New reply: {title}');
    setExtraEmailTemplates([]);
    expect(emailTemplate('formReply')).toBeUndefined();
    expect(emailTemplate('reset')).toBeDefined();
  });

  it('refuses a key already taken and keeps the previous set', () => {
    setExtraEmailTemplates([extra]);
    expect(() => setExtraEmailTemplates([{ ...extra, key: 'reset' }])).toThrow('reset');
    expect(emailTemplate('formReply')).toBe(extra);
    setExtraEmailTemplates([]);
  });
});

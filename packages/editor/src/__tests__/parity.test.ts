import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createDocument, Editor } from '@tiptap/core';
import { JSDOM } from 'jsdom';
import { Markdown } from 'tiptap-markdown';
import { documentExtensions } from '../document';
import { markdownToDocumentJson } from '../markdown';

// markdownToDocumentJson repeats tiptap-markdown's parse steps. This keeps it equal to
// what the web editor builds from the same Markdown, across tiptap-markdown upgrades.

const globals = ['window', 'document', 'navigator', 'Node', 'NodeFilter', 'HTMLElement'] as const;
const previous = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
const { window } = new JSDOM('<!doctype html>');
beforeAll(() => {
  for (const name of globals)
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
});
afterAll(() => {
  globals.forEach((name, index) => {
    const descriptor = previous[index];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  });
});

function editorJson(content: string) {
  const editor = new Editor({
    extensions: [
      ...documentExtensions(),
      Markdown.configure({ html: true, linkify: true, breaks: true }),
    ],
  });
  const storage = editor.storage as unknown as {
    markdown: { parser: { parse: (markdown: string) => string } };
  };
  const json = createDocument(
    storage.markdown.parser.parse(content),
    editor.schema,
    editor.options.parseOptions,
  ).toJSON();
  editor.destroy();
  return JSON.parse(JSON.stringify(json));
}

const samples = [
  '# Title\n\n## Sub *em* **strong** ~~gone~~ `code`\n\nline one\nline two  \nhard break',
  '- a\n  - nested @alice\n- b\n\n1. one\n2. two\n\n7. seven\n\n0. zero',
  '- [ ] todo\n- [x] done\n  - [ ] nested\n- plain\n\n3. three\n4. [ ] four\n5. five',
  '| Left | Center | Right |\n| :--- | :---: | ---: |\n| @bob | `a\\|b` | [x](https://x.y) |',
  '```ts\nconst a = 1;\n\n```\n\n    indented\n\n> quote\n> > nested\n\n---',
  'Mail name@example.com, @@double, @end. and https://auto.link/path?q=1 <https://angle.link>',
  '![alt](https://x.y/a.png "title") ![rel](/media/a.png)\n\ntext <img src="https://x.y/b.png" width="120" style="max-width: 50%"> after',
  '<p style="text-align: center">centered</p>\n\n<h2 style="text-align: right">right</h2>\n\n<span style="color: rgb(255, 0, 0)">red</span> <mark data-color="#ff0">hi</mark>',
  '<table><tr><th colspan="2">merged</th></tr><tr><td>a</td><td>b</td></tr></table>\n\n<div>raw <b>html</b></div>',
  '<a href="javascript:alert(1)">bad</a> <a href="https://ok.y" target="_top">ok</a> <script>x</script>',
];

describe('markdownToDocumentJson', () => {
  for (const sample of samples)
    it(`reads ${JSON.stringify(sample.slice(0, 40))} as the web editor does`, () => {
      expect(markdownToDocumentJson(sample, window)).toEqual(editorJson(sample));
    });
});

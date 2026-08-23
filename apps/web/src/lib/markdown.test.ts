import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markdownSegments } from './markdown';

const spec =
  '{"type":"bar","x":"week","series":[{"key":"created"}],"data":[{"week":"W1","created":3}]}';

const kinds = (value: string) => markdownSegments(value).map((s) => s.kind);

describe('markdownSegments', () => {
  it('keeps plain markdown as one segment', () => {
    assert.deepEqual(kinds('# Title\n\ntext'), ['markdown']);
  });

  it('splits a chart fence out of the text around it', () => {
    const segments = markdownSegments(`before\n\n\`\`\`chart\n${spec}\n\`\`\`\n\nafter`);
    assert.deepEqual(
      segments.map((s) => s.kind),
      ['markdown', 'chart', 'markdown'],
    );
    assert.equal(segments[1].kind === 'chart' && segments[1].spec.type, 'bar');
  });

  it('reports an unclosed fence as pending, so a streaming spec is not shown raw', () => {
    assert.deepEqual(kinds('text\n\n```chart\n{"type":"bar"'), ['markdown', 'pending']);
  });

  it('draws a fence a model left a stray token in', () => {
    assert.deepEqual(kinds(`\`\`\`chart\n${spec}</br>\n\`\`\``), ['chart']);
  });

  it('draws a spec the model tagged as json or left untagged', () => {
    assert.deepEqual(kinds(`\`\`\`json\n${spec}\n\`\`\``), ['chart']);
    assert.deepEqual(kinds(`\`\`\`\n${spec}\n\`\`\``), ['chart']);
  });

  it('draws a spec written on the fence line itself', () => {
    assert.deepEqual(kinds(`\`\`\`chart ${spec}\n\`\`\``), ['chart']);
    assert.deepEqual(kinds(`\`\`\`chart ${spec}\`\`\``), ['chart']);
  });

  it('leaves an unclosed untagged fence as markdown, so code being typed still shows', () => {
    assert.deepEqual(kinds('text\n\n```js\nconst a = 1;'), ['markdown']);
  });

  it('leaves a fence whose body is not a spec as markdown', () => {
    assert.deepEqual(kinds('```chart\n{ broken\n```'), ['markdown']);
  });

  it('reads several fences in one answer', () => {
    assert.deepEqual(kinds(`\`\`\`chart\n${spec}\n\`\`\`\ngap\n\`\`\`chart\n${spec}\n\`\`\``), [
      'chart',
      'markdown',
      'chart',
    ]);
  });
});

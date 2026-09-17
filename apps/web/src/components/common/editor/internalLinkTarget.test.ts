import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { internalLinkTarget } from './internalLinkTarget';
import { previewExcerpt } from './previewExcerpt';

describe('internal link targets', () => {
  it('recognizes exact routes, encoded keys, aliases and query/hash decorations', () => {
    const examples = [
      ['/project/SYR', { kind: 'project', projectKey: 'SYR' }],
      ['/project/S%59R/issue/13?mode=full#details', { kind: 'issue', projectKey: 'SYR', id: 13 }],
      ['/issue/732', { kind: 'issueId', id: 732 }],
      ['/SYR-13', { kind: 'issue', projectKey: 'SYR', id: 13 }],
      ['/project/SYR/notes/18/', { kind: 'notes', projectKey: 'SYR', id: 18 }],
      ['/project/SYR/docs/9', { kind: 'document', projectKey: 'SYR', id: 9 }],
      ['/project/SYR/view/41', { kind: 'view', projectKey: 'SYR', id: 41 }],
    ] as const;
    for (const [path, expected] of examples)
      assert.deepEqual(internalLinkTarget(new URL(path, 'https://planner.test')), expected);
  });

  it('rejects unsupported, malformed and unsafe numeric routes', () => {
    for (const path of [
      '/account/profile',
      '/project/SYR/settings/general',
      '/project/SYR/issue/0',
      '/project/SYR/issue/-2',
      '/issue/1.5',
      '/issue/9007199254740992',
      '/project/SYR%2Fother/notes/1',
      '/project/%E0%A4%A',
      '/project/SYR/issue/1/extra',
    ]) {
      assert.equal(internalLinkTarget(new URL(path, 'https://planner.test')), null, path);
    }
  });

  it('extracts bounded plain text without markdown or HTML payloads', () => {
    assert.equal(
      previewExcerpt('# Plan\n\nA **clear** [task](https://example.com).\n\n- First\n- Second'),
      'Plan A clear task. First Second',
    );
    assert.equal(previewExcerpt('<script>alert(1)</script>\n\nSafe'), 'Safe');
    assert.equal(previewExcerpt('x'.repeat(500)).length, 281);
  });
});

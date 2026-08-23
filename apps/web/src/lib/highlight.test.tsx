import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidElement, type ReactNode } from 'react';
import { highlight } from './highlight';

function classes(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(classes);
  if (!isValidElement<{ className?: string; children?: ReactNode }>(node)) return [];
  const own = node.props.className ? [node.props.className] : [];
  return [...own, ...classes(node.props.children)];
}

describe('highlight', () => {
  it('highlights JSON', () => {
    assert.ok(classes(highlight('{"a":1}')).includes('hljs-attr'));
  });

  it('highlights a unified diff', () => {
    const found = classes(highlight('@@ -1,2 +1,2 @@\n-old line\n+new line\n context'));
    assert.ok(found.includes('hljs-deletion'));
    assert.ok(found.includes('hljs-addition'));
  });

  it('highlights a diff that has no header', () => {
    const found = classes(highlight('-old line\n+new line'));
    assert.ok(found.includes('hljs-deletion'));
    assert.ok(found.includes('hljs-addition'));
  });

  it('highlights code in a language of its own', () => {
    const code = 'export function greet(user: User): string {\n  return `Hello, ${user.name}!`;\n}';
    assert.ok(classes(highlight(code)).includes('hljs-keyword'));
  });

  it('leaves a markdown list alone', () => {
    assert.equal(highlight('- first\n- second'), null);
  });

  it('leaves prose and command output alone', () => {
    assert.equal(highlight('Wrote 3 files.'), null);
    assert.equal(highlight('bun test v1.3.9\n\n 5 pass\n 0 fail'), null);
  });
});

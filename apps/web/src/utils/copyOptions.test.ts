import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { includeOf, toggleInclude, type CopyGroup } from './copyOptions';

const option = (key: string, requires: string[] = []) => ({
  key,
  label: key,
  requires,
  template: true,
});

const columns: CopyGroup[][] = [
  [{ key: 'workflow', title: 'Workflow', options: [option('states'), option('labels')] }],
  [{ key: 'extra', title: 'Extra', options: [option('views', ['states', 'labels'])] }],
];

describe('includeOf', () => {
  it('counts an option the reader left alone as selected', () => {
    assert.deepEqual(includeOf(columns, { labels: false }), {
      states: true,
      labels: false,
      views: true,
    });
  });
});

describe('toggleInclude', () => {
  it('checks what an option requires', () => {
    const next = toggleInclude(
      columns,
      { states: false, labels: false, views: false },
      'views',
      true,
    );
    assert.deepEqual(includeOf(columns, next), { states: true, labels: true, views: true });
  });

  it('clears what requires a cleared option', () => {
    const next = toggleInclude(columns, {}, 'labels', false);
    assert.deepEqual(includeOf(columns, next), { states: true, labels: false, views: false });
  });
});

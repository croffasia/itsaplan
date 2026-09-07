import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSlashItems } from './tiptap-slash-command';

describe('buildSlashItems', () => {
  it('exposes the complete Docs block surface without changing compact editors', () => {
    const compact = buildSlashItems({ codeBlockLabel: 'Code' });
    assert.deepEqual(
      compact.map((item) => item.title),
      ['Code'],
    );

    const docs = buildSlashItems({
      codeBlockLabel: 'Code',
      tableLabel: 'Table',
      image: { label: 'Image', onPick: () => undefined },
      blocks: {
        paragraph: 'Text',
        headings: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
        bulletList: 'Bullets',
        orderedList: 'Numbers',
        taskList: 'Tasks',
        quote: 'Quote',
        divider: 'Divider',
      },
    });
    assert.deepEqual(
      docs.map((item) => item.title),
      [
        'Text',
        'H1',
        'H2',
        'H3',
        'H4',
        'H5',
        'H6',
        'Bullets',
        'Numbers',
        'Tasks',
        'Quote',
        'Code',
        'Divider',
        'Table',
        'Image',
      ],
    );
  });
});

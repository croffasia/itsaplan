import { Extension, type AnyExtension } from '@tiptap/core';
import { TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { AlignedHeading, AlignedParagraph } from './aligned-blocks';
import { BlockId } from './block-id';
import { DocumentColor, DocumentHighlight } from './color';
import { MarkdownImage } from './image';
import { DocumentLink } from './link';
import { MentionNode } from './mention';
import { TEXT_ALIGNMENTS, isSafeDocumentImageSource, isSafeLinkHref } from './rules';
import { MarkdownTable } from './table';
import { MarkdownTaskList } from './task-list';

// The parts the web editor swaps for ones that carry its interface. Each replacement
// extends the part it replaces, so the schema stays the same.
export type DocumentEditorParts = {
  blockId?: AnyExtension;
  codeBlock?: AnyExtension;
  image?: typeof MarkdownImage;
  mention?: AnyExtension;
};

// What a page is made of. The web editor and the api's Markdown reader build their
// schema from this one list.
export function documentExtensions(parts: DocumentEditorParts = {}): AnyExtension[] {
  return [
    parts.blockId ?? BlockId,
    StarterKit.configure({
      ...(parts.codeBlock ? { codeBlock: false } : {}),
      paragraph: false,
      heading: false,
      link: false,
      // Its paragraph is added before collab starts, so the server copy never gets it.
      trailingNode: false,
    }),
    ...(parts.codeBlock ? [parts.codeBlock] : []),
    DocumentLink.configure({
      autolink: true,
      defaultProtocol: 'https',
      openOnClick: true,
      HTMLAttributes: { class: 'cursor-pointer', tabindex: '0' },
      isAllowedUri: isSafeLinkHref,
    }),
    AlignedParagraph,
    AlignedHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    (parts.image ?? MarkdownImage).configure({ isAllowedSrc: isSafeDocumentImageSource }),
    TableKit.configure({ table: false }),
    MarkdownTable.configure({ resizable: false }),
    MarkdownTaskList,
    TaskItem.configure({ nested: true }),
    TextStyle,
    DocumentColor,
    DocumentHighlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: TEXT_ALIGNMENTS }),
    parts.mention ?? MentionNode,
  ];
}

// The tight-list attribute the Markdown extension adds to the web editor, for a schema
// built without it.
export const TightLists = Extension.create({
  name: 'markdownTightLists',
  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          tight: {
            default: true,
            parseHTML: (element) =>
              element.getAttribute('data-tight') === 'true' || !element.querySelector('p'),
          },
        },
      },
    ];
  },
});

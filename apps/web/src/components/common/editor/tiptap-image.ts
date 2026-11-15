import { MarkdownImage } from '@repo/editor';
import { ReactNodeViewRenderer } from '@tiptap/react';
import EditorResizableImage from './EditorResizableImage';

export const ResizableImage = MarkdownImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(EditorResizableImage);
  },
});

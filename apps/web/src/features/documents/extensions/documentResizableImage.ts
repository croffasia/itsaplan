import { MarkdownImage } from '@repo/editor';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DocumentPercentImage from '../components/DocumentPercentImage';

// A page image is resized to a share of the text width, so it keeps its proportion on every screen.
export const DocumentResizableImage = MarkdownImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(DocumentPercentImage);
  },
});

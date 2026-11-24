import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

type Upload = { id: string; position: number };
type UploadAction = { add: Upload } | { remove: { id: string } };

const uploads = new PluginKey<Upload[]>('documentImageUpload');
let uploadCount = 0;

// lucide's loader-circle, drawn without React inside a decoration.
const SPINNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="animate-spin motion-reduce:animate-none" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

function placeholder(label: string): HTMLElement {
  const box = document.createElement('div');
  box.className =
    'my-6 grid aspect-[4/3] w-[60%] place-items-center rounded-lg bg-muted text-[13px] text-muted-foreground';
  box.contentEditable = 'false';
  box.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.className = 'inline-flex items-center gap-2';
  text.innerHTML = SPINNER;
  text.append(label);
  box.append(text);
  return box;
}

// Shows "Uploading image…" where an image is being uploaded to, and keeps that place
// while the text around it changes, so the image lands where it was dropped.
export const DocumentImageUpload = Extension.create<{ label: string }>({
  name: 'documentImageUpload',

  addOptions() {
    return { label: '' };
  },

  addProseMirrorPlugins() {
    const { label } = this.options;
    return [
      // The places are kept as positions rather than as decorations: a decoration on a
      // block boundary is dropped when the block next to it changes its attributes.
      new Plugin<Upload[]>({
        key: uploads,
        state: {
          init: () => [],
          apply(tr, list) {
            const mapped = tr.docChanged
              ? list.map((upload) => ({ ...upload, position: tr.mapping.map(upload.position, -1) }))
              : list;
            const action = tr.getMeta(uploads) as UploadAction | undefined;
            if (!action) return mapped;
            if ('add' in action) return [...mapped, action.add];
            return mapped.filter((upload) => upload.id !== action.remove.id);
          },
        },
        props: {
          decorations: (state) => {
            const list = uploads.getState(state) ?? [];
            if (list.length === 0) return null;
            return DecorationSet.create(
              state.doc,
              list.map((upload) =>
                Decoration.widget(upload.position, () => placeholder(label), {
                  key: upload.id,
                  side: -1,
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

// Marks `position` as receiving an upload. The returned function reads where that place
// is now and removes the mark; it returns null in an editor without the extension.
export function trackImageUpload(editor: Editor, position: number): () => number | null {
  if (!uploads.getState(editor.state)) return () => null;
  const id = `image-upload-${++uploadCount}`;
  editor.view.dispatch(editor.state.tr.setMeta(uploads, { add: { id, position } }));
  return () => {
    if (editor.isDestroyed) return null;
    const found = uploads.getState(editor.state)?.find((upload) => upload.id === id);
    if (!found) return null;
    editor.view.dispatch(editor.state.tr.setMeta(uploads, { remove: { id } }));
    return found.position;
  };
}

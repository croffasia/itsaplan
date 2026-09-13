import type { EditorProps } from '@tiptap/pm/view';
import { openLinkOnAuxClick, openLinkOnEnter } from './modifierClickLink';

export function createLinkKeyboardHandlers(): EditorProps['handleDOMEvents'] {
  let focusedLink: HTMLAnchorElement | null = null;
  let pointerFocus = false;

  return {
    auxclick(view, event) {
      return openLinkOnAuxClick(event, view.dom);
    },
    focusin(view, event) {
      const target = event.target;
      if (target instanceof HTMLAnchorElement && !pointerFocus) focusedLink = target;
      else if (target !== view.dom) focusedLink = null;
      return false;
    },
    focusout(view, event) {
      if (event.relatedTarget !== view.dom) {
        focusedLink = null;
        pointerFocus = false;
      }
      return false;
    },
    pointerdown() {
      focusedLink = null;
      pointerFocus = true;
      return false;
    },
    pointerup() {
      pointerFocus = false;
      return false;
    },
    pointercancel() {
      pointerFocus = false;
      return false;
    },
    keydown(view, event) {
      // Chromium can focus the editing host before delivering Enter to a focused link.
      const link = focusedLink;
      focusedLink = null;
      pointerFocus = false;
      return openLinkOnEnter(event, view.dom, link);
    },
  };
}

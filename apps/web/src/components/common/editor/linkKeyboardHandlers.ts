import type { EditorProps } from '@tiptap/pm/view';
import { openLink, openLinkOnAuxClick, openLinkOnEnter } from './modifierClickLink';

export function createLinkKeyboardHandlers(openOnTouch = false): EditorProps['handleDOMEvents'] {
  let focusedLink: HTMLAnchorElement | null = null;
  let pointerFocus = false;
  let touchTap: {
    link: HTMLAnchorElement;
    pointerId: number;
    x: number;
    y: number;
    startedAt: number;
    released: boolean;
  } | null = null;

  return {
    click(view, event) {
      const tap = touchTap;
      touchTap = null;
      if (
        !view.editable ||
        !tap?.released ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        ('pointerType' in event && event.pointerType !== 'touch') ||
        event.timeStamp - tap.startedAt > 500 ||
        !(event.target instanceof Node) ||
        !tap.link.contains(event.target) ||
        window.getSelection()?.isCollapsed === false
      )
        return false;
      return openLink(event, view.dom);
    },
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
    pointerdown(view, event) {
      focusedLink = null;
      pointerFocus = true;
      touchTap = null;
      if (!openOnTouch || event.pointerType !== 'touch' || !event.isPrimary) return false;
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (link && view.dom.contains(link)) {
        touchTap = {
          link,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          startedAt: event.timeStamp,
          released: false,
        };
      }
      return false;
    },
    pointermove(_view, event) {
      if (
        touchTap &&
        event.pointerId === touchTap.pointerId &&
        Math.hypot(event.clientX - touchTap.x, event.clientY - touchTap.y) > 10
      )
        touchTap = null;
      return false;
    },
    pointerup(_view, event) {
      pointerFocus = false;
      if (touchTap && event.pointerId === touchTap.pointerId) {
        if (Math.hypot(event.clientX - touchTap.x, event.clientY - touchTap.y) > 10)
          touchTap = null;
        else touchTap.released = true;
      }
      return false;
    },
    pointercancel() {
      pointerFocus = false;
      touchTap = null;
      return false;
    },
    contextmenu() {
      touchTap = null;
      return false;
    },
    keydown(view, event) {
      // Chromium can focus the editing host before delivering Enter to a focused link.
      const link = focusedLink;
      focusedLink = null;
      pointerFocus = false;
      touchTap = null;
      return openLinkOnEnter(event, view.dom, link);
    },
  };
}

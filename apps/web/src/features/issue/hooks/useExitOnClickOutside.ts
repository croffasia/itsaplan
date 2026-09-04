import { useEffect, useRef, type RefObject } from 'react';

// Closes a surface when a click lands outside it, read from the document because the
// surface has no backdrop element of its own to take the click.
//
// The layer check keeps the surface open under its own overlays: a popover, dropdown,
// select, dialog or toast is its own child of the body. That holds while the app renders
// into one child of the body, so an element wrapping the providers would put those
// overlays in the surface's layer and a click in one would close it.
//
// The listener is on click so a field saving on blur commits first, and so a scrollbar
// drag or a right press raises none. A click reports the common ancestor of press and
// release, so the press decides: a gesture that starts inside the surface keeps it open
// even when it is released over the page. The handler is kept in a ref so the listeners
// are registered once and always call the latest onExit.
export function useExitOnClickOutside(ref: RefObject<HTMLElement | null>, onExit: () => void) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    let pressedInside = false;

    function onPointerDown(e: PointerEvent) {
      const surface = ref.current;
      pressedInside = !!surface && e.target instanceof Node && surface.contains(e.target);
    }

    function onClick(e: MouseEvent) {
      // Read and clear, so an activation that raises no press (a keyboard one, or a
      // synthetic click) is judged on its own target rather than on the last press.
      const pressed = pressedInside;
      pressedInside = false;
      if (pressed) return;
      const surface = ref.current;
      if (!surface || !(e.target instanceof Element)) return;
      if (surface.contains(e.target)) return;
      if (!surface.closest('body > *')?.contains(e.target)) return;
      onExitRef.current();
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick);
    };
  }, [ref]);
}

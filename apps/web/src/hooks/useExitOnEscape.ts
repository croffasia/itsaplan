import { useEffect, useRef } from 'react';

// Escape closes the current surface (a side panel, a full-page view). When a
// dropdown or popover is open (rendered in a portal), let it handle Escape first
// so it closes instead of the surface. The handler is kept in a ref so the
// listener is registered once and always calls the latest onExit.
export function useExitOnEscape(onExit: () => void) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[data-radix-popper-content-wrapper]')) return;
      onExitRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

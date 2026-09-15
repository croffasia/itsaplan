import { useCallback, useEffect, useRef, useState } from 'react';

export function useLinkPreviewDialog({
  linkCount,
  onClose,
  trigger,
  container,
}: {
  linkCount: number;
  onClose: () => void;
  trigger: HTMLElement | null;
  container: HTMLElement | null;
}) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<number | null>(linkCount === 1 ? 0 : null);
  const body = useRef<HTMLDivElement>(null);
  const lastSelected = useRef(0);
  const editAfterClose = useRef<(() => void) | undefined>(undefined);
  const focusAction = useCallback(() => {
    body.current
      ?.querySelector<HTMLElement>('[data-link-preview-primary]')
      ?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (open) focusAction();
  }, [open, selected, focusAction]);

  function closeAutoFocus(event: Event) {
    event.preventDefault();
    const target = trigger?.isConnected ? trigger : container;
    if (target?.isConnected) {
      const tabIndex = target.getAttribute('tabindex');
      if (tabIndex === null) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (tabIndex === null) target.removeAttribute('tabindex');
    }
    onClose();
    editAfterClose.current?.();
  }

  return {
    open,
    setOpen,
    selected,
    body,
    focusIndex: lastSelected.current,
    focusAction,
    closeAutoFocus,
    select(index: number) {
      lastSelected.current = index;
      setSelected(index);
    },
    backToLinks() {
      setSelected(null);
    },
    editLink(onEdit: () => void) {
      editAfterClose.current = onEdit;
      setOpen(false);
    },
  };
}

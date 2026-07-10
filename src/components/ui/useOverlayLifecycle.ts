import { useEffect, useState, type RefObject } from 'react';

/**
 * Shared enter/exit lifecycle for the mobile task-card overlays (right
 * slide-over + action modal).
 *
 * Both overlays are mounted PER task card, so keeping ~400 hidden portals in
 * the DOM would be wasteful. Instead each overlay mounts only while active:
 *   - `render` — keep the portal in the DOM (true from open until the exit
 *     transition finishes)
 *   - `shown`  — the visual open/closed flag the CSS transitions key off
 *     (flipped on the frame AFTER mount so the enter transition actually plays)
 *
 * Also wires Escape-to-close, a light-touch body-scroll lock, and the portal
 * target — mirroring the Sheet component's scaffolding.
 */
export function useOverlayLifecycle(
  open: boolean,
  onClose: () => void,
  exitMs: number,
  /** Focused when the overlay opens (honours the aria-modal contract); the
   *  previously-focused element is restored on close. */
  focusRef?: RefObject<HTMLElement>,
): { render: boolean; shown: boolean; portalTarget: HTMLElement | null } {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Mount → animate in; close → animate out → unmount.
  useEffect(() => {
    if (open) {
      setRender(true);
      // Two rAFs so the browser paints the closed state before flipping open.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Light-touch body-scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Move focus into the dialog on open (so screen readers honour aria-modal),
  // restore it to the previously-focused element on close.
  useEffect(() => {
    if (!open) return;
    const restoreTo = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => focusRef?.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      restoreTo?.focus?.();
    };
  }, [open, focusRef]);

  return { render, shown, portalTarget };
}

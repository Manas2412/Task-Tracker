'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

/**
 * Responsive dialog.
 *
 *   - mobile (< md) : bottom sheet, slides up from the bottom edge.
 *   - tablet+ (md+) : centred modal, scales/fades.
 *
 * Single DOM container, single state — Tailwind responsive classes flip
 * the presentation. See Design Tokens §6.3 (bottom sheet) and §6.8 (modal).
 *
 * Children are NOT unmounted on close; the parent should conditionally
 * mount when it wants fresh state on each open (e.g. forms).
 */

const SIZE_CLASS = {
  sm: 'md:w-[460px]',
  md: 'md:w-[520px]',
} as const;

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  ariaLabelledBy?: string;
  size?: keyof typeof SIZE_CLASS;
};

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  ariaLabelledBy,
  size = 'sm',
}: SheetProps) {
  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open (light-touch).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Portal target — render to document.body to escape any stacking context.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const content = (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Container — mobile bottom sheet / desktop modal in one element */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy ?? (title ? 'sheet-title' : undefined)}
        className={cn(
          // Common
          'fixed z-[70] bg-panel will-change-transform',
          // Mobile: pinned to bottom, full width, rounded top
          'inset-x-0 bottom-0 rounded-t-[24px] max-h-[90dvh] overflow-y-auto',
          // Mobile transitions
          'transition-transform duration-300 ease-out',
          // Desktop: centred modal
          'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2',
          SIZE_CLASS[size],
          'md:max-w-[calc(100vw-32px)] md:rounded-2xl md:max-h-[85dvh]',
          'md:-translate-x-1/2 md:-translate-y-1/2',
          'md:transition-all md:duration-200',
          // Open/closed states
          open
            ? 'translate-y-0 md:scale-100 md:opacity-100'
            : 'translate-y-full md:scale-95 md:opacity-0',
          // Pointer events
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-line rounded-full" aria-hidden="true" />
        </div>

        {title ? (
          <header className="px-5 md:px-6 pt-3 md:pt-6 pb-3 md:pb-4">
            <h2
              id={ariaLabelledBy ?? 'sheet-title'}
              className="font-serif text-[20px] md:text-[22px] font-medium text-ink leading-tight"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[12px] text-ink-3 mt-1">{subtitle}</p>
            ) : null}
          </header>
        ) : null}

        <div className="px-5 md:px-6 pb-6">{children}</div>
      </div>
    </>
  );

  if (!portalTarget) return null;
  return createPortal(content, portalTarget);
}

'use client';

import { cn } from '@/lib/utils';

/**
 * The Quick Create "+" — present on every mobile screen.
 * 56 × 56 px, bottom-right, 20 px from edges. See Design Tokens §5.1.
 *
 * Phase 1 stop: button renders and fires onClick. The Quick Create
 * bottom sheet itself ships in the next turn.
 */
type FabProps = {
  ariaLabel?: string;
  onClick?: () => void;
  icon?: string;
  className?: string;
};

export function FloatingActionButton({
  ariaLabel = 'Quick create task',
  onClick,
  icon = 'ti-plus',
  className,
}: FabProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'fixed bottom-20 md:bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-ink text-onink text-2xl',
        'grid place-items-center shadow-fab transition-transform',
        'hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        className,
      )}
    >
      <i className={cn('ti', icon)} aria-hidden="true" />
    </button>
  );
}

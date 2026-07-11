'use client';

import { cn } from '@/lib/utils';

/**
 * The "+ New task" button shown on tablet/laptop top-right.
 * On mobile this is replaced by the FloatingActionButton.
 *
 * Phase 1 stop: renders, fires onClick. Wired to Quick Create in turn B.
 */
type PrimaryActionProps = {
  label?: string;
  icon?: string;
  onClick?: () => void;
  className?: string;
};

export function PrimaryAction({
  label = 'New task',
  icon = 'ti-plus',
  onClick,
  className,
}: PrimaryActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-onink text-[13px] font-medium',
        'hover:bg-ink-2 transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        className,
      )}
    >
      <i className={cn('ti', icon, 'text-[14px]')} aria-hidden="true" />
      {label}
    </button>
  );
}

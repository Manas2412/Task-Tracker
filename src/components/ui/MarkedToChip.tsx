import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * MarkedToChip — the one canonical "division tag" pill used wherever a
 * division is shown as a chip (Timeline File card + marked-to editor). A
 * data-driven colour dot (the sanctioned inline-style exception) plus the
 * division name; an optional children slot carries the editor's remove
 * button so the card and editor can never drift in size/spacing.
 */
type MarkedToChipProps = {
  name: string;
  /** Division avatar colour (hex from data) for the dot. */
  colour: string;
  children?: ReactNode;
  className?: string;
};

export function MarkedToChip({ name, colour, children, className }: MarkedToChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2 bg-bg border border-line px-2 py-0.5 rounded-md',
        className,
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: colour }}
        aria-hidden="true"
      />
      {name}
      {children}
    </span>
  );
}

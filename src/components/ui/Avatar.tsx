import { cn } from '@/lib/utils';

/**
 * Avatar — circular initials with a colour fill.
 *
 * Two render modes:
 *   - `colour` (hex) — division-coloured avatars on task cards, the inspector.
 *   - `tone` (slot key) — used in the Super Admin hierarchy chart, which
 *     resolves to a CSS variable from --slot-*. Phase 1 surfaces use `colour`.
 *
 * See docs/COMPONENTS.md §15.
 */

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE: Record<AvatarSize, { box: string; text: string }> = {
  xs: { box: 'w-[22px] h-[22px]', text: 'text-[9px]' },
  sm: { box: 'w-[26px] h-[26px]', text: 'text-[10px]' },
  md: { box: 'w-8 h-8', text: 'text-[12px]' },
  lg: { box: 'w-12 h-12', text: 'text-[16px]' },
};

type AvatarProps = {
  initials: string;
  colour: string;
  size?: AvatarSize;
  ariaLabel?: string;
  className?: string;
};

export function Avatar({ initials, colour, size = 'xs', ariaLabel, className }: AvatarProps) {
  return (
    <span
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{ backgroundColor: colour }}
      className={cn(
        'inline-flex items-center justify-center rounded-full text-white font-medium',
        SIZE[size].box,
        SIZE[size].text,
        className,
      )}
    >
      {initials}
    </span>
  );
}

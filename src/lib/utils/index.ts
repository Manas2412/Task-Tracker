import { clsx, type ClassValue } from 'clsx';

/**
 * Conditional className merger. Use everywhere instead of string concatenation.
 *
 *   <button className={cn('px-3 py-2', isActive && 'bg-ink text-white')} />
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

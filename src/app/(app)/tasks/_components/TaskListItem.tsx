'use client';

import { TaskCardInteractive, type TaskCardInteractiveProps } from '@/components/ui';

/**
 * Tasks-list row.
 *
 *   - Desktop: hovering shows a clean description/owner preview (HoverPreview).
 *   - Mobile: swipe-left opens a read-only slide-over; a ~2 s long press opens
 *     a role-gated action modal. Both are touch-only and no-op on desktop.
 *
 * All of that lives in TaskCardInteractive; this stays a thin pass-through so
 * the server page keeps rendering the same component.
 */
export function TaskListItem(props: TaskCardInteractiveProps) {
  return <TaskCardInteractive {...props} />;
}

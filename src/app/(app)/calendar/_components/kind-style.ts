import type { CalendarKind } from '@/lib/calendar';

/**
 * One place for the colour + icon + label of each calendar item kind, so
 * the month, week, list, legend, filter bar, and detail sheet stay in
 * lock-step. Colours are token-based (no hex): engagements read teal
 * (info), task deadlines dark blue (primary), Timeline file deadlines red
 * (urgent) — three clearly distinct signals. These are the calendar's own
 * kind colours; the two-accent rule's reserved meanings hold elsewhere.
 */
export const KIND_META: Record<
  CalendarKind,
  {
    label: string;
    icon: string;
    /** Small chip in month/week cells. */
    chip: string;
    /** Solid dot used in the legend + filter chips. */
    dot: string;
    /** Border for the list-view row card. */
    rowBorder: string;
    /** Light background wash for the list-view row (matches the pill hue). */
    rowTint: string;
    /** Icon tile in the list view + detail. */
    tile: string;
    /** Active (selected) state for the kind filter button — a soft glow in the kind hue. */
    activeBtn: string;
  }
> = {
  engagement: {
    label: 'JS engagement',
    icon: 'ti-users-group',
    chip: 'bg-info-soft text-info hover:bg-info-soft/80',
    dot: 'bg-info',
    rowBorder: 'border-info/40',
    rowTint: 'cal-row-engagement',
    tile: 'bg-info-soft text-info',
    activeBtn: 'bg-info-soft text-info border-info/40 ring-2 ring-info/30 shadow-sm',
  },
  task: {
    label: 'Task deadline',
    icon: 'ti-checkbox',
    chip: 'bg-primary-soft text-primary hover:bg-primary-soft/80',
    dot: 'bg-primary',
    rowBorder: 'border-primary-line/40',
    rowTint: 'cal-row-task',
    tile: 'bg-primary-soft text-primary',
    activeBtn: 'bg-primary-soft text-primary border-primary/30 ring-2 ring-primary/25 shadow-sm',
  },
  tf: {
    label: 'Timeline file',
    icon: 'ti-file-stack',
    chip: 'bg-urgent-soft text-urgent hover:bg-urgent-soft/80',
    dot: 'bg-urgent',
    rowBorder: 'border-urgent/40',
    rowTint: 'cal-row-tf',
    tile: 'bg-urgent-soft text-urgent',
    activeBtn: 'bg-urgent-soft text-urgent border-urgent/40 ring-2 ring-urgent/30 shadow-sm',
  },
};

export const KIND_ORDER: CalendarKind[] = ['engagement', 'task', 'tf'];

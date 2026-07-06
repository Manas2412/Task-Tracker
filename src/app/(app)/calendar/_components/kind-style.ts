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
    /** Icon tile in the list view + detail. */
    tile: string;
  }
> = {
  engagement: {
    label: 'JS engagement',
    icon: 'ti-users-group',
    chip: 'bg-info-soft text-info hover:bg-info-soft/80',
    dot: 'bg-info',
    rowBorder: 'border-info/40',
    tile: 'bg-info-soft text-info',
  },
  task: {
    label: 'Task deadline',
    icon: 'ti-checkbox',
    chip: 'bg-primary-soft text-primary hover:bg-primary-soft/80',
    dot: 'bg-primary',
    rowBorder: 'border-primary-line/40',
    tile: 'bg-primary-soft text-primary',
  },
  tf: {
    label: 'Timeline file',
    icon: 'ti-file-stack',
    chip: 'bg-urgent-soft text-urgent hover:bg-urgent-soft/80',
    dot: 'bg-urgent',
    rowBorder: 'border-urgent/40',
    tile: 'bg-urgent-soft text-urgent',
  },
};

export const KIND_ORDER: CalendarKind[] = ['engagement', 'task', 'tf'];

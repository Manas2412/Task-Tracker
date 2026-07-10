import type { CalendarFilters, CalendarKind } from '@/lib/calendar';

/**
 * Calendar filter <-> URL search-param helpers. Filter state lives in the
 * URL (the project convention) so views are shareable and server-rendered.
 */

export const ALL_KINDS: CalendarKind[] = ['engagement', 'task', 'tf'];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TASK_STATUSES = ['not_started', 'in_progress', 'awaiting_input', 'on_hold', 'completed'];

export type RawParams = { [key: string]: string | undefined };

export function parseCalendarFilters(sp: RawParams): CalendarFilters {
  const kindsRaw = sp.types;
  const kinds = kindsRaw
    ? new Set(
        kindsRaw
          .split(',')
          .filter((k): k is CalendarKind => (ALL_KINDS as string[]).includes(k)),
      )
    : new Set(ALL_KINDS);
  // Guard against an empty/garbage list turning the calendar blank.
  if (kinds.size === 0) ALL_KINDS.forEach((k) => kinds.add(k));

  return {
    kinds,
    mine: sp.mine === '1',
    divisionId: sp.division || undefined,
    priority: TASK_PRIORITIES.includes(sp.priority ?? '') ? sp.priority : undefined,
    status: TASK_STATUSES.includes(sp.status ?? '') ? sp.status : undefined,
  };
}

/**
 * Build a /calendar href from the current params plus overrides. Passing
 * `null` for a key drops it. Undefined values are ignored (kept as-is).
 */
export function buildCalendarHref(sp: RawParams, overrides: Record<string, string | null>): string {
  const merged: RawParams = { ...sp };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) delete merged[k];
    else merged[k] = v;
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/calendar?${qs}` : '/calendar';
}

/**
 * Serialize a set of selected kinds to the `types` param value, considering
 * only the kinds actually available to this viewer. Returns null (drop the
 * param, = default "all") when all available kinds are on, or when none are
 * (an empty selection is meaningless, so it falls back to all).
 */
export function serializeKinds(
  selected: Set<CalendarKind>,
  available: CalendarKind[] = ALL_KINDS,
): string | null {
  const active = available.filter((k) => selected.has(k));
  if (active.length === 0 || active.length === available.length) return null;
  return ALL_KINDS.filter((k) => active.includes(k)).join(',');
}

/** Toggle a kind in the `types` param, returning the new serialized value or null (= all). */
export function toggleKindParam(current: Set<CalendarKind>, kind: CalendarKind): string | null {
  const next = new Set(current);
  if (next.has(kind)) next.delete(kind);
  else next.add(kind);
  // Never allow an empty set — re-enabling everything is the sensible reset.
  if (next.size === 0) return ALL_KINDS.join(',');
  if (next.size === ALL_KINDS.length) return null; // default (all) → drop the param
  return ALL_KINDS.filter((k) => next.has(k)).join(',');
}

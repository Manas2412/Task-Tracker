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

/**
 * Toggle a kind for the legend filter, considering only the kinds available to
 * this viewer (`available`). Returns the new serialized `types` value, or null
 * (= all, param dropped) — including when the toggle would leave no AVAILABLE
 * kind selected, so a viewer can never strand the calendar on a kind they can't
 * even see (e.g. a non-OJS user turning off both task and tf). Delegates to
 * `serializeKinds` so the "all / none → default" collapse stays in one place.
 */
export function toggleKindParam(
  current: Set<CalendarKind>,
  kind: CalendarKind,
  available: CalendarKind[] = ALL_KINDS,
): string | null {
  const next = new Set(current);
  if (next.has(kind)) next.delete(kind);
  else next.add(kind);
  return serializeKinds(next, available);
}

'use client';

import { useRouter } from 'next/navigation';

import { buildCalendarHref, type RawParams } from './filter-params';

type Option = { value: string; label: string };

/**
 * A compact select that narrows the calendar by writing one search param
 * and navigating. Kept client-side because a native select can't be a
 * <Link>; everything else in the filter bar stays server-rendered.
 */
export function FilterSelect({
  paramKey,
  value,
  options,
  allLabel,
  sp,
  ariaLabel,
}: {
  paramKey: string;
  value: string | undefined;
  options: Option[];
  allLabel: string;
  sp: RawParams;
  ariaLabel: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label={ariaLabel}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        router.push(buildCalendarHref(sp, { [paramKey]: v === '' ? null : v }));
      }}
      className="px-2.5 py-1.5 rounded-lg border border-line bg-panel text-[12px] font-medium text-ink-2 outline-none focus:border-ink appearance-none cursor-pointer"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

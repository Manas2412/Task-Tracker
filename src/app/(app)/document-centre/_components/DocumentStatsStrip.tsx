import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Summary strip for the Document Centre — four count tiles that double as
 * filter shortcuts, mirroring the tasks StatsStrip layout (2×2 on mobile, a
 * single frosted row on desktop). Non-interactive counts stay server-rendered.
 */

type Counts = { open: number; underReview: number; awaitingInput: number; completed: number };

const TILES: {
  key: keyof Counts;
  label: string;
  href: string;
  icon: string;
  tone: string;
}[] = [
  { key: 'open', label: 'Open', href: '/document-centre', icon: 'ti-files', tone: 'text-ink' },
  {
    key: 'underReview',
    label: 'Under review',
    href: '/document-centre?filter=under_review',
    icon: 'ti-eye-check',
    tone: 'text-info',
  },
  {
    key: 'awaitingInput',
    label: 'Awaiting input',
    href: '/document-centre?filter=awaiting_input',
    icon: 'ti-clock',
    tone: 'text-hold',
  },
  {
    key: 'completed',
    label: 'Completed',
    href: '/document-centre?filter=completed',
    icon: 'ti-circle-check',
    tone: 'text-success',
  },
];

export function DocumentStatsStrip({ counts }: { counts: Counts }) {
  return (
    <>
      {/* Mobile: 2×2 cards */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {TILES.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-panel px-3.5 py-3 shadow-card active:scale-[0.99] transition-transform"
          >
            <span className="flex flex-col">
              <span className={cn('text-[20px] font-medium leading-none', t.tone)}>
                {counts[t.key]}
              </span>
              <span className="mt-1 text-[11px] text-ink-3">{t.label}</span>
            </span>
            <i className={cn('ti', t.icon, 'text-[16px]', t.tone)} aria-hidden="true" />
          </Link>
        ))}
      </div>

      {/* Desktop: one frosted row */}
      <div className="hidden md:grid glass-card rounded-2xl grid-cols-4 divide-x divide-line/60">
        {TILES.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            className="flex items-center gap-3 px-5 py-4 hover:bg-line-2/40 first:rounded-l-2xl last:rounded-r-2xl transition-colors"
          >
            <i
              className={cn('ti', t.icon, 'text-[18px]', t.tone)}
              aria-hidden="true"
            />
            <span className="flex flex-col">
              <span className={cn('text-[22px] font-medium leading-none', t.tone)}>
                {counts[t.key]}
              </span>
              <span className="mt-1 text-[11px] text-ink-3">{t.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

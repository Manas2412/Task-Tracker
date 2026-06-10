import Link from 'next/link';

import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';

import type { PillStatusTone } from '@/components/ui/Pill';

/**
 * TimelineFileCard — per docs/COMPONENTS.md §4.
 *
 *   variant 'full'    — list view; full title block + marked-to chips
 *   variant 'compact' — small card embedded inside task detail
 *
 * Indigo accent throughout (the "structure" signal — TF and Super Admin).
 */

const TF_STATUS_LABEL: Record<string, string> = {
  pending_action: 'Pending action',
  in_progress: 'In progress',
  awaiting_reply: 'Awaiting reply',
  on_hold: 'On hold',
  closed: 'Closed',
};

const TF_STATUS_TONE: Record<string, PillStatusTone> = {
  pending_action: 'pending_action',
  in_progress: 'in_progress',
  awaiting_reply: 'awaiting_reply',
  on_hold: 'on_hold',
  closed: 'closed',
};

type FullProps = {
  variant?: 'full';
  refNo: string;
  subject: string;
  fromWhom: string;
  receivedDate: Date;
  deadlineDate: Date | null;
  status: string;
  markedTo: Array<{ id: string; name: string; avatarColour: string }>;
  taskLinkCount: number;
  href: string;
  className?: string;
};

type CompactProps = {
  variant: 'compact';
  refNo: string;
  subject: string;
  fromWhom: string;
  deadlineDate: Date | null;
  href: string;
  className?: string;
};

export type TimelineFileCardProps = FullProps | CompactProps;

export function TimelineFileCard(props: TimelineFileCardProps) {
  if (props.variant === 'compact') return <Compact {...props} />;
  return <Full {...props} />;
}

// ------------------------------------------------------------
// Full
// ------------------------------------------------------------

function Full(p: FullProps) {
  const days = p.deadlineDate ? daysUntil(p.deadlineDate) : null;
  const isOverdue = days !== null && days < 0;
  const isClosed = p.status === 'closed';

  return (
    <Link
      href={p.href}
      className={cn(
        'block bg-panel border border-line rounded-xl p-4 transition-colors',
        'hover:border-ink-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        isClosed && 'opacity-75',
        p.className,
      )}
    >
      {/* Header — ref no + status + deadline */}
      <header className="flex items-start gap-2 flex-wrap mb-2.5">
        <span className="font-mono text-[11px] font-medium text-primary bg-primary-soft border border-primary-line/40 px-2 py-0.5 rounded-md">
          {p.refNo}
        </span>
        <Pill
          variant="status"
          tone={TF_STATUS_TONE[p.status] ?? 'pending_action'}
          label={TF_STATUS_LABEL[p.status] ?? p.status}
        />
        {p.deadlineDate && !isClosed ? (
          <Pill variant="deadline" daysLeft={days ?? 0} overdue={isOverdue} />
        ) : null}
        {p.taskLinkCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-3 px-1.5 py-0.5 rounded-md bg-line-2 ml-auto">
            <i className="ti ti-link text-[11px]" aria-hidden="true" />
            {p.taskLinkCount}
          </span>
        ) : null}
      </header>

      {/* Subject */}
      <h3 className="font-serif text-[17px] leading-tight text-ink mb-2 tracking-tight-title">
        {p.subject}
      </h3>

      {/* From + received */}
      <p className="text-[11px] text-ink-3">
        From <span className="text-ink-2 font-medium">{p.fromWhom}</span>
        <span className="mx-1.5 text-ink-4">·</span>
        Received {formatShort(p.receivedDate)}
      </p>

      {/* Marked-to chips */}
      {p.markedTo.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.markedTo.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1.5 text-[10px] font-medium text-ink-2 bg-bg border border-line px-1.5 py-0.5 rounded-md"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: d.avatarColour }}
                aria-hidden="true"
              />
              {d.name}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

// ------------------------------------------------------------
// Compact (used inside task detail)
// ------------------------------------------------------------

function Compact(p: CompactProps) {
  const days = p.deadlineDate ? daysUntil(p.deadlineDate) : null;
  return (
    <Link
      href={p.href}
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl bg-primary-soft border border-primary-line/40',
        'hover:shadow-sm transition-shadow',
        p.className,
      )}
    >
      <div className="w-9 h-9 grid place-items-center rounded-lg bg-primary text-white shrink-0">
        <i className="ti ti-file-stack text-[18px]" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-primary">
          <span className="font-mono mr-1.5">{p.refNo}</span>· {p.subject}
        </div>
        <div className="text-[11px] text-ink-2 mt-0.5">From {p.fromWhom}</div>
        {days !== null ? (
          <div
            className={cn(
              'text-[11px] mt-1 font-medium',
              days < 0 ? 'text-urgent' : 'text-accent',
            )}
          >
            {days < 0
              ? `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`
              : days === 0
                ? 'Due today'
                : `Due in ${days} ${days === 1 ? 'day' : 'days'}`}
          </div>
        ) : null}
      </div>
      <i className="ti ti-chevron-right text-[16px] text-ink-3 shrink-0" aria-hidden="true" />
    </Link>
  );
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function daysUntil(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function formatShort(d: Date): string {
  // 18 May 2026
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

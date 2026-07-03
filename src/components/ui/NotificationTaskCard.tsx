import { format } from 'date-fns';

import { formatDue } from '@/lib/format';
import { cn } from '@/lib/utils';

export type NotificationTaskCardProps = {
  /** Accepted so callers can spread the full NotificationTaskContext; not rendered — the headline above already names the task. */
  taskName?: string;
  divisionName: string | null;
  dueDate: Date | null;
  actorLabel: string | null;
  actorName: string | null;
  /** 'compact' fits the bell dropdown (340px); 'full' is the /notifications page. */
  variant?: 'full' | 'compact';
};

/**
 * Task context shown under a notification's headline — division, due
 * date, and (where the notification type has one) who acted. The task
 * title itself isn't repeated here; `describeNotification`'s headline
 * already names it.
 *
 * The 'full' variant sizes itself to its content (inline-flex, not a
 * full-width block) — a compact chip, not a stretched panel — so it can
 * never crowd the swipe-to-reveal "Mark read" action on /notifications
 * regardless of row width or viewport.
 */
export function NotificationTaskCard({
  divisionName,
  dueDate,
  actorLabel,
  actorName,
  variant = 'full',
}: NotificationTaskCardProps) {
  const due = dueDate ? formatDue(dueDate) : null;
  const dueTone = cn(
    due?.tone === 'overdue' && 'text-urgent font-medium',
    due?.tone === 'today' && 'text-accent font-medium',
    (!due || due.tone === 'soon' || due.tone === 'future') && 'text-ink-3',
  );
  const dueLabel = dueDate ? `Due ${format(dueDate, 'd LLL yyyy, h:mm aaa')}` : 'No due date';
  const showActor = !!(actorLabel && actorName);

  if (variant === 'compact') {
    return (
      <span className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1 text-[10.5px] text-ink-3">
        {divisionName ? (
          <span className="inline-flex items-center gap-1 truncate max-w-[110px]">
            <i className="ti ti-building text-[11px]" aria-hidden="true" />
            {divisionName}
          </span>
        ) : null}
        {dueDate ? (
          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', dueTone)}>
            <i className="ti ti-calendar-due text-[11px]" aria-hidden="true" />
            {due?.label}
          </span>
        ) : null}
        {showActor ? (
          <span className="inline-flex items-center gap-1 truncate">
            <i className="ti ti-user text-[11px]" aria-hidden="true" />
            {actorLabel} {actorName}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap max-w-full items-center gap-x-4 gap-y-1 mt-2 mb-1 mr-2 rounded-lg border border-line bg-bg px-3 py-2">
      {divisionName ? (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
          <i className="ti ti-building text-[12px]" aria-hidden="true" />
          {divisionName}
        </span>
      ) : null}
      {showActor ? (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
          <i className="ti ti-user text-[12px]" aria-hidden="true" />
          {actorLabel} <span className="font-medium text-ink-2">{actorName}</span>
        </span>
      ) : null}
      <span className={cn('inline-flex items-center gap-1.5 text-[11px]', dueTone)}>
        <i className="ti ti-calendar-due text-[12px]" aria-hidden="true" />
        {dueLabel}
      </span>
    </span>
  );
}

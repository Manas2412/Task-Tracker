import { format } from 'date-fns';

import { formatDue } from '@/lib/format';
import { cn } from '@/lib/utils';

export type NotificationTaskCardProps = {
  taskName: string;
  divisionName: string | null;
  dueDate: Date | null;
  actorLabel: string | null;
  actorName: string | null;
  /** 'compact' fits the bell dropdown (340px); 'full' is the /notifications page. */
  variant?: 'full' | 'compact';
};

/**
 * Task context shown under a notification's headline — title, division,
 * due date, and (where the notification type has one) who acted.
 */
export function NotificationTaskCard({
  taskName,
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
      <span className="block mt-1 rounded-md border border-line bg-bg px-2 py-1.5">
        <span className="block text-[11.5px] font-medium text-ink leading-snug truncate">
          {taskName}
        </span>
        <span className="flex items-center gap-1 mt-0.5 text-[10px] text-ink-3">
          {divisionName ? <span className="truncate max-w-[90px]">{divisionName}</span> : null}
          {divisionName && dueDate ? <span aria-hidden="true">·</span> : null}
          {dueDate ? <span className={cn(dueTone, 'whitespace-nowrap')}>{due?.label}</span> : null}
          {showActor ? (
            <>
              {divisionName || dueDate ? <span aria-hidden="true">·</span> : null}
              <span className="truncate">
                {actorLabel} {actorName}
              </span>
            </>
          ) : null}
        </span>
      </span>
    );
  }

  return (
    <span className="block mt-2 mb-1 rounded-lg border border-line bg-bg px-3 py-2.5">
      <span className="block text-[13px] font-medium text-ink leading-snug">{taskName}</span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
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
    </span>
  );
}

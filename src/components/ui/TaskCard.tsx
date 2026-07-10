import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import { Pill, type PillJsLane, type PillPriorityTone, type PillStatusTone } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';

/**
 * TaskCard — list variant.
 * Lane variant (drag handle + tighter spacing) comes in Phase 2 with the board.
 *
 * See docs/COMPONENTS.md §3.
 */

const PRIORITY_DOT: Record<PillPriorityTone, string> = {
  low: 'bg-low',
  medium: 'bg-medium',
  high: 'bg-high',
  urgent: 'bg-urgent',
};

const STATUS_LABEL: Record<PillStatusTone, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_input: 'Awaiting input',
  on_hold: 'On hold',
  completed: 'Completed',
  pending_action: 'Pending action',
  awaiting_reply: 'Awaiting reply',
  closed: 'Closed',
};

export type TaskCardProps = {
  taskId: string;
  refNumber?: string | null;
  name: string;
  /** Full description — not shown on the card, used by the hover preview. */
  description?: string | null;
  /** Attachment file names — not shown on the card, used by the hover preview. */
  attachmentNames?: string[];
  division: { name: string };
  status: PillStatusTone;
  priority: PillPriorityTone;
  jsPriorityLane?: PillJsLane | null;
  due?: { label: string; tone: 'today' | 'overdue' | 'soon' | 'future' | 'none' };
  owner: { initials: string; colour: string; name: string };
  subtasks?: { done: number; total: number };
  hasAttachment?: boolean;
  /** If set, render "Primary: <divisionName>" pill (cross-division indicator) */
  primaryDivisionName?: string;
  /** Render the indigo Milestone pill in the footer when true. */
  milestone?: boolean;
  /**
   * Mobile layout: when true, the status pills + meta sit in a right-hand
   * column beside the title/division (a shorter card) instead of stacked
   * below. Reverts to the stacked layout on desktop. Opt-in (tasks list only)
   * so other TaskCard usages keep the classic layout.
   */
  mobileSplit?: boolean;
  href?: string;
  className?: string;
};

export function TaskCard({
  taskId,
  refNumber,
  name,
  division,
  status,
  priority,
  jsPriorityLane,
  due,
  owner,
  subtasks,
  hasAttachment,
  primaryDivisionName,
  milestone,
  mobileSplit,
  href,
  className,
}: TaskCardProps) {
  const isJs = !!jsPriorityLane;
  const Wrapper: React.ElementType = href ? Link : 'article';
  const wrapperProps = href ? { href } : {};

  const priorityDot = cn('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[priority]);

  return (
    <Wrapper
      {...wrapperProps}
      data-task-id={taskId}
      className={cn(
        'relative bg-panel border border-line rounded-xl p-[13px] shadow-card',
        'transition-[color,border-color,box-shadow,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)]',
        'hover:border-ink-4 hover:-translate-y-px hover:shadow-card-hover active:translate-y-0 active:scale-[0.99]',
        'motion-reduce:transition-none motion-reduce:transform-none',
        'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        isJs && 'border-accent-line bg-gradient-to-b from-accent-tint to-panel',
        // Two columns on mobile when split; classic stacked card on desktop.
        mobileSplit ? 'flex items-start gap-3 md:block' : 'block',
        className,
      )}
    >
      {isJs ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-[14px] bottom-[14px] w-[3px] rounded-r bg-accent"
        />
      ) : null}

      {/* Identity: title block + division. `md:contents` lets it dissolve into
          the card's normal stacking on desktop. */}
      <div className={mobileSplit ? 'flex-1 min-w-0 md:contents' : 'contents'}>
        <header className="flex items-start justify-between gap-2.5 mb-2">
          <div className="flex-1 min-w-0">
            {refNumber ? (
              <span className="font-mono text-[10px] text-ink-3 tracking-wide">{refNumber}</span>
            ) : null}
            <h3 className="text-[14px] font-medium leading-[1.35] text-ink tracking-[-0.005em]">
              {name}
            </h3>
          </div>
          <span
            aria-label={`${priority} priority`}
            className={cn(priorityDot, 'mt-[5px]', mobileSplit && 'hidden md:block')}
          />
        </header>

        <p className="text-[11px] text-ink-3 mb-2 inline-flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: owner.colour }}
            aria-hidden="true"
          />
          {division.name}
        </p>
      </div>

      {/* Status + meta: a right-hand column on mobile when split, the footer row
          on desktop. */}
      <footer
        className={cn(
          mobileSplit
            ? 'shrink-0 max-w-[47%] flex flex-col items-end gap-1.5 md:max-w-none md:flex-row md:items-center md:justify-between'
            : 'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between',
        )}
      >
        {mobileSplit ? (
          <span aria-hidden="true" className={cn(priorityDot, 'md:hidden')} />
        ) : null}

        <div
          className={cn(
            mobileSplit
              ? 'flex flex-wrap justify-end gap-1 md:gap-1.5 md:justify-start md:items-center'
              : 'flex gap-1.5 flex-wrap',
          )}
        >
          <Pill variant="status" tone={status} label={STATUS_LABEL[status]} />
          {jsPriorityLane ? <Pill variant="js" lane={jsPriorityLane} /> : null}
          {milestone ? <Pill variant="milestone" /> : null}
          {primaryDivisionName ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-[3px] text-[10px] font-medium rounded-pill tracking-pill bg-primary-soft text-primary border border-primary-line/40"
              title="Cross-division task"
            >
              <i className="ti ti-route text-[10px]" aria-hidden="true" />
              Primary: {primaryDivisionName}
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            'flex items-center text-[11px] text-ink-3 shrink-0',
            mobileSplit
              ? 'flex-wrap justify-end gap-x-2 gap-y-1 md:flex-nowrap md:w-auto md:justify-end'
              : 'gap-2 w-full sm:w-auto sm:justify-end',
          )}
        >
          {hasAttachment ? (
            <i className="ti ti-paperclip text-[13px] text-ink-3" aria-hidden="true" title="Has attachment" />
          ) : null}

          {subtasks && subtasks.total > 0 ? (
            <span className="inline-flex items-center gap-[3px] bg-line-2 px-[7px] py-[2px] rounded-lg text-[10px]">
              <i className="ti ti-list-check text-[10px]" aria-hidden="true" />
              {subtasks.done}/{subtasks.total}
            </span>
          ) : null}

          {due && due.tone !== 'none' ? (
            <time
              className={cn(
                'font-medium',
                due.tone === 'overdue' && 'text-urgent',
                due.tone === 'today' && 'text-accent',
                (due.tone === 'soon' || due.tone === 'future') && 'text-ink-3 font-normal',
              )}
            >
              {due.label}
            </time>
          ) : null}

          <Avatar
            initials={owner.initials}
            colour={owner.colour}
            size="xs"
            ariaLabel={`Owner ${owner.name}`}
          />
        </div>
      </footer>
    </Wrapper>
  );
}

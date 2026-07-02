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
  name: string;
  division: { name: string };
  status: PillStatusTone;
  priority: PillPriorityTone;
  jsPriorityLane?: PillJsLane | null;
  milestone?: boolean;
  due?: { label: string; tone: 'today' | 'overdue' | 'soon' | 'future' | 'none' };
  owner: { initials: string; colour: string; name: string };
  subtasks?: { done: number; total: number };
  hasAttachment?: boolean;
  /** If set, render "Primary: <divisionName>" pill (cross-division indicator) */
  primaryDivisionName?: string;
  href?: string;
  className?: string;
};

export function TaskCard({
  taskId,
  name,
  division,
  status,
  priority,
  jsPriorityLane,
  milestone,
  due,
  owner,
  subtasks,
  hasAttachment,
  primaryDivisionName,
  href,
  className,
}: TaskCardProps) {
  const isJs = !!jsPriorityLane;
  const Wrapper: React.ElementType = href ? Link : 'article';
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      data-task-id={taskId}
      className={cn(
        'relative block bg-panel border border-line rounded-xl p-[13px] transition-colors',
        'hover:border-ink-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        isJs && 'border-accent-line bg-gradient-to-b from-[#fffdf7] to-white',
        className,
      )}
    >
      {isJs ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-[14px] bottom-[14px] w-[3px] rounded-r bg-accent"
        />
      ) : null}

      <header className="flex items-start justify-between gap-2.5 mb-2">
        <h3 className="text-[14px] font-medium leading-[1.35] text-ink tracking-[-0.005em] flex-1">
          {name}
        </h3>
        <span
          aria-label={`${priority} priority`}
          className={cn('w-2 h-2 rounded-full mt-[5px] shrink-0', PRIORITY_DOT[priority])}
        />
      </header>

      <p className="text-[11px] text-ink-3 mb-2">{division.name}</p>

      <footer className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
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

        <div className="flex items-center gap-2 text-[11px] text-ink-3 shrink-0">
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

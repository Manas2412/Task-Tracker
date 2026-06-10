import Link from 'next/link';

import { Avatar, Pill } from '@/components/ui';
import { initialsOf, formatDue } from '@/lib/format';
import { TASK_STATUS_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';

import { CreateTaskFromTfDialog } from './CreateTaskFromTfDialog';

import type { PillStatusTone } from '@/components/ui/Pill';

export type LinkedTaskRow = {
  id: string;
  name: string;
  status: string;
  priority: string;
  due: Date | null;
  owner: { name: string; divisionColour: string };
};

type LinkedTasksSectionProps = {
  tfId: string;
  refNo: string;
  defaultDueDate: string | null;
  markedTo: { id: string; name: string }[];
  linkedTasks: LinkedTaskRow[];
  canCreateTasks: boolean;
};

export function LinkedTasksSection({
  tfId,
  refNo,
  defaultDueDate,
  markedTo,
  linkedTasks,
  canCreateTasks,
}: LinkedTasksSectionProps) {
  const total = linkedTasks.length;
  const done = linkedTasks.filter((t) => t.status === 'completed').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section
      aria-labelledby="tf-linked"
      className="px-4 md:px-6 py-5 border-b border-line-2"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-label" id="tf-linked">
          Linked tasks{' '}
          {total > 0 ? (
            <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
              {done} of {total} complete
            </span>
          ) : null}
        </h2>
      </div>

      {total > 0 ? (
        <div
          className="h-1 bg-line-2 rounded-full overflow-hidden mb-3"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Linked task completion"
        >
          <div
            className="h-full bg-ink transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {total === 0 ? (
        <p className="text-[13px] text-ink-3 italic">
          No tasks linked yet
          {canCreateTasks ? ' — create one from this file using the button below.' : '.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linkedTasks.map((t) => (
            <LinkedTaskCard key={t.id} task={t} />
          ))}
        </ul>
      )}

      {canCreateTasks ? (
        <CreateTaskFromTfDialog
          tfId={tfId}
          refNo={refNo}
          defaultDueDate={defaultDueDate}
          divisions={markedTo}
        />
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------
// Linked task card
// ------------------------------------------------------------

function LinkedTaskCard({ task }: { task: LinkedTaskRow }) {
  const due = formatDue(task.due);
  const isCompleted = task.status === 'completed';

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        'block bg-panel border border-line rounded-xl p-3 transition-colors',
        'hover:border-ink-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        isCompleted && 'opacity-65',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p
          className={cn(
            'text-[13px] font-medium leading-snug',
            isCompleted ? 'line-through text-ink-3' : 'text-ink',
          )}
        >
          {task.name}
        </p>
        <span
          aria-label={`${task.priority} priority`}
          className={cn(
            'w-2 h-2 rounded-full mt-[5px] shrink-0',
            task.priority === 'urgent' && 'bg-urgent',
            task.priority === 'high' && 'bg-high',
            task.priority === 'medium' && 'bg-medium',
            task.priority === 'low' && 'bg-low',
          )}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Pill
          variant="status"
          tone={task.status as PillStatusTone}
          label={TASK_STATUS_LABEL[task.status] ?? task.status}
        />
        <div className="flex items-center gap-2 text-[11px] text-ink-3 shrink-0">
          {due.tone !== 'none' ? (
            <span
              className={cn(
                'font-medium',
                due.tone === 'overdue' && 'text-urgent',
                due.tone === 'today' && 'text-accent',
                (due.tone === 'soon' || due.tone === 'future') && 'text-ink-3 font-normal',
              )}
            >
              {due.label}
            </span>
          ) : null}
          <Avatar
            initials={initialsOf(task.owner.name)}
            colour={task.owner.divisionColour}
            size="xs"
            ariaLabel={`Owner ${task.owner.name}`}
          />
        </div>
      </div>
    </Link>
  );
}

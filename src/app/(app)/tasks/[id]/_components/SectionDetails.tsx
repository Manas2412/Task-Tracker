'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Avatar, Sheet, Switch } from '@/components/ui';
import {
  updateTaskFieldsAction,
  reassignTaskAction,
  resolveReassignmentAction,
} from '@/app/actions/tasks';
import {
  INITIAL_FIELDS_STATE,
  type UpdateFieldsState,
} from '@/app/actions/states';
import { initialsOf, formatDue } from '@/lib/format';
import { cn } from '@/lib/utils';

import { RecurrencePicker, humanRecurrence } from './RecurrencePicker';

type ReassignCandidate = {
  id: string;
  name: string;
  designation: string;
  divisionName: string;
  divisionColour: string;
};

type PendingReassignment = {
  id: string;
  proposedOwnerName: string;
  requestedByName: string;
  approverName: string;
  approverId: string;
  isApprover: boolean;
};

type SectionDetailsProps = {
  taskId: string;
  owner: { name: string; division: { avatarColour: string } };
  due: Date | null;
  divisionName: string;
  visibility: 'division' | 'personal';
  recurrence: string | null;
  milestone: boolean;
  reassignCandidates: ReassignCandidate[];
  pendingReassignment: PendingReassignment | null;
  canReassign: boolean;
};

const VISIBILITY_OPTIONS = [
  { value: 'division', label: 'Division', icon: 'ti-users', hint: 'Visible to your chain and division' },
  { value: 'personal', label: 'Personal', icon: 'ti-lock', hint: 'Visible only to you — not even superiors' },
] as const;

export function SectionDetails(props: SectionDetailsProps) {
  return (
    <section aria-labelledby="sec-details" className="px-4 md:px-6 py-5 border-b border-line-2">
      <h2 id="sec-details" className="section-label mb-3">
        Details
      </h2>

      {props.pendingReassignment ? (
        <PendingReassignmentBanner
          taskId={props.taskId}
          pending={props.pendingReassignment}
        />
      ) : null}

      <div className="flex flex-col">
        <OwnerRow
          taskId={props.taskId}
          owner={props.owner}
          candidates={props.reassignCandidates}
          canReassign={props.canReassign && !props.pendingReassignment}
        />

        <DueRow taskId={props.taskId} due={props.due} />

        <Row icon="ti-building" label="Division">
          <span>{props.divisionName}</span>
        </Row>

        <VisibilityRow taskId={props.taskId} visibility={props.visibility} />

        <MilestoneRow taskId={props.taskId} milestone={props.milestone} />

        <RecurrenceRow taskId={props.taskId} recurrence={props.recurrence} />
      </div>
    </section>
  );
}

function RecurrenceRow({
  taskId,
  recurrence,
}: {
  taskId: string;
  recurrence: string | null;
}) {
  const label = humanRecurrence(recurrence);
  return (
    <RecurrencePicker
      taskId={taskId}
      current={recurrence}
      trigger={
        <Row icon="ti-repeat" label="Recurrence" onClick={() => undefined}>
          <span className={cn(!recurrence && 'text-ink-3 font-normal')}>{label}</span>
        </Row>
      }
    />
  );
}

// ------------------------------------------------------------
// Owner row — clickable if canReassign; opens a user picker sheet
// ------------------------------------------------------------

function OwnerRow({
  taskId,
  owner,
  candidates,
  canReassign,
}: {
  taskId: string;
  owner: { name: string; division: { avatarColour: string } };
  candidates: ReassignCandidate[];
  canReassign: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [state, formAction] = useFormState(reassignTaskAction, INITIAL_FIELDS_STATE);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setSearch('');
    }
  }, [state.ok, state.epoch]);

  const filtered = search
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.designation.toLowerCase().includes(search.toLowerCase()) ||
          c.divisionName.toLowerCase().includes(search.toLowerCase()),
      )
    : candidates;

  if (!canReassign) {
    return (
      <Row icon="ti-user" label="Owner">
        <div className="inline-flex items-center gap-2">
          <Avatar
            initials={initialsOf(owner.name)}
            colour={owner.division.avatarColour}
            size="xs"
            ariaLabel={`Owner ${owner.name}`}
          />
          <span>{owner.name}</span>
        </div>
      </Row>
    );
  }

  return (
    <>
      <Row icon="ti-user" label="Owner" onClick={() => setOpen(true)}>
        <div className="inline-flex items-center gap-2">
          <Avatar
            initials={initialsOf(owner.name)}
            colour={owner.division.avatarColour}
            size="xs"
            ariaLabel={`Owner ${owner.name}`}
          />
          <span>{owner.name}</span>
        </div>
      </Row>

      <Sheet open={open} onClose={() => { setOpen(false); setSearch(''); }} title="Reassign task">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[14px] outline-none focus:border-ink"
          />

          {state.error ? (
            <p className="text-[12px] text-urgent">{state.error}</p>
          ) : null}

          <p className="text-[11px] text-ink-3">
            Downward reassignment is instant. Sideways or upward requires your supervisor&apos;s approval.
          </p>

          <ul className="max-h-[320px] overflow-y-auto flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <li className="py-6 text-center text-[13px] text-ink-3">No matches</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <form action={formAction}>
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="newOwnerId" value={c.id} />
                    <button
                      type="submit"
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-bg transition-colors"
                    >
                      <Avatar
                        initials={initialsOf(c.name)}
                        colour={c.divisionColour}
                        size="xs"
                        ariaLabel={c.name}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink truncate">{c.name}</p>
                        <p className="text-[11px] text-ink-3 truncate">{c.designation} · {c.divisionName}</p>
                      </div>
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </div>
      </Sheet>
    </>
  );
}

// ------------------------------------------------------------
// Pending reassignment banner — amber accent per the two-accent rule
// ------------------------------------------------------------

function PendingReassignmentBanner({
  taskId,
  pending,
}: {
  taskId: string;
  pending: PendingReassignment;
}) {
  const [state, formAction] = useFormState(resolveReassignmentAction, INITIAL_FIELDS_STATE);

  return (
    <div className="mb-3 p-3 rounded-lg border border-accent/30 bg-accent/5">
      <div className="flex items-start gap-2.5">
        <i className="ti ti-arrows-shuffle text-[16px] text-accent mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ink">
            Reassignment pending
          </p>
          <p className="text-[12px] text-ink-2 mt-0.5">
            {pending.requestedByName} requested to reassign to {pending.proposedOwnerName}.
            Waiting for {pending.approverName}&apos;s approval.
          </p>

          {state.error ? (
            <p className="text-[12px] text-urgent mt-1">{state.error}</p>
          ) : null}

          {pending.isApprover ? (
            <div className="flex gap-2 mt-2.5">
              <form action={formAction}>
                <input type="hidden" name="requestId" value={pending.id} />
                <input type="hidden" name="action" value="approve" />
                <ApproveBtn />
              </form>
              <form action={formAction}>
                <input type="hidden" name="requestId" value={pending.id} />
                <input type="hidden" name="action" value="reject" />
                <RejectBtn />
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ApproveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 rounded-md bg-ink text-white text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Approving…' : 'Approve'}
    </button>
  );
}

function RejectBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 disabled:opacity-60"
    >
      {pending ? 'Rejecting…' : 'Reject'}
    </button>
  );
}

// ------------------------------------------------------------
// Row primitive
// ------------------------------------------------------------

type RowProps = {
  icon: string;
  label: string;
  muted?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
};

function Row({ icon, label, muted, children, onClick }: RowProps) {
  const Wrapper: React.ElementType = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg text-left',
        onClick && 'hover:bg-bg transition-colors',
      )}
    >
      <i className={cn('ti', icon, 'text-[16px] text-ink-3 shrink-0 w-[18px]')} aria-hidden="true" />
      <span className="text-[13px] text-ink-2 w-[100px] shrink-0">{label}</span>
      <span
        className={cn(
          'flex-1 text-[13px] text-right font-medium',
          muted ? 'text-ink-3 font-normal' : 'text-ink',
        )}
      >
        {children}
      </span>
      {onClick ? (
        <i className="ti ti-chevron-right text-[14px] text-ink-4 shrink-0" aria-hidden="true" />
      ) : null}
    </Wrapper>
  );
}

// ------------------------------------------------------------
// Due row — inline date input in a small popover (uses Sheet)
// ------------------------------------------------------------

function DueRow({ taskId, due }: { taskId: string; due: Date | null }) {
  const [open, setOpen] = useState(false);
  const display = formatDue(due);
  const dateStr = due ? due.toISOString().slice(0, 10) : '';

  return (
    <>
      <Row
        icon="ti-calendar-event"
        label="Due"
        onClick={() => setOpen(true)}
      >
        <span
          className={cn(
            display.tone === 'overdue' && 'text-urgent',
            display.tone === 'today' && 'text-accent',
          )}
        >
          {display.tone === 'none' ? 'Add due date' : display.label}
        </span>
      </Row>

      <Sheet open={open} onClose={() => setOpen(false)} title="Set due date">
        <DueForm taskId={taskId} initial={dateStr} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function DueForm({
  taskId,
  initial,
  onDone,
}: {
  taskId: string;
  initial: string;
  onDone: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<UpdateFieldsState, FormData>(
    updateTaskFieldsAction,
    INITIAL_FIELDS_STATE,
  );

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="taskId" value={taskId} />
      <input
        type="date"
        name="dueDate"
        defaultValue={initial}
        autoFocus
        className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[14px] outline-none focus:border-ink"
      />
      {state.fieldErrors?.dueDate ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.dueDate}</p>
      ) : null}
      {state.error ? <p className="text-[11px] text-urgent">{state.error}</p> : null}
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => {
            // Submit empty to clear due date.
            if (!ref.current) return;
            const fd = new FormData();
            fd.set('taskId', taskId);
            fd.set('dueDate', '');
            (formAction as unknown as (fd: FormData) => void)(fd);
          }}
          className="px-3 py-2 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-2 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2"
        >
          Cancel
        </button>
        <SaveBtn />
      </div>
    </form>
  );
}

// ------------------------------------------------------------
// Visibility row — sheet with two options
// ------------------------------------------------------------

function VisibilityRow({
  taskId,
  visibility,
}: {
  taskId: string;
  visibility: 'division' | 'personal';
}) {
  const [open, setOpen] = useState(false);
  const current = VISIBILITY_OPTIONS.find((v) => v.value === visibility)!;
  const [chosen, setChosen] = useState(visibility);
  const [state, formAction] = useFormState<UpdateFieldsState, FormData>(
    updateTaskFieldsAction,
    INITIAL_FIELDS_STATE,
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  useEffect(() => {
    if (open) setChosen(visibility);
  }, [open, visibility]);

  return (
    <>
      <Row icon="ti-users" label="Visibility" onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-1.5">
          <i className={cn('ti', current.icon, 'text-[13px]')} aria-hidden="true" />
          {current.label}
        </span>
      </Row>

      <Sheet open={open} onClose={() => setOpen(false)} title="Who can see this task?">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="visibility" value={chosen} />

          <div className="flex flex-col gap-1" role="radiogroup">
            {VISIBILITY_OPTIONS.map((v) => {
              const active = chosen === v.value;
              return (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChosen(v.value)}
                  className={cn(
                    'flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors',
                    active ? 'bg-primary-soft' : 'hover:bg-bg',
                  )}
                >
                  <i
                    className={cn(
                      'ti',
                      v.icon,
                      'text-[18px] mt-0.5',
                      active ? 'text-primary' : 'text-ink-2',
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <div className="text-[14px] font-medium text-ink">{v.label}</div>
                    <div className="text-[12px] text-ink-3 mt-0.5">{v.hint}</div>
                  </div>
                  {active ? (
                    <span className="w-5 h-5 grid place-items-center rounded-full bg-ink text-white shrink-0">
                      <i className="ti ti-check text-[12px]" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {state.error ? <p className="text-[12px] text-urgent">{state.error}</p> : null}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-3 rounded-lg border border-line text-[14px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <SaveBtn />
          </div>
        </form>
      </Sheet>
    </>
  );
}

// ------------------------------------------------------------
// Milestone row — inline switch fires its own action
// ------------------------------------------------------------

function MilestoneRow({ taskId, milestone }: { taskId: string; milestone: boolean }) {
  const [state, formAction] = useFormState<UpdateFieldsState, FormData>(
    updateTaskFieldsAction,
    INITIAL_FIELDS_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [optimistic, setOptimistic] = useState(milestone);

  useEffect(() => {
    setOptimistic(milestone);
  }, [milestone]);

  return (
    <form action={formAction} ref={formRef} className="flex items-center gap-3 py-2.5">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="milestone" value={optimistic ? 'on' : ''} />

      <i className="ti ti-flag-3 text-[16px] text-accent shrink-0 w-[18px]" aria-hidden="true" />
      <span className="text-[13px] text-ink-2 w-[100px] shrink-0">Milestone</span>
      <span className="flex-1 text-right">
        <Switch
          checked={optimistic}
          ariaLabel="Mark as milestone"
          onChange={(next) => {
            setOptimistic(next);
            // Submit immediately.
            queueMicrotask(() => formRef.current?.requestSubmit());
          }}
        />
      </span>
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2 px-3 rounded-md bg-ink text-white text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

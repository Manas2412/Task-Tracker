'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import Link from 'next/link';

import { Avatar, Sheet, UserPicker, type UserPickerOption } from '@/components/ui';
import {
  addCollaboratorAction,
  removeCollaboratorAction,
} from '@/app/actions/tasks';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

export type CollaboratorRow = {
  id: string;
  userId: string;
  name: string;
  designation: string;
  role: 'collaborator' | 'division_lead' | 'co_owner';
  division: { name: string; avatarColour: string };
};

export type Candidate = {
  id: string;
  name: string;
  designation: string;
  divisionName: string;
  divisionColour?: string;
};

export type SubtaskScope = {
  id: string;
  name: string;
};

type CollaboratorsSectionProps = {
  taskId: string;
  collaborators: CollaboratorRow[];
  candidates: Candidate[];
  canEdit: boolean;
  canViewProfiles: boolean;
  subtasks?: SubtaskScope[];
};

const ROLE_LABEL: Record<CollaboratorRow['role'], string> = {
  collaborator: 'Collaborator',
  division_lead: 'Division lead',
  co_owner: 'Co-owner',
};

const ROLE_TONE: Record<CollaboratorRow['role'], string> = {
  collaborator: 'text-ink-3',
  division_lead: 'text-accent',
  co_owner: 'text-primary',
};

export function CollaboratorsSection({
  taskId,
  collaborators,
  candidates,
  canEdit,
  canViewProfiles,
  subtasks,
}: CollaboratorsSectionProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section
      aria-labelledby="sec-collab"
      className="px-4 md:px-6 py-5 border-b border-line-2"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-label" id="sec-collab">
          Collaborators
          <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
            {collaborators.length} {collaborators.length === 1 ? 'person' : 'people'}
          </span>
        </h2>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-user-plus text-[13px]" aria-hidden="true" />
            Add
          </button>
        ) : null}
      </div>

      {collaborators.length === 0 ? (
        <p className="text-[13px] text-ink-3 italic">
          No collaborators yet.{' '}
          {canEdit ? 'Tap Add to share this with people from any division.' : ''}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {collaborators.map((c) => (
            <CollaboratorChip
              key={c.id}
              taskId={taskId}
              row={c}
              canEdit={canEdit}
              canViewProfile={canViewProfiles}
            />
          ))}
        </ul>
      )}

      {canEdit ? (
        <AddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          taskId={taskId}
          candidates={candidates}
          alreadyAdded={collaborators.map((c) => c.userId)}
          subtasks={subtasks}
        />
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------
// Chip
// ------------------------------------------------------------

function CollaboratorChip({
  taskId,
  row,
  canEdit,
  canViewProfile,
}: {
  taskId: string;
  row: CollaboratorRow;
  canEdit: boolean;
  canViewProfile: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!confirm(`Remove ${row.name} from this task?`)) return;
    const fd = new FormData();
    fd.set('taskId', taskId);
    fd.set('userId', row.userId);
    startTransition(async () => {
      const result = await removeCollaboratorAction(undefined, fd);
      if (!result.ok && result.error) alert(result.error);
    });
  };

  return (
    <li
      className={cn(
        'inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full bg-bg border border-line',
        pending && 'opacity-60',
      )}
    >
      <Avatar
        initials={initialsOf(row.name)}
        colour={row.division.avatarColour}
        size="xs"
        ariaLabel={row.name}
      />
      {canViewProfile ? (
        <Link href={`/users/${row.userId}`} className="text-[11px] text-ink hover:underline">
          {row.name}
        </Link>
      ) : (
        <span className="text-[11px] text-ink">{row.name}</span>
      )}
      <span className={cn('text-[10px]', ROLE_TONE[row.role])}>
        · {ROLE_LABEL[row.role]}
      </span>
      {canEdit ? (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={`Remove ${row.name}`}
          className="w-5 h-5 grid place-items-center rounded-full text-ink-3 hover:bg-line-2 hover:text-ink"
        >
          <i className="ti ti-x text-[12px]" aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------
// Add dialog
// ------------------------------------------------------------

const ROLE_OPTIONS = [
  { value: 'collaborator', label: 'Collaborator', sub: 'Comment + status change' },
  { value: 'division_lead', label: 'Division lead', sub: 'One per participating division' },
  { value: 'co_owner', label: 'Co-owner', sub: 'Equal accountability (max 3)' },
] as const;

function AddDialog({
  open,
  onClose,
  taskId,
  candidates,
  alreadyAdded,
  subtasks,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  candidates: Candidate[];
  alreadyAdded: string[];
  subtasks?: SubtaskScope[];
}) {
  const [state, formAction] = useFormState(addCollaboratorAction, {
    ok: false,
    epoch: 0,
  });
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]['value']>('collaborator');
  const [scopeId, setScopeId] = useState('');

  useEffect(() => {
    if (state.ok) {
      onClose();
      setUserId('');
      setRole('collaborator');
      setScopeId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const available = candidates.filter((c) => !alreadyAdded.includes(c.id));
  const pickerOptions: UserPickerOption[] = available.map((c) => ({
    id: c.id,
    name: c.name,
    designation: c.designation,
    divisionName: c.divisionName,
    divisionColour: c.divisionColour,
  }));

  const targetTaskId = scopeId || taskId;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add collaborator"
      subtitle="They get notified and can comment / change status."
    >
      {open ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="taskId" value={targetTaskId} />

          {subtasks && subtasks.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-ink-2">Scope</span>
              <select
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none transition-colors appearance-none focus:border-ink"
              >
                <option value="">Entire task</option>
                {subtasks.map((s) => (
                  <option key={s.id} value={s.id}>
                    Subtask: {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">Person</span>
            {available.length === 0 ? (
              <p className="text-[12px] text-ink-3 italic px-2 py-3 rounded-lg border border-dashed border-line text-center">
                Everyone is already added. Super Admin can create more users from the
                Users sub-section.
              </p>
            ) : (
              <UserPicker
                options={pickerOptions}
                value={userId}
                onChange={setUserId}
                placeholder="Search by name or designation…"
                name="userId"
                error={!!state.fieldErrors?.userId}
              />
            )}
            {state.fieldErrors?.userId ? (
              <span className="text-[11px] text-urgent">{state.fieldErrors.userId}</span>
            ) : null}
          </label>

          <fieldset className="mt-1">
            <legend className="text-[11px] font-medium text-ink-2 mb-1.5">Role</legend>
            <input type="hidden" name="role" value={role} />
            <div className="flex flex-col gap-1" role="radiogroup">
              {ROLE_OPTIONS.map((o) => {
                const active = role === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRole(o.value)}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      active ? 'bg-primary-soft' : 'hover:bg-bg',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'w-4 h-4 rounded-full border mt-0.5 shrink-0',
                        active ? 'border-primary' : 'border-ink-4',
                      )}
                    >
                      {active ? (
                        <span className="block w-2 h-2 rounded-full bg-primary m-[3px]" />
                      ) : null}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'block text-[13px] font-medium',
                          active ? 'text-primary' : 'text-ink',
                        )}
                      >
                        {o.label}
                      </span>
                      <span className="block text-[11px] text-ink-3 mt-0.5">{o.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {state.error ? (
            <p
              role="alert"
              className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <AddButton disabled={available.length === 0 || !userId} />
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}

function AddButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Adding…' : 'Add'}
    </button>
  );
}

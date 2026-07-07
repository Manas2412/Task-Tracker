'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Avatar, Sheet } from '@/components/ui';
import { transferTaskAction } from '@/app/actions/tasks';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

type TransferCandidate = {
  id: string;
  name: string;
  designation: string;
  divisionName: string;
  divisionColour: string;
  /** 'Super Admin' | 'Division head' | null */
  badge: string | null;
};

type TransferTaskButtonProps = {
  taskId: string;
  candidates: TransferCandidate[];
};

/** One-tap reasons for the hand-off note; users can still type their own. */
const COMMENT_PRESETS = [
  'On leave',
  'This work belongs to another official',
  'Delegating it',
] as const;

export function TransferTaskButton({ taskId, candidates }: TransferTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [state, formAction] = useFormState(transferTaskAction, { ok: false, epoch: 0 });

  const close = () => {
    setOpen(false);
    setSearch('');
    setSelectedId(null);
    setComment('');
  };

  useEffect(() => {
    if (state.ok) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const filtered = search
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.designation.toLowerCase().includes(search.toLowerCase()) ||
          c.divisionName.toLowerCase().includes(search.toLowerCase()),
      )
    : candidates;

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 text-left transition-colors hover:border-ink-4 hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-white">
          <i className="ti ti-transfer text-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-ink">Transfer this task</span>
          <span className="mt-0.5 block text-[12px] text-ink-3">
            Hand it to another official — a short note is required
          </span>
        </span>
        <i
          className="ti ti-chevron-right shrink-0 text-[18px] text-ink-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>

      <Sheet open={open} onClose={close} title="Transfer task">
        {open ? (
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="targetUserId" value={selectedId ?? ''} />

            <p className="text-[12px] text-ink-3">
              Transfer to a user in your division, your division head, or Super
              Admin. A comment explaining the hand-off is required. You will no
              longer be the owner.
            </p>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[14px] outline-none focus:border-ink"
            />

            {state.error ? (
              <p role="alert" className="text-[12px] text-urgent">{state.error}</p>
            ) : null}

            <ul className="max-h-[240px] overflow-y-auto flex flex-col gap-0.5" role="listbox" aria-label="Transfer to">
              {filtered.length === 0 ? (
                <li className="py-6 text-center text-[13px] text-ink-3">No matches</li>
              ) : (
                filtered.map((c) => {
                  const isSelected = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => setSelectedId(isSelected ? null : c.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border',
                          isSelected
                            ? 'border-ink bg-bg'
                            : 'border-transparent hover:bg-bg',
                        )}
                      >
                        <Avatar
                          initials={initialsOf(c.name)}
                          colour={c.divisionColour}
                          size="xs"
                          ariaLabel={c.name}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-ink truncate">
                            {c.name}
                          </span>
                          <span className="block text-[11px] text-ink-3 truncate">
                            {c.designation} · {c.divisionName}
                          </span>
                        </span>
                        {c.badge ? (
                          <span className="shrink-0 text-[10px] font-medium text-primary bg-primary-soft border border-primary-line/40 px-1.5 py-0.5 rounded">
                            {c.badge}
                          </span>
                        ) : null}
                        {isSelected ? (
                          <i className="ti ti-check text-[15px] text-ink shrink-0" aria-hidden="true" />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-ink-2">
                Comment <span className="text-urgent">(required)</span>
              </span>

              {/* One-tap reasons — pick one or type your own below. */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick reasons">
                {COMMENT_PRESETS.map((preset) => {
                  const isActive = comment.trim() === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setComment(preset)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11.5px] font-medium transition-colors',
                        isActive
                          ? 'border-ink bg-ink text-white'
                          : 'border-line bg-panel text-ink-2 hover:border-ink-4 hover:text-ink',
                      )}
                    >
                      {isActive ? (
                        <i className="ti ti-check text-[12px]" aria-hidden="true" />
                      ) : null}
                      {preset}
                    </button>
                  );
                })}
              </div>

              <label className="sr-only" htmlFor="transfer-comment">
                Comment
              </label>
              <textarea
                id="transfer-comment"
                name="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Why is this task being handed off?"
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-panel text-[13px] outline-none resize-none transition-colors',
                  state.fieldErrors?.comment ? 'border-urgent' : 'border-line focus:border-ink',
                )}
              />
              {state.fieldErrors?.comment ? (
                <span className="text-[11px] text-urgent">{state.fieldErrors.comment}</span>
              ) : null}
            </div>

            <TransferSubmit
              disabled={!selectedId || comment.trim().length === 0}
              targetName={selected?.name ?? null}
            />
          </form>
        ) : null}
      </Sheet>
    </>
  );
}

function TransferSubmit({ disabled, targetName }: { disabled: boolean; targetName: string | null }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-50 transition-opacity"
    >
      {pending
        ? 'Transferring…'
        : targetName
          ? `Transfer to ${targetName}`
          : 'Pick a person to transfer to'}
    </button>
  );
}

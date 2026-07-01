'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Avatar, Sheet } from '@/components/ui';
import { transferTaskAction } from '@/app/actions/tasks';
import { initialsOf } from '@/lib/format';

type TransferCandidate = {
  id: string;
  name: string;
  designation: string;
  divisionColour: string;
};

type TransferTaskButtonProps = {
  taskId: string;
  candidates: TransferCandidate[];
};

export function TransferTaskButton({ taskId, candidates }: TransferTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [state, formAction] = useFormState(transferTaskAction, { ok: false, epoch: 0 });

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
          c.designation.toLowerCase().includes(search.toLowerCase()),
      )
    : candidates;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
      >
        <i className="ti ti-transfer text-[14px]" aria-hidden="true" />
        Transfer task
      </button>

      <Sheet open={open} onClose={() => { setOpen(false); setSearch(''); }} title="Transfer task">
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-ink-3">
            Transfer this task to another user in the same division. You will no longer be the owner.
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
            <p className="text-[12px] text-urgent">{state.error}</p>
          ) : null}

          <ul className="max-h-[320px] overflow-y-auto flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <li className="py-6 text-center text-[13px] text-ink-3">No matches</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <form action={formAction}>
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="targetUserId" value={c.id} />
                    <TransferButton candidate={c} />
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

function TransferButton({ candidate }: { candidate: TransferCandidate }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-bg transition-colors disabled:opacity-60"
    >
      <Avatar
        initials={initialsOf(candidate.name)}
        colour={candidate.divisionColour}
        size="xs"
        ariaLabel={candidate.name}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink truncate">{candidate.name}</p>
        <p className="text-[11px] text-ink-3 truncate">{candidate.designation}</p>
      </div>
    </button>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { format } from 'date-fns';

import { Sheet } from '@/components/ui';
import { updateTimelineFileFieldsAction } from '@/app/actions/timeline-files';
import { daysUntil } from '@/lib/format';
import { cn } from '@/lib/utils';

type TfDeadlineEditorProps = {
  tfId: string;
  deadlineDate: Date | null;
  canEdit: boolean;
};

/**
 * "Deadline" detail row with inline edit — tappable row opens a Sheet
 * with a date input, mirroring the Tasks due-date row pattern.
 */
export function TfDeadlineEditor({ tfId, deadlineDate, canEdit }: TfDeadlineEditorProps) {
  const [open, setOpen] = useState(false);
  const days = deadlineDate ? daysUntil(deadlineDate) : null;
  const isOverdue = days !== null && days < 0;
  const dateStr = deadlineDate ? deadlineDate.toISOString().slice(0, 10) : '';

  const display = deadlineDate ? (
    <span className={cn(isOverdue && 'text-urgent')}>
      {format(deadlineDate, 'd LLL yyyy')}{' '}
      {days !== null ? (
        <span className="text-ink-3 text-[11px] font-normal">
          (
          {days < 0
            ? `${Math.abs(days)} d overdue`
            : days === 0
              ? 'today'
              : `in ${days} d`}
          )
        </span>
      ) : null}
    </span>
  ) : (
    <span className="text-ink-3 italic">{canEdit ? 'Add deadline' : 'No deadline'}</span>
  );

  if (!canEdit) {
    return (
      <Row icon="ti-clock" label="Deadline">
        {display}
      </Row>
    );
  }

  return (
    <>
      <Row icon="ti-clock" label="Deadline" onClick={() => setOpen(true)}>
        {display}
      </Row>
      <Sheet open={open} onClose={() => setOpen(false)} title="Set deadline">
        <DeadlineForm tfId={tfId} initial={dateStr} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function DeadlineForm({
  tfId,
  initial,
  onDone,
}: {
  tfId: string;
  initial: string;
  onDone: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(updateTimelineFileFieldsAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={tfId} />
      <input
        type="date"
        name="deadlineDate"
        defaultValue={initial}
        autoFocus
        className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[14px] outline-none focus:border-ink"
      />
      {state.fieldErrors?.deadlineDate ? (
        <p className="text-[11px] text-urgent">{state.fieldErrors.deadlineDate}</p>
      ) : null}
      {state.error ? <p className="text-[11px] text-urgent">{state.error}</p> : null}
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => {
            if (!ref.current) return;
            const fd = new FormData();
            fd.set('id', tfId);
            fd.set('deadlineDate', '');
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

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2 rounded-md bg-ink text-white text-[12px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

function Row({
  icon,
  label,
  onClick,
  children,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const Wrapper: React.ElementType = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full',
        onClick && '-mx-2 rounded-lg px-2 py-0.5 text-left hover:bg-bg transition-colors',
      )}
    >
      <i className={cn('ti', icon, 'text-[16px] text-ink-3 shrink-0 w-[18px]')} aria-hidden="true" />
      <span className="text-[13px] text-ink-2 w-[100px] shrink-0">{label}</span>
      <span className="flex-1 text-[13px] text-right font-medium text-ink">{children}</span>
      {onClick ? (
        <i className="ti ti-chevron-right text-[14px] text-ink-4 shrink-0" aria-hidden="true" />
      ) : null}
    </Wrapper>
  );
}

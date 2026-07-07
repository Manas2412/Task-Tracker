'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import {
  clearAllNotificationsForAllUsersAction,
  clearAllActivityTrailsAction,
  type BulkClearState,
} from '@/app/actions/admin-audit';
import { cn } from '@/lib/utils';

const INITIAL: BulkClearState = { ok: false, epoch: 0 };

type ClearAction = (
  prev: BulkClearState | undefined,
  formData: FormData,
) => Promise<BulkClearState>;

/**
 * Super Admin bulk-clear controls on the Audit Trail page. Each button opens
 * a confirmation before running an irreversible, system-wide delete.
 */
export function AuditDangerZone() {
  return (
    <section
      aria-labelledby="danger-zone"
      className="mt-8 rounded-xl border border-urgent/25 bg-urgent-soft/40 p-4 md:p-5"
    >
      <h2
        id="danger-zone"
        className="text-[13px] font-medium text-urgent flex items-center gap-1.5"
      >
        <i className="ti ti-alert-triangle text-[15px]" aria-hidden="true" />
        Danger zone
      </h2>
      <p className="text-[12px] text-ink-3 mt-1 mb-4">
        System-wide and irreversible. Neither affects the audit trail above.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ClearCard
          action={clearAllNotificationsForAllUsersAction}
          icon="ti-bell"
          title="Clear all notifications"
          desc="Delete every notification for every user."
          confirmBody="This permanently deletes every notification for all users. It cannot be undone."
          cta="Clear notifications"
          noun="notifications"
        />
        <ClearCard
          action={clearAllActivityTrailsAction}
          icon="ti-history"
          title="Clear all activity trails"
          desc="Delete every task and Timeline File activity event."
          confirmBody="This permanently deletes the activity trail on every task and Timeline File, for all users. The audit trail above is not affected, and it cannot be undone."
          cta="Clear activity trails"
          noun="activity events"
        />
      </div>
    </section>
  );
}

function ClearCard({
  action,
  icon,
  title,
  desc,
  confirmBody,
  cta,
  noun,
}: {
  action: ClearAction;
  icon: string;
  title: string;
  desc: string;
  confirmBody: string;
  cta: string;
  noun: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.ok) setConfirming(false);
  }, [state.ok, state.epoch]);

  return (
    <div className="rounded-lg border border-line bg-panel p-3.5 flex flex-col">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 w-8 h-8 shrink-0 grid place-items-center rounded-full bg-urgent-soft text-urgent">
          <i className={cn('ti', icon, 'text-[16px]')} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">{title}</p>
          <p className="text-[11.5px] text-ink-3 leading-relaxed">{desc}</p>
        </div>
      </div>

      {state.ok ? (
        <p
          role="status"
          className="mt-2.5 text-[12px] text-success font-medium inline-flex items-center gap-1"
        >
          <i className="ti ti-check text-[13px]" aria-hidden="true" />
          Cleared {state.count ?? 0} {noun}.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2.5 text-[12px] text-urgent">
          {state.error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-3 w-full py-2 rounded-lg border border-urgent/30 text-urgent text-[12.5px] font-medium hover:bg-urgent hover:text-white transition-colors"
      >
        {cta}
      </button>

      {confirming ? (
        <ConfirmOverlay
          title={`${title}?`}
          body={confirmBody}
          cta={cta}
          formAction={formAction}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

function ConfirmOverlay({
  title,
  body,
  cta,
  formAction,
  onCancel,
}: {
  title: string;
  body: string;
  cta: string;
  formAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-panel rounded-2xl border border-line shadow-2xl w-full max-w-[420px] mx-4 p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="mt-0.5 w-9 h-9 shrink-0 grid place-items-center rounded-full bg-urgent-soft text-urgent">
            <i className="ti ti-alert-triangle text-[18px]" aria-hidden="true" />
          </span>
          <h3 className="font-serif text-[18px] text-ink leading-snug">{title}</h3>
        </div>
        <p className="text-[12.5px] text-ink-2 leading-relaxed mb-4">{body}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
          >
            Cancel
          </button>
          <form action={formAction} className="flex-1">
            <ConfirmSubmit cta={cta} />
          </form>
        </div>
      </div>
    </div>
  );
}

function ConfirmSubmit({ cta }: { cta: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 rounded-lg bg-urgent text-white text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Clearing…' : cta}
    </button>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { purgeMockDataAction } from '@/app/actions/settings';
import { cn } from '@/lib/utils';

const CONFIRMATION_PHRASE = 'PURGE MOCK DATA';

export function CutoverCard() {
  const [armed, setArmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(purgeMockDataAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setArmed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <section className="bg-panel border border-urgent/30 rounded-2xl overflow-hidden">
      <header className="px-5 pt-5 pb-3 border-b border-line-2">
        <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-urgent mb-1 inline-flex items-center gap-1">
          <i className="ti ti-alert-triangle text-[11px]" aria-hidden="true" />
          Destructive
        </p>
        <h2 className="font-serif text-[18px] md:text-[20px] leading-tight text-ink">
          Cutover to operational mode
        </h2>
        <p className="text-[12px] text-ink-2 mt-1.5 leading-relaxed">
          Purges every user (except you), division (except yours and its parents),
          task, Timeline File, attachment, notification, and tag. The audit trail
          itself is preserved and gains a single &ldquo;operational_cutover&rdquo;
          marker.
        </p>
      </header>

      <div className="p-5">
        {state.ok && state.deletedCounts ? (
          <SuccessSummary counts={state.deletedCounts} />
        ) : !armed ? (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-urgent/30 text-urgent text-[13px] font-medium hover:bg-urgent-soft transition-colors"
          >
            <i className="ti ti-flame text-[14px]" aria-hidden="true" />
            Arm cutover
          </button>
        ) : (
          <form ref={formRef} action={formAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ink leading-relaxed">
                To proceed, type{' '}
                <span className="font-mono text-[11px] bg-urgent-soft text-urgent px-1.5 py-0.5 rounded border border-urgent/20">
                  {CONFIRMATION_PHRASE}
                </span>{' '}
                in the field below, then press <strong>Purge</strong>.
              </span>
              <input
                name="confirmation"
                type="text"
                autoComplete="off"
                autoFocus
                placeholder={CONFIRMATION_PHRASE}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] font-mono text-ink outline-none transition-colors',
                  state.fieldErrors?.confirmation
                    ? 'border-urgent focus:border-urgent'
                    : 'border-line focus:border-ink',
                )}
              />
              {state.fieldErrors?.confirmation ? (
                <span className="text-[11px] text-urgent">
                  {state.fieldErrors.confirmation}
                </span>
              ) : null}
            </label>

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
                onClick={() => setArmed(false)}
                className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
              >
                Stand down
              </button>
              <PurgeButton />
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function PurgeButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-urgent text-white text-[13px] font-medium disabled:opacity-60 hover:bg-urgent/90"
    >
      {pending ? 'Purging…' : 'Purge'}
    </button>
  );
}

function SuccessSummary({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="bg-success-soft border border-success/30 rounded-lg p-4">
      <p className="text-[13px] font-medium text-success mb-2 inline-flex items-center gap-1.5">
        <i className="ti ti-circle-check text-[15px]" aria-hidden="true" />
        Cutover complete — {total} {total === 1 ? 'row' : 'rows'} removed.
      </p>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-ink-2">
        {Object.entries(counts)
          .filter(([, n]) => n > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([key, n]) => (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-3">{key.replace(/_/g, ' ')}</dt>
              <dd className="font-medium text-ink">{n}</dd>
            </div>
          ))}
      </dl>
      <p className="text-[11px] text-ink-3 mt-3 leading-relaxed">
        Your account, division, and the audit log are preserved. Go live by
        creating real divisions and users from{' '}
        <strong>Structure &amp; hierarchy</strong> and <strong>Users</strong>.
      </p>
    </div>
  );
}

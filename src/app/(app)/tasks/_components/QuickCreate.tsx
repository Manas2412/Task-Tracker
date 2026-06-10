'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import {
  FloatingActionButton,
  PrimaryAction,
} from '@/components/layout';
import { Sheet, Switch } from '@/components/ui';
import { createTaskAction } from '@/app/actions/tasks';
import {
  INITIAL_CREATE_STATE,
  type CreateTaskState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

/**
 * Quick Create — turn B of Phase 1.
 *
 * Architecture:
 *   - QuickCreateProvider owns the open/close state and renders the Sheet.
 *   - QuickCreateFab + QuickCreatePrimary are thin trigger buttons that
 *     pull `open()` from the context. They can sit anywhere in the page
 *     tree without prop-drilling.
 *   - QuickCreateForm uses useFormState. On state.ok we close the sheet
 *     and revalidatePath('/tasks') (server-side) brings the new task in.
 *
 * Form fields per PRD §5.1 — name (required) + Add more details expander
 * for description, due date, priority, visibility, milestone. Owner and
 * division default to the caller. Recurrence + collaborators + attachments
 * arrive in later turns when there's more data to wire to.
 */

// ------------------------------------------------------------
// Context
// ------------------------------------------------------------

type QuickCreateContextValue = {
  open: () => void;
};

const QuickCreateContext = createContext<QuickCreateContextValue | null>(null);

function useQuickCreate(): QuickCreateContextValue {
  const ctx = useContext(QuickCreateContext);
  if (!ctx) throw new Error('useQuickCreate must be used inside QuickCreateProvider');
  return ctx;
}

// ------------------------------------------------------------
// Provider
// ------------------------------------------------------------

type ProviderProps = {
  defaultDivisionId: string;
  children: ReactNode;
};

export function QuickCreateProvider({ defaultDivisionId, children }: ProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  return (
    <QuickCreateContext.Provider value={{ open }}>
      {children}

      <Sheet open={isOpen} onClose={close} title="Quick create">
        {/* Mount fresh on every open so useFormState resets. */}
        {isOpen ? (
          <QuickCreateForm onSuccess={close} defaultDivisionId={defaultDivisionId} />
        ) : null}
      </Sheet>
    </QuickCreateContext.Provider>
  );
}

// ------------------------------------------------------------
// Triggers
// ------------------------------------------------------------

export function QuickCreateFab() {
  const { open } = useQuickCreate();
  return (
    <div className="md:hidden">
      <FloatingActionButton onClick={open} />
    </div>
  );
}

export function QuickCreatePrimary() {
  const { open } = useQuickCreate();
  return <PrimaryAction onClick={open} />;
}

// ------------------------------------------------------------
// Form
// ------------------------------------------------------------

type FormProps = {
  onSuccess: () => void;
  defaultDivisionId: string;
};

const PRIORITIES = [
  { value: 'low', label: 'Low', tone: 'text-low' },
  { value: 'medium', label: 'Medium', tone: 'text-medium' },
  { value: 'high', label: 'High', tone: 'text-high' },
  { value: 'urgent', label: 'Urgent', tone: 'text-urgent' },
] as const;

const VISIBILITIES = [
  { value: 'division', label: 'Division', icon: 'ti-users' },
  { value: 'personal', label: 'Personal', icon: 'ti-lock' },
] as const;

function QuickCreateForm({ onSuccess, defaultDivisionId }: FormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<CreateTaskState, FormData>(
    createTaskAction,
    INITIAL_CREATE_STATE,
  );

  const [showMore, setShowMore] = useState(false);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]['value']>('low');
  const [visibility, setVisibility] =
    useState<(typeof VISIBILITIES)[number]['value']>('division');

  // Close on successful save. `epoch` ensures successive successes re-fire.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="divisionId" value={defaultDivisionId} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="visibility" value={visibility} />

      {/* Name — the only required field */}
      <div>
        <label htmlFor="qc-name" className="sr-only">
          Task name
        </label>
        <input
          id="qc-name"
          name="name"
          type="text"
          autoComplete="off"
          autoFocus
          placeholder="Task name…"
          className={cn(
            'w-full px-3.5 py-3.5 rounded-lg border bg-panel',
            'text-[16px] font-medium text-ink outline-none',
            'placeholder:text-ink-3 placeholder:font-normal',
            state.fieldErrors?.name
              ? 'border-urgent focus:border-urgent'
              : 'border-line focus:border-ink',
          )}
          aria-invalid={!!state.fieldErrors?.name}
          aria-describedby={state.fieldErrors?.name ? 'qc-name-error' : undefined}
          maxLength={200}
        />
        {state.fieldErrors?.name ? (
          <p id="qc-name-error" className="text-[11px] text-urgent mt-1">
            {state.fieldErrors.name}
          </p>
        ) : null}
      </div>

      {/* Add more details toggle */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
        aria-controls="qc-more"
        className="flex items-center gap-2 py-2 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors"
      >
        <i
          className={cn(
            'ti ti-chevron-down text-[15px] transition-transform',
            showMore && 'rotate-180',
          )}
          aria-hidden="true"
        />
        Add more details
      </button>

      {/* Collapsible details */}
      <div
        id="qc-more"
        className={cn(
          'overflow-hidden transition-[max-height,opacity] duration-300',
          showMore ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="flex flex-col gap-3.5 pb-1">
          {/* Description */}
          <Field label="Description">
            <textarea
              name="description"
              rows={3}
              placeholder="Add context, links, background notes…"
              className="w-full px-3 py-2.5 rounded-lg border border-line bg-panel text-[14px] text-ink outline-none focus:border-ink resize-none"
              maxLength={2000}
            />
          </Field>

          {/* Due date */}
          <Field label="Due date" error={state.fieldErrors?.dueDate}>
            <input
              name="dueDate"
              type="date"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-panel text-[14px] text-ink outline-none focus:border-ink',
                state.fieldErrors?.dueDate ? 'border-urgent' : 'border-line',
              )}
            />
          </Field>

          {/* Priority segmented */}
          <Field label="Priority">
            <div
              role="radiogroup"
              aria-label="Priority"
              className="grid grid-cols-4 gap-1 p-[3px] bg-line-2 rounded-[10px]"
            >
              {PRIORITIES.map((p) => {
                const isActive = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      'py-2 text-[11px] font-medium rounded-md transition-colors',
                      isActive
                        ? cn('bg-panel shadow-sm', p.tone)
                        : 'text-ink-2 hover:text-ink',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Visibility segmented */}
          <Field label="Visibility">
            <div
              role="radiogroup"
              aria-label="Visibility"
              className="grid grid-cols-2 gap-1 p-[3px] bg-line-2 rounded-[10px]"
            >
              {VISIBILITIES.map((v) => {
                const isActive = visibility === v.value;
                return (
                  <button
                    key={v.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setVisibility(v.value)}
                    className={cn(
                      'py-2 text-[12px] font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5',
                      isActive ? 'bg-panel text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
                    )}
                  >
                    <i className={cn('ti', v.icon, 'text-[13px]')} aria-hidden="true" />
                    {v.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Milestone */}
          <CheckRow
            icon="ti-flag-3"
            iconColour="text-accent"
            label="Mark as milestone"
          >
            <Switch name="milestone" ariaLabel="Mark as milestone" />
          </CheckRow>
        </div>
      </div>

      {/* Global error */}
      {state.error ? (
        <p
          role="alert"
          className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
        >
          {state.error}
        </p>
      ) : null}

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onSuccess}
          className="flex-1 py-3 rounded-lg border border-line text-[14px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
        >
          Cancel
        </button>
        <SaveButton />
      </div>
    </form>
  );
}

// ------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-ink-2 mb-1.5">{label}</label>
      {children}
      {error ? <p className="text-[11px] text-urgent mt-1">{error}</p> : null}
    </div>
  );
}

function CheckRow({
  icon,
  iconColour = 'text-ink-3',
  label,
  children,
}: {
  icon: string;
  iconColour?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-t border-line-2">
      <span className="text-[13px] text-ink inline-flex items-center gap-2">
        <i className={cn('ti', icon, 'text-[15px]', iconColour)} aria-hidden="true" />
        {label}
      </span>
      {children}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-3 rounded-lg bg-ink text-white text-[14px] font-medium transition-opacity disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save task'}
    </button>
  );
}

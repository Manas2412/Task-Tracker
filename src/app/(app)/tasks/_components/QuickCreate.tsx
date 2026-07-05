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
import { registerAttachmentAction } from '@/app/actions/attachments';
import {
  INITIAL_CREATE_STATE,
  type CreateTaskState,
} from '@/app/actions/states';
import { cn } from '@/lib/utils';

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
  s3Configured: boolean;
  /** Whether this user may create division-visible tasks (head/OSD/SA). */
  canCreateDivisionTasks: boolean;
  children: ReactNode;
};

export function QuickCreateProvider({
  defaultDivisionId,
  s3Configured,
  canCreateDivisionTasks,
  children,
}: ProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  return (
    <QuickCreateContext.Provider value={{ open }}>
      {children}

      <Sheet open={isOpen} onClose={close} title="Quick create">
        {isOpen ? (
          <QuickCreateForm
            onSuccess={close}
            defaultDivisionId={defaultDivisionId}
            s3Configured={s3Configured}
            canCreateDivisionTasks={canCreateDivisionTasks}
          />
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
  s3Configured: boolean;
  canCreateDivisionTasks: boolean;
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

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function QuickCreateForm({ onSuccess, defaultDivisionId, s3Configured, canCreateDivisionTasks }: FormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useFormState<CreateTaskState, FormData>(
    createTaskAction,
    INITIAL_CREATE_STATE,
  );

  const [showMore, setShowMore] = useState(false);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]['value']>('low');
  // Normal users can only create personal tasks; division visibility is a
  // head power (also enforced on the server).
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]['value']>(
    canCreateDivisionTasks ? 'division' : 'personal',
  );

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // After task creation succeeds, upload the pending file if any, then close.
  useEffect(() => {
    if (!state.ok) return;
    const taskId = state.taskId;

    if (pendingFile && taskId) {
      uploadFileToTask(pendingFile, taskId).then(() => {
        formRef.current?.reset();
        setPendingFile(null);
        setUploadStatus(null);
        onSuccess();
      });
    } else {
      formRef.current?.reset();
      setPendingFile(null);
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  async function uploadFileToTask(file: File, taskId: string) {
    setUploadStatus(`Uploading ${file.name}…`);
    setUploadError(null);
    try {
      const presignRes = await fetch('/api/attachments/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'task',
          parentId: taskId,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not start upload.');
      }
      const { key, url } = (await presignRes.json()) as { key: string; url: string };

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status}).`);
      }

      const fd = new FormData();
      fd.set('scope', 'task');
      fd.set('parentId', taskId);
      fd.set('source', 'uploaded');
      fd.set('key', key);
      fd.set('fileName', file.name);
      fd.set('mimeType', file.type || '');
      fd.set('sizeBytes', String(file.size));
      const registered = await registerAttachmentAction(undefined, fd);
      if (!registered.ok) {
        throw new Error(registered.error ?? 'Could not save the attachment.');
      }
    } catch (err) {
      console.error('Post-create upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    }
    setUploadStatus(null);
  }

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`File is over ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setUploadError(null);
    setPendingFile(file);
  };

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
          showMore ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0',
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

          {/* Visibility segmented — only heads can choose Division. */}
          {canCreateDivisionTasks ? (
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
          ) : (
            <Field label="Visibility">
              <p className="inline-flex items-center gap-1.5 text-[12px] text-ink-2 px-1 py-1.5">
                <i className="ti ti-lock text-[13px] text-ink-3" aria-hidden="true" />
                Personal — only your division head can share tasks with the division.
              </p>
            </Field>
          )}

          {/* Milestone */}
          <CheckRow
            icon="ti-flag-3"
            iconColour="text-accent"
            label="Mark as milestone"
          >
            <Switch name="milestone" ariaLabel="Mark as milestone" />
          </CheckRow>

          {/* Attachments */}
          <Field label="Attach">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!s3Configured}
                title={s3Configured ? undefined : 'Storage is not configured. Use a link instead.'}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors',
                  s3Configured
                    ? 'border-line bg-panel text-ink hover:border-ink-4'
                    : 'border-line bg-bg text-ink-3 cursor-not-allowed',
                )}
              >
                <i className="ti ti-cloud-upload text-[15px]" aria-hidden="true" />
                Upload file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={onFileChosen}
                className="sr-only"
                aria-hidden="true"
              />
            </div>

            {pendingFile ? (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-bg border border-line rounded-lg">
                <i className="ti ti-file text-[14px] text-ink-2" aria-hidden="true" />
                <span className="flex-1 min-w-0 text-[12px] text-ink truncate">
                  {pendingFile.name}
                </span>
                <span className="text-[10px] text-ink-3 shrink-0">
                  {formatBytes(pendingFile.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  aria-label="Remove file"
                  className="w-6 h-6 grid place-items-center rounded text-ink-3 hover:text-urgent shrink-0"
                >
                  <i className="ti ti-x text-[12px]" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {uploadError ? (
              <p className="text-[11px] text-urgent mt-1">{uploadError}</p>
            ) : null}
          </Field>

          {/* Drive link */}
          <Field label="Or paste a link" error={state.fieldErrors?.driveUrl}>
            <input
              name="driveUrl"
              type="url"
              placeholder="Google Drive, Dropbox, or any URL…"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-panel text-[14px] text-ink outline-none focus:border-ink',
                state.fieldErrors?.driveUrl ? 'border-urgent' : 'border-line',
              )}
              maxLength={1000}
            />
          </Field>
        </div>
      </div>

      {/* Upload progress */}
      {uploadStatus ? (
        <p className="text-[12px] text-ink-2 inline-flex items-center gap-1.5">
          <i className="ti ti-loader-2 animate-spin text-[13px]" aria-hidden="true" />
          {uploadStatus}
        </p>
      ) : null}

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
        <SaveButton uploading={!!uploadStatus} />
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

function SaveButton({ uploading }: { uploading: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || uploading;
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex-1 py-3 rounded-lg bg-ink text-white text-[14px] font-medium transition-opacity disabled:opacity-60"
    >
      {uploading ? 'Uploading…' : pending ? 'Saving…' : 'Save task'}
    </button>
  );
}

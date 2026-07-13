'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import {
  addDriveLinkAttachmentAction,
  registerAttachmentAction,
} from '@/app/actions/attachments';
import { createDocumentAction } from '@/app/actions/documents';
import {
  INITIAL_CREATE_DOCUMENT_STATE,
  type CreateDocumentState,
} from '@/app/actions/states';
import { URGENCY_LABEL, URGENCY_OPTIONS, type DocumentUrgency } from '@/lib/document-centre-shared';
import { guessContentType } from '@/lib/mime';
import { fileBadgeFor, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/s3';
import { cn } from '@/lib/utils';

/**
 * Create New Record — the Document Centre create flow. Mirrors
 * CreateTimelineFileDialog: a self-contained trigger + Sheet, the record is
 * created first (server action), then the queued files + Drive links upload
 * against the new id through the shared attachment pipeline (scope 'document').
 */

type QueuedDriveLink = { name: string; url: string };

const URGENCY_DOT: Record<DocumentUrgency, string> = {
  highly_urgent: 'bg-urgent',
  urgent: 'bg-high',
  normal: 'bg-low',
};
const URGENCY_ACTIVE: Record<DocumentUrgency, string> = {
  highly_urgent: 'bg-urgent-soft text-urgent border-urgent/30',
  urgent: 'bg-high-soft text-high border-high/30',
  normal: 'bg-low-soft text-low border-low/30',
};

export function CreateDocumentDialog({ s3Configured }: { s3Configured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<CreateDocumentState, FormData>(
    createDocumentAction,
    INITIAL_CREATE_DOCUMENT_STATE,
  );
  const [urgency, setUrgency] = useState<DocumentUrgency>('normal');

  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [queuedLinks, setQueuedLinks] = useState<QueuedDriveLink[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.ok || !state.documentId) return;
    if (queuedFiles.length === 0 && queuedLinks.length === 0) {
      const id = state.documentId;
      resetAndClose();
      router.push(`/document-centre/${id}`);
      return;
    }
    uploadAttachments(state.documentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  async function uploadAttachments(documentId: string) {
    setUploading(true);
    setUploadError(null);
    const total = queuedLinks.length + queuedFiles.length;
    let done = 0;
    try {
      for (const link of queuedLinks) {
        setUploadStatus(`Adding link ${done + 1} of ${total}…`);
        const fd = new FormData();
        fd.set('scope', 'document');
        fd.set('parentId', documentId);
        fd.set('fileName', link.name);
        fd.set('driveUrl', link.url);
        const res = await addDriveLinkAttachmentAction(undefined, fd);
        if (!res.ok) throw new Error(res.error ?? 'Failed to add Drive link.');
        done++;
      }

      for (const file of queuedFiles) {
        setUploadStatus(`Uploading ${file.name} (${done + 1} of ${total})…`);
        const contentType = guessContentType(file.name, file.type);
        const presignRes = await fetch('/api/attachments/upload-url', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            scope: 'document',
            parentId: documentId,
            filename: file.name,
            contentType,
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
          headers: { 'content-type': contentType },
          body: file,
        });
        if (!putRes.ok) throw new Error(`Upload rejected (${putRes.status}).`);

        const regFd = new FormData();
        regFd.set('scope', 'document');
        regFd.set('parentId', documentId);
        regFd.set('source', 'uploaded');
        regFd.set('key', key);
        regFd.set('fileName', file.name);
        regFd.set('mimeType', contentType);
        regFd.set('sizeBytes', String(file.size));
        const regRes = await registerAttachmentAction(undefined, regFd);
        if (!regRes.ok) throw new Error(regRes.error ?? 'Could not register file.');
        done++;
      }

      resetAndClose();
      router.push(`/document-centre/${documentId}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      setUploading(false);
      setUploadStatus(null);
    }
  }

  function resetAndClose() {
    formRef.current?.reset();
    setUrgency('normal');
    setQueuedFiles([]);
    setQueuedLinks([]);
    setShowLinkForm(false);
    setLinkName('');
    setLinkUrl('');
    setUploading(false);
    setUploadStatus(null);
    setUploadError(null);
    setOpen(false);
  }

  const onPickFile = () => fileInputRef.current?.click();
  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files) return;
    const arr = Array.from(files);
    const oversize = arr.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (oversize) {
      setUploadError(`${oversize.name} exceeds ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setUploadError(null);
    setQueuedFiles((prev) => [...prev, ...arr]);
  };
  const removeQueuedFile = (idx: number) =>
    setQueuedFiles((prev) => prev.filter((_, i) => i !== idx));

  const addDriveLink = () => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    try {
      new URL(linkUrl.trim());
    } catch {
      return;
    }
    setQueuedLinks((prev) => [...prev, { name: linkName.trim(), url: linkUrl.trim() }]);
    setLinkName('');
    setLinkUrl('');
    setShowLinkForm(false);
  };
  const removeQueuedLink = (idx: number) =>
    setQueuedLinks((prev) => prev.filter((_, i) => i !== idx));

  const hasAttachments = queuedFiles.length > 0 || queuedLinks.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-onink text-[13px] font-medium hover:bg-ink-2 transition-colors"
      >
        <i className="ti ti-file-plus text-[14px]" aria-hidden="true" />
        Create record
      </button>

      <Sheet
        open={open}
        onClose={uploading ? () => {} : () => setOpen(false)}
        title="Create new record"
        subtitle="A confidential executive record — MoM, briefing, report, or correspondence."
      >
        {open ? (
          <form ref={formRef} action={formAction} className="flex flex-col gap-3.5">
            <Field label="Subject" error={state.fieldErrors?.subject}>
              <input
                name="subject"
                required
                autoFocus
                maxLength={300}
                disabled={uploading}
                placeholder="e.g. Minutes — Khelo India review meeting"
                className={inputCn(!!state.fieldErrors?.subject)}
              />
            </Field>

            <Field
              label="Context"
              hint="Optional. Background, notes, or a summary."
              error={state.fieldErrors?.context}
            >
              <textarea
                name="context"
                rows={4}
                maxLength={5000}
                disabled={uploading}
                placeholder="Add context, background, or a summary…"
                className={cn(inputCn(false), 'resize-none')}
              />
            </Field>

            <Field label="Urgency">
              <input type="hidden" name="urgency" value={urgency} />
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Urgency">
                {URGENCY_OPTIONS.map((value) => {
                  const active = urgency === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setUrgency(value)}
                      disabled={uploading}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill text-[11px] font-medium border transition-colors',
                        active ? URGENCY_ACTIVE[value] : 'bg-panel text-ink-2 border-line hover:border-ink-4',
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', URGENCY_DOT[value])} aria-hidden="true" />
                      {URGENCY_LABEL[value]}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Attachments + Drive links */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-ink-2">Attachments &amp; links</span>
              <span className="text-[11px] text-ink-3">
                Optional. Files upload after the record is created; Drive links attach immediately.
              </span>

              {hasAttachments ? (
                <ul className="flex flex-col gap-1.5 mt-1">
                  {queuedLinks.map((link, i) => (
                    <li
                      key={`link-${i}`}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-line bg-bg"
                    >
                      <span className="w-7 h-8 rounded grid place-items-center bg-info text-white shrink-0">
                        <i className="ti ti-link text-[12px]" aria-hidden="true" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-ink truncate">{link.name}</p>
                        <p className="text-[10px] text-ink-3 truncate">{link.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQueuedLink(i)}
                        disabled={uploading}
                        className="p-1 text-ink-3 hover:text-urgent transition-colors shrink-0"
                        aria-label="Remove"
                      >
                        <i className="ti ti-x text-[13px]" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                  {queuedFiles.map((file, i) => {
                    const badge = fileBadgeFor(file.name, 'uploaded');
                    return (
                      <li
                        key={`file-${i}`}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-line bg-bg"
                      >
                        <span
                          className={cn(
                            'w-7 h-8 rounded grid place-items-end justify-center pb-0.5 text-white text-[8px] font-medium shrink-0',
                            badge.tone === 'pdf' ? 'bg-urgent' :
                            badge.tone === 'doc' ? 'bg-medium' :
                            badge.tone === 'xls' ? 'bg-success' :
                            badge.tone === 'img' ? 'bg-success' :
                            'bg-low',
                          )}
                        >
                          {badge.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-ink truncate">{file.name}</p>
                          <p className="text-[10px] text-ink-3">{formatBytes(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQueuedFile(i)}
                          disabled={uploading}
                          className="p-1 text-ink-3 hover:text-urgent transition-colors shrink-0"
                          aria-label="Remove"
                        >
                          <i className="ti ti-x text-[13px]" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {showLinkForm ? (
                <div className="flex flex-col gap-2 mt-1 p-2.5 rounded-lg border border-line bg-bg">
                  <input
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="Display name"
                    maxLength={200}
                    autoFocus
                    className={inputCn(false)}
                  />
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://drive.google.com/…"
                    type="url"
                    maxLength={1000}
                    className={inputCn(false)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLinkForm(false);
                        setLinkName('');
                        setLinkUrl('');
                      }}
                      className="flex-1 py-1.5 rounded-md border border-line text-[11px] font-medium text-ink-2 hover:bg-line-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addDriveLink}
                      disabled={!linkName.trim() || !linkUrl.trim()}
                      className="flex-1 py-1.5 rounded-md bg-ink text-onink text-[11px] font-medium disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : null}

              {!showLinkForm ? (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={onPickFile}
                    disabled={uploading || !s3Configured}
                    title={s3Configured ? undefined : 'Storage is not configured. Use a Drive link instead.'}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium',
                      s3Configured && !uploading
                        ? 'upload-btn'
                        : 'border border-line bg-bg text-ink-3 cursor-not-allowed',
                    )}
                  >
                    <i className="upload-btn-icon ti ti-cloud-upload text-[14px]" aria-hidden="true" />
                    Upload files
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLinkForm(true)}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-panel text-[11px] font-medium text-ink-2 hover:border-ink-4 transition-colors"
                  >
                    <i className="ti ti-link text-[13px]" aria-hidden="true" />
                    Add Drive link
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={onFileChosen}
                    className="sr-only"
                    aria-hidden="true"
                  />
                </div>
              ) : null}
            </div>

            {uploadStatus ? (
              <p className="text-[12px] text-ink-2 inline-flex items-center gap-1.5">
                <i className="ti ti-loader-2 animate-spin text-[13px]" aria-hidden="true" />
                {uploadStatus}
              </p>
            ) : null}

            {uploadError ? (
              <p role="alert" className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2">
                {uploadError}
              </p>
            ) : null}

            {state.error ? (
              <p role="alert" className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            ) : null}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <SaveButton uploading={uploading} hasAttachments={hasAttachments} />
            </div>
          </form>
        ) : null}
      </Sheet>
    </>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="text-[11px] text-urgent">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

function inputCn(hasError: boolean) {
  return cn(
    'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] text-ink outline-none transition-colors',
    hasError ? 'border-urgent focus:border-urgent' : 'border-line focus:border-ink',
  );
}

function SaveButton({ uploading, hasAttachments }: { uploading: boolean; hasAttachments: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || uploading;
  const label = uploading
    ? 'Uploading…'
    : pending
      ? 'Creating…'
      : hasAttachments
        ? 'Create & upload'
        : 'Create record';
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex-1 py-2.5 rounded-lg bg-ink text-onink text-[13px] font-medium disabled:opacity-60"
    >
      {label}
    </button>
  );
}

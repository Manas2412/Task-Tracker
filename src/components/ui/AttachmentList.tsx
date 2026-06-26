'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useFormState, useFormStatus } from 'react-dom';
import { format, formatDistanceToNow } from 'date-fns';

import { Sheet } from '@/components/ui/Sheet';
import {
  addDriveLinkAttachmentAction,
  deleteAttachmentAction,
  registerAttachmentAction,
} from '@/app/actions/attachments';
import { fileBadgeFor, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/s3';
import { cn } from '@/lib/utils';

/**
 * Attachment list + upload/Drive-link controls — used by:
 *   - Task detail Attachments section
 *   - TF detail Source documents section
 *   - TF detail Action document section
 *
 * Three modes via `mode` prop:
 *   - 'list-multi' (default for task + TF source) — many attachments
 *   - 'list-single' (TF action document) — only one stays current,
 *      uploading replaces the displayed one (history kept in audit/activity)
 *
 * When S3 is not configured, the native upload button stays disabled with
 * a tooltip; Drive-link still works.
 */

export type AttachmentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | bigint | null;
  source: 'uploaded' | 'drive_link';
  uploadedAt: Date;
  uploaderName: string;
  /** Allow this caller to remove this row */
  canDelete: boolean;
};

type AttachmentListProps = {
  scope: 'task' | 'tf_source' | 'tf_action';
  parentId: string;
  attachments: AttachmentRow[];
  canEdit: boolean;
  s3Configured: boolean;
  mode?: 'list-multi' | 'list-single';
  emptyHint?: string;
};

export function AttachmentList({
  scope,
  parentId,
  attachments,
  canEdit,
  s3Configured,
  mode = 'list-multi',
  emptyHint,
}: AttachmentListProps) {
  const [driveOpen, setDriveOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<AttachmentRow | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`File is over ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setUploadError(null);
    setUploadProgress(`Uploading ${file.name}…`);
    try {
      // 1) Ask the server for a presigned PUT URL
      const presignRes = await fetch('/api/attachments/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope,
          parentId,
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

      // 2) PUT the file directly to S3
      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`S3 rejected the upload (${putRes.status}).`);
      }

      // 3) Register the metadata with our server (validates key prefix)
      const fd = new FormData();
      fd.set('scope', scope);
      fd.set('parentId', parentId);
      fd.set('source', 'uploaded');
      fd.set('key', key);
      fd.set('fileName', file.name);
      fd.set('mimeType', file.type || '');
      fd.set('sizeBytes', String(file.size));
      const registered = await registerAttachmentAction(undefined, fd);
      if (!registered.ok) {
        throw new Error(registered.error ?? 'Could not save the attachment.');
      }
      setUploadProgress(null);
      // Server action revalidates the path — re-render will refresh the list
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadProgress(null);
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  const onDelete = (id: string) => {
    if (!confirm('Remove this attachment?')) return;
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const result = await deleteAttachmentAction(undefined, fd);
      if (!result.ok && result.error) alert(result.error);
    });
  };

  // For 'list-single', only show the latest item (server may pass just one)
  const visible =
    mode === 'list-single' ? attachments.slice(0, 1) : attachments;

  const isEmpty = visible.length === 0;

  return (
    <div>
      {/* Action bar */}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={onPickFile}
            disabled={!s3Configured}
            title={
              s3Configured
                ? undefined
                : 'Storage is not configured on this server. Use a Drive link instead.'
            }
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-medium transition-colors',
              s3Configured
                ? 'border-line bg-panel text-ink hover:border-ink-4'
                : 'border-line bg-bg text-ink-3 cursor-not-allowed',
            )}
          >
            <i className="ti ti-cloud-upload text-[14px]" aria-hidden="true" />
            {mode === 'list-single' && !isEmpty ? 'Replace file' : 'Upload file'}
          </button>
          <button
            type="button"
            onClick={() => setDriveOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-panel text-[12px] font-medium text-ink hover:border-ink-4 transition-colors"
          >
            <i className="ti ti-link text-[14px]" aria-hidden="true" />
            Add Drive link
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileChosen}
            className="sr-only"
            aria-hidden="true"
          />
        </div>
      ) : null}

      {uploadProgress ? (
        <p className="text-[12px] text-ink-2 inline-flex items-center gap-1.5 mb-2">
          <i
            className="ti ti-loader-2 animate-spin text-[13px]"
            aria-hidden="true"
          />
          {uploadProgress}
        </p>
      ) : null}
      {uploadError ? (
        <p
          role="alert"
          className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2 mb-2"
        >
          {uploadError}
        </p>
      ) : null}

      {/* List */}
      {isEmpty ? (
        <EmptyState mode={mode} canEdit={canEdit} hint={emptyHint} />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((a) => (
            <li key={a.id}>
              <AttachmentRowCard
                row={a}
                onDelete={() => onDelete(a.id)}
                onPreview={() => setPreviewRow(a)}
              />
            </li>
          ))}
        </ul>
      )}

      <DriveLinkDialog
        open={driveOpen}
        onClose={() => setDriveOpen(false)}
        scope={scope}
        parentId={parentId}
      />

      {previewRow ? (
        <AttachmentPreview
          row={previewRow}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Row
// ------------------------------------------------------------

const TONE_BG: Record<string, string> = {
  pdf: 'bg-urgent',
  doc: 'bg-medium',
  xls: 'bg-success',
  img: 'bg-success',
  drive: 'bg-info',
  file: 'bg-low',
};

function AttachmentRowCard({
  row,
  onDelete,
  onPreview,
}: {
  row: AttachmentRow;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const badge = fileBadgeFor(row.fileName, row.source);
  const isDriveLink = row.source === 'drive_link';
  return (
    <div className="flex items-center gap-3 p-3 bg-bg border border-line rounded-xl hover:border-ink-4 transition-colors">
      <span
        className={cn(
          'w-9 h-10 rounded-[5px] grid place-items-end justify-center pb-1 text-white text-[9px] font-medium shrink-0',
          TONE_BG[badge.tone],
        )}
        aria-hidden="true"
      >
        {badge.tone === 'drive' ? (
          <i className="ti ti-link text-[14px]" aria-hidden="true" />
        ) : (
          <span>{badge.label}</span>
        )}
      </span>
      {isDriveLink ? (
        <a
          href={row.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="flex-1 min-w-0 text-left hover:underline"
        >
          <p className="text-[13px] font-medium text-ink truncate">{row.fileName}</p>
          <p className="text-[11px] text-ink-3 truncate" title={format(row.uploadedAt, 'd LLL yyyy, h:mm a')}>
            {row.uploaderName} ·{' '}
            {formatDistanceToNow(row.uploadedAt, { addSuffix: true })}
            {' · Drive link'}
          </p>
        </a>
      ) : (
        <button
          type="button"
          onClick={onPreview}
          className="flex-1 min-w-0 text-left hover:underline"
        >
          <p className="text-[13px] font-medium text-ink truncate">{row.fileName}</p>
          <p className="text-[11px] text-ink-3 truncate" title={format(row.uploadedAt, 'd LLL yyyy, h:mm a')}>
            {row.uploaderName} ·{' '}
            {formatDistanceToNow(row.uploadedAt, { addSuffix: true })}
            {row.sizeBytes != null ? ` · ${formatBytes(row.sizeBytes)}` : null}
          </p>
        </button>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {isDriveLink ? (
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open link"
            className="w-8 h-8 grid place-items-center rounded-lg border border-line text-ink-2 hover:bg-line-2"
          >
            <i className="ti ti-external-link text-[14px]" aria-hidden="true" />
          </a>
        ) : (
          <>
            <button
              type="button"
              onClick={onPreview}
              aria-label="Preview attachment"
              className="w-8 h-8 grid place-items-center rounded-lg border border-line text-ink-2 hover:bg-line-2"
            >
              <i className="ti ti-eye text-[14px]" aria-hidden="true" />
            </button>
            <a
              href={`/api/attachments/${row.id}/download`}
              aria-label="Download file"
              className="w-8 h-8 grid place-items-center rounded-lg border border-line text-ink-2 hover:bg-line-2"
            >
              <i className="ti ti-download text-[14px]" aria-hidden="true" />
            </a>
          </>
        )}
        {row.canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Remove attachment"
            className="w-8 h-8 grid place-items-center rounded-lg border border-urgent/20 text-urgent hover:bg-urgent-soft"
          >
            <i className="ti ti-trash text-[14px]" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Empty state
// ------------------------------------------------------------

function EmptyState({
  mode,
  canEdit,
  hint,
}: {
  mode: 'list-multi' | 'list-single';
  canEdit: boolean;
  hint?: string;
}) {
  if (mode === 'list-single') {
    return (
      <div className="rounded-xl border-[1.5px] border-dashed border-line p-6 text-center bg-bg">
        <i
          className="ti ti-cloud-upload text-[26px] text-ink-3 block mb-1.5"
          aria-hidden="true"
        />
        <p className="text-[13px] font-medium text-ink-2 mb-1">Not yet uploaded</p>
        <p className="text-[11px] text-ink-3 max-w-sm mx-auto leading-relaxed">
          {hint ??
            'The final response sent in reply to this file — uploaded by the concerned section when action is complete.'}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center bg-bg">
      <i className="ti ti-paperclip text-[24px] text-ink-3 block mb-1.5" aria-hidden="true" />
      <p className="text-[12px] text-ink-2 max-w-sm mx-auto leading-relaxed">
        {canEdit
          ? 'No attachments yet. Upload a file or paste a Drive link.'
          : hint ?? 'No attachments yet.'}
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// Drive-link dialog
// ------------------------------------------------------------

function DriveLinkDialog({
  open,
  onClose,
  scope,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  scope: 'task' | 'tf_source' | 'tf_action';
  parentId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(addDriveLinkAttachmentAction, {
    ok: false,
    epoch: 0,
  });

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <Sheet open={open} onClose={onClose} title="Add a Drive link" subtitle="Anyone with link access on the source will be able to open it.">
      {open ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="parentId" value={parentId} />

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">Display name</span>
            <input
              name="fileName"
              required
              maxLength={200}
              autoFocus
              autoComplete="off"
              placeholder="e.g. Mission architecture diagram"
              className={inputCn(!!state.fieldErrors?.fileName)}
            />
            {state.fieldErrors?.fileName ? (
              <span className="text-[11px] text-urgent">{state.fieldErrors.fileName}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-2">URL</span>
            <input
              name="driveUrl"
              type="url"
              required
              maxLength={1000}
              autoComplete="off"
              placeholder="https://drive.google.com/…"
              className={inputCn(!!state.fieldErrors?.driveUrl)}
            />
            {state.fieldErrors?.driveUrl ? (
              <span className="text-[11px] text-urgent">{state.fieldErrors.driveUrl}</span>
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
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
            >
              Cancel
            </button>
            <SaveButton />
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Adding…' : 'Add link'}
    </button>
  );
}

// ------------------------------------------------------------
// Full-screen attachment preview
// ------------------------------------------------------------

const PREVIEWABLE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return PREVIEWABLE_TYPES.has(mimeType) || mimeType.startsWith('image/');
}

function AttachmentPreview({
  row,
  onClose,
}: {
  row: AttachmentRow;
  onClose: () => void;
}) {
  const viewUrl = `/api/attachments/${row.id}/view`;
  const downloadUrl = `/api/attachments/${row.id}/download`;
  const canPreview = isPreviewable(row.mimeType);
  const [mounted, setMounted] = useState(false);

  const onEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
  }, [onEsc]);

  if (!mounted) return null;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
      className="flex flex-col bg-black/90"
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 md:px-5 py-3 bg-black border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="w-10 h-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <i className="ti ti-x text-[22px]" aria-hidden="true" />
        </button>
        <p className="flex-1 min-w-0 text-[14px] font-medium text-white truncate ml-1">
          {row.fileName}
        </p>
        <a
          href={downloadUrl}
          aria-label="Download file"
          className="w-10 h-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <i className="ti ti-download text-[20px]" aria-hidden="true" />
        </a>
        <a
          href={viewUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in new tab"
          className="w-10 h-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <i className="ti ti-external-link text-[20px]" aria-hidden="true" />
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4 md:p-8">
        {canPreview ? (
          row.mimeType?.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewUrl}
              alt={row.fileName}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          ) : (
            <iframe
              src={viewUrl}
              title={row.fileName}
              className="w-full h-full rounded-lg bg-white"
            />
          )
        ) : (
          <div className="text-center max-w-sm mx-auto">
            <i className="ti ti-file text-[56px] text-white/30 block mb-4" aria-hidden="true" />
            <p className="text-[16px] font-medium text-white mb-2">{row.fileName}</p>
            <p className="text-[13px] text-white/50 mb-6">
              {row.sizeBytes != null ? formatBytes(row.sizeBytes) : 'Unknown size'}
            </p>
            <p className="text-[13px] text-white/40 mb-6">
              Preview is not available for this file type.
            </p>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-[14px] font-medium hover:bg-white/90 transition-colors"
            >
              <i className="ti ti-download text-[18px]" aria-hidden="true" />
              Download
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function inputCn(hasError: boolean) {
  return cn(
    'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] text-ink outline-none transition-colors',
    hasError ? 'border-urgent focus:border-urgent' : 'border-line focus:border-ink',
  );
}

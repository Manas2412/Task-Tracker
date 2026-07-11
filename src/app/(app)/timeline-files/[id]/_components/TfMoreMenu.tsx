'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { deleteTimelineFileAction } from '@/app/actions/timeline-files';
import { cn } from '@/lib/utils';

type TfMoreMenuProps = {
  tfId: string;
  refNo: string;
  /** OSD or Super Admin — can view the audit trail */
  canViewAudit: boolean;
  /** Super Admin only — can hard-delete */
  canDelete: boolean;
};

export function TfMoreMenu({ tfId, refNo, canViewAudit, canDelete }: TfMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const callAction = (action: typeof deleteTimelineFileAction) => {
    const fd = new FormData();
    fd.set('id', tfId);
    startTransition(async () => {
      const result = await action(undefined, fd);
      if (result.ok) {
        router.push('/timeline-files');
        router.refresh();
      } else if (result.error) {
        alert(result.error);
      }
    });
  };

  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = `${window.location.origin}/timeline-files/${tfId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 grid place-items-center rounded-full text-ink-2 hover:bg-line-2"
      >
        <i className="ti ti-dots-vertical text-[18px]" aria-hidden="true" />
      </button>

      {copied ? (
        <span className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-lg bg-ink text-onink text-[12px] whitespace-nowrap z-40">
          Link copied
        </span>
      ) : null}

      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          'absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-panel shadow-xl z-40 p-1.5',
          'transition-all duration-150 origin-top-right',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none',
        )}
      >
        {confirmDelete ? (
          <div className="p-2">
            <p className="text-[12px] text-ink-2 mb-2 leading-relaxed">
              Hard-delete {refNo}? Linked tasks lose their reference. This cannot be undone.
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
                className="flex-1 py-1.5 rounded-md border border-line text-[12px] text-ink-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => callAction(deleteTimelineFileAction)}
                className="flex-1 py-1.5 rounded-md bg-urgent text-white text-[12px] font-medium disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <MenuButton
              icon="ti-link"
              label="Share link"
              onClick={copyLink}
            />
            {canViewAudit ? (
              <MenuLink
                icon="ti-history"
                label="View audit trail"
                href={`/admin/audit?entity=timeline_file&entityId=${tfId}`}
                onClick={() => setOpen(false)}
              />
            ) : null}
            {canDelete ? (
              <MenuButton
                icon="ti-trash"
                label="Delete"
                danger
                onClick={() => setConfirmDelete(true)}
              />
            ) : (
              <div className="px-3 py-2 text-[11px] text-ink-3 leading-relaxed">
                <i className="ti ti-info-circle mr-1.5" aria-hidden="true" />
                Only Super Admin can hard-delete a timeline file.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] hover:bg-bg transition-colors',
        danger ? 'text-urgent' : 'text-ink',
      )}
    >
      <i
        className={cn('ti', icon, 'text-[16px]', danger ? 'text-urgent' : 'text-ink-2')}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}

function MenuLink({
  icon,
  label,
  href,
  onClick,
}: {
  icon: string;
  label: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-ink hover:bg-bg transition-colors"
    >
      <i className={cn('ti', icon, 'text-[16px] text-ink-2')} aria-hidden="true" />
      {label}
    </Link>
  );
}

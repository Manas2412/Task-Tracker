'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { format } from 'date-fns';

import { Sheet } from '@/components/ui';
import { deleteTagAction, renameTagAction } from '@/app/actions/tags';
import { cn } from '@/lib/utils';

export type TagRow = {
  id: string;
  name: string;
  createdAt: Date;
  createdByName: string;
  taskCount: number;
};

type TagsAdminListProps = {
  tags: TagRow[];
};

export function TagsAdminList({ tags }: TagsAdminListProps) {
  const [renameTarget, setRenameTarget] = useState<TagRow | null>(null);

  if (tags.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-panel p-10 text-center">
        <i className="ti ti-tags text-[28px] text-ink-3 mb-2 block" aria-hidden="true" />
        <h2 className="font-serif text-[18px] text-ink mb-1">No tags yet</h2>
        <p className="text-[13px] text-ink-2 max-w-md mx-auto">
          Tap &ldquo;New tag&rdquo; to add the first label that officers can attach to tasks.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-panel border border-line rounded-xl overflow-hidden">
        <table className="w-full hidden md:table">
          <thead>
            <tr className="text-left bg-bg border-b border-line">
              <Th>Tag</Th>
              <Th>Usage</Th>
              <Th>Created</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <DesktopRow key={t.id} tag={t} onRename={() => setRenameTarget(t)} />
            ))}
          </tbody>
        </table>

        <ul className="md:hidden divide-y divide-line-2">
          {tags.map((t) => (
            <li key={t.id} className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{t.name}</div>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  Used on {t.taskCount} {t.taskCount === 1 ? 'task' : 'tasks'} · added by{' '}
                  {t.createdByName}
                </div>
              </div>
              <RowMenu tag={t} onRename={() => setRenameTarget(t)} />
            </li>
          ))}
        </ul>
      </div>

      {renameTarget ? (
        <RenameDialog tag={renameTarget} onClose={() => setRenameTarget(null)} />
      ) : null}
    </>
  );
}

function DesktopRow({
  tag,
  onRename,
}: {
  tag: TagRow;
  onRename: () => void;
}) {
  return (
    <tr className="border-b border-line-2 last:border-b-0 hover:bg-bg/60 transition-colors">
      <Td>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-line-2 text-[12px] font-medium text-ink-2">
          <i className="ti ti-tag text-[12px]" aria-hidden="true" />
          {tag.name}
        </span>
      </Td>
      <Td>
        <span className="text-[12px] text-ink">
          {tag.taskCount} {tag.taskCount === 1 ? 'task' : 'tasks'}
        </span>
      </Td>
      <Td>
        <span className="text-[11px] text-ink-3" title={format(tag.createdAt, 'd LLL yyyy, h:mm a')}>
          {format(tag.createdAt, 'd LLL yyyy')} · {tag.createdByName}
        </span>
      </Td>
      <Td className="text-right">
        <RowMenu tag={tag} onRename={onRename} />
      </Td>
    </tr>
  );
}

function RowMenu({ tag, onRename }: { tag: TagRow; onRename: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const remove = () => {
    if (!confirm(`Delete "${tag.name}"?`)) return;
    const fd = new FormData();
    fd.set('id', tag.id);
    startTransition(async () => {
      const result = await deleteTagAction(undefined, fd);
      if (!result.ok && result.error) alert(result.error);
    });
  };

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${tag.name}`}
        className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-line-2"
      >
        <i className="ti ti-dots-vertical text-[16px]" aria-hidden="true" />
      </button>
      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          'absolute right-0 top-full mt-2 w-44 rounded-xl border border-line bg-panel shadow-xl z-40 p-1',
          'transition-all duration-150 origin-top-right',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
        )}
      >
        <MenuItem
          icon="ti-edit"
          label="Rename"
          onClick={() => {
            setOpen(false);
            onRename();
          }}
        />
        <MenuItem
          icon="ti-trash"
          label={tag.taskCount > 0 ? 'In use — cannot delete' : 'Delete'}
          danger={tag.taskCount === 0}
          disabled={tag.taskCount > 0 || pending}
          onClick={() => {
            setOpen(false);
            remove();
          }}
        />
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] hover:bg-bg transition-colors disabled:opacity-60',
        danger ? 'text-urgent' : 'text-ink',
      )}
    >
      <i className={cn('ti', icon, 'text-[14px]', danger ? 'text-urgent' : 'text-ink-2')} aria-hidden="true" />
      {label}
    </button>
  );
}

function RenameDialog({ tag, onClose }: { tag: TagRow; onClose: () => void }) {
  const [state, formAction] = useFormState(renameTagAction, { ok: false, epoch: 0 });
  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <Sheet open={true} onClose={onClose} title={`Rename "${tag.name}"`}>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={tag.id} />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-ink-2">Name</span>
          <input
            name="name"
            defaultValue={tag.name}
            autoFocus
            required
            maxLength={40}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] outline-none',
              state.fieldErrors?.name
                ? 'border-urgent focus:border-urgent'
                : 'border-line focus:border-ink',
            )}
          />
          {state.fieldErrors?.name ? (
            <span className="text-[11px] text-urgent">{state.fieldErrors.name}</span>
          ) : null}
        </label>
        {state.error ? (
          <p className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2">
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
    </Sheet>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-onink text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3 px-3.5 py-2.5',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3.5 py-3 align-middle', className)}>{children}</td>;
}

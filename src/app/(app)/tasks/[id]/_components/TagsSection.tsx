'use client';

import { useEffect, useState, useTransition } from 'react';

import { Sheet } from '@/components/ui';
import { addTagToTaskAction, removeTagFromTaskAction } from '@/app/actions/tags';
import { cn } from '@/lib/utils';

export type TaskTagRow = {
  id: string;
  name: string;
};

type TagsSectionProps = {
  taskId: string;
  current: TaskTagRow[];
  available: TaskTagRow[];
  canEdit: boolean;
};

export function TagsSection({
  taskId,
  current,
  available,
  canEdit,
}: TagsSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <section
      aria-labelledby="sec-tags"
      className="px-4 md:px-6 py-5 border-b border-line-2"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-label" id="sec-tags">
          Tags
          <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
            {current.length}
          </span>
        </h2>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-[11px] font-medium text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-tag-plus text-[13px]" aria-hidden="true" />
            Add tag
          </button>
        ) : null}
      </div>

      {current.length === 0 ? (
        <p className="text-[13px] text-ink-3 italic">
          {canEdit
            ? 'No tags yet. Tap Add tag to pick from the master list.'
            : 'No tags yet.'}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {current.map((t) => (
            <TagChip key={t.id} taskId={taskId} tag={t} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {canEdit ? (
        <PickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          taskId={taskId}
          current={current}
          available={available}
        />
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------
// Chip
// ------------------------------------------------------------

function TagChip({
  taskId,
  tag,
  canEdit,
}: {
  taskId: string;
  tag: TaskTagRow;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const remove = () => {
    const fd = new FormData();
    fd.set('taskId', taskId);
    fd.set('tagId', tag.id);
    startTransition(async () => {
      const result = await removeTagFromTaskAction(undefined, fd);
      if (!result.ok && result.error) alert(result.error);
    });
  };

  return (
    <li
      className={cn(
        'inline-flex items-center gap-1 pl-2 py-1 pr-1 rounded-md bg-line-2 text-[11px] font-medium text-ink-2',
        pending && 'opacity-60',
      )}
    >
      <i className="ti ti-tag text-[11px] text-ink-3" aria-hidden="true" />
      {tag.name}
      {canEdit ? (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={`Remove tag ${tag.name}`}
          className="w-4 h-4 grid place-items-center rounded-full text-ink-3 hover:bg-bg hover:text-ink"
        >
          <i className="ti ti-x text-[10px]" aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------
// Picker sheet
// ------------------------------------------------------------

function PickerSheet({
  open,
  onClose,
  taskId,
  current,
  available,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  current: TaskTagRow[];
  available: TaskTagRow[];
}) {
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  // Calculate which tags are addable right now.
  const currentIds = new Set(current.map((t) => t.id));
  const filtered = available
    .filter((t) => !currentIds.has(t.id))
    .filter((t) => t.name.toLowerCase().includes(query.toLowerCase().trim()));

  const add = async (tagId: string) => {
    const fd = new FormData();
    fd.set('taskId', taskId);
    fd.set('tagId', tagId);
    setPendingId(tagId);
    try {
      const result = await addTagToTaskAction(undefined, fd);
      if (!result.ok && result.error) alert(result.error);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add tag"
      subtitle="Pick from the master list. Super Admin manages the master list."
    >
      {open ? (
        <div className="flex flex-col gap-3">
          <input
            type="search"
            placeholder="Search tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none focus:border-ink"
          />

          {filtered.length === 0 ? (
            <p className="text-[12px] text-ink-3 italic px-2 py-3 rounded-lg border border-dashed border-line text-center">
              {available.length === 0
                ? 'No tags in the master list yet. Super Admin can add some from Tags & labels.'
                : currentIds.size === available.length
                  ? 'All available tags are already on this task.'
                  : 'No tags match.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
              {filtered.map((t) => {
                const isPending = pendingId === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => add(t.id)}
                      disabled={isPending}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        'hover:bg-bg',
                        isPending && 'opacity-60',
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        <i className="ti ti-tag text-[14px] text-ink-3" aria-hidden="true" />
                        <span className="text-[13px] text-ink">{t.name}</span>
                      </span>
                      <i className="ti ti-plus text-[14px] text-primary" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2 mt-1"
          >
            Done
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}

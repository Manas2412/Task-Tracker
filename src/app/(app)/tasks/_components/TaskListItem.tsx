'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Avatar, HoverPreview, SwipeToReveal, TaskCard, type TaskCardProps } from '@/components/ui';
import { archiveTaskAction } from '@/app/actions/tasks';

type TaskListItemProps = TaskCardProps & {
  canArchive: boolean;
};

/**
 * Tasks-list row wrapper.
 *
 * On touch devices, a left-swipe reveals an Archive action — fires
 * `archiveTaskAction` and refreshes the list. On desktop, hovering the row
 * shows a clean preview of the task's description and owner (HoverPreview).
 */
export function TaskListItem({ canArchive, ...cardProps }: TaskListItemProps) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const archive = async () => {
    const fd = new FormData();
    fd.set('taskId', cardProps.taskId);
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        const result = await archiveTaskAction(undefined, fd);
        if (!result.ok && result.error) alert(result.error);
        router.refresh();
        resolve();
      });
    });
  };

  const card = canArchive ? (
    <SwipeToReveal
      action={{
        label: 'Archive',
        icon: 'ti-archive',
        tone: 'danger',
        onAction: archive,
      }}
    >
      <TaskCard {...cardProps} />
    </SwipeToReveal>
  ) : (
    <TaskCard {...cardProps} />
  );

  return <HoverPreview content={<TaskPreview {...cardProps} />}>{card}</HoverPreview>;
}

const MAX_PREVIEW_DOCS = 4;

/** The floating preview panel shown on hover — description, docs, owner. */
function TaskPreview({ name, description, owner, attachmentNames }: TaskCardProps) {
  const hasDescription = !!description && description.trim().length > 0;
  const docs = attachmentNames ?? [];
  const shownDocs = docs.slice(0, MAX_PREVIEW_DOCS);
  const extraDocs = docs.length - shownDocs.length;

  return (
    <div className="rounded-xl border border-line bg-bg p-3.5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.22)]">
      <p className="text-[12.5px] font-medium text-ink leading-snug line-clamp-2">{name}</p>

      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-2 line-clamp-4">
        {hasDescription ? (
          description
        ) : (
          <span className="italic text-ink-3">No description</span>
        )}
      </p>

      {docs.length > 0 ? (
        <div className="mt-3 border-t border-line pt-2.5">
          <p className="text-[11px] uppercase tracking-[0.06em] text-ink-3 mb-1.5">
            Docs attached
          </p>
          <ul className="flex flex-col gap-1">
            {shownDocs.map((fileName, i) => (
              <li key={i} className="flex items-center gap-1.5 min-w-0">
                <i className="ti ti-paperclip text-[12px] text-ink-3 shrink-0" aria-hidden="true" />
                <span className="text-[12px] text-ink-2 truncate">{fileName}</span>
              </li>
            ))}
            {extraDocs > 0 ? (
              <li className="text-[11px] text-ink-3 pl-[18px]">
                and {extraDocs} more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
        <Avatar
          initials={owner.initials}
          colour={owner.colour}
          size="xs"
          ariaLabel={`Owner ${owner.name}`}
        />
        <span className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Owner</span>
        <span className="ml-auto truncate text-[12px] font-medium text-ink">{owner.name}</span>
      </div>
    </div>
  );
}

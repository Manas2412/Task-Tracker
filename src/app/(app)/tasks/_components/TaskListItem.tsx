'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { SwipeToReveal, TaskCard, type TaskCardProps } from '@/components/ui';
import { archiveTaskAction } from '@/app/actions/tasks';

type TaskListItemProps = TaskCardProps & {
  canArchive: boolean;
};

/**
 * Tasks-list row wrapper.
 *
 * On touch devices, a left-swipe reveals an Archive action — fires
 * `archiveTaskAction` and refreshes the list. Desktop behaves identically
 * to the bare `<TaskCard>` (no swipe handlers attach without touch).
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

  if (!canArchive) {
    return <TaskCard {...cardProps} />;
  }

  return (
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
  );
}

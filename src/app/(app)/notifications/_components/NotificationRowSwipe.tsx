'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { SwipeToReveal } from '@/components/ui';
import { markNotificationReadAction } from '@/app/actions/notifications';

type NotificationRowSwipeProps = {
  notificationId: string;
  unread: boolean;
  children: React.ReactNode;
};

/**
 * Wraps a notification row in `<SwipeToReveal>` with a Mark-read action.
 *
 * Already-read rows pass through with no swipe handlers (nothing to do).
 */
export function NotificationRowSwipe({
  notificationId,
  unread,
  children,
}: NotificationRowSwipeProps) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (!unread) return <>{children}</>;

  const markRead = async () => {
    const fd = new FormData();
    fd.set('id', notificationId);
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        await markNotificationReadAction(undefined, fd);
        router.refresh();
        resolve();
      });
    });
  };

  return (
    <SwipeToReveal
      action={{
        label: 'Mark read',
        icon: 'ti-check',
        tone: 'primary',
        onAction: markRead,
      }}
    >
      {children}
    </SwipeToReveal>
  );
}

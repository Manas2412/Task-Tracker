'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

import {
  markAllNotificationsReadAction,
  readAndRedirectAction,
} from '@/app/actions/notifications';
import { NotificationTaskCard } from '@/components/ui';
import {
  describeNotification,
  type DescribedNotification,
} from '@/lib/notifications';
import type { NotificationTaskContext } from '@/lib/notification-context';
import { cn } from '@/lib/utils';

export type BellNotification = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
  taskContext?: NotificationTaskContext;
};

type NotificationsBellProps = {
  unreadCount: number;
  recent: BellNotification[];
};

/**
 * Top-bar notifications bell + dropdown.
 *
 * Mobile/tablet/desktop: same dropdown, anchored to the right of the bell.
 * Server actions handle mark-read and read-and-navigate.
 */
export function NotificationsBell({ unreadCount, recent }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications — ${unreadCount} unread`
            : 'Notifications'
        }
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 grid place-items-center rounded-full text-ink-2 hover:bg-line-2 transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <i className="ti ti-bell text-[18px]" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-urgent text-white text-[9px] font-medium grid place-items-center border-2 border-bg"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          'absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-32px)] rounded-xl border border-line bg-panel shadow-xl z-50',
          'transition-all duration-150 origin-top-right overflow-hidden',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none',
        )}
      >
        <header className="flex items-center justify-between px-3.5 py-3 border-b border-line-2">
          <div>
            <h3 className="font-serif text-[16px] leading-none text-ink">Notifications</h3>
            <p className="text-[10px] text-ink-3 mt-1">
              {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
            </p>
          </div>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="text-[11px] font-medium text-primary px-2 py-1 rounded-md hover:bg-primary-soft"
              >
                Mark all read
              </button>
            </form>
          ) : null}
        </header>

        <ul className="max-h-[440px] overflow-y-auto">
          {recent.length === 0 ? (
            <li className="px-4 py-10 text-center">
              <i
                className="ti ti-bell-off text-[28px] text-ink-3 block mb-2"
                aria-hidden="true"
              />
              <p className="text-[12px] text-ink-2">No notifications yet.</p>
            </li>
          ) : (
            recent.map((n) => <Row key={n.id} notification={n} onSelect={() => setOpen(false)} />)
          )}
        </ul>

        <footer className="px-3 py-2 border-t border-line-2 bg-bg">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-[12px] font-medium text-primary py-1.5 rounded-md hover:bg-primary-soft"
          >
            View all
          </Link>
        </footer>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Row
// ------------------------------------------------------------

function Row({
  notification,
  onSelect,
}: {
  notification: BellNotification;
  onSelect: () => void;
}) {
  const described = describeNotification(notification.type, notification.payload);
  const isUnread = !notification.readAt;

  return (
    <li className="border-b border-line-2 last:border-b-0">
      <form action={readAndRedirectAction}>
        <input type="hidden" name="id" value={notification.id} />
        <input type="hidden" name="href" value={described.href} />
        <button
          type="submit"
          onClick={onSelect}
          className={cn(
            'w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-bg transition-colors relative',
            isUnread && accentBg(described.accent),
          )}
        >
          {isUnread ? (
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-0 top-2 bottom-2 w-[2px] rounded-r',
                accentLine(described.accent),
              )}
            />
          ) : null}

          <span
            className={cn(
              'w-7 h-7 grid place-items-center rounded-lg shrink-0',
              isUnread ? 'bg-panel' : 'bg-line-2',
            )}
          >
            <i
              className={cn('ti', described.icon, 'text-[14px]', described.iconClass)}
              aria-hidden="true"
            />
          </span>

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-[12.5px] leading-snug',
                isUnread ? 'text-ink font-medium' : 'text-ink-2',
              )}
            >
              {described.text}
            </p>
            {notification.taskContext ? (
              <NotificationTaskCard {...notification.taskContext} variant="compact" />
            ) : null}
            <time
              className="text-[10px] text-ink-3 mt-0.5 block"
              dateTime={notification.createdAt.toISOString()}
            >
              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
            </time>
          </div>

          {isUnread ? (
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full bg-urgent mt-1 shrink-0"
            />
          ) : null}
        </button>
      </form>
    </li>
  );
}

function accentBg(accent: DescribedNotification['accent']) {
  switch (accent) {
    case 'js':
      return 'bg-accent-soft/40';
    case 'urgent':
      return 'bg-urgent-soft/40';
    case 'primary':
      return 'bg-primary-soft/50';
    case 'info':
      return 'bg-info-soft/30';
    default:
      return 'bg-bg/50';
  }
}

function accentLine(accent: DescribedNotification['accent']) {
  switch (accent) {
    case 'js':
      return 'bg-accent';
    case 'urgent':
      return 'bg-urgent';
    case 'primary':
      return 'bg-primary';
    case 'info':
      return 'bg-info';
    default:
      return 'bg-ink-4';
  }
}

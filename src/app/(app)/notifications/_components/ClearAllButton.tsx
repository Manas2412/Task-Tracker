'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

import { clearAllNotificationsAction } from '@/app/actions/notifications';
import { cn } from '@/lib/utils';

/**
 * Header action on /notifications: clears the caller's whole inbox.
 * Because it deletes, it asks for a one-tap confirm first. Clearing marks
 * any unread items read (leaving the task read-receipt trail) — see
 * clearAllNotificationsAction.
 */
export function ClearAllButton({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 hover:text-ink transition-colors"
      >
        <i className="ti ti-trash text-[14px]" aria-hidden="true" />
        Clear all
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[12px] text-ink-2">
        Clear {count} {count === 1 ? 'notification' : 'notifications'}?
      </span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-2.5 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink-2 hover:bg-line-2 transition-colors"
      >
        Cancel
      </button>
      <form action={clearAllNotificationsAction}>
        <ConfirmButton />
      </form>
    </div>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-urgent text-white text-[12px] font-medium transition-opacity',
        'disabled:opacity-60',
      )}
    >
      <i className="ti ti-trash text-[14px]" aria-hidden="true" />
      {pending ? 'Clearing…' : 'Clear all'}
    </button>
  );
}

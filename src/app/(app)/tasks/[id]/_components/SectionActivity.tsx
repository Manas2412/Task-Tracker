'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/utils';

type Activity = {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  actor: { name: string };
};

type SectionActivityProps = {
  activity: Activity[];
};

/**
 * Per-task activity log. Top 3 visible; "Show older activity" reveals
 * the rest. Sentence-case copy via the event-type → human-string map.
 */
export function SectionActivity({ activity }: SectionActivityProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? activity : activity.slice(0, 3);
  const older = activity.length - 3;

  return (
    <section aria-labelledby="sec-activity" className="px-4 md:px-6 py-5">
      <h2 id="sec-activity" className="section-label mb-3">
        Activity
      </h2>

      {activity.length === 0 ? (
        <p className="text-[13px] text-ink-3 italic">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 text-[12px] text-ink-2 leading-relaxed">
              <span
                aria-hidden="true"
                className={cn(
                  'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                  isAccent(e.eventType) ? 'bg-accent' : 'bg-ink-4',
                )}
              />
              <span className="flex-1">
                <span className="text-ink font-medium">{e.actor.name}</span>{' '}
                {describeEvent(e.eventType, e.payload)}
                <time
                  className="ml-1.5 text-ink-3 text-[11px]"
                  dateTime={e.createdAt.toISOString()}
                  title={format(e.createdAt, 'd LLL yyyy, h:mm a')}
                >
                  {isReadReceipt(e.eventType)
                    ? `on ${format(e.createdAt, 'd LLL yyyy, h:mm aaa')}`
                    : formatDistanceToNow(e.createdAt, { addSuffix: true })}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}

      {older > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary"
        >
          <i
            className={cn(
              'ti ti-chevron-down text-[14px] transition-transform',
              showAll && 'rotate-180',
            )}
            aria-hidden="true"
          />
          {showAll ? 'Hide older activity' : `Show older activity (${older})`}
        </button>
      ) : null}
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_input: 'Awaiting input',
  on_hold: 'On hold',
  completed: 'Completed',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function describeEvent(type: string, payload: Record<string, unknown> | null): string {
  if (!payload) payload = {};
  switch (type) {
    case 'task_created':
      return 'created this task';
    case 'status_changed':
      return `changed status to ${STATUS_LABEL[String(payload.to)] ?? String(payload.to)}`;
    case 'priority_changed':
      return `changed priority to ${PRIORITY_LABEL[String(payload.to)] ?? String(payload.to)}`;
    case 'description_updated':
      return 'updated the description';
    case 'due_date_changed':
      return payload.to
        ? `set the due date to ${payload.to}`
        : 'cleared the due date';
    case 'visibility_changed':
      return `set visibility to ${String(payload.to)}`;
    case 'milestone_toggled':
      return payload.milestone ? 'marked as milestone' : 'unmarked as milestone';
    case 'subtask_added':
      return `added subtask "${String(payload.name ?? '')}"`;
    case 'subtask_completed':
      return `completed subtask "${String(payload.name ?? '')}"`;
    case 'subtask_reopened':
      return `reopened subtask "${String(payload.name ?? '')}"`;
    case 'task_archived':
      return 'archived this task';
    case 'task_transferred':
      return `transferred this task to ${String(payload.toName ?? '')}`;
    case 'task_renamed':
      return `renamed this task to "${String(payload.to ?? '')}"`;
    case 'task_read':
      return 'read this task';
    case 'subtask_read':
      return `read subtask "${String(payload.subtaskName ?? '')}"`;
    default:
      return type.replace(/_/g, ' ');
  }
}

/** Read receipts show the absolute date and time, not a relative phrase. */
function isReadReceipt(type: string): boolean {
  return type === 'task_read' || type === 'subtask_read';
}

function isAccent(type: string): boolean {
  return type === 'status_changed' || type === 'js_priority_changed';
}

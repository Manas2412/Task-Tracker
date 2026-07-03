'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/utils';

type TfActivity = {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  actor: { name: string };
};

type TfActivitySectionProps = {
  activity: TfActivity[];
};

export function TfActivitySection({ activity }: TfActivitySectionProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? activity : activity.slice(0, 3);
  const older = activity.length - 3;

  return (
    <section aria-labelledby="tf-activity" className="px-4 md:px-6 py-5">
      <h2 className="section-label mb-3" id="tf-activity">
        Activity
      </h2>

      {activity.length === 0 ? (
        <p className="text-[13px] text-ink-3 italic">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-2.5 text-[12px] text-ink-2 leading-relaxed"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                  accentEvent(e.eventType) ? 'bg-primary' : 'bg-ink-4',
                )}
              />
              <span className="flex-1">
                <span className="text-ink font-medium">{e.actor.name}</span>{' '}
                {describeTfEvent(e.eventType, e.payload)}
                <time
                  className="ml-1.5 text-ink-3 text-[11px]"
                  dateTime={e.createdAt.toISOString()}
                >
                  {formatDistanceToNow(e.createdAt, { addSuffix: true })}
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

const TF_STATUS_LABEL: Record<string, string> = {
  pending_action: 'Pending action',
  in_progress: 'In progress',
  awaiting_reply: 'Awaiting reply',
  on_hold: 'On hold',
  closed: 'Closed',
};

function describeTfEvent(type: string, payload: Record<string, unknown> | null): string {
  if (!payload) payload = {};
  switch (type) {
    case 'created_from_correspondence':
      return 'created this file';
    case 'status_changed':
      return `changed status to ${TF_STATUS_LABEL[String(payload.to)] ?? String(payload.to)}`;
    case 'fields_updated':
      return 'updated the file details';
    case 'secretary_comment_added':
      return 'updated the secretary\'s comments';
    case 'desk_comment_added':
      return 'updated the desk comment';
    case 'tf_renamed':
      return `renamed the subject to "${String(payload.to ?? '')}"`;
    case 'deadline_changed':
      return payload.to
        ? `set the deadline to ${String(payload.to)}`
        : 'cleared the deadline';
    case 'marked_to_division':
      return 'marked the file to another division';
    case 'marked_to_division_removed':
      return 'removed a division from marked-to';
    case 'task_linked':
      return `linked a new task "${String(payload.taskName ?? '')}"`;
    case 'task_unlinked':
      return 'unlinked a task';
    case 'source_document_added':
      return 'uploaded a source document';
    case 'action_document_uploaded':
      return 'uploaded the action document';
    case 'forwarded_to_division':
      return 'forwarded the file to a division';
    default:
      return type.replace(/_/g, ' ');
  }
}

function accentEvent(type: string): boolean {
  return (
    type === 'status_changed' ||
    type === 'secretary_comment_added' ||
    type === 'created_from_correspondence'
  );
}

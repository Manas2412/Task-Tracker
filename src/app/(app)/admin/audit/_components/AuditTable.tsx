'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';

import { Avatar } from '@/components/ui';
import { initialsOf } from '@/lib/format';
import { summariseDiff, type AuditEntry } from '@/lib/audit';
import { cn } from '@/lib/utils';

type AuditTableProps = {
  entries: AuditEntry[];
};

const ACTION_TONE: Record<string, string> = {
  create: 'bg-success-soft text-success border-success/30',
  restore: 'bg-success-soft text-success border-success/30',
  update: 'bg-info-soft text-info border-info/30',
  role_change: 'bg-info-soft text-info border-info/30',
  hierarchy_change: 'bg-info-soft text-info border-info/30',
  archive: 'bg-hold-soft text-hold border-hold/30',
  delete: 'bg-urgent-soft text-urgent border-urgent/30',
  login: 'bg-low-soft text-low border-line',
  logout: 'bg-low-soft text-low border-line',
  password_reset: 'bg-accent-soft text-accent border-accent-line',
};

const ENTITY_ICON: Record<string, string> = {
  user: 'ti-user',
  division: 'ti-building',
  task: 'ti-checklist',
  timeline_file: 'ti-file-stack',
  attachment: 'ti-paperclip',
  tag: 'ti-tag',
  system: 'ti-server',
};

const ENTITY_LABEL: Record<string, string> = {
  user: 'User',
  division: 'Division',
  task: 'Task',
  timeline_file: 'Timeline file',
  attachment: 'Attachment',
  tag: 'Tag',
  system: 'System',
};

export function AuditTable({ entries }: AuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-panel p-12 text-center">
        <i
          className="ti ti-history text-[32px] text-ink-3 block mb-2"
          aria-hidden="true"
        />
        <h2 className="font-serif text-[18px] text-ink mb-1">No audit entries match</h2>
        <p className="text-[13px] text-ink-2 max-w-md mx-auto">
          Adjust the filters above, or wait for the next mutation — every
          Super Admin action is logged here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-xl overflow-hidden">
      {/* Desktop table */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="text-left bg-bg border-b border-line">
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Entity</Th>
            <Th>Changes</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <DesktopRow
              key={e.id}
              entry={e}
              expanded={expandedId === e.id}
              onToggle={() =>
                setExpandedId(expandedId === e.id ? null : e.id)
              }
            />
          ))}
        </tbody>
      </table>

      {/* Mobile card list */}
      <ul className="md:hidden divide-y divide-line-2">
        {entries.map((e) => (
          <MobileRow
            key={e.id}
            entry={e}
            expanded={expandedId === e.id}
            onToggle={() =>
              setExpandedId(expandedId === e.id ? null : e.id)
            }
          />
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------
// Rows
// ------------------------------------------------------------

function DesktopRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-line-2 last:border-b-0 hover:bg-bg/60 transition-colors">
        <Td>
          <When date={entry.createdAt} />
        </Td>
        <Td>
          <Actor entry={entry} />
        </Td>
        <Td>
          <ActionPill action={entry.action} />
        </Td>
        <Td>
          <Entity entry={entry} />
        </Td>
        <Td>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-start gap-1.5 text-left text-[12px] text-ink hover:underline w-full"
            aria-expanded={expanded}
          >
            <span className="flex-1 truncate">
              {summariseDiff(entry.before, entry.after)}
            </span>
            <i
              className={cn(
                'ti ti-chevron-down text-[14px] text-ink-3 mt-0.5 transition-transform shrink-0',
                expanded && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
        </Td>
      </tr>
      {expanded ? (
        <tr className="bg-bg/40 border-b border-line-2">
          <td colSpan={5} className="px-3.5 py-3">
            <JsonDiff before={entry.before} after={entry.after} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function MobileRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="p-3.5">
      <div className="flex items-start gap-3">
        <Actor entry={entry} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <ActionPill action={entry.action} />
            <Entity entry={entry} />
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="text-[12px] text-ink mt-1.5 text-left"
            aria-expanded={expanded}
          >
            {summariseDiff(entry.before, entry.after)}
          </button>
          <When date={entry.createdAt} muted />
        </div>
      </div>
      {expanded ? (
        <div className="mt-2 px-2">
          <JsonDiff before={entry.before} after={entry.after} />
        </div>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------
// Cell primitives
// ------------------------------------------------------------

function When({ date, muted }: { date: Date; muted?: boolean }) {
  const absolute = format(date, 'd LLL yyyy, h:mm a');
  const relative = formatDistanceToNow(date, { addSuffix: true });
  return (
    <span
      className={cn('text-[11px]', muted ? 'text-ink-3 block mt-1' : 'text-ink-2')}
      title={absolute}
    >
      <span className="block text-[10px] text-ink-3 leading-none">{relative}</span>
      <time className="leading-none" dateTime={date.toISOString()}>
        {absolute}
      </time>
    </span>
  );
}

function Actor({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar
        initials={initialsOf(entry.actor.name)}
        colour={entry.actor.division?.avatarColour ?? '#1a1a1a'}
        size="sm"
        ariaLabel={entry.actor.name}
      />
      <span className="text-[12.5px] font-medium text-ink truncate">
        {entry.actor.name}
      </span>
    </div>
  );
}

function ActionPill({ action }: { action: AuditEntry['action'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill text-[10px] font-medium tracking-pill border',
        ACTION_TONE[action] ?? 'bg-bg text-ink-2 border-line',
      )}
    >
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function Entity({ entry }: { entry: AuditEntry }) {
  const icon = ENTITY_ICON[entry.entityType] ?? 'ti-circle-dot';
  const label = ENTITY_LABEL[entry.entityType] ?? entry.entityType;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink min-w-0">
      <i className={cn('ti', icon, 'text-[13px] text-ink-3')} aria-hidden="true" />
      <span className="text-ink-3 text-[10px]">{label}</span>
      <span className="text-ink truncate max-w-[300px]">{entry.entityName}</span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3 px-3.5 py-2.5">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3.5 py-3 align-top">{children}</td>;
}

function JsonDiff({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px] text-ink-2">
      <div>
        <p className="text-[9px] uppercase tracking-[0.06em] font-medium text-ink-3 mb-1">
          Before
        </p>
        <pre className="bg-bg border border-line rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
          {Object.keys(before).length === 0 ? '∅' : JSON.stringify(before, null, 2)}
        </pre>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-[0.06em] font-medium text-ink-3 mb-1">
          After
        </p>
        <pre className="bg-bg border border-line rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
          {Object.keys(after).length === 0 ? '∅' : JSON.stringify(after, null, 2)}
        </pre>
      </div>
    </div>
  );
}

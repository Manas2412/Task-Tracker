'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

type Division = { id: string; name: string };

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_input', label: 'Awaiting input' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITIES = [
  { value: '', label: 'Any priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function SearchAdvancedFilters({ divisions }: { divisions: Division[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const status = sp.get('status') ?? '';
  const priority = sp.get('priority') ?? '';
  const divisionId = sp.get('division') ?? '';
  const dueFrom = sp.get('dueFrom') ?? '';
  const dueTo = sp.get('dueTo') ?? '';
  const jsP = sp.get('jsP') === '1';

  const navigate = (updates: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`/search?${next.toString()}`, { scroll: false });
  };

  const hasFilters = status || priority || divisionId || dueFrom || dueTo || jsP;

  return (
    <div className="mb-4 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.06em] text-ink-3 font-medium">
          Filter tasks
        </span>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => navigate({ status: e.target.value })}
          className={cn(
            'text-[12px] px-2.5 py-1.5 rounded-lg border bg-panel outline-none transition-colors',
            status ? 'border-ink text-ink' : 'border-line text-ink-2',
          )}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={priority}
          onChange={(e) => navigate({ priority: e.target.value })}
          className={cn(
            'text-[12px] px-2.5 py-1.5 rounded-lg border bg-panel outline-none transition-colors',
            priority ? 'border-ink text-ink' : 'border-line text-ink-2',
          )}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Division */}
        <select
          value={divisionId}
          onChange={(e) => navigate({ division: e.target.value })}
          className={cn(
            'text-[12px] px-2.5 py-1.5 rounded-lg border bg-panel outline-none transition-colors',
            divisionId ? 'border-ink text-ink' : 'border-line text-ink-2',
          )}
        >
          <option value="">Any division</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* JS Priority toggle */}
        <button
          type="button"
          onClick={() => navigate({ jsP: jsP ? '' : '1' })}
          className={cn(
            'text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors font-medium',
            jsP ? 'bg-ink text-onink border-ink' : 'bg-panel text-ink-2 border-line hover:border-ink-4',
          )}
        >
          JS Priority
        </button>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => navigate({ status: '', priority: '', division: '', dueFrom: '', dueTo: '', jsP: '' })}
            className="text-[11px] text-ink-3 hover:text-ink-2 transition-colors underline underline-offset-2"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Due date range */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-ink-3">Due</span>
        <input
          type="date"
          value={dueFrom}
          onChange={(e) => navigate({ dueFrom: e.target.value })}
          className={cn(
            'text-[12px] px-2.5 py-1.5 rounded-lg border bg-panel outline-none transition-colors',
            dueFrom ? 'border-ink text-ink' : 'border-line text-ink-3',
          )}
        />
        <span className="text-[11px] text-ink-3">to</span>
        <input
          type="date"
          value={dueTo}
          onChange={(e) => navigate({ dueTo: e.target.value })}
          className={cn(
            'text-[12px] px-2.5 py-1.5 rounded-lg border bg-panel outline-none transition-colors',
            dueTo ? 'border-ink text-ink' : 'border-line text-ink-3',
          )}
        />
      </div>
    </div>
  );
}

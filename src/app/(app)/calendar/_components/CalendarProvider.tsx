'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useQuickCreate } from '@/app/(app)/tasks/_components/QuickCreate';
import { Sheet } from '@/components/ui';
import { formatDayLong, isoDay } from '@/lib/date';

import type { CalendarEvent } from '@/lib/calendar';
import { DaySheet, type CreateAction } from './DaySheet';
import { EngagementDetail } from './EngagementDetail';
import { EngagementForm } from './EngagementForm';
import type { PickUser } from './types';

type CalendarContextValue = {
  canManageEngagements: boolean;
  canCreateTf: boolean;
  /**
   * Open the day sheet. In view mode (default) it shows that day's agenda
   * plus the "Create new" actions; in create mode (`createOnly`) it shows
   * only the create actions — used by the "+"/"New" shortcuts, where the
   * agenda is either already on screen or beside the point.
   */
  openDay: (dateIso: string, createOnly?: boolean) => void;
  /** Open an engagement's detail sheet. */
  openEngagementDetail: (id: string) => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used inside CalendarProvider');
  return ctx;
}

type ProviderProps = {
  canManageEngagements: boolean;
  canCreateTf: boolean;
  participantCandidates: PickUser[];
  /** Every event in the loaded window — the day sheet reads its agenda from here. */
  events: CalendarEvent[];
  children: ReactNode;
};

/** "Today" / "Tomorrow" relative to the current IST day, else null. */
function relativeLabel(iso: string): 'Today' | 'Tomorrow' | null {
  const now = new Date();
  if (iso === isoDay(now)) return 'Today';
  // India has no DST, so +24h always lands on the next calendar day.
  if (iso === isoDay(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return 'Tomorrow';
  return null;
}

export function CalendarProvider({
  canManageEngagements,
  canCreateTf,
  participantCandidates,
  events,
  children,
}: ProviderProps) {
  const router = useRouter();
  const quickCreate = useQuickCreate();

  const [dayIso, setDayIso] = useState<string | null>(null);
  const [dayCreateOnly, setDayCreateOnly] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = isoDay(e.date);
      const bucket = m.get(key);
      if (bucket) bucket.push(e);
      else m.set(key, [e]);
    }
    return m;
  }, [events]);

  const openDay = (dateIso: string, createOnly = false) => {
    setDayCreateOnly(createOnly);
    setDayIso(dateIso);
  };
  const openEngagementDetail = (id: string) => setDetailId(id);

  const startEngagement = (dateIso: string) => {
    setDayIso(null);
    setCreateDate(dateIso);
  };
  const startTask = (dateIso: string) => {
    setDayIso(null);
    quickCreate.open({ dueDate: dateIso });
  };
  const startTf = () => {
    setDayIso(null);
    router.push('/timeline-files');
  };

  const dayEvents = dayIso ? (eventsByDay.get(dayIso) ?? []) : [];
  const showAgenda = dayIso !== null && !dayCreateOnly;

  const dayActions: CreateAction[] = dayIso
    ? [
        ...(canManageEngagements
          ? [
              {
                key: 'engagement',
                icon: 'ti-users-group',
                tone: 'text-info',
                label: 'Add JS engagement',
                hint: 'Schedule a meeting',
                onClick: () => startEngagement(dayIso),
              } as CreateAction,
            ]
          : []),
        {
          key: 'task',
          icon: 'ti-checkbox',
          tone: 'text-primary',
          label: 'Create task',
          hint: 'With this due date',
          onClick: () => startTask(dayIso),
        },
        ...(canCreateTf
          ? [
              {
                key: 'tf',
                icon: 'ti-file-stack',
                tone: 'text-urgent',
                label: 'Create timeline file',
                hint: 'Opens the files workspace',
                onClick: startTf,
              } as CreateAction,
            ]
          : []),
      ]
    : [];

  const daySubtitle = (() => {
    if (!dayIso) return undefined;
    const rel = relativeLabel(dayIso);
    if (dayCreateOnly) return rel ?? undefined;
    const count = dayEvents.length;
    const items = count === 0 ? 'No items scheduled' : `${count} ${count === 1 ? 'item' : 'items'}`;
    return rel ? `${rel} · ${items}` : items;
  })();

  return (
    <CalendarContext.Provider
      value={{ canManageEngagements, canCreateTf, openDay, openEngagementDetail }}
    >
      {children}

      {/* Day sheet — the day's agenda plus the "Create new" actions. */}
      <Sheet
        open={dayIso !== null}
        onClose={() => setDayIso(null)}
        title={dayIso ? formatDayLong(dayIso) : 'Day'}
        subtitle={daySubtitle}
      >
        {dayIso !== null ? (
          <DaySheet
            events={dayEvents}
            actions={dayActions}
            showAgenda={showAgenda}
            onRowActivate={() => setDayIso(null)}
          />
        ) : null}
      </Sheet>

      {/* Create engagement */}
      <Sheet
        open={createDate !== null}
        onClose={() => setCreateDate(null)}
        title="New JS engagement"
      >
        {createDate !== null ? (
          <EngagementForm
            candidates={participantCandidates}
            defaultDate={createDate}
            onDone={() => {
              setCreateDate(null);
              router.refresh();
            }}
          />
        ) : null}
      </Sheet>

      {/* Engagement detail */}
      <Sheet
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Engagement"
      >
        {detailId !== null ? (
          <EngagementDetail
            engagementId={detailId}
            candidates={participantCandidates}
            canManage={canManageEngagements}
            onClose={() => setDetailId(null)}
          />
        ) : null}
      </Sheet>
    </CalendarContext.Provider>
  );
}

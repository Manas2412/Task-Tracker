'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useQuickCreate } from '@/app/(app)/tasks/_components/QuickCreate';
import { Sheet } from '@/components/ui';
import { cn } from '@/lib/utils';

import { EngagementDetail } from './EngagementDetail';
import { EngagementForm } from './EngagementForm';
import type { PickUser } from './types';

type CalendarContextValue = {
  canManageEngagements: boolean;
  canCreateTf: boolean;
  /** Open the "add to this date" menu for a clicked cell. */
  openDateMenu: (dateIso: string) => void;
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
  children: ReactNode;
};

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });
}

export function CalendarProvider({
  canManageEngagements,
  canCreateTf,
  participantCandidates,
  children,
}: ProviderProps) {
  const router = useRouter();
  const quickCreate = useQuickCreate();

  const [menuDate, setMenuDate] = useState<string | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const openDateMenu = (dateIso: string) => setMenuDate(dateIso);
  const openEngagementDetail = (id: string) => setDetailId(id);

  const startEngagement = (dateIso: string) => {
    setMenuDate(null);
    setCreateDate(dateIso);
  };
  const startTask = (dateIso: string) => {
    setMenuDate(null);
    quickCreate.open({ dueDate: dateIso });
  };
  const startTf = () => {
    setMenuDate(null);
    router.push('/timeline-files');
  };

  return (
    <CalendarContext.Provider
      value={{ canManageEngagements, canCreateTf, openDateMenu, openEngagementDetail }}
    >
      {children}

      {/* Date action menu */}
      <Sheet
        open={menuDate !== null}
        onClose={() => setMenuDate(null)}
        title={menuDate ? `Add to ${formatDay(menuDate)}` : 'Add'}
      >
        {menuDate ? (
          <div className="flex flex-col gap-2">
            {canManageEngagements ? (
              <ActionButton
                icon="ti-users-group"
                tone="text-info"
                label="Add JS engagement"
                hint="Schedule a meeting"
                onClick={() => startEngagement(menuDate)}
              />
            ) : null}
            <ActionButton
              icon="ti-checkbox"
              tone="text-primary"
              label="Create task"
              hint="With this due date"
              onClick={() => startTask(menuDate)}
            />
            {canCreateTf ? (
              <ActionButton
                icon="ti-file-stack"
                tone="text-urgent"
                label="Create timeline file"
                hint="Opens the files workspace"
                onClick={startTf}
              />
            ) : null}
          </div>
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

function ActionButton({
  icon,
  tone,
  label,
  hint,
  onClick,
}: {
  icon: string;
  tone: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-line bg-panel hover:border-ink-4 hover:bg-bg transition-colors text-left"
    >
      <span className={cn('w-9 h-9 grid place-items-center rounded-lg bg-bg', tone)}>
        <i className={cn('ti', icon, 'text-[18px]')} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        <span className="block text-[12px] text-ink-3">{hint}</span>
      </span>
      <i className="ti ti-chevron-right text-[15px] text-ink-3 ml-auto" aria-hidden="true" />
    </button>
  );
}

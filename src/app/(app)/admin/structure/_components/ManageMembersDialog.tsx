'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

import { Avatar, Sheet } from '@/components/ui';
import {
  changeDivisionAction,
  createUserAction,
  setUserPmuAction,
} from '@/app/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserState,
} from '@/app/actions/states';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

import {
  UserFormFields,
  type UserFormDivisionOption,
  type UserFormSupervisorOption,
} from '@/app/(app)/admin/users/_components/UserFormFields';

type ExistingUser = {
  id: string;
  name: string;
  username: string;
  designation: string;
  divisionId: string;
  divisionName: string;
  divisionColour: string;
  pmuId: string | null;
};

type ManageMembersDialogProps = {
  open: boolean;
  onClose: () => void;
  divisionId: string;
  divisionName: string;
  /**
   * Set when managing a PMU team instead of a ministry unit. Members are
   * matched on users.pmu_id and added via setUserPmuAction — sub-division
   * and section are never required for PMU members.
   */
  pmu: { id: string; homeDivisionId: string | null } | null;
  existingUsers: ExistingUser[];
  divisions: UserFormDivisionOption[];
  supervisors: UserFormSupervisorOption[];
};

type Tab = 'add' | 'create';

export function ManageMembersDialog({
  open,
  onClose,
  divisionId,
  divisionName,
  pmu,
  existingUsers,
  divisions,
  supervisors,
}: ManageMembersDialogProps) {
  const [tab, setTab] = useState<Tab>('add');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setTab('add');
      setSearch('');
    }
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Manage members — ${divisionName}`}
      subtitle={
        pmu
          ? 'Add an existing user or create a new one in this PMU team.'
          : 'Add an existing user or create a new one in this unit.'
      }
    >
      {open ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 bg-bg rounded-lg p-0.5">
            <TabButton active={tab === 'add'} onClick={() => setTab('add')}>
              Add existing
            </TabButton>
            <TabButton active={tab === 'create'} onClick={() => setTab('create')}>
              Create new
            </TabButton>
          </div>

          {tab === 'add' ? (
            <AddExistingTab
              search={search}
              onSearchChange={setSearch}
              users={existingUsers}
              divisionId={divisionId}
              pmu={pmu}
              onDone={onClose}
            />
          ) : (
            <CreateNewTab
              divisionId={pmu ? pmu.homeDivisionId ?? divisionId : divisionId}
              pmuId={pmu?.id ?? null}
              divisions={divisions}
              supervisors={supervisors}
              onDone={onClose}
            />
          )}
        </div>
      ) : null}
    </Sheet>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 py-1.5 rounded-md text-[12px] font-medium transition-colors',
        active
          ? 'bg-panel text-ink shadow-sm'
          : 'text-ink-3 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function AddExistingTab({
  search,
  onSearchChange,
  users,
  divisionId,
  pmu,
  onDone,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  users: ExistingUser[];
  divisionId: string;
  pmu: { id: string; homeDivisionId: string | null } | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  const currentMembers = pmu ? users.filter((u) => u.pmuId === pmu.id) : [];
  // A PMU member keeps their home division, so only users already in the
  // PMU's division are eligible — matching the server rule and keeping the
  // division stable. To pull in someone from elsewhere, change their
  // division first.
  const candidates = pmu
    ? users.filter(
        (u) =>
          u.pmuId !== pmu.id &&
          (pmu.homeDivisionId == null || u.divisionId === pmu.homeDivisionId),
      )
    : users.filter((u) => u.divisionId !== divisionId);

  const q = search.toLowerCase();
  const filtered = q
    ? candidates.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.divisionName.toLowerCase().includes(q),
      )
    : candidates;

  const run = (userId: string, fd: FormData) => {
    setMovingId(userId);
    startTransition(async () => {
      const result = pmu
        ? await setUserPmuAction(undefined, fd)
        : await changeDivisionAction(undefined, fd);
      if (!result.ok && result.error) {
        alert(result.error);
        setMovingId(null);
      } else {
        setMovingId(null);
        router.refresh();
      }
    });
  };

  const handleAdd = (userId: string) => {
    const fd = new FormData();
    fd.set('userId', userId);
    if (pmu) {
      fd.set('pmuId', pmu.id);
    } else {
      fd.set('divisionId', divisionId);
    }
    run(userId, fd);
    if (!pmu) onDone();
  };

  const handleRemove = (userId: string) => {
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('pmuId', '');
    run(userId, fd);
  };

  return (
    <div className="flex flex-col gap-2">
      {pmu && currentMembers.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium text-ink-2 mb-1">
            Team members ({currentMembers.length})
          </p>
          <ul className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto border border-line rounded-lg p-1 mb-1">
            {currentMembers.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg transition-colors"
              >
                <Avatar
                  initials={initialsOf(u.name)}
                  colour={u.divisionColour}
                  size="xs"
                  ariaLabel={u.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-ink truncate">{u.name}</div>
                  <div className="text-[10px] text-ink-3 truncate">{u.designation}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(u.id)}
                  disabled={pending}
                  className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium text-urgent hover:bg-urgent-soft transition-colors disabled:opacity-60"
                >
                  {movingId === u.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="relative">
        <i
          className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-3"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, username, or division…"
          autoFocus
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-line bg-panel text-[13px] outline-none focus:border-ink"
        />
      </div>

      <div className="max-h-[280px] overflow-y-auto -mx-1 px-1">
        {filtered.length === 0 ? (
          <p className="text-[12px] text-ink-3 italic py-4 text-center">
            {q ? 'No matching users found.' : 'All users are already in this unit.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.slice(0, 50).map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-bg transition-colors"
              >
                <Avatar
                  initials={initialsOf(u.name)}
                  colour={u.divisionColour}
                  size="sm"
                  ariaLabel={u.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-ink truncate">{u.name}</div>
                  <div className="text-[10px] text-ink-3 truncate">
                    {u.designation} · {u.divisionName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(u.id)}
                  disabled={pending}
                  className={cn(
                    'shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                    movingId === u.id
                      ? 'bg-line text-ink-3'
                      : 'bg-primary-soft text-primary hover:bg-primary/10',
                    pending && 'opacity-60',
                  )}
                >
                  {movingId === u.id ? (pmu ? 'Adding…' : 'Moving…') : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreateNewTab({
  divisionId,
  pmuId,
  divisions,
  supervisors,
  onDone,
}: {
  divisionId: string;
  pmuId: string | null;
  divisions: UserFormDivisionOption[];
  supervisors: UserFormSupervisorOption[];
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<AdminUserState, FormData>(
    createUserAction,
    INITIAL_ADMIN_USER_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <UserFormFields
        mode="create"
        divisions={divisions}
        supervisors={supervisors}
        defaults={{ divisionId, pmuId }}
        fieldErrors={state.fieldErrors}
      />

      {state.error ? (
        <p
          role="alert"
          className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
        >
          Cancel
        </button>
        <CreateButton />
      </div>
    </form>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create user'}
    </button>
  );
}

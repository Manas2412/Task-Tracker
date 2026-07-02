'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

import { Sheet } from '@/components/ui';
import {
  deleteDivisionAction,
  renameDivisionAction,
} from '@/app/actions/admin-structure';
import { cn } from '@/lib/utils';

import { CreateDivisionDialog } from './CreateDivisionDialog';
import { ManageMembersDialog } from './ManageMembersDialog';

import type {
  UserFormDivisionOption,
  UserFormSupervisorOption,
} from '@/app/(app)/admin/users/_components/UserFormFields';

export type TreeUser = {
  id: string;
  name: string;
  username: string;
  designation: string;
  divisionId: string;
  divisionName: string;
  divisionColour: string;
};

export type StructureNode = {
  id: string;
  name: string;
  kind: 'division' | 'sub_division' | 'section' | 'pmu';
  parentId: string | null;
  pmuParentDivisionId: string | null;
  avatarColour: string;
  userCount: number;
};

type StructureTreeProps = {
  nodes: StructureNode[];
  activeId: string | null;
  allUsers: TreeUser[];
  divisions: UserFormDivisionOption[];
  supervisors: UserFormSupervisorOption[];
};

const KIND_ICON: Record<StructureNode['kind'], string> = {
  division: 'ti-building',
  sub_division: 'ti-point-filled',
  section: 'ti-circle-dot',
  pmu: 'ti-building-bridge',
};

export function StructureTree({ nodes, activeId, allUsers, divisions, supervisors }: StructureTreeProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<StructureNode | null>(null);
  const [membersTarget, setMembersTarget] = useState<StructureNode | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{
    kind: StructureNode['kind'];
    parentId?: string;
  } | null>(null);

  const byParent = useMemo(() => {
    const map = new Map<string | null, StructureNode[]>();
    for (const n of nodes) {
      if (n.kind === 'pmu') continue; // PMUs grouped separately below
      const key = n.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return map;
  }, [nodes]);

  const pmus = nodes.filter((n) => n.kind === 'pmu');
  const topDivisions = byParent.get(null) ?? [];

  const openCreate = (defaults?: { kind: StructureNode['kind']; parentId?: string }) => {
    setCreateDefaults(defaults ?? { kind: 'division' });
    setCreateOpen(true);
  };

  return (
    <>
      <div className="bg-panel border border-line rounded-xl">
        <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-line-2">
          <h2 className="section-label">Divisions</h2>
          <button
            type="button"
            onClick={() => openCreate({ kind: 'division' })}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary px-1.5 py-0.5 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-plus text-[12px]" aria-hidden="true" />
            New
          </button>
        </header>

        <div className="p-1.5">
          {topDivisions.length === 0 ? (
            <p className="text-[11px] text-ink-3 italic px-3 py-2">No divisions yet.</p>
          ) : (
            topDivisions.map((d) => (
              <TreeBranch
                key={d.id}
                node={d}
                allNodes={nodes}
                byParent={byParent}
                activeId={activeId}
                depth={0}
                onAddChild={openCreate}
                onRename={setRenameTarget}
                onManageMembers={setMembersTarget}
              />
            ))
          )}
        </div>

        {pmus.length > 0 ? (
          <>
            <div className="px-3 pt-3 pb-1 border-t border-line-2">
              <h2 className="section-label">PMUs</h2>
            </div>
            <div className="p-1.5">
              {pmus.map((p) => (
                <TreeNode
                  key={p.id}
                  node={p}
                  activeId={activeId}
                  depth={0}
                  onRename={setRenameTarget}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <CreateDivisionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        divisions={nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind }))}
        initialKind={createDefaults?.kind}
        initialParentId={createDefaults?.parentId}
      />

      {renameTarget ? (
        <RenameDialog
          node={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      ) : null}

      <ManageMembersDialog
        open={!!membersTarget}
        onClose={() => setMembersTarget(null)}
        divisionId={membersTarget?.id ?? ''}
        divisionName={membersTarget?.name ?? ''}
        existingUsers={allUsers}
        divisions={divisions}
        supervisors={supervisors}
      />
    </>
  );
}

// ------------------------------------------------------------
// Recursive branch
// ------------------------------------------------------------

function TreeBranch({
  node,
  allNodes,
  byParent,
  activeId,
  depth,
  onAddChild,
  onRename,
  onManageMembers,
}: {
  node: StructureNode;
  allNodes: StructureNode[];
  byParent: Map<string | null, StructureNode[]>;
  activeId: string | null;
  depth: number;
  onAddChild: (defaults: { kind: StructureNode['kind']; parentId?: string }) => void;
  onRename: (n: StructureNode) => void;
  onManageMembers: (n: StructureNode) => void;
}) {
  const children = byParent.get(node.id) ?? [];
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <div>
      <TreeNode
        node={node}
        activeId={activeId}
        depth={depth}
        hasChildren={children.length > 0}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onAddChild={onAddChild}
        onRename={onRename}
        onManageMembers={onManageMembers}
      />
      {expanded && children.length > 0 ? (
        <div className="ml-3 pl-2 border-l border-line-2">
          {children.map((c) => (
            <TreeBranch
              key={c.id}
              node={c}
              allNodes={allNodes}
              byParent={byParent}
              activeId={activeId}
              depth={depth + 1}
              onAddChild={onAddChild}
              onRename={onRename}
              onManageMembers={onManageMembers}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Single node row
// ------------------------------------------------------------

function TreeNode({
  node,
  activeId,
  depth,
  hasChildren,
  expanded,
  onToggle,
  onAddChild,
  onRename,
  onManageMembers,
}: {
  node: StructureNode;
  activeId: string | null;
  depth: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAddChild?: (defaults: { kind: StructureNode['kind']; parentId?: string }) => void;
  onRename?: (n: StructureNode) => void;
  onManageMembers?: (n: StructureNode) => void;
}) {
  const isActive = node.id === activeId;
  const searchParams = useSearchParams();
  const href = `/admin/structure?${new URLSearchParams({
    division: node.id,
    ...(searchParams.get('selected') ? { selected: searchParams.get('selected')! } : {}),
  })}`;

  return (
    <div className="group relative flex items-center">
      {hasChildren && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="w-5 h-5 grid place-items-center text-ink-3 hover:text-ink"
        >
          <i
            className={cn(
              'ti ti-chevron-right text-[14px] transition-transform',
              expanded && 'rotate-90',
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="w-5 h-5" aria-hidden="true" />
      )}

      <Link
        href={href}
        scroll={false}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex-1 flex items-center gap-1.5 px-1.5 py-1.5 rounded-md text-[12.5px] truncate transition-colors',
          isActive
            ? 'bg-primary-soft text-primary border border-primary-line/40'
            : 'text-ink hover:bg-bg',
        )}
      >
        <i
          className={cn(
            'ti',
            KIND_ICON[node.kind],
            'text-[14px]',
            isActive ? 'text-primary' : 'text-ink-3',
          )}
          aria-hidden="true"
        />
        <span className="truncate">{node.name}</span>
        {node.userCount > 0 ? (
          <span
            className={cn(
              'ml-auto text-[10px] px-1.5 py-0.5 rounded-md',
              isActive ? 'bg-panel text-primary' : 'bg-line-2 text-ink-3',
            )}
          >
            {node.userCount}
          </span>
        ) : null}
      </Link>

      <RowMenu node={node} onAddChild={onAddChild} onRename={onRename} onManageMembers={onManageMembers} />
    </div>
  );
}

// ------------------------------------------------------------
// ⋮ row menu
// ------------------------------------------------------------

function RowMenu({
  node,
  onAddChild,
  onRename,
  onManageMembers,
}: {
  node: StructureNode;
  onAddChild?: (defaults: { kind: StructureNode['kind']; parentId?: string }) => void;
  onRename?: (n: StructureNode) => void;
  onManageMembers?: (n: StructureNode) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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

  const childKind: StructureNode['kind'] | null =
    node.kind === 'division' ? 'sub_division' : node.kind === 'sub_division' ? 'section' : null;

  const handleDelete = () => {
    if (!confirm(`Delete "${node.name}"? Only empty units can be deleted.`)) return;
    const fd = new FormData();
    fd.set('id', node.id);
    startTransition(async () => {
      const result = await deleteDivisionAction(undefined, fd);
      if (!result.ok && result.error) alert(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="relative ml-0.5" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`More for ${node.name}`}
        className="w-6 h-6 grid place-items-center rounded-md text-ink-3 hover:bg-line-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <i className="ti ti-dots-vertical text-[14px]" aria-hidden="true" />
      </button>
      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          'absolute right-0 top-full mt-1 w-48 rounded-xl border border-line bg-panel shadow-xl z-40 p-1',
          'transition-all duration-150 origin-top-right',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none',
        )}
      >
        {onRename ? (
          <MenuItem
            icon="ti-edit"
            label="Rename"
            onClick={() => {
              setOpen(false);
              onRename(node);
            }}
          />
        ) : null}
        {onManageMembers ? (
          <MenuItem
            icon="ti-users-plus"
            label="Manage members"
            onClick={() => {
              setOpen(false);
              onManageMembers(node);
            }}
          />
        ) : null}
        {childKind && onAddChild ? (
          <MenuItem
            icon="ti-plus"
            label={`Add ${childKind === 'sub_division' ? 'sub-division' : 'section'}`}
            onClick={() => {
              setOpen(false);
              onAddChild({ kind: childKind, parentId: node.id });
            }}
          />
        ) : null}
        {node.kind === 'division' ? (
          <MenuItem
            icon="ti-building-bridge"
            label="Add PMU team"
            onClick={() => {
              setOpen(false);
              onAddChild?.({ kind: 'pmu', parentId: node.id });
            }}
          />
        ) : null}
        <MenuItem
          icon="ti-trash"
          label="Delete"
          danger
          disabled={pending}
          onClick={() => {
            setOpen(false);
            handleDelete();
          }}
        />
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] hover:bg-bg transition-colors disabled:opacity-60',
        danger ? 'text-urgent' : 'text-ink',
      )}
    >
      <i className={cn('ti', icon, 'text-[14px]', danger ? 'text-urgent' : 'text-ink-2')} aria-hidden="true" />
      {label}
    </button>
  );
}

// ------------------------------------------------------------
// Rename dialog
// ------------------------------------------------------------

function RenameDialog({
  node,
  onClose,
}: {
  node: StructureNode;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(renameDivisionAction, { ok: false, epoch: 0 });

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  return (
    <Sheet open={true} onClose={onClose} title={`Rename "${node.name}"`}>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={node.id} />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-ink-2">Name</span>
          <input
            name="name"
            defaultValue={node.name}
            autoFocus
            required
            maxLength={80}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-panel text-[13px] outline-none',
              state.fieldErrors?.name
                ? 'border-urgent focus:border-urgent'
                : 'border-line focus:border-ink',
            )}
          />
          {state.fieldErrors?.name ? (
            <span className="text-[11px] text-urgent">{state.fieldErrors.name}</span>
          ) : null}
        </label>
        {state.error ? (
          <p className="text-[12px] text-urgent bg-urgent-soft border border-urgent/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        ) : null}
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink-2 hover:bg-line-2"
          >
            Cancel
          </button>
          <SaveButton />
        </div>
      </form>
    </Sheet>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}


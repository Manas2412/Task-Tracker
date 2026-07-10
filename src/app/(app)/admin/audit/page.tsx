import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import {
  fetchAuditEntries,
  type AuditAction,
  type AuditEntity,
} from '@/lib/audit';

import { AuditTable } from './_components/AuditTable';
import { AuditDangerZone } from './_components/AuditDangerZone';

const ENTITY_OPTIONS: { value: AuditEntity | 'all'; label: string }[] = [
  { value: 'all', label: 'All entities' },
  { value: 'user', label: 'User' },
  { value: 'division', label: 'Division' },
  { value: 'task', label: 'Task' },
  { value: 'timeline_file', label: 'Timeline file' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'tag', label: 'Tag' },
  { value: 'system', label: 'System' },
];

const ACTION_OPTIONS: { value: AuditAction | 'all'; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'archive', label: 'Archive' },
  { value: 'restore', label: 'Restore' },
  { value: 'login', label: 'Login' },
  { value: 'password_reset', label: 'Password reset' },
  { value: 'role_change', label: 'Role change' },
  { value: 'hierarchy_change', label: 'Hierarchy change' },
];

type PageProps = {
  searchParams?: {
    entity?: string;
    action?: string;
    page?: string;
  };
};

export default async function AuditPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) redirect('/tasks');

  const entityFilter =
    ENTITY_OPTIONS.find((o) => o.value === searchParams?.entity)?.value ?? 'all';
  const actionFilter =
    ACTION_OPTIONS.find((o) => o.value === searchParams?.action)?.value ?? 'all';
  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10) || 1);

  const { entries, total, pageSize } = await fetchAuditEntries({
    entity: entityFilter,
    action: actionFilter,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /** Build a query string preserving current filters when one param changes */
  function href(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const entity = overrides.entity ?? (entityFilter !== 'all' ? entityFilter : '');
    const action = overrides.action ?? (actionFilter !== 'all' ? actionFilter : '');
    const p = overrides.page ?? (page > 1 ? String(page) : '');
    if (entity) params.set('entity', entity);
    if (action) params.set('action', action);
    if (p && p !== '1') params.set('page', p);
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="pb-12">
      <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
        <header className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1">
            Super admin
          </p>
          <h1 className="font-serif text-[22px] md:text-[26px] leading-tight text-ink">
            Audit trail
          </h1>
          <p className="text-[12px] text-ink-3 mt-1">
            {total} {total === 1 ? 'entry' : 'entries'}
          </p>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <FilterSelect
            label="Entity"
            options={ENTITY_OPTIONS}
            current={entityFilter}
            buildHref={(v) => href({ entity: v, page: '1' })}
          />
          <FilterSelect
            label="Action"
            options={ACTION_OPTIONS}
            current={actionFilter}
            buildHref={(v) => href({ action: v, page: '1' })}
          />
        </div>

        <AuditTable entries={entries} />

        {/* Pagination */}
        {totalPages > 1 ? (
          <nav
            aria-label="Audit pagination"
            className="flex items-center justify-center gap-2 mt-5"
          >
            {page > 1 ? (
              <Link
                href={href({ page: String(page - 1) })}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink hover:bg-line-2"
              >
                <i className="ti ti-chevron-left text-[14px]" aria-hidden="true" />
                Previous
              </Link>
            ) : null}
            <span className="text-[12px] text-ink-3">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={href({ page: String(page + 1) })}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-line text-[12px] font-medium text-ink hover:bg-line-2"
              >
                Next
                <i className="ti ti-chevron-right text-[14px]" aria-hidden="true" />
              </Link>
            ) : null}
          </nav>
        ) : null}

        <AuditDangerZone />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Filter select – renders as a native <select> styled to match
// ------------------------------------------------------------

function FilterSelect<T extends string>({
  label,
  options,
  current,
  buildHref,
}: {
  label: string;
  options: { value: T; label: string }[];
  current: T;
  buildHref: (value: string) => string;
}) {
  return (
    <div className="relative">
      <label className="sr-only">{label}</label>
      {/* Use a visible link list rendered as <select>-styled dropdown.
          Since this is a server page (no 'use client'), we use anchored links
          via a wrapper approach: each option link navigates with the
          appropriate query string. For simplicity, this renders links that
          look like chips. */}
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const isActive = opt.value === current;
          return (
            <Link
              key={opt.value}
              href={buildHref(opt.value === 'all' ? '' : opt.value)}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'px-2.5 py-1 rounded-[14px] text-[11px] font-medium bg-ink text-onink border border-ink'
                  : 'px-2.5 py-1 rounded-[14px] text-[11px] font-medium bg-panel text-ink-2 border border-line hover:border-ink-4'
              }
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

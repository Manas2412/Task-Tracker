'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { initialsOf } from '@/lib/format';
import { TASK_STATUS_LABEL } from '@/lib/labels';
import type { AllottedTaskRow, UserProfileCard } from '@/lib/user-profile';
import { cn } from '@/lib/utils';

type ProfileResponse = UserProfileCard & { canViewAllottedTasks: boolean };

/** How the profiled person is attached to an allotted task. */
const RELATION_LABEL: Record<AllottedTaskRow['relation'], string> = {
  owner: 'Owner',
  collaborator: 'Collaborator',
  subtask: 'Subtask owner',
};

/** Gmail compose in a new tab, prefilled To: the person's email. */
function gmailComposeUrl(email: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

/**
 * View-only profile popup shown when a person is opened from global search.
 * Lazily fetches the directory card for `userId` from
 * `/api/users/[id]/profile`. Bottom sheet on mobile, centred modal on
 * desktop — matching the Sheet component's responsive grammar, but with a
 * bespoke, richer layout (coloured cover, hero avatar, contact tiles).
 */
type UserProfilePopupProps = {
  userId: string | null;
  onClose: () => void;
};

/** Append an alpha channel to a #rrggbb hex, for a soft division-colour wash. */
function tint(colour: string, alphaHex: string): string {
  return /^#[0-9a-f]{6}$/i.test(colour) ? `${colour}${alphaHex}` : colour;
}

export function UserProfilePopup({ userId, onClose }: UserProfilePopupProps) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // "Tasks allotted" inline expander — lazily loaded on first open.
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasks, setTasks] = useState<AllottedTaskRow[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Fetch the card whenever a new person is opened.
  useEffect(() => {
    if (!userId) return;
    setProfile(null);
    setError(null);
    setLoading(true);
    // Reset the allotted-tasks expander for the new person.
    setTasksOpen(false);
    setTasks(null);
    setTasksError(null);
    const ctl = new AbortController();
    fetch(`/api/users/${userId}/profile`, { signal: ctl.signal, cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'This person could not be found.' : 'Could not load this profile.');
        return (await r.json()) as ProfileResponse;
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Could not load this profile.');
        setLoading(false);
      });
    return () => ctl.abort();
  }, [userId]);

  const toggleTasks = () => {
    const next = !tasksOpen;
    setTasksOpen(next);
    // Lazy-load once, on first expand.
    if (next && tasks === null && !tasksLoading && userId) {
      setTasksLoading(true);
      setTasksError(null);
      fetch(`/api/users/${userId}/allotted-tasks`, { cache: 'no-store' })
        .then(async (r) => {
          if (!r.ok) throw new Error('Could not load tasks.');
          return (await r.json()) as { tasks: AllottedTaskRow[] };
        })
        .then((data) => {
          setTasks(data.tasks);
          setTasksLoading(false);
        })
        .catch((err) => {
          setTasksError(err instanceof Error ? err.message : 'Could not load tasks.');
          setTasksLoading(false);
        });
    }
  };

  // Enter transition + Esc to close + scroll lock while open.
  useEffect(() => {
    if (!userId) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus to the close button so Esc/Tab behave predictably.
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [userId, onClose]);

  if (!userId || !portalTarget) return null;

  const colour = profile?.divisionColour ?? '#334155';

  const content = (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-popup-name"
        className={cn(
          'fixed z-[70] bg-panel overflow-hidden will-change-transform',
          // Mobile: bottom sheet
          'inset-x-0 bottom-0 rounded-t-[24px] max-h-[92dvh] overflow-y-auto',
          'transition-transform duration-300 ease-out',
          // Desktop: centred modal
          'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[500px]',
          'md:max-w-[calc(100vw-32px)] md:rounded-3xl md:max-h-[85dvh]',
          'md:-translate-x-1/2 md:-translate-y-1/2 md:transition-all md:duration-200',
          visible
            ? 'translate-y-0 md:scale-100 md:opacity-100'
            : 'translate-y-full md:scale-95 md:opacity-0',
        )}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-panel/80 text-ink-2 backdrop-blur-sm hover:bg-line-2 hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <i className="ti ti-x text-[16px]" aria-hidden="true" />
        </button>

        {/* Cover band — a soft wash of the person's division colour */}
        <div
          className="h-20 md:h-24"
          style={{ background: `linear-gradient(135deg, ${tint(colour, '2b')}, ${tint(colour, '0d')})` }}
          aria-hidden="true"
        />

        {/* Hero: avatar + identity */}
        <div className="px-6 -mt-9 flex flex-col items-center text-center">
          <span
            className="grid h-[72px] w-[72px] place-items-center rounded-full text-white text-[24px] font-medium ring-4 ring-panel shadow-sm"
            style={{ backgroundColor: colour }}
            aria-hidden="true"
          >
            {profile ? initialsOf(profile.name) : ''}
          </span>

          {loading && !profile ? (
            <div className="mt-3 h-5 w-40 rounded bg-line-2 animate-pulse" aria-hidden="true" />
          ) : profile ? (
            <>
              <h2
                id="profile-popup-name"
                className="mt-3 font-serif text-[21px] leading-tight text-ink inline-flex items-center gap-1.5"
              >
                {profile.name}
                {profile.isSuperAdmin ? (
                  <i
                    className="ti ti-shield-check text-[16px] text-primary"
                    title="Super Admin"
                    aria-label="Super Admin"
                  />
                ) : null}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-2">{profile.designation}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-bg px-2.5 py-1 text-[11.5px] font-medium text-ink-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colour }}
                    aria-hidden="true"
                  />
                  {profile.divisionName}
                </span>
                {!profile.isActive ? (
                  <span className="inline-flex items-center rounded-pill border border-line bg-low-soft px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em] text-low">
                    Deactivated
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Details */}
        <div className="px-6 pb-7 pt-5">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-urgent/20 bg-urgent-soft px-3 py-2.5 text-center text-[12.5px] text-urgent"
            >
              {error}
            </p>
          ) : loading && !profile ? (
            <div className="flex flex-col gap-2.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-line-2/60 animate-pulse" />
              ))}
            </div>
          ) : profile ? (
            <div className="flex flex-col gap-2.5">
              {/* Contact tiles — full width so long emails stay legible */}
              <ContactTile
                icon="ti-phone"
                label="Phone"
                value={profile.phone}
                href={profile.phone ? `tel:${profile.phone.replace(/\s+/g, '')}` : null}
              />
              <ContactTile
                icon="ti-mail"
                label="Email"
                value={profile.email}
                href={profile.email ? gmailComposeUrl(profile.email) : null}
                newTab
              />

              {/* Reports to */}
              <DetailBlock icon="ti-arrow-up-right" label="Reports to">
                {profile.reportsToName ? (
                  <span className="text-[13px] text-ink">
                    {profile.reportsToName}
                    {profile.reportsToDesignation ? (
                      <span className="text-ink-3"> · {profile.reportsToDesignation}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-3 italic">No supervisor on record</span>
                )}
              </DetailBlock>

              {/* Work activities */}
              <DetailBlock icon="ti-briefcase" label="Work activities">
                {profile.workActivities ? (
                  <p className="text-[13px] leading-relaxed text-ink-2 whitespace-pre-line">
                    {profile.workActivities}
                  </p>
                ) : (
                  <span className="text-[13px] text-ink-3 italic">No work activities listed</span>
                )}
              </DetailBlock>

              {/* Tasks allotted — same-division colleagues + OSD / Super Admin only */}
              {profile.canViewAllottedTasks ? (
                <div>
                  <button
                    type="button"
                    onClick={toggleTasks}
                    aria-expanded={tasksOpen}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-[12px] font-medium text-ink transition-colors hover:border-ink-4 hover:bg-bg"
                  >
                    <i className="ti ti-checklist text-[14px] text-ink-2" aria-hidden="true" />
                    Tasks allotted
                    {tasks !== null ? (
                      <span className="text-ink-3">({tasks.length})</span>
                    ) : null}
                    <i
                      className={cn(
                        'ti ti-chevron-down text-[14px] text-ink-3 transition-transform',
                        tasksOpen && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {tasksOpen ? (
                    <div className="mt-2">
                      {tasksLoading ? (
                        <div className="flex flex-col gap-2" aria-hidden="true">
                          {[0, 1].map((i) => (
                            <div key={i} className="h-11 rounded-lg bg-line-2/60 animate-pulse" />
                          ))}
                        </div>
                      ) : tasksError ? (
                        <p role="alert" className="text-[12px] text-urgent">
                          {tasksError}
                        </p>
                      ) : tasks && tasks.length > 0 ? (
                        <ul className="flex flex-col gap-1.5">
                          {tasks.map((t) => (
                            <li key={t.id}>
                              <a
                                href={t.href}
                                onClick={onClose}
                                className="flex items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2 transition-colors hover:border-ink-4 hover:bg-bg"
                              >
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: colour }}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12.5px] font-medium text-ink">
                                    {t.name}
                                  </span>
                                  <span className="block text-[10.5px] text-ink-3">
                                    {TASK_STATUS_LABEL[t.status] ?? t.status}
                                    <span className="text-ink-4"> · </span>
                                    {RELATION_LABEL[t.relation]}
                                  </span>
                                </span>
                                <i
                                  className="ti ti-chevron-right shrink-0 text-[14px] text-ink-3"
                                  aria-hidden="true"
                                />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[12.5px] text-ink-3 italic">
                          No tasks allotted to {profile.name.split(' ')[0]}.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return createPortal(content, portalTarget);
}

// ------------------------------------------------------------
// Pieces
// ------------------------------------------------------------

function ContactTile({
  icon,
  label,
  value,
  href,
  newTab,
}: {
  icon: string;
  label: string;
  value: string | null;
  href: string | null;
  newTab?: boolean;
}) {
  const inner = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg text-ink-2">
        <i className={cn('ti text-[15px]', icon)} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3">
          {label}
        </span>
        {/* break-all keeps a long email fully visible without overflowing */}
        <span className={cn('block text-[13px] break-all', value ? 'text-ink' : 'text-ink-3 italic')}>
          {value ?? 'Not provided'}
        </span>
      </span>
      {href ? (
        <i
          className="ti ti-external-link shrink-0 text-[13px] text-ink-3"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const base = 'flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2.5';

  if (href) {
    return (
      <a
        href={href}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noreferrer' : undefined}
        className={cn(base, 'transition-colors hover:border-ink-4 hover:bg-bg')}
      >
        {inner}
      </a>
    );
  }
  return <div className={base}>{inner}</div>;
}

function DetailBlock({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3.5 py-3">
      <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] font-medium text-ink-3">
        <i className={cn('ti text-[13px]', icon)} aria-hidden="true" />
        {label}
      </div>
      {children}
    </div>
  );
}

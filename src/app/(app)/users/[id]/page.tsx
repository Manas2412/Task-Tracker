import { notFound, redirect } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';

import { Avatar } from '@/components/ui';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initialsOf } from '@/lib/format';
import {
  CONTRACT_ROLE_LABEL,
  HIERARCHY_SLOT_LABEL,
  HIERARCHY_SLOT_LEVEL,
  PMU_ROLE_LABEL,
} from '@/lib/labels';
import { cn } from '@/lib/utils';
import { BackButton } from './_components/BackButton';

type PageProps = { params: { id: string } };

export default async function UserProfilePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  // If viewing own profile, redirect to /profile
  if (params.id === session.user.id) redirect('/profile');

  // Only OSD and Super Admin can view other users' profiles
  if (!session.user.isSuperAdmin && session.user.hierarchySlot !== 'osd') {
    notFound();
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      division: true,
      subDivision: true,
      section: true,
      supervisor: { include: { division: true } },
    },
  });

  if (!user) notFound();

  return (
    <div className="max-w-2xl mx-auto pb-16 px-4 md:px-6 lg:px-8">
      {/* Header */}
      <header className="sticky top-14 md:top-16 z-10 bg-bg/90 backdrop-blur-sm border-b border-line-2">
        <div className="flex items-center gap-3 px-4 md:px-6 h-12 -mx-4 md:-mx-6">
          <BackButton />
        </div>
      </header>

      {/* Identity card */}
      <section className="mt-5 bg-panel border border-line rounded-2xl p-5 md:p-6 flex items-center gap-4 md:gap-5">
        <Avatar
          initials={initialsOf(user.name)}
          colour={user.division.avatarColour}
          size="lg"
          ariaLabel={user.name}
        />
        <div className="min-w-0">
          <h1 className="font-serif text-[20px] md:text-[22px] leading-tight text-ink truncate">
            {user.name}
          </h1>
          <p className="text-[12px] md:text-[13px] text-ink-2 mt-0.5 truncate">
            {user.designation}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {user.isSuperAdmin ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-primary bg-primary-soft border border-primary-line/40 px-1.5 py-0.5 rounded">
                <i className="ti ti-shield-check text-[11px]" aria-hidden="true" />
                Super Admin
              </span>
            ) : null}
            {!user.isActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3 bg-line px-1.5 py-0.5 rounded">
                Deactivated
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="mt-4 bg-panel border border-line rounded-2xl">
        <h2 className="px-5 md:px-6 pt-5 pb-2 section-label">Profile</h2>
        <dl className="px-2 pb-2">
          <DetailRow icon="ti-id" label="Hierarchy slot">
            <span>{HIERARCHY_SLOT_LABEL[user.hierarchySlot]}</span>
            {HIERARCHY_SLOT_LEVEL[user.hierarchySlot] != null ? (
              <span className="ml-2 inline-flex text-[10px] font-medium text-primary bg-primary-soft border border-primary-line/40 px-1.5 py-0.5 rounded">
                Level {HIERARCHY_SLOT_LEVEL[user.hierarchySlot]}
              </span>
            ) : (
              <span className="ml-2 inline-flex text-[10px] font-medium text-ink-3 bg-line-2 border border-line px-1.5 py-0.5 rounded">
                Support role
              </span>
            )}
          </DetailRow>

          {user.contractRole ? (
            <DetailRow icon="ti-bookmark" label="Contract role">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent bg-accent-soft border border-accent-line px-2 py-0.5 rounded-md">
                {CONTRACT_ROLE_LABEL[user.contractRole]}
              </span>
            </DetailRow>
          ) : null}

          {user.isPmu && user.pmuRole ? (
            <DetailRow icon="ti-building-bridge" label="PMU role">
              <span>{PMU_ROLE_LABEL[user.pmuRole]}</span>
            </DetailRow>
          ) : null}

          <DetailRow icon="ti-building" label="Division">
            <span className="inline-flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: user.division.avatarColour }}
                aria-hidden="true"
              />
              {user.division.name}
            </span>
          </DetailRow>

          {user.subDivision ? (
            <DetailRow icon="ti-arrow-right" label="Sub-division">
              <span>{user.subDivision.name}</span>
            </DetailRow>
          ) : null}

          {user.section ? (
            <DetailRow icon="ti-arrow-right" label="Section">
              <span>{user.section.name}</span>
            </DetailRow>
          ) : null}

          <DetailRow icon="ti-user" label="Username">
            <span className="font-mono text-[12px]">{user.username}</span>
          </DetailRow>

          {user.email ? (
            <DetailRow icon="ti-mail" label="Email" muted>
              <span>{user.email}</span>
            </DetailRow>
          ) : null}

          {user.phone ? (
            <DetailRow icon="ti-phone" label="Phone" muted>
              <a href={`tel:+91${user.phone}`} className="hover:underline">
                {user.phone}
              </a>
            </DetailRow>
          ) : null}

          {user.supervisor ? (
            <DetailRow icon="ti-arrow-up" label="Reports to">
              <span className="inline-flex items-center gap-2">
                <Avatar
                  initials={initialsOf(user.supervisor.name)}
                  colour={user.supervisor.division.avatarColour}
                  size="xs"
                  ariaLabel={user.supervisor.name}
                />
                {user.supervisor.name}
              </span>
            </DetailRow>
          ) : null}

          <DetailRow icon="ti-login" label="Last sign-in" muted>
            <span>
              {user.lastLogin ? (
                <>
                  {format(user.lastLogin, 'd LLL yyyy, h:mm a')}{' '}
                  <span className="text-ink-3 text-[11px]">
                    ({formatDistanceToNow(user.lastLogin, { addSuffix: true })})
                  </span>
                </>
              ) : (
                'No previous sign-in recorded'
              )}
            </span>
          </DetailRow>
        </dl>
      </section>

      {/* Work activities */}
      {user.workActivities ? (
        <section className="mt-4 bg-panel border border-line rounded-2xl">
          <h2 className="px-5 md:px-6 pt-5 pb-2 section-label">Work activities</h2>
          <div className="px-5 md:px-6 pb-5">
            <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
              {user.workActivities}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  muted,
  children,
}: {
  icon: string;
  label: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <i
        className={cn('ti', icon, 'text-[16px] text-ink-3 shrink-0 w-[18px]')}
        aria-hidden="true"
      />
      <dt className="text-[13px] text-ink-2 w-[130px] shrink-0">{label}</dt>
      <dd className={cn('flex-1 text-[13px] text-right font-medium', muted && 'text-ink-2 font-normal')}>
        {children}
      </dd>
    </div>
  );
}

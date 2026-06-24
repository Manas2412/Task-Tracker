import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { cn } from '@/lib/utils';

import { AdminSubNav } from './_components/AdminSubNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const isOsd = session.user.hierarchySlot === 'osd';
  if (!session.user.isSuperAdmin && !isOsd) redirect('/tasks');

  return (
    <div className="bg-canvas min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)]">
      <header className="sticky top-14 md:top-16 z-10 bg-bg/95 backdrop-blur-sm border-b border-line-2">
        <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-5 pb-1">
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1">
            <i className={cn('ti ti-shield-check text-[12px] mr-1')} aria-hidden="true" />
            Super Admin Console
          </p>
          <h1 className="font-serif text-[22px] md:text-[26px] leading-tight text-ink">
            {/* Each sub-section sets its own real title — this is a fallback. */}
            Settings
          </h1>
        </div>
        <AdminSubNav />
      </header>

      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6">{children}</div>
    </div>
  );
}

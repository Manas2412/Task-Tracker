import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { ChangePasswordForm } from './ChangePasswordForm';

type PageProps = {
  searchParams?: { changed?: string };
};

export default async function ChangePasswordPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { forcePasswordChange: true },
  });
  if (!me) redirect('/login');

  const justChanged = searchParams?.changed === '1';

  return (
    <div className="max-w-md mx-auto pb-16 px-4 md:px-6 pt-4 md:pt-8">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink mb-4"
      >
        <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
        Back to profile
      </Link>

      <header className="mb-5">
        <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3 font-medium mb-1">
          Account
        </p>
        <h1 className="font-serif text-[24px] md:text-[26px] leading-tight text-ink">
          Change password
        </h1>
        {me.forcePasswordChange ? (
          <p className="mt-3 inline-flex items-start gap-2 text-[12px] text-accent bg-accent-soft border border-accent-line rounded-lg px-3 py-2">
            <i
              className="ti ti-shield-lock text-[14px] mt-px"
              aria-hidden="true"
            />
            <span>
              Your Super Admin has required a password change before you can
              continue using the app.
            </span>
          </p>
        ) : null}
      </header>

      {justChanged ? (
        <div
          role="status"
          className="mb-4 text-[13px] text-success bg-success-soft border border-success/30 rounded-lg px-3 py-2 inline-flex items-center gap-2"
        >
          <i className="ti ti-circle-check text-[16px]" aria-hidden="true" />
          Password updated.
        </div>
      ) : null}

      <section className="bg-panel border border-line rounded-2xl p-5 md:p-6">
        <ChangePasswordForm wasForced={me.forcePasswordChange} />
      </section>

      <p className="mt-4 text-[11px] text-ink-3 leading-relaxed">
        Use at least 8 characters. Mixing a phrase with numbers and punctuation
        makes a password much harder to guess.
      </p>
    </div>
  );
}

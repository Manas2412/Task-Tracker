import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

/**
 * Root — routes the caller to their natural home.
 *
 *   - Unauthenticated → middleware will already have bounced to /login
 *   - OSD or Super Admin → /command-centre (their daily landing)
 *   - Everyone else → /tasks
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const isOsd =
    session.user.hierarchySlot === 'osd' || session.user.isSuperAdmin;
  redirect(isOsd ? '/command-centre' : '/tasks');
}

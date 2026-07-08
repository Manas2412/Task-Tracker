import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getUserProfileCard } from '@/lib/user-profile';

/**
 * GET /api/users/[id]/profile
 *
 * View-only profile card for the global-search people popup. Open to every
 * signed-in caller — the same reach as the searchable people directory
 * (src/lib/search.ts). Returns the directory facts only; no edit surface.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { ok: allowed } = rateLimit(`profile:${session.user.id}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const profile = await getUserProfileCard(params.id);
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

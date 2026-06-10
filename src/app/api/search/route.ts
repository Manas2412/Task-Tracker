import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { isQuerySearchable, searchPreview } from '@/lib/search';

/**
 * Search preview endpoint — drives the header dropdown.
 *
 * Returns JSON with `tasks`, `timelineFiles`, `users`, `tags` (top 5 each)
 * and totals. Scoped to the caller's visibility on tasks + TFs; users + tags
 * are open to every signed-in caller.
 *
 * No edge runtime: prisma needs the Node runtime.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  if (!isQuerySearchable(q)) {
    return NextResponse.json({
      query: q,
      tasks: [],
      timelineFiles: [],
      users: [],
      tags: [],
      totals: { tasks: 0, timelineFiles: 0, users: 0, tags: 0 },
    });
  }

  const results = await searchPreview(session.user.id, q);
  return NextResponse.json(results);
}

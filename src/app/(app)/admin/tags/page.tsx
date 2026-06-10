import { prisma } from '@/lib/db';

import { CreateTagDialog } from './_components/CreateTagDialog';
import { TagsAdminList, type TagRow } from './_components/TagsAdminList';

export default async function AdminTagsPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { tasks: true } },
    },
  });

  const rows: TagRow[] = tags.map((t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    createdByName: t.createdBy.name,
    taskCount: t._count.tasks,
  }));

  const usedCount = rows.filter((r) => r.taskCount > 0).length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="font-serif text-[22px] md:text-[26px] leading-tight text-ink">
            Tags &amp; labels
          </h2>
          <p className="text-[12px] text-ink-3 mt-1">
            {rows.length} total · {usedCount} in use
          </p>
        </div>
        <CreateTagDialog />
      </div>

      <TagsAdminList tags={rows} />

      <p className="mt-4 text-[11px] text-ink-3 leading-relaxed">
        Tags are managed centrally so the same labels apply across divisions.
        Officers add tags from the task detail screen; only Super Admin can
        rename or remove a tag from the master list, and only when no task is
        using it.
      </p>
    </div>
  );
}

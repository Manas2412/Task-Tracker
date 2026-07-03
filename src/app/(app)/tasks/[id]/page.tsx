import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

import { AttachmentList, type AttachmentRow, Pill, TimelineFileCard } from '@/components/ui';
import { canEditTaskAttachments } from '@/app/actions/attachments';
import { isS3Configured } from '@/lib/s3';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initialsOf } from '@/lib/format';
import { buildVisibilityClauses } from '@/lib/visibility';
import { CollaboratorsSection, type Candidate, type CollaboratorRow, type SubtaskScope } from './_components/CollaboratorsSection';
import { JsLanePicker } from './_components/JsLanePicker';
import { TagsSection, type TaskTagRow } from './_components/TagsSection';
import { MoreMenu } from './_components/MoreMenu';
import { PriorityPicker } from './_components/PriorityPicker';
import { SectionActivity } from './_components/SectionActivity';
import { SectionComments, type Mentionable } from './_components/SectionComments';
import { SectionContext } from './_components/SectionContext';
import { SectionDetails } from './_components/SectionDetails';
import { SectionSubtasks } from './_components/SectionSubtasks';
import { StatusPicker } from './_components/StatusPicker';
import { TaskTitleEditor } from './_components/TaskTitleEditor';
import { PullTaskButton } from './_components/PullTaskButton';
import { TransferTaskButton } from './_components/TransferTaskButton';

import type { PillJsLane, PillPriorityTone, PillStatusTone } from '@/components/ui/Pill';

type PageProps = { params: { id: string } };

export default async function TaskDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // UUID guard — keeps invalid IDs from blowing up Prisma.
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      owner: { include: { division: true } },
      division: true,
      collaborators: {
        include: { user: { include: { division: true } } },
      },
      subtasks: {
        include: { owner: { select: { id: true, name: true, division: { select: { avatarColour: true } } } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      },
      comments: {
        where: { parentCommentId: null },
        include: {
          user: { include: { division: true } },
          replies: {
            include: { user: { include: { division: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      activity: {
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
      },
      parentTask: { select: { id: true, name: true } },
      linkedTimelineFile: true,
      tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });

  if (!task || task.archivedAt) notFound();

  // Visibility guard — reuses the same scoper as the tasks list page.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, hierarchySlot: true, isSuperAdmin: true, divisionId: true, isPmu: true },
  });
  if (!me) redirect('/login');

  const visibilityClauses = await buildVisibilityClauses(me);
  const canView = await prisma.task.count({
    where: { id: task.id, OR: visibilityClauses },
  });
  if (!canView) {
    return (
      <div className="max-w-3xl xl:max-w-4xl mx-auto pb-16">
        <header className="sticky top-14 md:top-16 z-10 bg-bg/90 backdrop-blur-sm border-b border-line-2">
          <div className="flex items-center gap-3 px-4 md:px-6 h-12">
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
            >
              <i className="ti ti-arrow-left text-[16px]" aria-hidden="true" />
              <span className="hidden md:inline">Back to tasks</span>
            </Link>
          </div>
        </header>
        <div className="px-4 md:px-6 py-16 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-line grid place-items-center">
            <i className="ti ti-lock text-[24px] text-ink-3" aria-hidden="true" />
          </div>
          <h1 className="font-serif text-[20px] text-ink">You don't have access to this task</h1>
          <p className="text-[13px] text-ink-3 max-w-sm">
            Ask the task owner to add you on the task as a collaborator.
          </p>
        </div>
      </div>
    );
  }

  const isOwner = task.ownerId === session.user.id;
  const isUnassigned = task.ownerId === task.createdById;
  const canPull =
    isUnassigned &&
    !isOwner &&
    !task.parentTaskId &&
    task.visibility !== 'personal' &&
    me.divisionId === task.divisionId;

  const canDelete =
    task.createdById === session.user.id || isOwner;

  // Field editing: owner, creator, Director+ in same division, OSD, JS, Super Admin.
  const canEditFields =
    task.ownerId === session.user.id ||
    task.createdById === session.user.id ||
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd' ||
    session.user.hierarchySlot === 'js' ||
    (session.user.hierarchySlot === 'director' && session.user.divisionId === task.divisionId);

  // Collaborator editing: owner, creator, or OSD / Super Admin can manage.
  const canEditCollaborators =
    task.ownerId === session.user.id ||
    task.createdById === session.user.id ||
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd';

  // Candidate users: active users excluding the owner.
  const candidateRows = canEditCollaborators
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: task.ownerId },
        },
        select: {
          id: true,
          name: true,
          designation: true,
          division: { select: { name: true, avatarColour: true } },
        },
        orderBy: { name: 'asc' },
      })
    : [];

  const candidates: Candidate[] = candidateRows.map((u) => ({
    id: u.id,
    name: u.name,
    designation: u.designation,
    divisionName: u.division.name,
    divisionColour: u.division.avatarColour,
  }));

  // Mentionables: every active user (including the owner). Cap at 200 for
  // the in-memory typeahead — the picker filters client-side.
  const mentionableRows = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      username: true,
      designation: true,
      division: { select: { avatarColour: true } },
    },
    orderBy: { name: 'asc' },
    take: 200,
  });
  const mentionables: Mentionable[] = mentionableRows.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    designation: u.designation,
    divisionColour: u.division.avatarColour,
  }));

  const collaboratorRows: CollaboratorRow[] = task.collaborators.map((c) => ({
    id: c.id,
    userId: c.userId,
    name: c.user.name,
    designation: c.user.designation,
    role: c.role as CollaboratorRow['role'],
    division: {
      name: c.user.division.name,
      avatarColour: c.user.division.avatarColour,
    },
  }));

  // Cross-division marker — a task is "cross-division" if at least one
  // collaborator carries the division_lead role.
  const isCrossDivision = collaboratorRows.some((c) => c.role === 'division_lead');

  const subtaskScopes: SubtaskScope[] = task.subtasks.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  // Subtask assignee candidates: all active users.
  const subtaskAssigneeRows = canEditFields
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          designation: true,
          division: { select: { name: true, avatarColour: true } },
        },
        orderBy: { name: 'asc' },
      })
    : [];
  const subtaskAssignees = subtaskAssigneeRows.map((u) => ({
    id: u.id,
    name: u.name,
    designation: u.designation,
    divisionName: u.division.name,
    divisionColour: u.division.avatarColour,
  }));

  const transferCandidates = isOwner
    ? (await prisma.user.findMany({
        where: { isActive: true, divisionId: task.divisionId, id: { not: task.ownerId } },
        select: {
          id: true,
          name: true,
          designation: true,
          division: { select: { avatarColour: true } },
        },
        orderBy: { name: 'asc' },
      })).map((u) => ({
        id: u.id,
        name: u.name,
        designation: u.designation,
        divisionColour: u.division.avatarColour,
      }))
    : [];

  // Attachment editing — share the same permission as task tags.
  const canEditAttachments = await canEditTaskAttachments(session.user.id, task.id);
  const s3Ready = isS3Configured();

  const attachmentRows = await prisma.attachment.findMany({
    where: { ownerType: 'task', ownerId: task.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { uploadedAt: 'desc' },
  });
  const taskAttachments: AttachmentRow[] = attachmentRows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    source: a.source as 'uploaded' | 'drive_link',
    uploadedAt: a.uploadedAt,
    uploaderName: a.uploadedBy.name,
    canDelete: canEditAttachments || a.uploadedById === session.user.id,
  }));

  // Tag editing: owner, creator, OSD, or Super Admin can manage tags.
  const canEditTags =
    task.ownerId === session.user.id ||
    task.createdById === session.user.id ||
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd';

  const currentTagRows: TaskTagRow[] = task.tags.map((t) => ({
    id: t.tag.id,
    name: t.tag.name,
  }));

  const availableTagRows: TaskTagRow[] = canEditTags
    ? (
        await prisma.tag.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
      )
    : [];

  const canReassign =
    task.ownerId === session.user.id ||
    task.createdById === session.user.id ||
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd';

  const canChangeDivision =
    session.user.isSuperAdmin || session.user.hierarchySlot === 'osd';

  const [reassignCandidateRows, pendingReassignmentRow, allDivisions] = await Promise.all([
    canReassign
      ? prisma.user.findMany({
          where: { isActive: true, id: { not: task.ownerId } },
          select: {
            id: true,
            name: true,
            designation: true,
            division: { select: { name: true, avatarColour: true } },
          },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    prisma.reassignmentRequest.findFirst({
      where: { taskId: task.id, status: 'pending' },
      include: {
        proposedOwner: { select: { name: true } },
        requestedBy: { select: { name: true } },
        approver: { select: { name: true } },
      },
    }),
    canChangeDivision
      ? prisma.division.findMany({
          where: { kind: 'division' },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true, avatarColour: true },
        })
      : Promise.resolve([]),
  ]);

  const reassignCandidates = reassignCandidateRows.map((u) => ({
    id: u.id,
    name: u.name,
    designation: u.designation,
    divisionName: u.division.name,
    divisionColour: u.division.avatarColour,
  }));

  const pendingReassignment = pendingReassignmentRow
    ? {
        id: pendingReassignmentRow.id,
        proposedOwnerName: pendingReassignmentRow.proposedOwner.name,
        requestedByName: pendingReassignmentRow.requestedBy.name,
        approverName: pendingReassignmentRow.approver.name,
        approverId: pendingReassignmentRow.approverId,
        isApprover: pendingReassignmentRow.approverId === session.user.id,
      }
    : null;

  return (
    <div className="max-w-3xl xl:max-w-4xl mx-auto pb-16">
      {/* Header bar */}
      <header className="sticky top-14 md:top-16 z-10 bg-bg/90 backdrop-blur-sm border-b border-line-2">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-12">
          <Link
            href={task.parentTaskId ? `/tasks/${task.parentTaskId}` : '/tasks'}
            aria-label={task.parentTaskId ? 'Back to parent task' : 'Back to tasks'}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            <i className="ti ti-arrow-left text-[16px]" aria-hidden="true" />
            <span className="hidden md:inline">
              {task.parentTaskId ? 'Parent task' : 'Back to tasks'}
            </span>
          </Link>
          <MoreMenu
            taskId={task.id}
            canDelete={canDelete}
            reasonNoDelete={
              !canDelete
                ? 'Only the owner or creator can delete a task.'
                : undefined
            }
          />
        </div>
      </header>

      {/* Title block */}
      <section
        aria-labelledby="task-title"
        className="px-4 md:px-6 py-5 border-b border-line-2"
      >
        {task.parentTaskId ? (
          <p className="text-[11px] text-ink-3 mb-2 inline-flex items-center gap-1">
            <i className="ti ti-subtask text-[12px]" aria-hidden="true" />
            Subtask of{' '}
            <Link href={`/tasks/${task.parentTaskId}`} className="text-primary hover:underline font-medium">
              {task.parentTask?.name ?? 'parent task'}
            </Link>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <StatusPicker taskId={task.id} current={task.status as PillStatusTone} canEdit={canEditFields} />
          <PriorityPicker taskId={task.id} current={task.priority as PillPriorityTone} canEdit={canEditFields} />
          <JsLanePicker
            taskId={task.id}
            current={task.jsPriorityLane as PillJsLane | null}
            canCurate={
              session.user.isSuperAdmin || session.user.hierarchySlot === 'osd'
            }
          />
          {task.milestone ? <Pill variant="milestone" /> : null}
        </div>

        {task.refNumber ? (
          <span className="font-mono text-[11px] text-ink-3 tracking-wide">{task.refNumber}</span>
        ) : null}
        <TaskTitleEditor taskId={task.id} name={task.name} canEdit={canEditFields} />

        <p className="mt-2 text-[11px] text-ink-3 inline-flex items-center gap-1.5">
          <i className="ti ti-edit text-[12px]" aria-hidden="true" />
          Last edited {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
        </p>
      </section>

      <SectionContext taskId={task.id} description={task.description} canEdit={canEditFields} />

      <SectionSubtasks
        taskId={task.id}
        subtasks={task.subtasks}
        canEdit={canEditFields}
        assignees={subtaskAssignees}
        parentDueDate={task.dueDate}
      />

      {task.linkedTimelineFile ? (
        <section className="px-4 md:px-6 py-5 border-b border-line-2">
          <h2 className="section-label mb-2.5">Linked timeline file</h2>
          <TimelineFileCard
            variant="compact"
            refNo={task.linkedTimelineFile.refNo}
            subject={task.linkedTimelineFile.subject}
            fromWhom={task.linkedTimelineFile.fromWhom}
            deadlineDate={task.linkedTimelineFile.deadlineDate}
            href={`/timeline-files/${task.linkedTimelineFile.id}`}
          />
        </section>
      ) : null}

      <SectionDetails
        taskId={task.id}
        owner={task.owner}
        due={task.dueDate}
        divisionId={task.divisionId}
        divisionName={task.division.name}
        visibility={task.visibility as 'division' | 'personal'}
        recurrence={task.recurrenceRule}
        milestone={task.milestone}
        reassignCandidates={reassignCandidates}
        pendingReassignment={pendingReassignment}
        canReassign={canReassign}
        canEditFields={canEditFields}
        canChangeDivision={canChangeDivision}
        divisions={allDivisions}
        canViewProfiles={canChangeDivision}
      />

      {isOwner && !task.parentTaskId && transferCandidates.length > 0 ? (
        <div className="px-4 md:px-6 py-3 border-b border-line-2">
          <TransferTaskButton taskId={task.id} candidates={transferCandidates} />
        </div>
      ) : null}

      {canPull ? (
        <div className="px-4 md:px-6 py-3 border-b border-line-2">
          <PullTaskButton taskId={task.id} />
        </div>
      ) : null}

      <CollaboratorsSection
        taskId={task.id}
        collaborators={collaboratorRows}
        candidates={candidates}
        canEdit={canEditCollaborators}
        canViewProfiles={canChangeDivision}
        subtasks={!task.parentTaskId ? subtaskScopes : undefined}
      />

      <TagsSection
        taskId={task.id}
        current={currentTagRows}
        available={availableTagRows}
        canEdit={canEditTags}
      />

      <section className="px-4 md:px-6 py-5 border-b border-line-2">
        <h2 className="section-label mb-3">
          Attachments
          {taskAttachments.length > 0 ? (
            <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
              {taskAttachments.length}{' '}
              {taskAttachments.length === 1 ? 'file' : 'files'}
            </span>
          ) : null}
        </h2>
        <AttachmentList
          scope="task"
          parentId={task.id}
          attachments={taskAttachments}
          canEdit={canEditAttachments}
          s3Configured={s3Ready}
        />
      </section>

      <SectionComments
        taskId={task.id}
        comments={task.comments}
        mentionables={mentionables}
        currentUserId={session.user.id}
        canViewProfiles={canChangeDivision}
      />

      <SectionActivity
        activity={task.activity.map((a) => ({
          ...a,
          payload: (a.payload ?? {}) as Record<string, unknown>,
        }))}
      />
    </div>
  );
}



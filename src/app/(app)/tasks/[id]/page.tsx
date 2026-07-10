import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

import { AttachmentList, type AttachmentRow, Avatar, BackButton, CollapsibleSection, DetailSection, GlassDetailPanel, Pill, TimelineFileCard } from '@/components/ui';
import { canEditTaskAttachments } from '@/app/actions/attachments';
import { isS3Configured } from '@/lib/s3';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDue, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  canTransferTaskTo,
  fetchTransferTargets,
  getHeadedDivisionsByUser,
  getRbacActor,
  getSubordinateIds,
} from '@/lib/rbac';
import { ACTOR_SUMMARY_SELECT, USER_SUMMARY_SELECT } from '@/lib/prisma-selects';
import { buildVisibilityClauses } from '@/lib/visibility';
import { buildTaskParticipantWhere } from '@/lib/task-participants';
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
      owner: { select: USER_SUMMARY_SELECT },
      division: true,
      subDivision: { select: { id: true, name: true } },
      collaborators: {
        include: { user: { select: USER_SUMMARY_SELECT } },
      },
      subtasks: {
        include: { owner: { select: { id: true, name: true, division: { select: { avatarColour: true } } } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      },
      comments: {
        where: { parentCommentId: null },
        include: {
          user: { select: USER_SUMMARY_SELECT },
          replies: {
            include: { user: { select: USER_SUMMARY_SELECT } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      activity: {
        include: { actor: { select: ACTOR_SUMMARY_SELECT } },
        orderBy: { createdAt: 'desc' },
      },
      parentTask: { select: { id: true, name: true, ownerId: true } },
      linkedTimelineFile: true,
      tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });

  if (!task || task.archivedAt) notFound();

  // Visibility guard — reuses the same scoper as the tasks list page.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, hierarchySlot: true, isSuperAdmin: true, divisionId: true, isPmu: true, pmuId: true, pmuRole: true },
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
            <BackButton fallbackHref="/tasks" label="Back to tasks" hideLabelOnMobile />
          </div>
        </header>
        <div className="px-4 md:px-6 py-16 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-line grid place-items-center">
            <i className="ti ti-lock text-[24px] text-ink-3" aria-hidden="true" />
          </div>
          <h1 className="font-serif text-[20px] text-ink">You don&rsquo;t have access to this task</h1>
          <p className="text-[13px] text-ink-3 max-w-sm">
            Ask the task owner to add you on the task as a collaborator.
          </p>
        </div>
      </div>
    );
  }

  const isOwner = task.ownerId === session.user.id;
  const isSubtask = task.parentTaskId !== null;
  // Explicit collaborators (any role) may contribute to the task: add
  // documents, edit its context, and create subtasks — mirrored server-side
  // by isTaskCollaborator. It does not grant redefine/delete powers.
  const isCollaborator = task.collaborators.some(
    (c) => c.userId === session.user.id,
  );
  const isUnassigned = task.ownerId === task.createdById;
  // The Owner row reads as "Unassigned" for a top-level division task still
  // owned by its creator — the state a division member can pull from. A
  // personal task is genuinely owned by its creator, and subtasks are always
  // assigned, so neither shows the unassigned label.
  const ownerUnassigned =
    isUnassigned && task.visibility !== 'personal' && !task.parentTaskId;
  // Due-date display for the above-the-fold hero strip (same tone grammar as
  // the task cards).
  const heroDue = formatDue(task.dueDate);
  // Hero tint. A task spawned from / linked to a Timeline File gets a soft
  // RED wash (the Timeline-File colour on the calendar); every other task
  // keeps the light lavender. Kept subtle so the hero reads as a block.
  const fromTimelineFile = task.linkedTimelineFileId !== null;
  const heroTint = fromTimelineFile
    ? 'linear-gradient(180deg, color-mix(in srgb, var(--urgent-soft) 92%, transparent) 0%, color-mix(in srgb, var(--urgent-soft) 62%, transparent) 100%)'
    : 'linear-gradient(180deg, color-mix(in srgb, var(--primary-soft) 92%, transparent) 0%, color-mix(in srgb, var(--primary-soft) 62%, transparent) 100%)';
  const canPull =
    isUnassigned &&
    !isOwner &&
    !task.parentTaskId &&
    task.visibility !== 'personal' &&
    me.divisionId === task.divisionId;

  // Division-based RBAC context — heads (direct or delegated) get
  // director-like powers over the divisions they head.
  const actor = await getRbacActor(session.user.id);
  const isHeadOfTaskDivision =
    actor !== null && actor.headedDivisionIds.includes(task.divisionId);

  // Delete mirrors deleteTaskAction. For a subtask, the right belongs to the
  // parent task's owner, the head of the division, or a Super Admin — never
  // the subtask's own assignee. For a top-level task: a Super Admin or the
  // head of the division, plus a user's own personal task. A normal user who
  // merely owns a division task (e.g. after a transfer) cannot delete it.
  const canDelete = isSubtask
    ? session.user.isSuperAdmin ||
      isHeadOfTaskDivision ||
      task.parentTask?.ownerId === session.user.id
    : session.user.isSuperAdmin ||
      isHeadOfTaskDivision ||
      (task.visibility === 'personal' && task.ownerId === session.user.id);

  // Working the task — status, priority, description, subtasks — stays open
  // to the owner, creator, Director+ in same division, head, OSD, JS,
  // Super Admin.
  const canEditFields =
    task.ownerId === session.user.id ||
    task.createdById === session.user.id ||
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd' ||
    session.user.hierarchySlot === 'js' ||
    (session.user.hierarchySlot === 'director' && session.user.divisionId === task.divisionId) ||
    isHeadOfTaskDivision;

  // Redefining the task — name, due date, recurrence — is stricter: a normal
  // owner (e.g. after a transfer) cannot. Mirrors canEditTaskDetails on the
  // server. Own personal tasks stay fully editable.
  const canEditDetails =
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd' ||
    session.user.hierarchySlot === 'js' ||
    (session.user.hierarchySlot === 'director' && session.user.divisionId === task.divisionId) ||
    isHeadOfTaskDivision ||
    (task.visibility === 'personal' && task.ownerId === session.user.id);

  // Collaborator editing: owner, creator, or OSD / Super Admin can manage.
  const canEditCollaborators =
    task.ownerId === session.user.id ||
    task.createdById === session.user.id ||
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd';

  // PMU team share — a PMU team leader can share their own PMU task with the
  // whole team, surfacing it in every teammate's assigned list (except the
  // PMU's home-division head). OSD / Super Admin may manage it on any PMU task.
  const isPmuTask = task.division.kind === 'pmu';
  const canSharePmuTeam =
    isPmuTask &&
    ((task.ownerId === me.id &&
      me.pmuRole === 'pmu_team_leader' &&
      me.pmuId === task.divisionId) ||
      me.isSuperAdmin ||
      me.hierarchySlot === 'osd');

  // Every task user-picker (collaborators, subtask assignees, @mentions)
  // draws from the same set: the task division's members (or PMU team), its
  // head, and the oversight roles (OSD + Super Admin) — Office of JS being
  // the any-user exception. Centralised in buildTaskParticipantWhere.
  const participantWhere = await buildTaskParticipantWhere(task);

  // Candidate collaborators: task participants, excluding the current owner.
  const candidateRows = canEditCollaborators
    ? await prisma.user.findMany({
        where: { AND: [participantWhere, { id: { not: task.ownerId } }] },
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

  // Mentionables: task participants (including the owner). Cap at 200 for
  // the in-memory typeahead — the picker filters client-side.
  const mentionableRows = await prisma.user.findMany({
    where: participantWhere,
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

  // Subtask assignee candidates: task participants (same set as above).
  // Collaborators can create subtasks too, so they need the picker options.
  const subtaskAssigneeRows = canEditFields || isCollaborator
    ? await prisma.user.findMany({
        where: participantWhere,
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

  // Transfer targets follow the RBAC matrix: own division, division
  // head(s), Super Admin — or everyone for a Super Admin owner.
  const transferCandidates =
    isOwner && actor ? await fetchTransferTargets(actor) : [];

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

  // Tags are a Super Admin-only feature — only they see or manage tags.
  const canEditTags = session.user.isSuperAdmin;

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

  // Changing the owner from the Owner row is reserved for Super Admin, OSD,
  // and the head of the task's division. A normal user (even the owner or
  // creator) hands the task off via the Transfer button instead, which
  // requires a comment — so the Owner row stays read-only for them.
  const canReassign =
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd' ||
    isHeadOfTaskDivision;

  const canChangeDivision =
    session.user.isSuperAdmin || session.user.hierarchySlot === 'osd';

  // Visibility is a head power in both directions — mirrors the
  // canCreateDivisionTask gate in updateTaskFieldsAction.
  const canEditVisibility =
    session.user.isSuperAdmin ||
    session.user.hierarchySlot === 'osd' ||
    isHeadOfTaskDivision;

  // Super Admin and OSD may reassign anywhere; everyone else only sees
  // targets the RBAC matrix (or the legacy downward-chain rule) allows.
  const reassignAnywhere =
    session.user.isSuperAdmin || session.user.hierarchySlot === 'osd';

  const [
    reassignCandidateRows,
    pendingReassignmentRow,
    allDivisions,
    headedByUser,
    subordinateIds,
    subDivisionOptions,
  ] =
    await Promise.all([
      canReassign
        ? prisma.user.findMany({
            where: { isActive: true, id: { not: task.ownerId } },
            select: {
              id: true,
              name: true,
              designation: true,
              divisionId: true,
              isSuperAdmin: true,
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
            // Structure & Hierarchy: top-level divisions and their PMUs.
            // Assigning a task to one auto-owns it to the head / team leader.
            where: { kind: { in: ['division', 'pmu'] } },
            orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, avatarColour: true, kind: true },
          })
        : Promise.resolve([]),
      canReassign && !reassignAnywhere ? getHeadedDivisionsByUser() : Promise.resolve(new Map<string, string[]>()),
      canReassign && !reassignAnywhere ? getSubordinateIds(session.user.id) : Promise.resolve(new Set<string>()),
      // Sub-divisions of the task's division — drives the Subdivision row,
      // which appears only when the division has any. Fetched regardless of
      // edit rights so the row can also render read-only.
      prisma.division.findMany({
        where: { kind: 'sub_division', parentId: task.divisionId },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, avatarColour: true },
      }),
    ]);

  const reassignCandidates = reassignCandidateRows
    .filter(
      (u) =>
        reassignAnywhere ||
        subordinateIds.has(u.id) ||
        (actor !== null &&
          canTransferTaskTo(actor, {
            id: u.id,
            divisionId: u.divisionId,
            isSuperAdmin: u.isSuperAdmin,
            headedDivisionIds: headedByUser.get(u.id) ?? [],
            isActive: true,
          })),
    )
    .map((u) => ({
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
    <GlassDetailPanel>
      {/* Header bar — glassy, rounded to the panel's top edge */}
      <header className="sticky top-14 md:top-16 z-10 glass-header border-b border-line-2 rounded-t-[26px]">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-12">
          <BackButton
            fallbackHref={task.parentTaskId ? `/tasks/${task.parentTaskId}` : '/tasks'}
            label={task.parentTaskId ? 'Parent task' : 'Back to tasks'}
            hideLabelOnMobile
          />
          <MoreMenu
            taskId={task.id}
            canDelete={canDelete}
            reasonNoDelete={
              !canDelete
                ? isSubtask
                  ? 'Only the parent task owner, a division head, or a Super Admin can delete this subtask.'
                  : 'Only a division head or a Super Admin can delete this task.'
                : undefined
            }
          />
        </div>
      </header>

      {/* Title block — a clear tint over the frosted glass. It stays coloured
          right down to the divider so the hero reads as a distinct block.
          Red for Timeline-File-generated tasks, lavender otherwise. */}
      <section
        aria-labelledby="task-title"
        className="px-4 md:px-6 py-5 border-b border-line-2"
        style={{ background: heroTint }}
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
        <TaskTitleEditor taskId={task.id} name={task.name} canEdit={canEditDetails} />

        {/* Above-the-fold metadata — owner / due / division at a glance, so the
            hero has real hierarchy without expanding the details panel. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-2">
          {ownerUnassigned ? (
            <span className="inline-flex items-center gap-1.5 text-ink-3">
              <i className="ti ti-user text-[13px]" aria-hidden="true" />
              Unassigned
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Avatar
                size="xs"
                initials={initialsOf(task.owner.name)}
                colour={task.owner.division.avatarColour}
                ariaLabel={`Owner ${task.owner.name}`}
              />
              <span className="text-ink font-medium">{task.owner.name}</span>
            </span>
          )}

          {heroDue.tone !== 'none' ? (
            <>
              <span className="text-ink-4" aria-hidden="true">·</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  heroDue.tone === 'overdue' && 'text-urgent font-medium',
                  heroDue.tone === 'today' && 'text-accent font-medium',
                )}
              >
                <i className="ti ti-calendar-event text-[13px]" aria-hidden="true" />
                {heroDue.label}
              </span>
            </>
          ) : null}

          <span className="text-ink-4" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <i className="ti ti-building text-[13px]" aria-hidden="true" />
            {task.division.name}
          </span>
        </div>

        <p className="mt-2 text-[11px] text-ink-3 inline-flex items-center gap-1.5">
          <i className="ti ti-edit text-[12px]" aria-hidden="true" />
          Last edited {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
        </p>
      </section>

      <SectionContext
        taskId={task.id}
        description={task.description}
        canEdit={canEditFields || isCollaborator}
      />

      {/* Subtasks are one level deep — a subtask has no Subtasks section of its
          own (and can't gain one). Any legacy nested children still render. */}
      {!isSubtask || task.subtasks.length > 0 ? (
        <SectionSubtasks
          taskId={task.id}
          subtasks={task.subtasks}
          canEdit={canEditFields}
          canAdd={!isSubtask && (canEditFields || isCollaborator)}
          assignees={subtaskAssignees}
          parentDueDate={task.dueDate}
        />
      ) : null}

      {task.linkedTimelineFile ? (
        <DetailSection title="Linked timeline file">
          <TimelineFileCard
            variant="compact"
            refNo={task.linkedTimelineFile.refNo}
            subject={task.linkedTimelineFile.subject}
            fromWhom={task.linkedTimelineFile.fromWhom}
            deadlineDate={task.linkedTimelineFile.deadlineDate}
            href={`/timeline-files/${task.linkedTimelineFile.id}`}
          />
        </DetailSection>
      ) : null}

      {canPull ? (
        <div className="px-4 md:px-6 py-4 border-b border-line-2">
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
        pmuTeamShare={
          isPmuTask
            ? { canManage: canSharePmuTeam, shared: task.sharedWithPmuTeam }
            : undefined
        }
      />

      <DetailSection
        title="Attachments"
        count={taskAttachments.length}
        countLabel={taskAttachments.length === 1 ? 'file' : 'files'}
      >
        <AttachmentList
          scope="task"
          parentId={task.id}
          attachments={taskAttachments}
          canEdit={canEditAttachments}
          canAdd={canEditAttachments || isCollaborator}
          s3Configured={s3Ready}
        />
      </DetailSection>

      <SectionComments
        taskId={task.id}
        comments={task.comments}
        mentionables={mentionables}
        currentUserId={session.user.id}
        canViewProfiles={canChangeDivision}
      />

      {/* Details, tags (if any) and the activity log live together in one
          collapsible panel at the bottom — consistent across tasks, subtasks
          and timeline files. */}
      <CollapsibleSection
        title="Task details"
        subtitle="Owner, division, transfer, recurrence, tags and activity"
        icon="ti-list-details"
      >
        <SectionDetails
          taskId={task.id}
          owner={task.owner}
          isUnassigned={ownerUnassigned}
          due={task.dueDate}
          divisionId={task.divisionId}
          divisionName={task.division.name}
          subDivisionId={task.subDivisionId}
          subDivisionName={task.subDivision?.name ?? null}
          subDivisions={subDivisionOptions}
          canChangeSubDivision={canEditDetails}
          visibility={task.visibility as 'division' | 'personal'}
          recurrence={task.recurrenceRule}
          reassignCandidates={reassignCandidates}
          pendingReassignment={pendingReassignment}
          canReassign={canReassign}
          canEditFields={canEditDetails}
          canEditVisibility={canEditVisibility}
          canChangeDivision={canChangeDivision}
          divisions={allDivisions}
          canViewProfiles={canChangeDivision}
        />

        {/* Transfer lives under Task details — the current owner hands the task
            (or subtask) off via the same division-scoped dropdown. */}
        {isOwner && transferCandidates.length > 0 ? (
          <div className="px-4 md:px-6 py-4 border-b border-line-2">
            <TransferTaskButton taskId={task.id} candidates={transferCandidates} />
          </div>
        ) : null}

        {session.user.isSuperAdmin ? (
          <TagsSection
            taskId={task.id}
            current={currentTagRows}
            available={availableTagRows}
            canEdit={canEditTags}
          />
        ) : null}

        <SectionActivity
          activity={task.activity.map((a) => ({
            ...a,
            payload: (a.payload ?? {}) as Record<string, unknown>,
          }))}
        />
      </CollapsibleSection>
    </GlassDetailPanel>
  );
}



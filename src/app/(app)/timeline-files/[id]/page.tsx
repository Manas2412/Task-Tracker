import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';

import {
  AttachmentList,
  type AttachmentRow,
  Pill,
} from '@/components/ui';
import { canEditTfAttachments } from '@/app/actions/attachments';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initialsOf } from '@/lib/format';
import { isS3Configured } from '@/lib/s3';
import { buildTfVisibilityClause } from '@/lib/timeline-files';
import { cn } from '@/lib/utils';

import { DeskCommentSection } from './_components/DeskCommentSection';
import { LinkedTasksSection, type LinkedTaskRow } from './_components/LinkedTasksSection';
import {
  MarkedToEditor,
  type DivisionOption,
} from './_components/MarkedToEditor';
import { SecretaryQuoteSection } from './_components/SecretaryQuoteSection';
import { TfActivitySection } from './_components/TfActivitySection';
import { TfDeadlineEditor } from './_components/TfDeadlineEditor';
import { TfMoreMenu } from './_components/TfMoreMenu';
import { TfStatusPicker } from './_components/TfStatusPicker';
import { TfTitleEditor } from './_components/TfTitleEditor';

type PageProps = { params: { id: string } };

function canEditFieldsHelper(me: { hierarchySlot: string; isSuperAdmin: boolean }): boolean {
  return me.isSuperAdmin || me.hierarchySlot === 'osd';
}

const TF_STATUS_LABEL: Record<string, string> = {
  pending_action: 'Pending action',
  in_progress: 'In progress',
  awaiting_reply: 'Awaiting reply',
  on_hold: 'On hold',
  closed: 'Closed',
};

export default async function TimelineFileDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      hierarchySlot: true,
      isSuperAdmin: true,
      divisionId: true,
    },
  });
  if (!me) notFound();

  const visibility = await buildTfVisibilityClause(me);

  const tf = await prisma.timelineFile.findFirst({
    where: {
      id: params.id,
      archivedAt: null,
      AND: [visibility],
    },
    include: {
      createdBy: { include: { division: true } },
      markedTo: {
        include: {
          division: { select: { id: true, name: true, avatarColour: true } },
        },
      },
      taskLinks: {
        include: {
          task: {
            include: { owner: { include: { division: true } } },
          },
        },
        orderBy: { linkedAt: 'asc' },
      },
      activity: {
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!tf) notFound();

  // For the marked-to editor — OSD picks from any top-level division.
  const allDivisions: DivisionOption[] = canEditFieldsHelper(me)
    ? await prisma.division.findMany({
        where: { kind: 'division' },
        select: { id: true, name: true, avatarColour: true },
        orderBy: { displayOrder: 'asc' },
      })
    : [];

  const canEditFields =
    me.isSuperAdmin || me.hierarchySlot === 'osd';
  const canEditStatus =
    me.isSuperAdmin ||
    me.hierarchySlot === 'osd' ||
    (me.hierarchySlot === 'director' &&
      tf.markedTo.some((m) => m.division.id === me.divisionId));
  const canCreateTasks = true; // anyone with view access can create from a TF

  // Attachments — same gate as TF field editing for non-OSD directors of marked-to.
  const canEditAtt = await canEditTfAttachments(me.id, tf.id);
  const s3Ready = isS3Configured();

  // Source documents — many allowed
  const sourceRows = await prisma.attachment.findMany({
    where: { ownerType: 'timeline_file_source', ownerId: tf.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { uploadedAt: 'asc' },
  });
  const sourceAttachments: AttachmentRow[] = sourceRows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    source: a.source as 'uploaded' | 'drive_link',
    uploadedAt: a.uploadedAt,
    uploaderName: a.uploadedBy.name,
    canDelete: canEditAtt || a.uploadedById === me.id,
  }));

  // Action document — single canonical one tracked by TF.actionDocumentAttachmentId.
  const actionAttachments: AttachmentRow[] = tf.actionDocumentAttachmentId
    ? await prisma.attachment
        .findUnique({
          where: { id: tf.actionDocumentAttachmentId },
          include: { uploadedBy: { select: { name: true } } },
        })
        .then((a) =>
          a
            ? [
                {
                  id: a.id,
                  fileName: a.fileName,
                  fileUrl: a.fileUrl,
                  mimeType: a.mimeType,
                  sizeBytes: a.sizeBytes,
                  source: a.source as 'uploaded' | 'drive_link',
                  uploadedAt: a.uploadedAt,
                  uploaderName: a.uploadedBy.name,
                  canDelete: canEditAtt || a.uploadedById === me.id,
                },
              ]
            : [],
        )
    : [];

  // ---------- derive rendering data ----------

  const days = tf.deadlineDate ? daysUntil(tf.deadlineDate) : null;
  const isOverdue = days !== null && days < 0;
  const isClosed = tf.status === 'closed';

  const linkedTasks: LinkedTaskRow[] = tf.taskLinks.map((link) => ({
    id: link.task.id,
    name: link.task.name,
    status: link.task.status,
    priority: link.task.priority,
    due: link.task.dueDate,
    owner: {
      name: link.task.owner.name,
      divisionColour: link.task.owner.division.avatarColour,
    },
  }));

  const deadlineIso = tf.deadlineDate
    ? tf.deadlineDate.toISOString().slice(0, 10)
    : null;

  const markedToOptions = tf.markedTo.map((m) => ({
    id: m.division.id,
    name: m.division.name,
  }));

  // Stable signature line for the secretary's quote.
  const secretarySignature = `Secretary, Sports · ${format(tf.receivedDate, 'd LLL')}`;

  return (
    <div className="max-w-3xl xl:max-w-4xl mx-auto pb-16">
      {/* App-bar */}
      <header className="sticky top-14 md:top-16 z-10 bg-bg/90 backdrop-blur-sm border-b border-line-2">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-12">
          <Link
            href="/timeline-files"
            aria-label="Back to timeline files"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            <i className="ti ti-arrow-left text-[16px]" aria-hidden="true" />
            <span className="hidden md:inline">Back to timeline files</span>
          </Link>
          <TfMoreMenu
            tfId={tf.id}
            refNo={tf.refNo}
            canArchive={canEditFields}
            canDelete={!!me?.isSuperAdmin}
          />
        </div>
      </header>

      {/* Title block — indigo gradient + ref + status + deadline */}
      <section
        aria-labelledby="tf-title"
        className="px-4 md:px-6 py-5 border-b border-line-2"
        style={{ background: 'linear-gradient(180deg, var(--primary-soft) 0%, var(--panel) 100%)' }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className="font-mono text-[11px] font-medium text-primary bg-panel border border-primary-line/60 px-2 py-0.5 rounded-md">
            {tf.refNo}
          </span>
          <TfStatusPicker tfId={tf.id} current={tf.status} canEdit={canEditStatus} />
          {tf.deadlineDate && !isClosed && days !== null ? (
            <Pill variant="deadline" daysLeft={days} overdue={isOverdue} />
          ) : null}
        </div>

        <TfTitleEditor tfId={tf.id} subject={tf.subject} canEdit={canEditFields} />

        <p className="text-[12px] text-ink-2">
          From <span className="text-ink font-medium">{tf.fromWhom}</span>
          <span className="mx-1.5 text-ink-4">·</span>
          Received <span className="text-ink font-medium">{format(tf.receivedDate, 'd LLL yyyy')}</span>
        </p>
      </section>

      <SecretaryQuoteSection
        tfId={tf.id}
        comments={tf.secretaryComments}
        signature={secretarySignature}
        canEdit={canEditFields}
      />

      <DeskCommentSection
        tfId={tf.id}
        comments={tf.deskComments}
        canEdit={canEditFields}
      />

      <LinkedTasksSection
        tfId={tf.id}
        refNo={tf.refNo}
        defaultDueDate={deadlineIso}
        markedTo={markedToOptions}
        linkedTasks={linkedTasks}
        canCreateTasks={canCreateTasks}
      />

      <section className="px-4 md:px-6 py-5 border-b border-line-2">
        <h2 className="section-label mb-3">
          Source documents
          {sourceAttachments.length > 0 ? (
            <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
              {sourceAttachments.length}{' '}
              {sourceAttachments.length === 1 ? 'file' : 'files'}
            </span>
          ) : null}
        </h2>
        <AttachmentList
          scope="tf_source"
          parentId={tf.id}
          attachments={sourceAttachments}
          canEdit={canEditAtt}
          s3Configured={s3Ready}
          mode="list-multi"
          emptyHint="The original correspondence and any supporting annexures live here."
        />
      </section>

      <section className="px-4 md:px-6 py-5 border-b border-line-2">
        <h2 className="section-label mb-3">
          Action document
          {actionAttachments.length === 0 ? (
            <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
              Not yet uploaded
            </span>
          ) : null}
        </h2>
        <AttachmentList
          scope="tf_action"
          parentId={tf.id}
          attachments={actionAttachments}
          canEdit={canEditAtt}
          s3Configured={s3Ready}
          mode="list-single"
        />
      </section>

      {/* Details */}
      <section className="px-4 md:px-6 py-5 border-b border-line-2">
        <h2 className="section-label mb-3">Details</h2>
        <dl className="flex flex-col gap-2.5">
          <Row icon="ti-mail-forward" label="From">
            {tf.fromWhom}
          </Row>
          <Row icon="ti-calendar-event" label="Received">
            {format(tf.receivedDate, 'd LLL yyyy')}
          </Row>
          <TfDeadlineEditor
            tfId={tf.id}
            deadlineDate={tf.deadlineDate}
            canEdit={canEditFields}
          />
          <Row icon="ti-building" label="Marked to">
            <MarkedToEditor
              tfId={tf.id}
              current={tf.markedTo.map((m) => m.division)}
              allDivisions={allDivisions}
              canEdit={canEditFields}
            />
          </Row>
          <Row icon="ti-user" label="Created by">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-full text-white text-[9px] font-medium grid place-items-center"
                style={{ backgroundColor: tf.createdBy.division.avatarColour }}
                aria-hidden="true"
              >
                {initialsOf(tf.createdBy.name)}
              </span>
              {tf.createdBy.name}
              <span className="text-ink-3 text-[11px] font-normal">
                · {formatDistanceToNow(tf.createdAt, { addSuffix: true })}
              </span>
            </span>
          </Row>
        </dl>
      </section>

      <TfActivitySection
        activity={tf.activity.map((a) => ({
          ...a,
          payload: (a.payload ?? {}) as Record<string, unknown>,
        }))}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Row + helpers
// ------------------------------------------------------------

function Row({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <i
        className={cn('ti', icon, 'text-[16px] text-ink-3 shrink-0 w-[18px]')}
        aria-hidden="true"
      />
      <span className="text-[13px] text-ink-2 w-[100px] shrink-0">{label}</span>
      <span className="flex-1 text-[13px] text-right font-medium text-ink">{children}</span>
    </div>
  );
}

function daysUntil(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

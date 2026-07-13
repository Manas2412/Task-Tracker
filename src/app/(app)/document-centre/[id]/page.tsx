import { notFound, redirect } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';

import {
  AttachmentList,
  type AttachmentRow,
  BackButton,
  GlassDetailPanel,
  Pill,
} from '@/components/ui';
import {
  deleteDocumentCommentAction,
  editDocumentCommentAction,
  postDocumentCommentAction,
} from '@/app/actions/documents';
import { Discussion, type Mentionable } from '@/components/discussion/Discussion';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessDocumentCentreById, documentMentionWhere } from '@/lib/document-centre';
import {
  AWAITING_INPUT_TONE,
  COMPLETED_TONE,
  UNDER_REVIEW_TONE,
  URGENCY_LABEL,
  URGENCY_TONE,
} from '@/lib/document-centre-shared';
import { USER_SUMMARY_SELECT } from '@/lib/prisma-selects';
import { isS3Configured } from '@/lib/s3';

import { DocumentContextSection } from '../_components/DocumentContextSection';
import {
  DeleteDocumentButton,
  UrgencyControl,
  WorkflowControls,
} from '../_components/DocumentDetailControls';
import { DocumentTitleEditor } from '../_components/DocumentTitleEditor';

type PageProps = { params: { id: string } };

export default async function DocumentDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  // DB-backed gate (also rechecks isActive) — parity with the list page.
  if (!(await canAccessDocumentCentreById(session.user.id))) redirect('/tasks');

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const record = await prisma.documentRecord.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
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
    },
  });
  if (!record || record.archivedAt) notFound();

  // Mention pool + mentionables — the executive audience only.
  const mentionableRows = await prisma.user.findMany({
    where: documentMentionWhere(),
    select: {
      id: true,
      name: true,
      username: true,
      designation: true,
      division: { select: { avatarColour: true } },
    },
    orderBy: { name: 'asc' },
    take: 50,
  });
  const mentionables: Mentionable[] = mentionableRows.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    designation: u.designation,
    divisionColour: u.division.avatarColour,
  }));

  const attachmentRows = await prisma.attachment.findMany({
    where: { ownerType: 'document_record', ownerId: record.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { uploadedAt: 'desc' },
  });
  const attachments: AttachmentRow[] = attachmentRows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    source: a.source as 'uploaded' | 'drive_link',
    uploadedAt: a.uploadedAt,
    uploaderName: a.uploadedBy.name,
    canDelete: true,
  }));

  const canDelete = session.user.isSuperAdmin || record.createdById === session.user.id;
  const isCompleted = record.status === 'completed';

  return (
    <GlassDetailPanel>
      {/* Header */}
      <header className="sticky top-14 md:top-16 z-10 flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-line-2 bg-panel/85 backdrop-blur-sm">
        <BackButton fallbackHref="/document-centre" label="Records" hideLabelOnMobile />
        <span className="text-[11px] text-ink-3 inline-flex items-center gap-1">
          <i className="ti ti-files text-[13px] text-primary" aria-hidden="true" />
          Document Centre
        </span>
      </header>

      {/* Hero */}
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-line-2">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Pill variant="priority" tone={URGENCY_TONE[record.urgency]} label={URGENCY_LABEL[record.urgency]} />
          {isCompleted ? (
            <Pill variant="status" tone={COMPLETED_TONE} label="Completed" />
          ) : (
            <>
              {record.markedForReview ? (
                <Pill variant="status" tone={UNDER_REVIEW_TONE} label="Under review" />
              ) : null}
              {record.awaitingInput ? (
                <Pill variant="status" tone={AWAITING_INPUT_TONE} label="Awaiting input" />
              ) : null}
            </>
          )}
        </div>

        <DocumentTitleEditor documentId={record.id} subject={record.subject} />

        <p className="mt-2 text-[11.5px] text-ink-3">
          Created by <span className="text-ink-2 font-medium">{record.createdBy.name}</span>
          <span className="mx-1.5 text-ink-4">·</span>
          <time>{format(record.createdAt, 'd LLL yyyy')}</time>
          <span className="mx-1.5 text-ink-4">·</span>
          Updated {formatDistanceToNow(record.lastActivityAt, { addSuffix: true })}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="section-label mb-1.5">Urgency</p>
            <UrgencyControl documentId={record.id} urgency={record.urgency} />
          </div>
          <div>
            <p className="section-label mb-1.5">Workflow</p>
            <WorkflowControls
              documentId={record.id}
              markedForReview={record.markedForReview}
              awaitingInput={record.awaitingInput}
              status={record.status}
            />
          </div>
        </div>
      </div>

      {/* Context */}
      <DocumentContextSection documentId={record.id} context={record.context} />

      {/* Attachments + Drive links */}
      <section className="px-4 md:px-6 py-5 border-b border-line-2">
        <h2 className="section-label mb-3">
          Attachments
          {attachments.length > 0 ? (
            <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
              {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
            </span>
          ) : null}
        </h2>
        <AttachmentList
          scope="document"
          parentId={record.id}
          attachments={attachments}
          canEdit
          canAdd
          s3Configured={isS3Configured()}
          mode="list-multi"
          emptyHint="Attach files or paste Google Drive links — reports, minutes, presentations."
        />
      </section>

      {/* Discussion */}
      <Discussion
        entityField="id"
        entityId={record.id}
        actions={{
          post: postDocumentCommentAction,
          edit: editDocumentCommentAction,
          del: deleteDocumentCommentAction,
        }}
        comments={record.comments}
        mentionables={mentionables}
        currentUserId={session.user.id}
        canViewProfiles={session.user.isSuperAdmin || session.user.hierarchySlot === 'osd'}
      />

      {/* Danger zone */}
      {canDelete ? (
        <section className="px-4 md:px-6 py-5">
          <h2 className="section-label mb-3">Manage</h2>
          <DeleteDocumentButton documentId={record.id} canDelete={canDelete} />
        </section>
      ) : null}
    </GlassDetailPanel>
  );
}

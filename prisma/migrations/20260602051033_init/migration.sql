-- CreateEnum
CREATE TYPE "HierarchySlot" AS ENUM ('js', 'osd', 'director', 'deputy_secretary', 'under_secretary', 'section_officer', 'aso');

-- CreateEnum
CREATE TYPE "ContractRole" AS ENUM ('po', 'apo', 'yp');

-- CreateEnum
CREATE TYPE "PmuRole" AS ENUM ('pmu_senior_leadership', 'pmu_team_leader', 'pmu_senior_consultant', 'pmu_consultant', 'pmu_intern');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('not_started', 'in_progress', 'awaiting_input', 'on_hold', 'completed');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "JsPriorityLane" AS ENUM ('today', 'week', 'month', 'watchlist');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('personal', 'division');

-- CreateEnum
CREATE TYPE "RecurrenceRule" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'half_yearly');

-- CreateEnum
CREATE TYPE "TaskCollaboratorRole" AS ENUM ('collaborator', 'division_lead', 'co_owner');

-- CreateEnum
CREATE TYPE "TimelineFileStatus" AS ENUM ('pending_action', 'in_progress', 'awaiting_reply', 'on_hold', 'closed');

-- CreateEnum
CREATE TYPE "AttachmentOwnerType" AS ENUM ('task', 'task_comment', 'timeline_file', 'timeline_file_source', 'timeline_file_action');

-- CreateEnum
CREATE TYPE "AttachmentSource" AS ENUM ('uploaded', 'drive_link');

-- CreateEnum
CREATE TYPE "DivisionKind" AS ENUM ('division', 'sub_division', 'section', 'pmu');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('task_assigned', 'mention', 'status_changed_on_my_task', 'js_priority_added', 'task_due_soon', 'task_overdue', 'timeline_file_marked_to_division', 'secretary_comment_on_timeline_file', 'cross_division_status_change', 'reassignment_approval_requested', 'reassignment_approved', 'reassignment_rejected', 'password_reset_by_admin');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'archive', 'restore', 'login', 'logout', 'password_reset', 'role_change', 'hierarchy_change');

-- CreateEnum
CREATE TYPE "ReassignmentRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "hierarchy_slot" "HierarchySlot" NOT NULL,
    "contract_role" "ContractRole",
    "division_id" UUID NOT NULL,
    "sub_division_id" UUID,
    "section_id" UUID,
    "is_pmu" BOOLEAN NOT NULL DEFAULT false,
    "pmu_role" "PmuRole",
    "supervisor_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "force_password_change" BOOLEAN NOT NULL DEFAULT false,
    "password_changed_at" TIMESTAMPTZ(6),
    "last_login" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "divisions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "kind" "DivisionKind" NOT NULL,
    "has_pmu" BOOLEAN NOT NULL DEFAULT false,
    "pmu_parent_division_id" UUID,
    "avatar_colour" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'not_started',
    "priority" "TaskPriority" NOT NULL DEFAULT 'low',
    "js_priority_lane" "JsPriorityLane",
    "visibility" "Visibility" NOT NULL DEFAULT 'division',
    "due_date" TIMESTAMPTZ(6),
    "milestone" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" "RecurrenceRule",
    "parent_task_id" UUID,
    "linked_timeline_file_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_collaborators" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TaskCollaboratorRole" NOT NULL,
    "added_by" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" UUID[] DEFAULT ARRAY[]::UUID[],
    "status_transition" "TaskStatus",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activity" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "owner_type" "AttachmentOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "source" "AttachmentSource" NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_files" (
    "id" UUID NOT NULL,
    "ref_no" TEXT NOT NULL,
    "ref_year" INTEGER NOT NULL,
    "ref_seq" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "from_whom" TEXT NOT NULL,
    "received_date" DATE NOT NULL,
    "deadline_date" DATE,
    "status" "TimelineFileStatus" NOT NULL DEFAULT 'pending_action',
    "secretary_comments" TEXT,
    "action_document_attachment_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,

    CONSTRAINT "timeline_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_file_marked_to" (
    "timeline_file_id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "marked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_file_marked_to_pkey" PRIMARY KEY ("timeline_file_id","division_id")
);

-- CreateTable
CREATE TABLE "timeline_file_task_links" (
    "timeline_file_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" UUID NOT NULL,

    CONSTRAINT "timeline_file_task_links_pkey" PRIMARY KEY ("timeline_file_id","task_id")
);

-- CreateTable
CREATE TABLE "timeline_file_activity" (
    "id" UUID NOT NULL,
    "timeline_file_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_file_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tags" (
    "task_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("task_id","tag_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reassignment_requests" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "proposed_owner_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "status" "ReassignmentRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "reassignment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB NOT NULL DEFAULT '{}',
    "after" JSONB NOT NULL DEFAULT '{}',
    "ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_supervisor_id_idx" ON "users"("supervisor_id");

-- CreateIndex
CREATE INDEX "users_division_id_idx" ON "users"("division_id");

-- CreateIndex
CREATE INDEX "users_hierarchy_slot_idx" ON "users"("hierarchy_slot");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "divisions_parent_id_idx" ON "divisions"("parent_id");

-- CreateIndex
CREATE INDEX "divisions_kind_idx" ON "divisions"("kind");

-- CreateIndex
CREATE INDEX "tasks_owner_id_idx" ON "tasks"("owner_id");

-- CreateIndex
CREATE INDEX "tasks_division_id_idx" ON "tasks"("division_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_js_priority_lane_idx" ON "tasks"("js_priority_lane");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_linked_timeline_file_id_idx" ON "tasks"("linked_timeline_file_id");

-- CreateIndex
CREATE INDEX "task_collaborators_user_id_idx" ON "task_collaborators"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_collaborators_task_id_user_id_key" ON "task_collaborators"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "task_activity_task_id_created_at_idx" ON "task_activity"("task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "attachments_owner_type_owner_id_idx" ON "attachments"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_files_ref_no_key" ON "timeline_files"("ref_no");

-- CreateIndex
CREATE INDEX "timeline_files_deadline_date_idx" ON "timeline_files"("deadline_date");

-- CreateIndex
CREATE INDEX "timeline_files_status_idx" ON "timeline_files"("status");

-- CreateIndex
CREATE INDEX "timeline_files_received_date_idx" ON "timeline_files"("received_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "timeline_files_ref_year_ref_seq_key" ON "timeline_files"("ref_year", "ref_seq");

-- CreateIndex
CREATE INDEX "timeline_file_marked_to_division_id_idx" ON "timeline_file_marked_to"("division_id");

-- CreateIndex
CREATE INDEX "timeline_file_task_links_task_id_idx" ON "timeline_file_task_links"("task_id");

-- CreateIndex
CREATE INDEX "timeline_file_activity_timeline_file_id_created_at_idx" ON "timeline_file_activity"("timeline_file_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reassignment_requests_approver_id_status_idx" ON "reassignment_requests"("approver_id", "status");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_created_at_idx" ON "audit_log"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sub_division_id_fkey" FOREIGN KEY ("sub_division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "divisions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_pmu_parent_division_id_fkey" FOREIGN KEY ("pmu_parent_division_id") REFERENCES "divisions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linked_timeline_file_id_fkey" FOREIGN KEY ("linked_timeline_file_id") REFERENCES "timeline_files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_files" ADD CONSTRAINT "timeline_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_files" ADD CONSTRAINT "timeline_files_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "timeline_files" ADD CONSTRAINT "timeline_files_action_document_attachment_id_fkey" FOREIGN KEY ("action_document_attachment_id") REFERENCES "attachments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "timeline_file_marked_to" ADD CONSTRAINT "timeline_file_marked_to_timeline_file_id_fkey" FOREIGN KEY ("timeline_file_id") REFERENCES "timeline_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_marked_to" ADD CONSTRAINT "timeline_file_marked_to_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_task_links" ADD CONSTRAINT "timeline_file_task_links_timeline_file_id_fkey" FOREIGN KEY ("timeline_file_id") REFERENCES "timeline_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_task_links" ADD CONSTRAINT "timeline_file_task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_task_links" ADD CONSTRAINT "timeline_file_task_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_activity" ADD CONSTRAINT "timeline_file_activity_timeline_file_id_fkey" FOREIGN KEY ("timeline_file_id") REFERENCES "timeline_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_file_activity" ADD CONSTRAINT "timeline_file_activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_proposed_owner_id_fkey" FOREIGN KEY ("proposed_owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

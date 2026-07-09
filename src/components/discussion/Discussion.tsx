'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';

import Link from 'next/link';

import { Avatar, Pill } from '@/components/ui';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { PillStatusTone } from '@/components/ui/Pill';

/**
 * A threaded discussion — comments, replies, @-mentions, and a 5-minute
 * edit/delete window. Generic over the parent entity: the host supplies the
 * hidden field name the post action reads (`entityField`), the entity id, and
 * the three server actions. Used by Timeline Files; the task discussion has
 * its own copy today and can migrate here later.
 *
 * Mentions: no @ is required — typing a name opens the picker (it only opens
 * when the word prefixes a name, so prose doesn't). A mention is stored as an
 * `@username` marker and rendered as the person's full name in the app's
 * mention colour, underlined like a link.
 */

type CommentUser = {
  id?: string;
  name: string;
  designation: string;
  division: { avatarColour: string };
};

export type DiscussionReply = {
  id: string;
  userId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  statusTransition?: string | null;
  user: CommentUser;
};

export type DiscussionComment = DiscussionReply & {
  replies: DiscussionReply[];
};

export type Mentionable = {
  id: string;
  name: string;
  username: string;
  designation: string;
  divisionColour: string;
};

type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  epoch?: number;
};
type CommentAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

export type DiscussionActions = {
  post: CommentAction;
  edit: CommentAction;
  del: CommentAction;
};

type DiscussionProps = {
  /** Hidden field name the post action reads for the parent id (e.g. "id"). */
  entityField: string;
  entityId: string;
  actions: DiscussionActions;
  comments: DiscussionComment[];
  mentionables: Mentionable[];
  currentUserId: string;
  canViewProfiles: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_input: 'Awaiting input',
  on_hold: 'On hold',
  completed: 'Completed',
};

const EDIT_WINDOW_MS = 5 * 60 * 1000;

export function Discussion({
  entityField,
  entityId,
  actions,
  comments,
  mentionables,
  currentUserId,
  canViewProfiles,
}: DiscussionProps) {
  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  return (
    <section aria-labelledby="sec-discussion" className="px-4 md:px-6 py-5 border-b border-line-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="grid place-items-center w-7 h-7 rounded-xl bg-primary-soft text-primary shrink-0">
          <i className="ti ti-messages text-[15px]" aria-hidden="true" />
        </span>
        <h2 id="sec-discussion" className="section-label">
          Discussion
        </h2>
        <span className="text-[11px] font-medium leading-none text-primary bg-primary-soft border border-primary-line/40 px-2 py-[3px] rounded-pill">
          {totalCount}
        </span>
      </div>

      <div className="discussion-surface rounded-2xl p-3 md:p-4">
        {comments.length === 0 ? (
          <div className="text-center py-6">
            <span className="mx-auto grid place-items-center w-11 h-11 rounded-2xl bg-primary-soft text-primary mb-2.5">
              <i className="ti ti-message-2 text-[20px]" aria-hidden="true" />
            </span>
            <p className="text-[13px] font-medium text-ink-2">No comments yet</p>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Type a name to mention someone and start the discussion.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <CommentThread
                key={c.id}
                comment={c}
                replyTo={replyTo}
                onReply={setReplyTo}
                entityField={entityField}
                entityId={entityId}
                actions={actions}
                mentionables={mentionables}
                currentUserId={currentUserId}
                canViewProfiles={canViewProfiles}
              />
            ))}
          </ul>
        )}

        {replyTo === null ? (
          <Composer
            entityField={entityField}
            entityId={entityId}
            postAction={actions.post}
            mentionables={mentionables}
          />
        ) : null}
      </div>
    </section>
  );
}

function CommentThread({
  comment,
  replyTo,
  onReply,
  entityField,
  entityId,
  actions,
  mentionables,
  currentUserId,
  canViewProfiles,
}: {
  comment: DiscussionComment;
  replyTo: string | null;
  onReply: (id: string | null) => void;
  entityField: string;
  entityId: string;
  actions: DiscussionActions;
  mentionables: Mentionable[];
  currentUserId: string;
  canViewProfiles: boolean;
}) {
  const [showAllReplies, setShowAllReplies] = useState(false);
  const hasReplies = comment.replies.length > 0;
  const hiddenCount = comment.replies.length - 2;
  const visibleReplies = showAllReplies ? comment.replies : comment.replies.slice(-2);

  return (
    <li>
      <CommentRow
        comment={comment}
        currentUserId={currentUserId}
        mentionables={mentionables}
        actions={actions}
        canViewProfiles={canViewProfiles}
      />

      <div className="ml-9 mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onReply(replyTo === comment.id ? null : comment.id)}
          className="text-[11px] text-ink-3 hover:text-primary font-medium flex items-center gap-1"
        >
          <i className="ti ti-message-circle text-[13px]" aria-hidden="true" />
          {replyTo === comment.id ? 'Cancel' : 'Reply'}
        </button>
        {hasReplies ? (
          <span className="text-[11px] text-ink-3">
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </span>
        ) : null}
      </div>

      {hasReplies ? (
        <div className="ml-9 mt-2 pl-3 discussion-thread-line flex flex-col gap-2">
          {!showAllReplies && hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllReplies(true)}
              className="self-start text-[11px] text-primary font-medium hover:underline"
            >
              Show {hiddenCount} earlier {hiddenCount === 1 ? 'reply' : 'replies'}
            </button>
          ) : null}
          <ul className="flex flex-col gap-2">
            {visibleReplies.map((r) => (
              <li key={r.id}>
                <CommentRow
                  comment={r}
                  compact
                  currentUserId={currentUserId}
                  mentionables={mentionables}
                  actions={actions}
                  canViewProfiles={canViewProfiles}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {replyTo === comment.id ? (
        <div className="ml-9 mt-2 pl-3 discussion-thread-line">
          <Composer
            entityField={entityField}
            entityId={entityId}
            postAction={actions.post}
            mentionables={mentionables}
            parentCommentId={comment.id}
            placeholder={`Reply to ${comment.user.name}…`}
            onPosted={() => onReply(null)}
          />
        </div>
      ) : null}
    </li>
  );
}

function CommentRow({
  comment,
  compact,
  currentUserId,
  mentionables,
  actions,
  canViewProfiles,
}: {
  comment: DiscussionReply;
  compact?: boolean;
  currentUserId: string;
  mentionables: Mentionable[];
  actions: DiscussionActions;
  canViewProfiles: boolean;
}) {
  const isOwn = String(comment.userId) === String(currentUserId);
  const [windowOpen, setWindowOpen] = useState(() => {
    const elapsed = Date.now() - new Date(comment.createdAt).getTime();
    return isOwn && elapsed < EDIT_WINDOW_MS;
  });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!windowOpen) return;
    const elapsed = Date.now() - new Date(comment.createdAt).getTime();
    const remaining = EDIT_WINDOW_MS - elapsed;
    if (remaining <= 0) {
      setWindowOpen(false);
      return;
    }
    const timer = setTimeout(() => setWindowOpen(false), remaining);
    return () => clearTimeout(timer);
  }, [windowOpen, comment.createdAt]);

  if (editing) {
    return (
      <div className={cn('flex gap-2.5', compact && 'gap-2')}>
        <Avatar
          initials={initialsOf(comment.user.name)}
          colour={comment.user.division.avatarColour}
          size="sm"
          ariaLabel={comment.user.name}
        />
        <div className="flex-1 min-w-0">
          <EditComposer
            commentId={comment.id}
            initialBody={comment.body}
            mentionables={mentionables}
            editAction={actions.edit}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  const bubbleClass = cn(
    compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
    isOwn ? 'discussion-bubble-own' : compact ? 'discussion-bubble-reply' : 'discussion-bubble',
  );

  return (
    <div className={cn('flex gap-2.5', compact && 'gap-2')}>
      <Avatar
        initials={initialsOf(comment.user.name)}
        colour={comment.user.division.avatarColour}
        size="sm"
        ariaLabel={comment.user.name}
      />
      <div className="flex-1 min-w-0">
        <div className={bubbleClass}>
          <header className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
            {canViewProfiles && comment.user.id ? (
              <Link
                href={`/users/${comment.user.id}`}
                className={cn('font-medium text-ink hover:underline', compact ? 'text-[11px]' : 'text-[12px]')}
              >
                {comment.user.name}
              </Link>
            ) : (
              <span className={cn('font-medium text-ink', compact ? 'text-[11px]' : 'text-[12px]')}>
                {comment.user.name}
              </span>
            )}
            {!compact ? <span className="text-[10px] text-ink-3">· {comment.user.designation}</span> : null}
            {comment.editedAt ? <span className="text-[10px] text-ink-3 italic">edited</span> : null}
            <time
              className="ml-auto text-[10px] text-ink-3"
              dateTime={new Date(comment.createdAt).toISOString()}
            >
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </time>
          </header>
          <p
            className={cn(
              'text-ink leading-relaxed whitespace-pre-wrap',
              compact ? 'text-[12px]' : 'text-[13px]',
            )}
            dangerouslySetInnerHTML={{ __html: renderMentions(comment.body, mentionables) }}
          />
          {comment.statusTransition ? (
            <div className="mt-1.5 inline-flex">
              <Pill
                variant="status"
                tone={comment.statusTransition as PillStatusTone}
                label={`Status: ${STATUS_LABEL[comment.statusTransition] ?? comment.statusTransition}`}
              />
            </div>
          ) : null}
        </div>

        {windowOpen && !deleting ? (
          <div className="flex items-center gap-3 mt-1 ml-0.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-ink-3 hover:text-primary font-medium flex items-center gap-1"
            >
              <i className="ti ti-pencil text-[12px]" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="text-[11px] text-ink-3 hover:text-urgent font-medium flex items-center gap-1"
            >
              <i className="ti ti-trash text-[12px]" aria-hidden="true" />
              Delete
            </button>
          </div>
        ) : null}

        {deleting ? (
          <DeleteConfirm commentId={comment.id} delAction={actions.del} onCancel={() => setDeleting(false)} />
        ) : null}
      </div>
    </div>
  );
}

function DeleteConfirm({
  commentId,
  delAction,
  onCancel,
}: {
  commentId: string;
  delAction: CommentAction;
  onCancel: () => void;
}) {
  const [state, formAction] = useFormState(delAction, { ok: false, epoch: 0 });

  return (
    <form action={formAction} className="mt-1.5">
      <input type="hidden" name="commentId" value={commentId} />
      <p className="text-[11px] text-ink-2 mb-1.5">Delete this comment?</p>
      <div className="flex gap-2">
        <SubmitDeleteButton />
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-ink-3 hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {state.error ? <p className="text-[10px] text-urgent mt-1">{state.error}</p> : null}
    </form>
  );
}

function SubmitDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-urgent text-white disabled:opacity-50"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}

function EditComposer({
  commentId,
  initialBody,
  mentionables,
  editAction,
  onCancel,
  onSaved,
}: {
  commentId: string;
  initialBody: string;
  mentionables: Mentionable[];
  editAction: CommentAction;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction] = useFormState(editAction, { ok: false, epoch: 0 });
  const mention = useMentionTypeahead(textareaRef, mentionables);

  useEffect(() => {
    if (state.ok) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      mention.autoSize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="commentId" value={commentId} />
      <div className="relative">
        {mention.pickerOpen && mention.matches.length > 0 ? (
          <MentionPicker
            matches={mention.matches}
            activeIndex={mention.activeIndex}
            onSelect={mention.insertMention}
            onHover={mention.setActiveIndex}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          required
          defaultValue={initialBody}
          onInput={() => {
            mention.autoSize();
            mention.checkMention();
          }}
          onKeyDown={(e) => {
            if (mention.onKeyDown(e)) return;
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          onClick={mention.checkMention}
          onBlur={mention.onBlur}
          className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-[13px] text-ink outline-none resize-none focus:border-primary"
          maxLength={4000}
        />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <SaveButton />
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 rounded-md text-[11px] font-medium text-ink-3 hover:text-ink"
        >
          Cancel
        </button>
        <span className="ml-auto text-[10px] text-ink-3">Esc to cancel</span>
      </div>
      {state.fieldErrors?.body ? <p className="text-[11px] text-urgent mt-1">{state.fieldErrors.body}</p> : null}
      {state.error ? <p className="text-[11px] text-urgent mt-1">{state.error}</p> : null}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1 rounded-md text-[11px] font-medium bg-ink text-white disabled:bg-ink-4"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Turn each `@username` marker into the person's full name styled as a link —
 * the app's mention colour (indigo), underlined. Unknown handles keep their
 * raw text. HTML-escapes every interpolated value (dangerouslySetInnerHTML).
 */
function renderMentions(body: string, mentionables: Mentionable[]): string {
  const nameByUsername = new Map(
    mentionables.map((m) => [m.username.toLowerCase(), m.name] as const),
  );
  return escapeHtml(body).replace(/@([a-z0-9][a-z0-9._-]{1,40})/gi, (whole, handle: string) => {
    const name = nameByUsername.get(handle.toLowerCase());
    if (!name) return whole;
    return `<span class="text-primary underline underline-offset-2 decoration-primary-line">${escapeHtml(name)}</span>`;
  });
}

// ------------------------------------------------------------
// Mention typeahead — shared between the composer and edit box
// ------------------------------------------------------------

const MAX_PICKER_RESULTS = 6;

function filterMentionables(list: Mentionable[], rawQuery: string): Mentionable[] {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return list;
  return list.filter(
    (m) => m.username.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
  );
}

/** True only when a bare typed word (no @) should open the menu: 2+ chars that
 * prefix a username or any part of a name — so prose never pops the menu. */
function nameMatches(list: Mentionable[], word: string): boolean {
  const q = word.toLowerCase();
  if (q.length < 2) return false;
  return list.some(
    (m) =>
      m.username.toLowerCase().startsWith(q) ||
      m.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)),
  );
}

function useMentionTypeahead(
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  mentionables: Mentionable[],
) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = pickerOpen
    ? filterMentionables(mentionables, query).slice(0, MAX_PICKER_RESULTS)
    : [];

  useEffect(() => {
    setActiveIndex(0);
  }, [query, pickerOpen]);

  const closePicker = () => {
    setPickerOpen(false);
    setQuery('');
    setMentionStart(null);
  };

  const autoSize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const checkMention = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? 0;
    const before = ta.value.slice(0, cursor);
    // Explicit @ trigger — a handle being typed after an @.
    const at = before.match(/(?:^|[\s.,;:()\[\]!?])@([a-z0-9._-]{0,40})$/i);
    if (at) {
      setQuery(at[1]);
      setMentionStart(cursor - at[1].length - 1);
      setPickerOpen(true);
      return;
    }
    // No @ needed — the word at the cursor is matched against names.
    const word = before.match(/(?:^|[\s.,;:()\[\]!?])([A-Za-z][A-Za-z.'-]{1,40})$/);
    if (word && nameMatches(mentionables, word[1])) {
      setQuery(word[1]);
      setMentionStart(cursor - word[1].length);
      setPickerOpen(true);
      return;
    }
    closePicker();
  };

  const insertMention = (m: Mentionable) => {
    const ta = textareaRef.current;
    if (!ta || mentionStart === null) return;
    const text = ta.value;
    const cursor = ta.selectionStart ?? text.length;
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursor);
    ta.value = `${before}@${m.username} ${after}`;
    const nextCursor = mentionStart + m.username.length + 2;
    ta.setSelectionRange(nextCursor, nextCursor);
    ta.focus();
    autoSize();
    closePicker();
  };

  /** Returns true when the key was handled by the picker (caller should stop). */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!pickerOpen || matches.length === 0) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (matches[activeIndex]) insertMention(matches[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePicker();
    }
    return true;
  };

  const onBlur = () => {
    setTimeout(closePicker, 120);
  };

  return {
    pickerOpen,
    matches,
    activeIndex,
    setActiveIndex,
    query,
    autoSize,
    checkMention,
    insertMention,
    onKeyDown,
    onBlur,
  };
}

function MentionPicker({
  matches,
  activeIndex,
  onSelect,
  onHover,
}: {
  matches: Mentionable[];
  activeIndex: number;
  onSelect: (m: Mentionable) => void;
  onHover: (i: number) => void;
}) {
  return (
    <ul
      role="listbox"
      aria-label="Mentions"
      className="absolute left-0 right-0 bottom-full mb-2 z-30 rounded-xl border border-line bg-panel shadow-xl overflow-hidden max-h-[280px] overflow-y-auto"
    >
      <li className="px-3 py-1.5 text-[9px] uppercase tracking-[0.08em] font-medium text-ink-3 border-b border-line-2 bg-bg">
        Mention someone
      </li>
      {matches.map((m, i) => {
        const isActive = i === activeIndex;
        return (
          <li key={m.id}>
            <button
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(m);
              }}
              onMouseEnter={() => onHover(i)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                isActive ? 'bg-primary-soft' : 'hover:bg-bg',
              )}
            >
              <Avatar initials={initialsOf(m.name)} colour={m.divisionColour} size="sm" ariaLabel={m.name} />
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-medium text-ink truncate">
                  {m.name}{' '}
                  <span className="font-mono text-[10.5px] text-ink-3 font-normal">@{m.username}</span>
                </span>
                <span className="block text-[10.5px] text-ink-3 truncate">{m.designation}</span>
              </span>
            </button>
          </li>
        );
      })}
      <li className="px-3 py-1.5 text-[9px] text-ink-3 border-t border-line-2 bg-bg flex justify-between gap-2">
        <span>↑↓ to choose</span>
        <span>Enter to insert · Esc to cancel</span>
      </li>
    </ul>
  );
}

function Composer({
  entityField,
  entityId,
  postAction,
  mentionables,
  parentCommentId,
  placeholder,
  onPosted,
}: {
  entityField: string;
  entityId: string;
  postAction: CommentAction;
  mentionables: Mentionable[];
  parentCommentId?: string;
  placeholder?: string;
  onPosted?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction] = useFormState(postAction, { ok: false, epoch: 0 });
  const mention = useMentionTypeahead(textareaRef, mentionables);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      onPosted?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const onMentionButton = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, cursor);
    const after = ta.value.slice(cursor);
    const needsSpace = before.length > 0 && !/[\s.,;:()\[\]!?]$/.test(before);
    const insert = `${needsSpace ? ' ' : ''}@`;
    ta.value = `${before}${insert}${after}`;
    const nextCursor = cursor + insert.length;
    ta.setSelectionRange(nextCursor, nextCursor);
    ta.focus();
    mention.autoSize();
    mention.checkMention();
  };

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <input type="hidden" name={entityField} value={entityId} />
      {parentCommentId ? <input type="hidden" name="parentCommentId" value={parentCommentId} /> : null}
      <div className="relative">
        {mention.pickerOpen && mention.matches.length > 0 ? (
          <MentionPicker
            matches={mention.matches}
            activeIndex={mention.activeIndex}
            onSelect={mention.insertMention}
            onHover={mention.setActiveIndex}
          />
        ) : null}

        <div className="discussion-composer flex items-end gap-1 rounded-[22px] pl-1 pr-1.5 py-1.5">
          <button
            type="button"
            onClick={onMentionButton}
            aria-label="Mention someone"
            className="w-7 h-7 grid place-items-center rounded-full text-ink-3 hover:bg-primary-soft hover:text-primary transition-colors"
          >
            <i className="ti ti-at text-[15px]" aria-hidden="true" />
          </button>
          <textarea
            ref={textareaRef}
            name="body"
            rows={1}
            required
            placeholder={placeholder ?? 'Add a comment — type a name to mention someone'}
            onInput={() => {
              mention.autoSize();
              mention.checkMention();
            }}
            onKeyDown={(e) => {
              mention.onKeyDown(e);
            }}
            onClick={mention.checkMention}
            onBlur={mention.onBlur}
            className="flex-1 bg-transparent text-[13.5px] text-ink outline-none resize-none py-1.5 placeholder:text-ink-3"
            maxLength={4000}
          />
          <SendButton />
        </div>
      </div>
      {state.fieldErrors?.body ? <p className="text-[11px] text-urgent mt-1.5">{state.fieldErrors.body}</p> : null}
      {state.error ? <p className="text-[11px] text-urgent mt-1.5">{state.error}</p> : null}
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label="Post comment"
      disabled={pending}
      className="w-8 h-8 grid place-items-center rounded-full bg-primary text-white shadow-sm transition-colors hover:bg-primary/90 disabled:bg-ink-4 disabled:cursor-not-allowed"
    >
      <i className={cn('ti', pending ? 'ti-loader-2 animate-spin' : 'ti-send-2', 'text-[15px]')} aria-hidden="true" />
    </button>
  );
}

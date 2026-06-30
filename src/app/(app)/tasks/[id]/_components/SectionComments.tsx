'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';

import Link from 'next/link';

import { Avatar, Pill } from '@/components/ui';
import { deleteCommentAction, editCommentAction, postCommentAction } from '@/app/actions/tasks';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { PillStatusTone } from '@/components/ui/Pill';

type CommentUser = {
  id?: string;
  name: string;
  designation: string;
  division: { avatarColour: string };
};

type Reply = {
  id: string;
  userId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  statusTransition: string | null;
  user: CommentUser;
};

type Comment = {
  id: string;
  userId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  statusTransition: string | null;
  user: CommentUser;
  replies: Reply[];
};

export type Mentionable = {
  id: string;
  name: string;
  username: string;
  designation: string;
  divisionColour: string;
};

type SectionCommentsProps = {
  taskId: string;
  comments: Comment[];
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

export function SectionComments({
  taskId,
  comments,
  mentionables,
  currentUserId,
  canViewProfiles,
}: SectionCommentsProps) {
  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  return (
    <section aria-labelledby="sec-comments" className="px-4 md:px-6 py-5 border-b border-line-2">
      <h2 id="sec-comments" className="section-label mb-3">
        Discussion{' '}
        <span className="ml-2 text-ink-3 text-[11px] tracking-normal normal-case font-normal">
          {totalCount} {totalCount === 1 ? 'comment' : 'comments'}
        </span>
      </h2>

      {comments.length === 0 ? (
        <p className="text-[13px] text-ink-3 italic mb-4">
          No comments yet. Tag someone with @ to start a discussion.
        </p>
      ) : (
        <ul className="flex flex-col">
          {comments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              replyTo={replyTo}
              onReply={setReplyTo}
              taskId={taskId}
              mentionables={mentionables}
              currentUserId={currentUserId}
              canViewProfiles={canViewProfiles}
            />
          ))}
        </ul>
      )}

      {replyTo === null ? (
        <Composer taskId={taskId} mentionables={mentionables} />
      ) : null}
    </section>
  );
}

function CommentThread({
  comment,
  replyTo,
  onReply,
  taskId,
  mentionables,
  currentUserId,
  canViewProfiles,
}: {
  comment: Comment;
  replyTo: string | null;
  onReply: (id: string | null) => void;
  taskId: string;
  mentionables: Mentionable[];
  currentUserId: string;
  canViewProfiles: boolean;
}) {
  const [showAllReplies, setShowAllReplies] = useState(false);
  const hasReplies = comment.replies.length > 0;
  const hiddenCount = comment.replies.length - 2;
  const visibleReplies = showAllReplies ? comment.replies : comment.replies.slice(-2);

  return (
    <li className="py-3 border-b border-line-2 last:border-b-0">
      <CommentRow comment={comment} currentUserId={currentUserId} mentionables={mentionables} taskId={taskId} canViewProfiles={canViewProfiles} />

      <div className="ml-9 mt-1.5 flex items-center gap-3">
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
        <div className="ml-9 mt-2 pl-3 border-l-2 border-line-2">
          {!showAllReplies && hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllReplies(true)}
              className="text-[11px] text-primary font-medium mb-2 hover:underline"
            >
              Show {hiddenCount} earlier {hiddenCount === 1 ? 'reply' : 'replies'}
            </button>
          ) : null}
          <ul className="flex flex-col">
            {visibleReplies.map((r) => (
              <li key={r.id} className="py-2 border-b border-line-2 last:border-b-0">
                <CommentRow comment={r} compact currentUserId={currentUserId} mentionables={mentionables} taskId={taskId} canViewProfiles={canViewProfiles} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {replyTo === comment.id ? (
        <div className="ml-9 mt-2 pl-3 border-l-2 border-primary-line">
          <Composer
            taskId={taskId}
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
  taskId,
  showActions,
  canViewProfiles,
}: {
  comment: Reply;
  compact?: boolean;
  currentUserId: string;
  mentionables: Mentionable[];
  taskId: string;
  showActions?: boolean;
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
    if (remaining <= 0) { setWindowOpen(false); return; }
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
            taskId={taskId}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2.5', compact && 'gap-2')}>
      <Avatar
        initials={initialsOf(comment.user.name)}
        colour={comment.user.division.avatarColour}
        size="sm"
        ariaLabel={comment.user.name}
      />
      <div className="flex-1 min-w-0">
        <header className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          {canViewProfiles && comment.user.id ? (
            <Link href={`/users/${comment.user.id}`} className={cn('font-medium text-ink hover:underline', compact ? 'text-[11px]' : 'text-[12px]')}>
              {comment.user.name}
            </Link>
          ) : (
            <span className={cn('font-medium text-ink', compact ? 'text-[11px]' : 'text-[12px]')}>
              {comment.user.name}
            </span>
          )}
          {!compact ? (
            <span className="text-[10px] text-ink-3">· {comment.user.designation}</span>
          ) : null}
          {comment.editedAt ? (
            <span className="text-[10px] text-ink-3 italic">edited</span>
          ) : null}
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
          dangerouslySetInnerHTML={{ __html: renderMentions(comment.body) }}
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

        {/* Inline edit/delete actions — visible text links, like Reply */}
        {windowOpen && !deleting ? (
          <div className="flex items-center gap-3 mt-1">
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
          <DeleteConfirm
            commentId={comment.id}
            onCancel={() => setDeleting(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

function DeleteConfirm({ commentId, onCancel }: { commentId: string; onCancel: () => void }) {
  const [state, formAction] = useFormState(deleteCommentAction, { ok: false, epoch: 0 });

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
      {state.error ? (
        <p className="text-[10px] text-urgent mt-1">{state.error}</p>
      ) : null}
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
  taskId,
  onCancel,
  onSaved,
}: {
  commentId: string;
  initialBody: string;
  mentionables: Mentionable[];
  taskId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction] = useFormState(editCommentAction, { ok: false, epoch: 0 });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (state.ok) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoSize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = pickerOpen
    ? filterMentionables(mentionables, query).slice(0, MAX_PICKER_RESULTS)
    : [];

  useEffect(() => { setActiveIndex(0); }, [query, pickerOpen]);

  const closePicker = () => { setPickerOpen(false); setQuery(''); setMentionStart(null); };

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
    const m = before.match(/(?:^|[\s.,;:()\[\]!?])@([a-z0-9._-]{0,40})$/i);
    if (m) {
      setQuery(m[1]);
      setMentionStart(cursor - m[1].length - 1);
      setPickerOpen(true);
    } else {
      closePicker();
    }
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

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="commentId" value={commentId} />
      <div className="relative">
        {pickerOpen && matches.length > 0 ? (
          <MentionPicker
            matches={matches}
            activeIndex={activeIndex}
            onSelect={insertMention}
            onHover={setActiveIndex}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          required
          defaultValue={initialBody}
          onInput={() => { autoSize(); checkMention(); }}
          onKeyDown={(e) => {
            if (pickerOpen && matches.length > 0) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % matches.length); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + matches.length) % matches.length); }
              else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (matches[activeIndex]) insertMention(matches[activeIndex]); }
              else if (e.key === 'Escape') { e.preventDefault(); closePicker(); }
              return;
            }
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
          onClick={checkMention}
          onBlur={() => { setTimeout(closePicker, 120); }}
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-[13px] text-ink outline-none resize-none focus:border-ink"
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
      {state.fieldErrors?.body ? (
        <p className="text-[11px] text-urgent mt-1">{state.fieldErrors.body}</p>
      ) : null}
      {state.error ? (
        <p className="text-[11px] text-urgent mt-1">{state.error}</p>
      ) : null}
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

function renderMentions(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(
    /@([a-z0-9][a-z0-9._-]{1,40})/gi,
    '<span class="text-primary bg-primary-soft px-1 py-0.5 rounded-md font-medium">@$1</span>',
  );
}

// ------------------------------------------------------------
// Shared mention picker dropdown
// ------------------------------------------------------------

const MAX_PICKER_RESULTS = 6;

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
              onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
              onMouseEnter={() => onHover(i)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                isActive ? 'bg-primary-soft' : 'hover:bg-bg',
              )}
            >
              <Avatar
                initials={initialsOf(m.name)}
                colour={m.divisionColour}
                size="sm"
                ariaLabel={m.name}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-medium text-ink truncate">
                  {m.name}{' '}
                  <span className="font-mono text-[10.5px] text-ink-3 font-normal">
                    @{m.username}
                  </span>
                </span>
                <span className="block text-[10.5px] text-ink-3 truncate">
                  {m.designation}
                </span>
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

// ------------------------------------------------------------
// New comment composer with mention typeahead
// ------------------------------------------------------------

function Composer({
  taskId,
  mentionables,
  parentCommentId,
  placeholder,
  onPosted,
}: {
  taskId: string;
  mentionables: Mentionable[];
  parentCommentId?: string;
  placeholder?: string;
  onPosted?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction] = useFormState(postCommentAction, { ok: false, epoch: 0 });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      closePicker();
      onPosted?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.epoch]);

  const matches = pickerOpen
    ? filterMentionables(mentionables, query).slice(0, MAX_PICKER_RESULTS)
    : [];

  useEffect(() => { setActiveIndex(0); }, [query, pickerOpen]);

  const closePicker = () => { setPickerOpen(false); setQuery(''); setMentionStart(null); };

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
    const m = before.match(/(?:^|[\s.,;:()\[\]!?])@([a-z0-9._-]{0,40})$/i);
    if (m) {
      setQuery(m[1]);
      setMentionStart(cursor - m[1].length - 1);
      setPickerOpen(true);
    } else {
      closePicker();
    }
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
    autoSize();
    checkMention();
  };

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <input type="hidden" name="taskId" value={taskId} />
      {parentCommentId ? (
        <input type="hidden" name="parentCommentId" value={parentCommentId} />
      ) : null}
      <div className="relative">
        {pickerOpen && matches.length > 0 ? (
          <MentionPicker
            matches={matches}
            activeIndex={activeIndex}
            onSelect={insertMention}
            onHover={setActiveIndex}
          />
        ) : null}

        <div
          className={cn(
            'flex items-end gap-1 bg-bg border border-line rounded-[22px] pl-1 pr-1.5 py-1.5',
            'focus-within:border-ink',
          )}
        >
          <button
            type="button"
            onClick={onMentionButton}
            aria-label="Mention someone"
            className="w-7 h-7 grid place-items-center rounded-full text-ink-3 hover:bg-line-2 hover:text-ink"
          >
            <i className="ti ti-at text-[15px]" aria-hidden="true" />
          </button>
          <textarea
            ref={textareaRef}
            name="body"
            rows={1}
            required
            placeholder={placeholder ?? 'Add a comment or ask for an update… use @ to mention'}
            onInput={() => { autoSize(); checkMention(); }}
            onKeyDown={(e) => {
              if (!pickerOpen || matches.length === 0) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % matches.length); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + matches.length) % matches.length); }
              else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (matches[activeIndex]) insertMention(matches[activeIndex]); }
              else if (e.key === 'Escape') { e.preventDefault(); closePicker(); }
            }}
            onClick={checkMention}
            onBlur={() => { setTimeout(closePicker, 120); }}
            className="flex-1 bg-transparent text-[13.5px] text-ink outline-none resize-none py-1.5 placeholder:text-ink-3"
            maxLength={4000}
          />
          <SendButton />
        </div>
      </div>
      {state.fieldErrors?.body ? (
        <p className="text-[11px] text-urgent mt-1.5">{state.fieldErrors.body}</p>
      ) : null}
      {state.error ? (
        <p className="text-[11px] text-urgent mt-1.5">{state.error}</p>
      ) : null}
    </form>
  );
}

function filterMentionables(list: Mentionable[], rawQuery: string): Mentionable[] {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return list;
  return list.filter((m) =>
    m.username.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label="Post comment"
      disabled={pending}
      className="w-8 h-8 grid place-items-center rounded-full bg-ink text-white disabled:bg-ink-4 disabled:cursor-not-allowed"
    >
      <i
        className={cn('ti', pending ? 'ti-loader-2 animate-spin' : 'ti-send-2', 'text-[15px]')}
        aria-hidden="true"
      />
    </button>
  );
}

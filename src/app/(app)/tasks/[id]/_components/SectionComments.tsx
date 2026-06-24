'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';

import { Avatar, Pill } from '@/components/ui';
import { postCommentAction } from '@/app/actions/tasks';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { PillStatusTone } from '@/components/ui/Pill';

type CommentUser = {
  name: string;
  designation: string;
  division: { avatarColour: string };
};

type Reply = {
  id: string;
  body: string;
  createdAt: Date;
  statusTransition: string | null;
  user: CommentUser;
};

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
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
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_input: 'Awaiting input',
  on_hold: 'On hold',
  completed: 'Completed',
};

export function SectionComments({
  taskId,
  comments,
  mentionables,
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
            />
          ))}
        </ul>
      )}

      {/* Top-level composer (not replying to any specific comment) */}
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
}: {
  comment: Comment;
  replyTo: string | null;
  onReply: (id: string | null) => void;
  taskId: string;
  mentionables: Mentionable[];
}) {
  const [showAllReplies, setShowAllReplies] = useState(false);
  const hasReplies = comment.replies.length > 0;
  const hiddenCount = comment.replies.length - 2;
  const visibleReplies = showAllReplies ? comment.replies : comment.replies.slice(-2);

  return (
    <li className="py-3 border-b border-line-2 last:border-b-0">
      <CommentRow comment={comment} />

      {/* Reply action */}
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

      {/* Replies */}
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
                <CommentRow comment={r} compact />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Inline reply composer */}
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

function CommentRow({ comment, compact }: { comment: Reply; compact?: boolean }) {
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
          <span className={cn('font-medium text-ink', compact ? 'text-[11px]' : 'text-[12px]')}>
            {comment.user.name}
          </span>
          {!compact ? (
            <span className="text-[10px] text-ink-3">· {comment.user.designation}</span>
          ) : null}
          <time
            className="ml-auto text-[10px] text-ink-3"
            dateTime={comment.createdAt.toISOString()}
          >
            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
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
      </div>
    </div>
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
// Composer with mention typeahead
// ------------------------------------------------------------

const MAX_PICKER_RESULTS = 6;

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
    const text = ta.value;
    const before = text.slice(0, cursor);
    const m = before.match(/(?:^|[\s.,;:()\[\]!?])@([a-z0-9._-]{0,40})$/i);
    if (m) {
      setQuery(m[1]);
      setMentionStart(cursor - m[1].length - 1);
      setPickerOpen(true);
    } else {
      closePicker();
    }
  };

  const onInput = () => {
    autoSize();
    checkMention();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!pickerOpen || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const m = matches[activeIndex];
      if (m) insertMention(m);
    } else if (e.key === 'Escape') {
      e.preventDefault();
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
    const replacement = `@${m.username} `;
    const next = `${before}${replacement}${after}`;
    ta.value = next;
    const nextCursor = mentionStart + replacement.length;
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
                      insertMention(m);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
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
            onInput={onInput}
            onKeyDown={onKeyDown}
            onClick={checkMention}
            onBlur={() => {
              setTimeout(closePicker, 120);
            }}
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
  return list.filter((m) => {
    return (
      m.username.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  });
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

/**
 * Notification rendering.
 *
 * One central place that turns a `(type, payload)` pair into the icon,
 * tone, copy, and click target shown in the bell dropdown and the full
 * /notifications page.
 *
 * Per PRD §7 every type listed in `NotificationType` should map to a
 * legible sentence-case line.
 */

export type DescribedNotification = {
  icon: string;
  /** Tailwind colour class for the icon */
  iconClass: string;
  /** Sentence-case line shown to the user */
  text: string;
  /** Where clicking the notification takes the user */
  href: string;
  /** Optional left-edge accent tone for the row */
  accent?: 'js' | 'urgent' | 'primary' | 'info';
};

const LANE_LABEL: Record<string, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  watchlist: 'watchlist',
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_input: 'Awaiting input',
  on_hold: 'On hold',
  completed: 'Completed',
};

export function describeNotification(
  type: string,
  payload: Record<string, unknown> | null | undefined,
): DescribedNotification {
  const p = payload ?? {};
  const taskHref = p.taskId ? `/tasks/${String(p.taskId)}` : '/tasks';

  switch (type) {
    case 'js_priority_added': {
      const lane = String(p.lane ?? '');
      return {
        icon: 'ti-bookmark-filled',
        iconClass: 'text-accent',
        text: `Added to JS Priority — ${LANE_LABEL[lane] ?? lane}`,
        href: taskHref,
        accent: 'js',
      };
    }
    case 'task_assigned':
      return {
        icon: 'ti-user-plus',
        iconClass: 'text-primary',
        text: 'Assigned a task to you',
        href: taskHref,
      };
    case 'mention':
      return {
        icon: 'ti-at',
        iconClass: 'text-primary',
        text: 'Mentioned you in a comment',
        href: taskHref,
        accent: 'primary',
      };
    case 'status_changed_on_my_task': {
      const to = String(p.to ?? '');
      return {
        icon: 'ti-refresh',
        iconClass: 'text-info',
        text: `Status changed to ${STATUS_LABEL[to] ?? to}`,
        href: taskHref,
        accent: 'info',
      };
    }
    case 'task_due_soon':
      return {
        icon: 'ti-clock',
        iconClass: 'text-accent',
        text: 'Task due within 24 hours',
        href: taskHref,
        accent: 'js',
      };
    case 'task_overdue':
      return {
        icon: 'ti-alert-triangle',
        iconClass: 'text-urgent',
        text: 'Task is overdue',
        href: taskHref,
        accent: 'urgent',
      };
    case 'timeline_file_marked_to_division':
      return {
        icon: 'ti-file-stack',
        iconClass: 'text-primary',
        text: 'Timeline file marked to your division',
        href: p.timelineFileId ? `/timeline-files/${String(p.timelineFileId)}` : '/timeline-files',
        accent: 'primary',
      };
    case 'secretary_comment_on_timeline_file':
      return {
        icon: 'ti-quote',
        iconClass: 'text-primary',
        text: 'Secretary added a comment',
        href: p.timelineFileId ? `/timeline-files/${String(p.timelineFileId)}` : '/timeline-files',
        accent: 'primary',
      };
    case 'cross_division_status_change':
      return {
        icon: 'ti-refresh',
        iconClass: 'text-info',
        text: 'Status changed on a cross-division task',
        href: taskHref,
      };
    case 'reassignment_approval_requested':
      return {
        icon: 'ti-arrows-shuffle',
        iconClass: 'text-accent',
        text: 'Reassignment needs your approval',
        href: taskHref,
        accent: 'js',
      };
    case 'reassignment_approved':
      return {
        icon: 'ti-check',
        iconClass: 'text-success',
        text: 'Reassignment approved',
        href: taskHref,
      };
    case 'reassignment_rejected':
      return {
        icon: 'ti-x',
        iconClass: 'text-urgent',
        text: 'Reassignment rejected',
        href: taskHref,
      };
    case 'task_transferred': {
      const from = String(p.fromName ?? '');
      const to = String(p.toName ?? '');
      return {
        icon: 'ti-transfer',
        iconClass: 'text-info',
        text: `${from} transferred a task to ${to}`,
        href: taskHref,
        accent: 'info',
      };
    }
    case 'password_reset_by_admin':
      return {
        icon: 'ti-lock-cog',
        iconClass: 'text-primary',
        text: 'Your password was reset by Super Admin',
        href: '/profile/change-password',
        accent: 'primary',
      };
    default:
      return {
        icon: 'ti-bell',
        iconClass: 'text-ink-3',
        text: 'New notification',
        href: '/notifications',
      };
  }
}

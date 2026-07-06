'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { deleteEngagementAction, getEngagementDetail } from '@/app/actions/engagements';
import type { EngagementDetailData } from '@/app/actions/states';
import { formatTimeIST } from '@/lib/date';
import { cn } from '@/lib/utils';

import { EngagementForm } from './EngagementForm';
import { KIND_META } from './kind-style';
import type { PickUser } from './types';

type Props = {
  engagementId: string;
  candidates: PickUser[];
  canManage: boolean;
  onClose: () => void;
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function EngagementDetail({ engagementId, candidates, canManage, onClose }: Props) {
  const router = useRouter();
  const [data, setData] = useState<EngagementDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = () => {
    setLoading(true);
    getEngagementDetail(engagementId).then((d) => {
      setData(d);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  if (loading) {
    return (
      <p className="py-8 text-center text-[13px] text-ink-3 inline-flex items-center justify-center gap-1.5 w-full">
        <i className="ti ti-loader-2 animate-spin text-[15px]" aria-hidden="true" />
        Loading…
      </p>
    );
  }

  if (!data) {
    return (
      <p className="py-8 text-center text-[13px] text-ink-3">
        This engagement is no longer available.
      </p>
    );
  }

  if (editing) {
    return (
      <EngagementForm
        candidates={candidates}
        edit={{
          id: data.id,
          title: data.title,
          startsAt: data.startsAt,
          venue: data.venue,
          momNotes: data.momNotes,
          participantIds: data.participants.map((p) => p.id),
        }}
        onDone={() => {
          setEditing(false);
          load();
          router.refresh();
        }}
      />
    );
  }

  const meta = KIND_META.engagement;

  const onDelete = () => {
    const fd = new FormData();
    fd.set('engagementId', data.id);
    startTransition(async () => {
      const res = await deleteEngagementAction(undefined, fd);
      if (res.ok) {
        onClose();
        router.refresh();
      } else if (res.error) {
        alert(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={cn('w-9 h-9 grid place-items-center rounded-lg shrink-0', meta.tile)}>
          <i className={cn('ti text-[17px]', meta.icon)} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-serif text-[18px] leading-snug text-ink">{data.title}</h3>
          <p className="text-[12px] text-ink-2 mt-0.5">
            {formatDay(data.startsAt)} · {formatTimeIST(new Date(data.startsAt))}
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-3 text-[13px]">
        {data.venue ? (
          <Row icon="ti-map-pin" label="Venue / link">
            {/^https?:\/\//.test(data.venue) ? (
              <a
                href={data.venue}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline break-all"
              >
                {data.venue}
              </a>
            ) : (
              <span className="text-ink">{data.venue}</span>
            )}
          </Row>
        ) : null}

        <Row icon="ti-users" label="Participants">
          {data.participants.length > 0 ? (
            <span className="text-ink">{data.participants.map((p) => p.name).join(', ')}</span>
          ) : (
            <span className="text-ink-3">None added</span>
          )}
        </Row>

        {data.momNotes ? (
          <Row icon="ti-notes" label="MoM notes">
            <span className="text-ink whitespace-pre-wrap">{data.momNotes}</span>
          </Row>
        ) : null}

        {data.attachments.length > 0 ? (
          <Row icon="ti-paperclip" label="Attachments">
            <ul className="flex flex-col gap-1">
              {data.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline break-all inline-flex items-center gap-1.5"
                  >
                    <i className="ti ti-link text-[13px]" aria-hidden="true" />
                    {a.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </Row>
        ) : null}

        <Row icon="ti-user" label="Scheduled by">
          <span className="text-ink">{data.createdBy.name}</span>
        </Row>
      </dl>

      {canManage ? (
        confirmDelete ? (
          <div className="rounded-lg border border-line p-3">
            <p className="text-[12px] text-ink-2 mb-2">Delete this engagement? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
                className="flex-1 py-2 rounded-md border border-line text-[12px] text-ink-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="flex-1 py-2 rounded-md bg-urgent text-white text-[12px] font-medium disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 py-2.5 rounded-lg border border-line text-[13px] font-medium text-ink hover:bg-line-2 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <i className="ti ti-pencil text-[14px]" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="py-2.5 px-3 rounded-lg border border-line text-[13px] font-medium text-urgent hover:bg-urgent-soft transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <i className="ti ti-trash text-[14px]" aria-hidden="true" />
              Delete
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}

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
    <div className="flex gap-2.5">
      <i className={cn('ti', icon, 'text-[15px] text-ink-3 mt-0.5 shrink-0')} aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-[0.05em] text-ink-3 mb-0.5">{label}</dt>
        <dd className="min-w-0">{children}</dd>
      </div>
    </div>
  );
}

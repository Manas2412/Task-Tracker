'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { addMarkedToAction, removeMarkedToAction } from '@/app/actions/timeline-files';
import { cn } from '@/lib/utils';

export type DivisionOption = {
  id: string;
  name: string;
  avatarColour: string;
};

type MarkedToEditorProps = {
  tfId: string;
  current: DivisionOption[];
  allDivisions: DivisionOption[];
  canEdit: boolean;
};

export function MarkedToEditor({
  tfId,
  current,
  allDivisions,
  canEdit,
}: MarkedToEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const remove = (divisionId: string) => {
    const fd = new FormData();
    fd.set('id', tfId);
    fd.set('divisionId', divisionId);
    setPendingId(divisionId);
    startTransition(async () => {
      const result = await removeMarkedToAction(undefined, fd);
      setPendingId(null);
      if (!result.ok && result.error) alert(result.error);
    });
  };

  const add = (divisionId: string) => {
    const fd = new FormData();
    fd.set('id', tfId);
    fd.set('divisionId', divisionId);
    setPendingId(divisionId);
    startTransition(async () => {
      const result = await addMarkedToAction(undefined, fd);
      setPendingId(null);
      if (!result.ok && result.error) alert(result.error);
      else setPickerOpen(false);
    });
  };

  const currentIds = new Set(current.map((d) => d.id));
  const addable = allDivisions.filter((d) => !currentIds.has(d.id));

  return (
    <div className="inline-flex flex-wrap gap-1.5 justify-end items-center">
      {current.map((d) => (
        <span
          key={d.id}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium text-ink-2 bg-bg border border-line px-2 py-0.5 rounded-md',
            pendingId === d.id && 'opacity-60',
          )}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: d.avatarColour }}
            aria-hidden="true"
          />
          {d.name}
          {canEdit && current.length > 1 ? (
            <button
              type="button"
              onClick={() => remove(d.id)}
              disabled={pendingId !== null}
              aria-label={`Remove ${d.name}`}
              className="w-4 h-4 grid place-items-center rounded-full text-ink-3 hover:bg-line-2 hover:text-ink"
            >
              <i className="ti ti-x text-[10px]" aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}

      {canEdit && addable.length > 0 ? (
        <div className="relative inline-block" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={pickerOpen}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary border border-dashed border-primary-line/60 bg-primary-soft/40 px-2 py-0.5 rounded-md hover:bg-primary-soft"
          >
            <i className="ti ti-plus text-[10px]" aria-hidden="true" />
            Add
          </button>
          <div
            role="menu"
            aria-hidden={!pickerOpen}
            className={cn(
              'absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-panel shadow-xl z-30 p-1',
              'transition-all duration-150 origin-top-right',
              pickerOpen
                ? 'opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-95 pointer-events-none',
            )}
          >
            {addable.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => add(d.id)}
                disabled={pendingId !== null}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-ink hover:bg-bg transition-colors disabled:opacity-60"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: d.avatarColour }}
                  aria-hidden="true"
                />
                {d.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

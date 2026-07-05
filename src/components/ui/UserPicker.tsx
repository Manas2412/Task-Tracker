'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

export type UserPickerOption = {
  id: string;
  name: string;
  designation: string;
  divisionName?: string;
  divisionColour?: string;
};

type UserPickerProps = {
  options: UserPickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
};

export function UserPicker({
  options,
  value,
  onChange,
  placeholder = 'Search by name or designation…',
  name,
  disabled,
  error,
  className,
}: UserPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.name.toLowerCase().includes(q) ||
          o.designation.toLowerCase().includes(q) ||
          (o.divisionName?.toLowerCase().includes(q) ?? false)
        );
      })
    : options;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!value) setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const select = useCallback(
    (o: UserPickerOption) => {
      onChange(o.id);
      setQuery(o.name);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[activeIndex]) select(filtered[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        if (!value) setQuery('');
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const handleFocus = () => {
    setOpen(true);
    if (selected) {
      setQuery('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (value) onChange('');
    setOpen(true);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <div className="relative">
        <i
          className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-3 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selected?.name ?? query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          className={cn(
            'w-full pl-8 pr-8 py-2 rounded-lg border bg-panel text-[13px] outline-none transition-colors',
            error
              ? 'border-urgent focus:border-urgent'
              : 'border-line focus:border-ink',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-line-2"
            aria-label="Clear selection"
          >
            <i className="ti ti-x text-[12px]" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open && filtered.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-line bg-panel shadow-xl overflow-hidden max-h-[240px] overflow-y-auto"
        >
          {filtered.map((o, i) => {
            const isActive = i === activeIndex;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(o);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-primary-soft' : 'hover:bg-bg',
                  )}
                >
                  <Avatar
                    initials={initialsOf(o.name)}
                    colour={o.divisionColour ?? 'var(--ink-4)'}
                    size="sm"
                    ariaLabel={o.name}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium text-ink truncate">
                      {o.name}
                    </span>
                    <span className="block text-[10.5px] text-ink-3 truncate">
                      {o.designation}
                      {o.divisionName ? ` · ${o.divisionName}` : ''}
                    </span>
                  </span>
                  {o.id === value ? (
                    <i className="ti ti-check text-[14px] text-primary shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : open && query.trim() && filtered.length === 0 ? (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-line bg-panel shadow-xl px-4 py-3 text-center">
          <p className="text-[12px] text-ink-3">No match for &ldquo;{query}&rdquo;</p>
        </div>
      ) : null}
    </div>
  );
}

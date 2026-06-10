'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Toggle switch per Design Tokens §6.7.
 *
 * Form submission: pass `name` and it writes a hidden input with
 * value `'on'` when checked, empty otherwise. Server reads with
 * `formData.get(name)` and checks truthiness.
 *
 * Controlled mode (pass `checked` + `onChange`) overrides uncontrolled.
 */

type SwitchProps = {
  name?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({
  name,
  defaultChecked = false,
  checked,
  onChange,
  ariaLabel,
  disabled,
  className,
}: SwitchProps) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const value = isControlled ? checked : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !value;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <>
      {name ? <input type="hidden" name={name} value={value ? 'on' : ''} /> : null}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={ariaLabel}
        onClick={toggle}
        disabled={disabled}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          value ? 'bg-ink' : 'bg-line',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform',
            'shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
            value && 'translate-x-4',
          )}
        />
      </button>
    </>
  );
}

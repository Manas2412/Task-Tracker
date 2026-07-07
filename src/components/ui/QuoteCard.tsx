import { cn } from '@/lib/utils';

export type QuoteCardTone = 'primary' | 'ink';

type QuoteCardProps = {
  text: string;
  /** Attribution row, e.g. "Secretary, Sports · 29 Apr". Omitted when null. */
  signature?: string | null;
  /**
   * `primary` (indigo) is reserved for Timeline File surfaces per the
   * two-accent rule; `ink` is the neutral variant for everywhere else.
   */
  tone?: QuoteCardTone;
  /** Extra classes for the body text — e.g. a line-clamp. */
  textClassName?: string;
};

/**
 * Quoted callout card — white panel, left stripe, serif body, a large
 * quotation mark top-right, and an optional dash-prefixed attribution.
 * The visual grammar of the Secretary's comments block (Design Tokens
 * §6.4), shared by the TF desk comment and the task context section.
 */
export function QuoteCard({ text, signature, tone = 'primary', textClassName }: QuoteCardProps) {
  const isPrimary = tone === 'primary';
  return (
    <blockquote
      className={cn(
        'relative bg-panel border border-l-4 rounded-r-xl px-4 py-3.5',
        isPrimary ? 'border-primary-line/40 border-l-primary' : 'border-line border-l-ink',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 right-3 font-serif text-[34px] leading-none select-none',
          isPrimary ? 'text-primary-line/70' : 'text-ink-4',
        )}
      >
        &ldquo;
      </span>
      <p
        className={cn(
          'font-serif text-[14px] leading-relaxed text-ink pr-6 whitespace-pre-wrap',
          textClassName,
        )}
      >
        {text}
      </p>
      {signature ? (
        <div
          className={cn(
            'mt-2.5 flex items-center gap-1.5 text-[11px] font-medium',
            isPrimary ? 'text-primary' : 'text-ink-2',
          )}
        >
          <span aria-hidden="true" className={cn('w-4 h-px', isPrimary ? 'bg-primary-line' : 'bg-ink-4')} />
          {signature}
        </div>
      ) : null}
    </blockquote>
  );
}

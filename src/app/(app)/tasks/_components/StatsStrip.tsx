type StatsStripProps = {
  counts: { open: number; dueToday: number; overdue: number };
};

/**
 * Three-stat strip. Single row at every breakpoint; cards get more
 * breathing room on tablet+ via larger padding.
 */
export function StatsStrip({ counts }: StatsStripProps) {
  return (
    <div
      className="mt-4 p-4 md:p-5 grid grid-cols-3 gap-3 md:gap-6 rounded-xl border border-line"
      style={{
        background: 'linear-gradient(180deg, var(--canvas) 0%, var(--bg) 100%)',
      }}
    >
      <Stat label="Open tasks" value={counts.open} />
      <Stat label="Due today" value={counts.dueToday} accent />
      <Stat label="Overdue" value={counts.overdue} alert={counts.overdue > 0} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  alert,
}: {
  label: string;
  value: number;
  accent?: boolean;
  alert?: boolean;
}) {
  const tone =
    alert
      ? 'text-urgent'
      : accent
        ? 'text-accent'
        : 'text-ink';
  return (
    <div>
      <div className={`font-serif text-[22px] md:text-[28px] leading-none font-medium ${tone}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] md:text-[11px] uppercase tracking-[0.04em] font-medium text-ink-3">
        {label}
      </div>
    </div>
  );
}

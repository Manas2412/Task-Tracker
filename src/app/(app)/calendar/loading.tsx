/** Skeleton shown during the /calendar server render. */
export default function CalendarLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="h-3 w-16 rounded bg-line-2 mb-2 animate-pulse" />
          <div className="h-6 w-48 rounded bg-line-2 animate-pulse" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-8 w-8 rounded-md bg-line-2 animate-pulse" />
          <div className="h-8 w-8 rounded-md bg-line-2 animate-pulse" />
        </div>
      </div>

      <div className="flex gap-1.5 mb-5">
        <div className="h-7 w-20 rounded-[14px] bg-line-2 animate-pulse" />
        <div className="h-7 w-16 rounded-[14px] bg-line-2 animate-pulse" />
      </div>

      {/* Month grid placeholder */}
      <div className="grid grid-cols-7 gap-px bg-line rounded-xl overflow-hidden border border-line">
        {/* Day headers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h-${i}`} className="h-8 bg-panel animate-pulse" />
        ))}
        {/* Day cells — 5 rows × 7 */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-20 md:h-24 bg-panel animate-pulse" />
        ))}
      </div>
    </div>
  );
}

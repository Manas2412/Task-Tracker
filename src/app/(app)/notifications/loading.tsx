/** Skeleton shown during the /notifications server render. */
export default function NotificationsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="h-3 w-14 rounded bg-line-2 mb-2 animate-pulse" />
          <div className="h-6 w-40 rounded bg-line-2 mb-1 animate-pulse" />
          <div className="h-3 w-28 rounded bg-line-2 mt-1 animate-pulse" />
        </div>
        <div className="h-8 w-28 rounded-md bg-line-2 animate-pulse" />
      </div>

      <div className="flex gap-1.5 mb-4">
        <div className="h-7 w-16 rounded-[14px] bg-line-2 animate-pulse" />
        <div className="h-7 w-24 rounded-[14px] bg-line-2 animate-pulse" />
      </div>

      <div className="bg-panel border border-line rounded-xl overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 md:px-5 py-3.5 border-b border-line-2 last:border-b-0"
          >
            <div className="w-9 h-9 rounded-lg bg-line-2 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-3.5 w-3/4 rounded bg-line-2 mb-2 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-line-2 animate-pulse" />
            </div>
            <div className="w-2 h-2 rounded-full bg-line-2 mt-1.5 shrink-0 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

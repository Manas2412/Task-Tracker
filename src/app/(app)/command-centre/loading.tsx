/** Skeleton shown during the /command-centre server render. */
export default function CommandCentreLoading() {
  return (
    <div className="pb-12">
      <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
        <div className="h-3 w-24 rounded bg-line-2 mb-2 animate-pulse" />
        <div className="h-7 w-56 rounded bg-line-2 mb-5 animate-pulse" />

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-line bg-panel animate-pulse"
            />
          ))}
        </div>

        {/* Table placeholder */}
        <div className="rounded-xl border border-line bg-panel overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 border-b border-line-2 last:border-b-0 px-4 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-line-2 animate-pulse shrink-0" />
              <div className="flex-1 h-3 rounded bg-line-2 animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-line-2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

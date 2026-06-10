/** Skeleton shown during the /admin/audit server render. */
export default function AdminAuditLoading() {
  return (
    <div className="pb-12">
      <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
        <div className="h-3 w-24 rounded bg-line-2 mb-2 animate-pulse" />
        <div className="h-6 w-40 rounded bg-line-2 mb-4 animate-pulse" />
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-32 rounded-md bg-line-2 animate-pulse"
            />
          ))}
        </div>
        <div className="rounded-xl border border-line bg-panel overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-14 border-b border-line-2 last:border-b-0 px-4 flex items-center gap-3"
            >
              <div className="h-8 w-8 rounded-lg bg-line-2 animate-pulse" />
              <div className="flex-1 h-3 rounded bg-line-2 animate-pulse" />
              <div className="h-3 w-20 rounded bg-line-2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

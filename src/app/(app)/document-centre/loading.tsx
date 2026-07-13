export default function DocumentCentreLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-24 md:pb-10 animate-pulse">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-2.5 w-28 rounded bg-line-2" />
          <div className="h-7 w-56 rounded bg-line-2" />
          <div className="h-3 w-72 rounded bg-line-2" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-line-2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-panel border border-line" />
        ))}
      </div>

      {/* Filter row */}
      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded-[14px] bg-line-2" />
        ))}
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-panel border border-line" />
        ))}
      </div>
    </div>
  );
}

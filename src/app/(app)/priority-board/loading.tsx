/** Skeleton shown during the /priority-board server render. */
export default function PriorityBoardLoading() {
  return (
    <div className="pb-12">
      <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
        <div className="h-3 w-20 rounded bg-line-2 mb-2 animate-pulse" />
        <div className="h-7 w-48 rounded bg-line-2 mb-5 animate-pulse" />

        {/* Lane columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 3 }).map((_, laneIdx) => (
            <div
              key={laneIdx}
              className="rounded-xl border border-line bg-panel p-3"
            >
              <div className="h-4 w-24 rounded bg-line-2 mb-3 animate-pulse" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, cardIdx) => (
                  <div
                    key={cardIdx}
                    className="h-24 rounded-lg border border-line-2 bg-bg animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton shown during the /timeline-files server render. */
export default function TimelineFilesLoading() {
  return (
    <div className="pb-24 md:pb-10">
      <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
        <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
          <div>
            <div className="h-3 w-20 rounded bg-line-2 mb-2 animate-pulse" />
            <div className="h-6 w-48 rounded bg-line-2 animate-pulse" />
          </div>
          <div className="hidden md:block h-8 w-28 rounded-md bg-line-2 animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-20 rounded-[14px] bg-line-2 animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="px-4 md:px-6 lg:px-8 mt-5">
        <ul className="space-y-2 md:space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="h-36 rounded-xl border border-line bg-panel animate-pulse"
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

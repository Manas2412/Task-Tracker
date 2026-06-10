/**
 * Skeleton shown during the /tasks server render.
 *
 * Renders a header strip + filter row + grid of card placeholders that
 * mirrors the real layout, so the page feels stable across navigation.
 */
export default function TasksLoading() {
  return (
    <div className="pb-24 md:pb-10">
      <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
        <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
          <div>
            <div className="h-3 w-20 rounded bg-line-2 mb-2 animate-pulse" />
            <div className="h-6 w-44 rounded bg-line-2 animate-pulse" />
          </div>
          <div className="hidden md:block h-8 w-24 rounded-md bg-line-2 animate-pulse" />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-16 rounded-[14px] bg-line-2 animate-pulse"
            />
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-line bg-panel animate-pulse"
            />
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 mt-5">
        <div className="h-3 w-12 rounded bg-line-2 mb-2 animate-pulse" />
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <div className="h-28 rounded-xl border border-line bg-panel animate-pulse" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

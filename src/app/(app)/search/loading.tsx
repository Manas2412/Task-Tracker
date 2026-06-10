/** Skeleton shown during the /search server render. */
export default function SearchLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12">
      <div className="h-3 w-16 rounded bg-line-2 mb-2 animate-pulse" />
      <div className="h-6 w-56 rounded bg-line-2 mb-4 animate-pulse" />
      <div className="flex flex-wrap gap-1.5 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-20 rounded-[14px] bg-line-2 animate-pulse"
          />
        ))}
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="h-20 rounded-xl border border-line bg-panel animate-pulse"
          />
        ))}
      </ul>
    </div>
  );
}

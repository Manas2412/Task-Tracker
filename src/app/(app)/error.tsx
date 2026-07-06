'use client';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-md mx-auto py-20 px-4 text-center">
      <i
        className="ti ti-alert-triangle text-[36px] text-ink-3 block mb-3"
        aria-hidden="true"
      />
      <h2 className="font-serif text-[22px] text-ink mb-2">
        Something went wrong
      </h2>
      <p className="text-[13px] text-ink-2 leading-relaxed mb-5">
        An unexpected error occurred while loading this page. If the problem
        persists, contact your Super Admin.
      </p>
      {error.digest ? (
        <p className="text-[11px] text-ink-3 mb-4">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="px-5 py-2.5 rounded-lg border border-line bg-panel text-[13px] font-medium text-ink hover:bg-line-2 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

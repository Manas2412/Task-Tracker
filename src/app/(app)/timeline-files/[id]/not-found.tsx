import { BackButton } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="min-h-[60dvh] flex items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <i
          className="ti ti-file-off text-[36px] text-ink-3 block mb-3"
          aria-hidden="true"
        />
        <h1 className="font-serif text-[22px] text-ink mb-2">Timeline file not found</h1>
        <p className="text-[13px] text-ink-2 leading-relaxed mb-5">
          The file you opened may have been archived, may not be marked to your division, or never existed.
        </p>
        <BackButton
          variant="button"
          fallbackHref="/timeline-files"
          label="Back to timeline files"
        />
      </div>
    </main>
  );
}

'use client';

import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
    >
      <i className="ti ti-arrow-left text-[16px]" aria-hidden="true" />
      <span className="hidden md:inline">Back</span>
    </button>
  );
}

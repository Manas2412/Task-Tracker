'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={onSubmit} className="mt-3">
      <div className="relative">
        <i
          className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-ink-3 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks, files, people, tags…"
          autoFocus
          autoComplete="off"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-line bg-panel text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-ink transition-colors"
          aria-label="Search"
        />
      </div>
    </form>
  );
}

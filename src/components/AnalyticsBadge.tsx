'use client';

import { useEffect, useState } from 'react';

interface Stats {
  activeUsers: number;
  totalUsers: number;
  configured: boolean;
}

export function AnalyticsBadge() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch('/api/analytics');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setStats(data);
      } catch {
        // silent — badge just won't show
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (!stats?.configured) return null;

  return (
    <div className="flex items-center gap-3 text-xs font-medium text-[var(--text-secondary)]">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {stats.activeUsers} online
      </span>
      <span className="text-[var(--border-default)]">|</span>
      <span>{stats.totalUsers} total</span>
    </div>
  );
}

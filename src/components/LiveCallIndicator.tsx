'use client';

import { useEffect, useState } from 'react';

function elapsed(since: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Pulsing "LIVE" pill with a call timer and audio bars, shown while a verification call runs. */
export function LiveCallIndicator({ startedAt, label }: { startedAt: string; label: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2" role="status">
      <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        Live
      </span>
      <span className="flex h-5 items-end gap-0.5" aria-hidden>
        {[0, 150, 300, 450].map((delay) => (
          <span
            key={delay}
            className="w-1 animate-call-bar rounded-full bg-blue-600"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="text-sm font-medium text-blue-900">{label}</span>
      <span className="ml-auto font-mono text-sm tabular-nums text-blue-900">{elapsed(startedAt, now)}</span>
    </div>
  );
}

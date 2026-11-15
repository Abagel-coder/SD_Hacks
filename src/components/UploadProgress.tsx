'use client';

import { useEffect, useState } from 'react';

/**
 * The upload is one POST with no progress events, so the steps advance on a timer
 * matched to typical stage times (read ~3 s, web check ~4 s, then scoring until the
 * response arrives). `done` marks every step complete.
 */
const STEPS = [
  { label: 'Reading invoice', detail: 'Gemini extracts vendor, amount and bank details', startsAt: 0 },
  { label: 'Checking the web', detail: 'Bright Data looks up the real vendor', startsAt: 3500 },
  { label: 'Scoring', detail: 'Comparing against history and known scams', startsAt: 7500 },
] as const;

export function UploadProgress({ done }: { done: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(timer);
  }, []);

  const current = done ? STEPS.length : STEPS.findLastIndex((step) => elapsed >= step.startsAt);

  return (
    <ol className="w-full space-y-2 rounded-lg border border-gray-200 bg-white p-3" aria-live="polite">
      {STEPS.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'waiting';
        return (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 ${
                state === 'done'
                  ? 'bg-green-600 text-white'
                  : state === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200'
              }`}
              aria-hidden
            >
              {state === 'done' ? '✓' : state === 'active' ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : index + 1}
            </span>
            <span className={state === 'waiting' ? 'text-gray-400' : 'font-semibold text-gray-900'}>{step.label}</span>
            <span className={`hidden text-xs sm:inline ${state === 'waiting' ? 'text-gray-300' : 'text-gray-500'}`}>
              {step.detail}
            </span>
            <span className="sr-only">{state}</span>
          </li>
        );
      })}
    </ol>
  );
}

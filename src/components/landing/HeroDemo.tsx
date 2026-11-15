'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import type { InvoiceStatus } from '@/lib/types';

/** A looping, illustrative replay of one scam invoice going through the agent. It reads no real data. */
const STEPS: { tool: string; text: string; status: InvoiceStatus; risk: number }[] = [
  { tool: 'Gemini', text: 'Reading the invoice', status: 'pending', risk: 0 },
  { tool: 'Neon', text: 'New bank account, 3× the usual amount', status: 'pending', risk: 60 },
  { tool: 'Bright Data', text: 'Sent from u1ine.com, real site is uline.com', status: 'frozen', risk: 100 },
  { tool: 'ElevenLabs', text: 'Calling the number on uline.com', status: 'verifying', risk: 100 },
  { tool: 'Vendor', text: '"No, we never changed banks."', status: 'blocked', risk: 100 },
];

const STEP_MS = 2200;

export function HeroDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => (current + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  const current = STEPS[step];
  const calling = current.status === 'verifying';

  return (
    <div className="relative w-full max-w-md rounded-[1.75rem] bg-white p-6 text-gray-900 shadow-2xl shadow-black/40">
      {/* The scanning line while the invoice is being read and checked. */}
      {step < 3 && (
        <div className="pointer-events-none absolute inset-x-6 bottom-6 top-6 overflow-hidden rounded-2xl">
          <div className="animate-scan absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-blue-400/15 to-transparent" />
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Invoice ULI-2026-11</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">Uline</p>
          <p className="text-sm text-gray-500">from billing@u1ine.com</p>
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">$3,853.50</p>
      </div>

      <div className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between border-b border-gray-100 pb-2">
          <span className="text-gray-500">Bank account</span>
          <span className={`font-medium transition-colors duration-500 ${step >= 1 ? 'text-red-600' : ''}`}>•••• 6789</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 pb-2">
          <span className="text-gray-500">Risk score</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
              <span
                className="block h-full rounded-full bg-red-600 transition-all duration-700"
                style={{ width: `${current.risk}%` }}
              />
            </span>
            <span className="w-7 text-right font-semibold tabular-nums">{current.risk}</span>
          </span>
        </div>
      </div>

      <div className="mt-5 flex min-h-[4.5rem] items-center gap-3 rounded-2xl bg-gray-50 p-4">
        {calling ? (
          <span className="flex h-8 w-10 shrink-0 items-center justify-center gap-0.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className="animate-wave h-full w-1 rounded-full bg-blue-600"
                style={{ animationDelay: `${bar * 0.12}s` }}
              />
            ))}
          </span>
        ) : (
          <span className="grid h-8 w-10 shrink-0 place-items-center rounded-full bg-black text-[10px] font-bold text-white">
            {current.tool.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div key={step} className="animate-fade-up min-w-0">
          <p className="eyebrow">{current.tool}</p>
          <p className="truncate text-sm font-medium">{current.text}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-500 ${index === step ? 'w-6 bg-black' : 'w-1.5 bg-gray-300'}`}
            />
          ))}
        </div>
        <span className={current.status === 'blocked' ? 'animate-ring-pulse rounded-full' : ''}>
          <StatusBadge status={current.status} />
        </span>
      </div>
    </div>
  );
}

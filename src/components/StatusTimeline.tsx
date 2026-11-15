'use client';

import { useEffect, useRef, useState } from 'react';
import type { CallRow, InvoiceStatus } from '@/lib/types';

type StepState = 'done' | 'current' | 'upcoming' | 'skipped';
type Tone = 'neutral' | 'amber' | 'blue' | 'red' | 'green';

interface Step {
  id: string;
  label: string;
  state: StepState;
  tone: Tone;
}

/** Received → Checked → Frozen → Verifying → Blocked/Approved, derived from the invoice and its latest call. */
function buildSteps(status: InvoiceStatus, call: CallRow | null): Step[] {
  const decided = status === 'approved' || status === 'blocked';
  // An approved invoice with no call went straight from Checked to Approved.
  const wasFrozen = status !== 'approved' || call !== null;
  const wasVerifying = status === 'verifying' || call !== null;

  const freeze: StepState =
    status === 'frozen' ? 'current' : status === 'pending' ? 'upcoming' : wasFrozen ? 'done' : 'skipped';
  const verify: StepState =
    status === 'verifying' ? 'current' : decided ? (wasVerifying ? 'done' : 'skipped') : 'upcoming';

  return [
    { id: 'received', label: 'Received', state: 'done', tone: 'neutral' },
    { id: 'checked', label: 'Checked', state: status === 'pending' ? 'current' : 'done', tone: 'neutral' },
    { id: 'frozen', label: 'Frozen', state: freeze, tone: 'amber' },
    { id: 'verifying', label: 'Verifying', state: verify, tone: 'blue' },
    {
      id: 'final',
      label: status === 'blocked' ? 'Blocked' : status === 'approved' ? 'Approved' : 'Decision',
      state: decided ? 'current' : 'upcoming',
      tone: status === 'blocked' ? 'red' : status === 'approved' ? 'green' : 'neutral',
    },
  ];
}

const DOT: Record<Tone, string> = {
  neutral: 'bg-gray-800 text-white ring-gray-800',
  amber: 'bg-amber-400 text-amber-950 ring-amber-500',
  blue: 'bg-blue-600 text-white ring-blue-600',
  red: 'bg-red-600 text-white ring-red-600',
  green: 'bg-green-600 text-white ring-green-600',
};

const HALO: Record<Tone, string> = {
  neutral: 'ring-gray-300',
  amber: 'ring-amber-200',
  blue: 'ring-blue-200',
  red: 'ring-red-200',
  green: 'ring-green-200',
};

const ICON: Record<string, string> = {
  received: '↓', checked: '✓', frozen: '❄', verifying: '☎', final: '•',
};

function finalIcon(label: string): string {
  if (label === 'Blocked') return '✕';
  if (label === 'Approved') return '✓';
  return '•';
}

function Dot({ step, popKey }: { step: Step; popKey: number }) {
  const active = step.state === 'done' || step.state === 'current';
  const icon = step.id === 'final' ? finalIcon(step.label) : step.state === 'done' && step.id !== 'received' ? '✓' : ICON[step.id];
  return (
    <span
      key={step.state === 'current' ? popKey : undefined}
      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 transition-all duration-500 ${
        active ? DOT[step.tone] : step.state === 'skipped' ? 'bg-gray-100 text-gray-400 ring-gray-200' : 'bg-white text-gray-400 ring-gray-300'
      } ${step.state === 'current' ? 'animate-step-pop' : ''}`}
    >
      {step.state === 'current' && (
        <span className={`absolute inset-0 -z-10 rounded-full ring-[6px] ${HALO[step.tone]}`} aria-hidden />
      )}
      {icon}
    </span>
  );
}

/** Horizontal stepper on desktop, vertical on phones. The newly reached step pops when the status changes. */
export function StatusTimeline({ status, call }: { status: InvoiceStatus; call: CallRow | null }) {
  const steps = buildSteps(status, call);
  const previous = useRef(status);
  const [popKey, setPopKey] = useState(0);

  useEffect(() => {
    if (previous.current === status) return;
    previous.current = status;
    const timer = setTimeout(() => setPopKey((k) => k + 1), 0);
    return () => clearTimeout(timer);
  }, [status]);

  const reached = steps.reduce((last, step, index) => (step.state === 'done' || step.state === 'current' ? index : last), 0);

  return (
    <nav aria-label="Invoice progress" className="rounded-lg border border-gray-200 bg-white px-4 py-4">
      <ol className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
        {/* Connector track (desktop) with a fill that grows as the invoice moves along. */}
        <span className="absolute left-12 right-12 top-[16px] hidden h-1 rounded-full bg-gray-200 sm:block" aria-hidden />
        <span
          className="absolute left-12 top-[16px] hidden h-1 rounded-full bg-gray-800 transition-[width] duration-700 ease-out sm:block"
          style={{ width: `calc((100% - 6rem) * ${reached / (steps.length - 1)})` }}
          aria-hidden
        />
        {steps.map((step) => (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="flex items-center gap-3 sm:w-24 sm:flex-col sm:gap-1.5 sm:text-center"
          >
            <Dot step={step} popKey={popKey} />
            <span
              className={`text-sm transition-colors duration-500 ${
                step.state === 'current'
                  ? 'font-bold text-gray-900'
                  : step.state === 'done'
                    ? 'font-medium text-gray-700'
                    : step.state === 'skipped'
                      ? 'text-gray-400 line-through decoration-gray-300'
                      : 'text-gray-400'
              }`}
            >
              {step.label}
              {step.state === 'skipped' && <span className="sr-only"> (skipped)</span>}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

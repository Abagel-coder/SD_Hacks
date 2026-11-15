'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/AppNav';
import type { BacktestResult } from '@/lib/backtest/run';
import type { CaseResult, Scorecard } from '@/lib/backtest/replay';
import type { RiskRules } from '@/lib/risk/engine';
import { REASON_TITLE as RULE_LABEL } from '@/lib/risk-labels';
import type { RiskCode } from '@/lib/types';

function copy(rules: RiskRules): RiskRules {
  return { ...rules, points: { ...rules.points }, hardFreeze: { ...rules.hardFreeze } };
}

/** '2026-11-14T16:40' in the viewer's timezone -> ISO, or undefined. */
function localToIso(value: string): string | undefined {
  if (!value) return undefined;
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
}

const time = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Delta({ before, after, good }: { before: number; after: number; good: 'up' | 'down' }) {
  if (before === after) return <span className="text-lg font-semibold tabular-nums">{after}</span>;
  const better = good === 'up' ? after > before : after < before;
  return (
    <span className="flex items-center justify-end gap-2 tabular-nums">
      <span className="text-sm text-gray-400 line-through">{before}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${better ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {after} {better ? '▲' : '▼'}
      </span>
    </span>
  );
}

/** A circular gauge: share of frauds caught. */
function Ring({ value, total, label, tone }: { value: number; total: number; label: string; tone: string }) {
  const r = 34;
  const length = 2 * Math.PI * r;
  const share = total === 0 ? 0 : value / total;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-gray-100" />
          <circle
            cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
            className={`${tone} transition-[stroke-dashoffset] duration-1000 ease-out`}
            strokeDasharray={length} strokeDashoffset={length * (1 - share)}
          />
        </svg>
        <p className="absolute inset-0 grid place-items-center text-xl font-semibold tabular-nums">{value}/{total}</p>
      </div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

function ScoreTable({ title, current, proposed }: { title: string; current: Scorecard; proposed: Scorecard }) {
  const rows: [string, number, number, 'up' | 'down'][] = [
    [`Frauds caught (of ${current.fraudTotal})`, current.caught, proposed.caught, 'up'],
    ['Frauds missed', current.missed, proposed.missed, 'down'],
    [`Legit invoices frozen (of ${current.legitTotal})`, current.falseFreezes, proposed.falseFreezes, 'down'],
    ['Legit invoices approved', current.cleanApprovals, proposed.cleanApprovals, 'up'],
  ];
  return (
    <div className="card card-hover p-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="mt-5 flex justify-around">
        <Ring value={current.caught} total={current.fraudTotal} label="Caught · production" tone="stroke-gray-900" />
        <Ring value={proposed.caught} total={proposed.fraudTotal} label="Caught · your rules" tone="stroke-blue-600" />
      </div>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-gray-500">
            <th className="py-2 font-medium">Result</th>
            <th className="py-2 text-right font-medium">Production</th>
            <th className="py-2 text-right font-medium">Your rules</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, good]) => (
            <tr key={label} className="border-t border-gray-100">
              <td className="py-3 text-gray-800">{label}</td>
              <td className="py-3 text-right text-lg font-semibold tabular-nums text-gray-500">{a}</td>
              <td className="py-3 text-right"><Delta before={a} after={b} good={good} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Changed({ cases, current }: { cases: CaseResult[]; current: Scorecard }) {
  if (cases.length === 0) {
    return <p className="card p-5 text-sm text-gray-500">No decision changes under your rules.</p>;
  }
  const before = new Map(current.cases.map((c) => [c.id, c]));
  return (
    <ul className="space-y-2 text-sm">
      {cases.map((c, index) => {
        const wasFrozen = before.get(c.id)?.frozen;
        const bad = (c.label === 'fraud' && !c.frozen) || (c.label === 'legit' && c.frozen);
        return (
          <li
            key={c.id}
            className="card animate-fade-up flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
          >
            <span className="flex items-center gap-3 text-gray-900">
              <span className={c.label === 'fraud' ? 'rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800' : 'rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800'}>
                {c.label}
              </span>
              {c.title}
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">{wasFrozen ? 'Frozen' : 'Approved'}</span>
              <span aria-hidden>→</span>
              <span className={`rounded-full px-2.5 py-1 ${bad ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                {c.frozen ? 'Frozen' : 'Approved'}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Production as a line with a branch forking off; the dashes flow while a replay runs. */
function BranchDiagram({ running, done }: { running: boolean; done: boolean }) {
  return (
    <svg viewBox="0 0 260 90" className="w-full" aria-hidden>
      <line x1="10" y1="60" x2="250" y2="60" strokeWidth="3" strokeLinecap="round" className="stroke-gray-900" />
      <path
        d="M70 60 C 110 60, 110 22, 150 22 L 230 22"
        fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6"
        className={`${running ? 'animate-dash stroke-blue-600' : done ? 'stroke-green-600' : 'stroke-gray-300'} transition-colors`}
      />
      <circle cx="70" cy="60" r="6" className="fill-gray-900" />
      <circle cx="230" cy="22" r="7" className={running ? 'animate-pulse fill-blue-600' : done ? 'fill-green-600' : 'fill-gray-300'} />
      <text x="10" y="84" className="fill-gray-500 text-[10px]">production</text>
      <text x="150" y="12" className="fill-gray-500 text-[10px]">{running ? 'replaying…' : done ? 'replayed, deleted' : 'throwaway branch'}</text>
    </svg>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${checked ? 'bg-black' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  );
}

function Slider({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block rounded-2xl bg-gray-50 p-4">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}{suffix}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-black"
        style={{ background: `linear-gradient(90deg, #000 ${fill}%, #e3e3e3 ${fill}%)` }}
      />
    </label>
  );
}

export default function BacktestPage() {
  const [defaults, setDefaults] = useState<RiskRules | null>(null);
  const [rules, setRules] = useState<RiskRules | null>(null);
  const [neonConfigured, setNeonConfigured] = useState(true);
  const [asOf, setAsOf] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/backtest')
      .then((r) => r.json())
      .then((d: { defaults: RiskRules; neonConfigured: boolean }) => {
        setDefaults(d.defaults);
        setRules(copy(d.defaults));
        setNeonConfigured(d.neonConfigured);
      })
      .catch(() => setError('Could not load the production rules.'));
  }, []);

  function preset(kind: 'production' | 'looser' | 'stricter') {
    if (!defaults) return;
    const r = copy(defaults);
    if (kind === 'looser') {
      r.freezeThreshold = 70;
      r.hardFreeze.BANK_CHANGED = false;
    }
    if (kind === 'stricter') {
      r.freezeThreshold = 30;
      r.points.UNKNOWN_VENDOR = 25;
    }
    setRules(r);
  }

  async function run() {
    if (!rules || !defaults) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asOf: localToIso(asOf), rules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Backtest failed');
      setResult(data as BacktestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setRunning(false);
    }
  }

  const codes = rules ? (Object.keys(rules.points) as RiskCode[]) : [];

  const changedRules = rules && defaults
    ? codes.filter((code) => rules.points[code] !== defaults.points[code] || rules.hardFreeze[code] !== defaults.hardFreeze[code]).length +
      (rules.freezeThreshold !== defaults.freezeThreshold ? 1 : 0) + (rules.amountMultiplier !== defaults.amountMultiplier ? 1 : 0)
    : 0;

  return (
    <main className="mx-auto w-full max-w-[110rem] space-y-8 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
      <AppNav current="backtest" />

      <header className="animate-fade-up pt-4">
        <p className="eyebrow">Rule lab</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Backtest</h1>
        <p className="mt-3 max-w-2xl text-base text-gray-500">
          Change a rule, then replay every decided invoice on a throwaway Neon branch of the database, optionally as it was at
          an earlier moment. See how many frauds it would catch and how many legit invoices it would freeze, before it ships.
        </p>
      </header>

      {!neonConfigured && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Neon API credentials are not set on this deployment, so only the built-in scenarios will run.
        </p>
      )}

      {rules && (
        <div className="animate-fade-up grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]" style={{ animationDelay: '100ms' }}>
          <section className="card space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Tune the rules</h2>
              <div className="inline-flex rounded-full bg-gray-100 p-1">
                {(['production', 'looser', 'stricter'] as const).map((kind) => (
                  <button
                    key={kind} type="button" onClick={() => preset(kind)}
                    className="rounded-full px-4 py-1.5 text-sm font-medium capitalize text-gray-600 transition-all hover:bg-white hover:text-black hover:shadow-sm"
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Slider label="Freeze at score" value={rules.freezeThreshold} min={1} max={100} step={1} suffix=""
                onChange={(value) => setRules({ ...rules, freezeThreshold: value })} />
              <Slider label="Unusual amount above" value={rules.amountMultiplier} min={1} max={5} step={0.1} suffix="×"
                onChange={(value) => setRules({ ...rules, amountMultiplier: value })} />
            </div>

            <div>
              <h3 className="eyebrow">Signals</h3>
              <ul className="mt-2 divide-y divide-gray-100">
                {codes.map((code) => {
                  const changed = defaults && (rules.points[code] !== defaults.points[code] || rules.hardFreeze[code] !== defaults.hardFreeze[code]);
                  return (
                    <li key={code} className={`-mx-3 flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors ${changed ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                      <span className="flex-1 text-sm text-gray-800">
                        {RULE_LABEL[code] ?? code}
                        {changed && <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">edited</span>}
                      </span>
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        pts
                        <input type="number" min={0} max={100} value={rules.points[code]} aria-label={`${RULE_LABEL[code]} points`}
                          onChange={(e) => setRules({ ...rules, points: { ...rules.points, [code]: Number(e.target.value) } })}
                          className="field w-20 !py-1.5 text-right tabular-nums" />
                      </label>
                      <span className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="hidden sm:inline">freezes alone</span>
                        <Switch checked={rules.hardFreeze[code]} label={`${RULE_LABEL[code]} freezes on its own`}
                          onChange={(value) => setRules({ ...rules, hardFreeze: { ...rules.hardFreeze, [code]: value } })} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="relative overflow-hidden rounded-[1.25rem] bg-black p-6 text-white shadow-xl shadow-black/20">
              <div className="animate-drift pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-600/30 blur-3xl" />
              <div className="relative space-y-5">
                <div>
                  <p className="eyebrow !text-gray-400">Replay</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {changedRules === 0 ? 'Production rules' : `${changedRules} change${changedRules === 1 ? '' : 's'} to test`}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <BranchDiagram running={running} done={Boolean(result?.branch?.deleted)} />
                </div>
                <label className="block text-sm text-gray-300">
                  Replay the database as of <span className="text-gray-500">(optional)</span>
                  <input type="datetime-local" value={asOf} onChange={(e) => setAsOf(e.target.value)}
                    className="field mt-1.5 block w-full" />
                </label>
                <button type="button" onClick={run} disabled={running}
                  className="btn w-full !bg-white !py-3.5 !text-base !text-black hover:!bg-gray-100">
                  {running && <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-black" />}
                  {running ? 'Forking a branch and replaying…' : 'Run backtest'}
                </button>
              </div>
            </section>
          </aside>
        </div>
      )}

      {error && <p className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</p>}

      {result && (
        <section className="animate-fade-up space-y-6">
          {result.branch ? (
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-black px-3 py-1.5 text-white">
                Branch <code className="font-mono">{result.branch.name}</code>
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-gray-700 ring-1 ring-gray-200">
                {result.branch.asOf ? `as of ${time(result.branch.asOf)}` : 'as of now'}
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-gray-700 ring-1 ring-gray-200">
                forked in {(result.branch.createMs / 1000).toFixed(1)} s
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-gray-700 ring-1 ring-gray-200">
                {result.history?.current.cases.length ?? 0} invoices replayed
              </span>
              <span className={`rounded-full px-3 py-1.5 ${result.branch.deleted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {result.branch.deleted ? 'branch deleted' : 'branch NOT deleted, remove it in the Neon console'}
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-gray-700 ring-1 ring-gray-200">
                {(result.totalMs / 1000).toFixed(1)} s total
              </span>
            </div>
          ) : (
            result.historyError && (
              <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                History replay skipped: {result.historyError}
              </p>
            )
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {result.history && <ScoreTable title="Real decided invoices (replayed on the branch)" current={result.history.current} proposed={result.history.proposed} />}
            <ScoreTable title="Built-in attack scenarios" current={result.scenarios.current} proposed={result.scenarios.proposed} />
          </div>

          {result.history && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Real invoices whose decision would change</h2>
              <Changed cases={result.history.changed} current={result.history.current} />
            </div>
          )}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Scenarios whose decision would change</h2>
            <Changed cases={result.scenarios.changed} current={result.scenarios.current} />
          </div>
        </section>
      )}
    </main>
  );
}

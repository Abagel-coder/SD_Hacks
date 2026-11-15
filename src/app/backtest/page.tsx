'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/AppNav';
import type { BacktestResult } from '@/lib/backtest/run';
import type { CaseResult, Scorecard } from '@/lib/backtest/replay';
import type { RiskRules } from '@/lib/risk/engine';
import type { RiskCode } from '@/lib/types';

const RULE_LABEL: Record<RiskCode, string> = {
  BLOCKLIST_HIT: 'On the scam blocklist',
  BANK_CHANGED: 'Bank details changed',
  LOOKALIKE_DOMAIN: 'Lookalike sender domain',
  DOMAIN_MISMATCH: 'Sender domain mismatch',
  NEW_DOMAIN: 'Newly registered domain',
  AMOUNT_ANOMALY: 'Unusual amount',
  URGENCY_OR_SECRECY: 'Pressure or secrecy language',
  UNKNOWN_VENDOR: 'Unknown vendor',
  AI_FLAGGED: 'Gemini flagged a warning sign',
  NO_WEB_PRESENCE: 'Sender domain has no web presence',
};

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
  if (before === after) return <span className="tabular-nums">{after}</span>;
  const better = good === 'up' ? after > before : after < before;
  return (
    <span className="tabular-nums">
      <span className="text-gray-500 line-through">{before}</span>{' '}
      <span className={better ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>{after}</span>
    </span>
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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
            <th className="py-1 font-medium">Result</th>
            <th className="py-1 text-right font-medium">Production rules</th>
            <th className="py-1 text-right font-medium">Your rules</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, good]) => (
            <tr key={label} className="border-t border-gray-100">
              <td className="py-2 text-gray-800">{label}</td>
              <td className="py-2 text-right tabular-nums text-gray-800">{a}</td>
              <td className="py-2 text-right"><Delta before={a} after={b} good={good} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Changed({ cases, current }: { cases: CaseResult[]; current: Scorecard }) {
  if (cases.length === 0) return <p className="text-sm text-gray-600">No decision changes under your rules.</p>;
  const before = new Map(current.cases.map((c) => [c.id, c]));
  return (
    <ul className="space-y-2 text-sm">
      {cases.map((c) => {
        const wasFrozen = before.get(c.id)?.frozen;
        const bad = (c.label === 'fraud' && !c.frozen) || (c.label === 'legit' && c.frozen);
        return (
          <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2">
            <span className="text-gray-900">
              <span className={c.label === 'fraud' ? 'mr-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800' : 'mr-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800'}>
                {c.label}
              </span>
              {c.title}
            </span>
            <span className={bad ? 'font-semibold text-red-700' : 'font-semibold text-green-700'}>
              {wasFrozen ? 'Frozen' : 'Approved'} → {c.frozen ? 'Frozen' : 'Approved'}
            </span>
          </li>
        );
      })}
    </ul>
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

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-gray-900">
      <AppNav current="backtest" />

      <header>
        <h1 className="text-2xl font-bold">Rule backtest</h1>
        <p className="mt-1 text-sm text-gray-700">
          Change a rule, then replay every decided invoice on a throwaway Neon branch of the database, optionally as it was at
          an earlier moment. You see how many frauds the rule would catch and how many legit invoices it would freeze, before it ships.
        </p>
      </header>

      {!neonConfigured && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Neon API credentials are not set on this deployment, so only the built-in scenarios will run.
        </p>
      )}

      {rules && (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-800">Presets:</span>
            <button type="button" onClick={() => preset('production')} className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">Production</button>
            <button type="button" onClick={() => preset('looser')} className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">Looser</button>
            <button type="button" onClick={() => preset('stricter')} className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">Stricter</button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-gray-800">
              Freeze at score
              <input type="number" min={1} max={100} value={rules.freezeThreshold}
                onChange={(e) => setRules({ ...rules, freezeThreshold: Number(e.target.value) })}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-gray-900" />
            </label>
            <label className="text-sm text-gray-800">
              Unusual amount above (× normal max)
              <input type="number" min={1} max={5} step={0.1} value={rules.amountMultiplier}
                onChange={(e) => setRules({ ...rules, amountMultiplier: Number(e.target.value) })}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-gray-900" />
            </label>
            <label className="text-sm text-gray-800">
              Replay the database as of (optional)
              <input type="datetime-local" value={asOf} onChange={(e) => setAsOf(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-gray-900" />
            </label>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="py-1 font-medium">Rule</th>
                <th className="py-1 font-medium">Points (0 = off)</th>
                <th className="py-1 font-medium">Freezes on its own</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const changed = defaults && (rules.points[code] !== defaults.points[code] || rules.hardFreeze[code] !== defaults.hardFreeze[code]);
                return (
                  <tr key={code} className={changed ? 'border-t border-gray-100 bg-amber-50' : 'border-t border-gray-100'}>
                    <td className="py-1.5 text-gray-800">{RULE_LABEL[code] ?? code}</td>
                    <td className="py-1.5">
                      <input type="number" min={0} max={100} value={rules.points[code]} aria-label={`${RULE_LABEL[code]} points`}
                        onChange={(e) => setRules({ ...rules, points: { ...rules.points, [code]: Number(e.target.value) } })}
                        className="w-20 rounded border border-gray-300 px-2 py-0.5 text-gray-900" />
                    </td>
                    <td className="py-1.5">
                      <input type="checkbox" checked={rules.hardFreeze[code]} aria-label={`${RULE_LABEL[code]} freezes on its own`}
                        onChange={(e) => setRules({ ...rules, hardFreeze: { ...rules.hardFreeze, [code]: e.target.checked } })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button type="button" onClick={run} disabled={running}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
            {running ? 'Forking a Neon branch and replaying…' : 'Run backtest'}
          </button>
        </section>
      )}

      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      {result && (
        <section className="space-y-4">
          {result.branch ? (
            <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              Neon branch <code className="font-mono">{result.branch.name}</code> forked from production
              {result.branch.asOf ? ` as it was at ${time(result.branch.asOf)}` : ' as it is now'} in{' '}
              {(result.branch.createMs / 1000).toFixed(1)} s · replayed {result.history?.current.cases.length ?? 0} decided invoices ·{' '}
              {result.branch.deleted ? 'branch deleted' : 'branch NOT deleted, remove it in the Neon console'} · {(result.totalMs / 1000).toFixed(1)} s total
            </p>
          ) : (
            result.historyError && (
              <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                History replay skipped: {result.historyError}
              </p>
            )
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {result.history && <ScoreTable title="Real decided invoices (replayed on the branch)" current={result.history.current} proposed={result.history.proposed} />}
            <ScoreTable title="Built-in attack scenarios" current={result.scenarios.current} proposed={result.scenarios.proposed} />
          </div>

          {result.history && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">Real invoices whose decision would change</h2>
              <Changed cases={result.history.changed} current={result.history.current} />
            </div>
          )}
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Scenarios whose decision would change</h2>
            <Changed cases={result.scenarios.changed} current={result.scenarios.current} />
          </div>
        </section>
      )}
    </main>
  );
}

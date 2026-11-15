import { neon } from '@neondatabase/serverless';
import { DEFAULT_RULES, withRules, type RiskRules } from '../risk/engine';
import type { InvoiceRow, RiskCode, VendorRow } from '../types';
import { withReplayBranch, type BranchInfo } from './neon-branch';
import { compareRules, toReplayCase, type BlocklistEntry, type ReplayCase } from './replay';
import { SCENARIOS } from './scenarios';

export interface RulesOverride {
  points: Partial<Record<RiskCode, number>>;
  hardFreeze: Partial<Record<RiskCode, boolean>>;
  freezeThreshold?: number;
  amountMultiplier?: number;
  newDomainDays?: number;
}

const CODES = Object.keys(DEFAULT_RULES.points) as RiskCode[];
const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const clamp = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;

/** Validate a rule change from the browser: known rule codes only, numbers clamped to sane ranges. */
export function parseRulesOverride(body: unknown): RulesOverride {
  const b = asObject(body);
  const pointsIn = asObject(b.points);
  const hardIn = asObject(b.hardFreeze);
  const out: RulesOverride = { points: {}, hardFreeze: {} };
  for (const code of CODES) {
    const p = clamp(pointsIn[code], 0, 100);
    if (p !== undefined) out.points[code] = Math.round(p);
    if (typeof hardIn[code] === 'boolean') out.hardFreeze[code] = hardIn[code] as boolean;
  }
  const threshold = clamp(b.freezeThreshold, 1, 100);
  if (threshold !== undefined) out.freezeThreshold = Math.round(threshold);
  const multiplier = clamp(b.amountMultiplier, 1, 5);
  if (multiplier !== undefined) out.amountMultiplier = multiplier;
  const days = clamp(b.newDomainDays, 0, 3650);
  if (days !== undefined) out.newDomainDays = Math.round(days);
  return out;
}

type Query = (text: string) => Promise<Record<string, unknown>[]>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/** Read every decided invoice, the vendors and the blocklist as they exist on the branch. */
export async function loadHistoryCases(query: Query, opts: { attempts?: number; retryDelayMs?: number } = {}): Promise<ReplayCase[]> {
  const attempts = opts.attempts ?? 6;
  const delay = opts.retryDelayMs ?? 1500;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      // A fresh branch's compute can take a few seconds to accept connections.
      const [invoices, vendors, blocklist] = await Promise.all([
        query("select * from invoices where status in ('approved', 'blocked') order by created_at"),
        query('select * from vendors'),
        query('select kind, value, reason, source_invoice_id, created_at from blocklist'),
      ]);
      const byId = new Map(vendors.map((v) => [String(v.id), { ...v, created_at: iso(v.created_at) } as unknown as VendorRow]));
      const entries = blocklist.map((e) => ({ ...e, created_at: iso(e.created_at) }) as unknown as BlocklistEntry);
      return invoices
        .map((r) => ({ ...r, created_at: iso(r.created_at), updated_at: iso(r.updated_at) }) as unknown as InvoiceRow)
        .map((row) => toReplayCase(row, row.vendor_id ? byId.get(row.vendor_id) ?? null : null, entries))
        .filter((c): c is ReplayCase => c !== null);
    } catch (err) {
      last = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}

export interface BacktestResult {
  rules: { current: RiskRules; proposed: RiskRules };
  scenarios: ReturnType<typeof compareRules>;
  history: ReturnType<typeof compareRules> | null;
  historyError: string | null;
  branch: BranchInfo | null;
  totalMs: number;
}

/**
 * Score the labelled scenarios, then fork a Neon branch (optionally at `asOf`) and replay every decided
 * invoice on it, under the production rules and the proposed ones. The branch is always deleted.
 */
export async function runBacktest(input: { asOf?: string; rules: RulesOverride }): Promise<BacktestResult> {
  const started = Date.now();
  const proposed = withRules(input.rules);
  const scenarios = compareRules(SCENARIOS, DEFAULT_RULES, proposed);

  let history: BacktestResult['history'] = null;
  let historyError: string | null = null;
  let branch: BranchInfo | null = null;
  try {
    const out = await withReplayBranch({ asOf: input.asOf }, async (uri) => {
      const sql = neon(uri);
      const cases = await loadHistoryCases((text) => sql.query(text) as Promise<Record<string, unknown>[]>);
      return compareRules(cases, DEFAULT_RULES, proposed);
    });
    history = out.result;
    branch = out.branch;
  } catch (err) {
    historyError = err instanceof Error ? err.message : String(err);
  }
  return { rules: { current: DEFAULT_RULES, proposed }, scenarios, history, historyError, branch, totalMs: Date.now() - started };
}

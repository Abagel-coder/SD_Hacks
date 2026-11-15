import { parseRulesOverride, runBacktest } from '@/lib/backtest/run';
import { DEFAULT_RULES } from '@/lib/risk/engine';

export const maxDuration = 60;

/** Production rules, for the page's form. */
export async function GET() {
  return Response.json({
    defaults: DEFAULT_RULES,
    neonConfigured: Boolean(process.env.NEON_API_KEY && process.env.NEON_PROJECT_ID),
  });
}

/** Body: { asOf?: ISO string, rules?: RulesOverride }. Forks a Neon branch, replays, deletes it. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { asOf?: unknown; rules?: unknown };
  const asOf = typeof body.asOf === 'string' && body.asOf.trim() ? body.asOf.trim() : undefined;
  if (asOf && Number.isNaN(new Date(asOf).getTime())) {
    return Response.json({ error: 'asOf must be a date and time' }, { status: 400 });
  }
  const result = await runBacktest({ asOf, rules: parseRulesOverride(body.rules) });
  return Response.json(result);
}

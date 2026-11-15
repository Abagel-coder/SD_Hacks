import { getBlocklistSummary } from '@/lib/repo';

/** GET /api/blocklist: blocked-invoice counters and every blocklist entry, newest first. */
export async function GET() {
  return Response.json(await getBlocklistSummary());
}

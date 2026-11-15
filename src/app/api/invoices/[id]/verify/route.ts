import { rateLimited } from '@/lib/rate-limit';
import { getActiveCallForInvoice } from '@/lib/repo';
import { CallStartError, startVerificationCall } from '@/lib/voice/start-call';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(req, 'verify');
  if (limited) return limited;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { channel?: unknown };
  const channel = body.channel === 'phone' || body.channel === 'browser' ? body.channel : undefined;

  // A second click or a second tab joins the call that is already running instead of failing.
  const existing = await getActiveCallForInvoice(id);
  if (existing) return Response.json({ callId: existing.id, channel: existing.channel, existing: true });

  try {
    return Response.json(await startVerificationCall(id, channel));
  } catch (err) {
    if (err instanceof CallStartError) {
      const raced = await getActiveCallForInvoice(id);
      if (raced) return Response.json({ callId: raced.id, channel: raced.channel, existing: true });
    }
    console.error('startVerificationCall failed', err);
    const message = err instanceof Error ? err.message : 'Could not start the call.';
    return Response.json({ error: message }, { status: err instanceof CallStartError ? 409 : 502 });
  }
}

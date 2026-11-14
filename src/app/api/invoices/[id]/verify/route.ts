import { CallStartError, startVerificationCall } from '@/lib/voice/start-call';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { channel?: unknown };
  const channel = body.channel === 'phone' || body.channel === 'browser' ? body.channel : undefined;

  try {
    return Response.json(await startVerificationCall(id, channel));
  } catch (err) {
    console.error('startVerificationCall failed', err);
    const message = err instanceof Error ? err.message : 'Could not start the call.';
    return Response.json({ error: message }, { status: err instanceof CallStartError ? 409 : 502 });
  }
}

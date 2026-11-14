import { getCall, getInvoice } from '@/lib/repo';
import { dynamicVariablesFor } from '@/lib/voice/start-call';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await getCall(id);
  const invoice = call ? await getInvoice(call.invoice_id) : null;
  if (!call || !invoice) return Response.json({ error: 'Call not found' }, { status: 404 });
  if (!process.env.ELEVENLABS_AGENT_ID) {
    return Response.json({ error: 'ELEVENLABS_AGENT_ID is not set' }, { status: 500 });
  }
  return Response.json({
    agentId: process.env.ELEVENLABS_AGENT_ID,
    dynamicVariables: dynamicVariablesFor(invoice, call),
  });
}

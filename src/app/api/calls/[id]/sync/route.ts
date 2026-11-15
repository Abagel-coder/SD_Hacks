import { getCall, updateCall } from '@/lib/repo';
import { isMock } from '@/lib/util';
import { getConversation, MOCK_CONVERSATION } from '@/lib/voice/elevenlabs';
import { failCall, finalizeCall } from '@/lib/voice/finalize';

/** Longer than the agent's 180 s call limit, so only a call that never connected is given up on. */
const NEVER_CONNECTED_MS = 3 * 60_000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await getCall(id);
  if (!call) return Response.json({ error: 'Call not found' }, { status: 404 });

  const done = async () => {
    const latest = await getCall(id);
    return Response.json({ status: latest?.status ?? call.status, outcome: latest?.outcome ?? null });
  };
  if (call.status === 'completed' || call.status === 'failed') return done();

  if (isMock('CALL')) {
    const elapsed = Date.now() - new Date(call.started_at).getTime();
    if (elapsed > 3_000) await updateCall(call.id, { status: 'in_progress' });
    if (elapsed > 6_000) await finalizeCall(call, MOCK_CONVERSATION);
    return done();
  }

  const body = (await req.json().catch(() => ({}))) as { conversationId?: unknown };
  const conversationId = call.conversation_id
    ?? (typeof body.conversationId === 'string' && body.conversationId ? body.conversationId : null);
  if (!conversationId) {
    // Without this, a browser call that never started would leave the invoice in verifying for good.
    if (Date.now() - new Date(call.started_at).getTime() > NEVER_CONNECTED_MS) {
      await failCall(call, 'the call never connected');
    }
    return done();
  }
  if (!call.conversation_id) await updateCall(call.id, { conversationId });

  try {
    const conversation = await getConversation(conversationId);
    if (conversation.status === 'done') await finalizeCall(call, conversation);
    else if (conversation.status === 'failed') await failCall(call, 'the call failed');
    else if (conversation.status === 'in-progress' || conversation.status === 'processing') {
      await updateCall(call.id, { status: 'in_progress' });
    }
  } catch (err) {
    console.error('Conversation sync failed', err);
  }
  return done();
}

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { getCall, getCallByConversationId, isUuid } from '@/lib/repo';
import type { ConversationData } from '@/lib/voice/elevenlabs';
import { failCall, finalizeCall } from '@/lib/voice/finalize';

export const maxDuration = 60;

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('elevenlabs-signature') ?? '';

  // The SDK client throws without an API key. Report that as a config error, not a bad signature.
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!process.env.ELEVENLABS_API_KEY || !secret) {
    console.error('ElevenLabs webhook: ELEVENLABS_API_KEY or ELEVENLABS_WEBHOOK_SECRET is not set');
    return Response.json({ error: 'Webhook is not configured' }, { status: 500 });
  }

  let event: { type?: string; data?: ConversationData & { failure_reason?: string } };
  try {
    const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
    event = (await client.webhooks.constructEvent(rawBody, signature, secret)) as typeof event;
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const data = event.data ?? {};
  // Our call id travels with the call as a dynamic variable; fall back to the conversation id.
  const callId = data.conversation_initiation_client_data?.dynamic_variables?.call_id;
  const call = (isUuid(callId) ? await getCall(callId) : null)
    ?? (data.conversation_id ? await getCallByConversationId(data.conversation_id) : null);
  if (!call) return Response.json({ received: true, ignored: 'no matching call' });

  if (event.type === 'call_initiation_failure') {
    await failCall(call, data.failure_reason ?? 'no answer');
  } else if (event.type === 'post_call_transcription') {
    await finalizeCall(call, data);
  }
  return Response.json({ received: true });
}

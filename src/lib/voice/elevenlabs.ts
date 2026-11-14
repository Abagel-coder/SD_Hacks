const BASE = 'https://api.elevenlabs.io/v1/convai';

export interface ConversationData {
  conversation_id?: string;
  status?: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
  transcript?: { role: 'user' | 'agent'; message?: string | null }[];
  analysis?: unknown;
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } | null;
}

function headers(): Record<string, string> {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is not set');
  return { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' };
}

export async function placeOutboundCall(
  toNumber: string, dynamicVariables: Record<string, string>,
): Promise<{ conversationId: string | null }> {
  const res = await fetch(`${BASE}/twilio/outbound-call`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      agent_id: process.env.ELEVENLABS_AGENT_ID,
      agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
      to_number: toNumber,
      conversation_initiation_client_data: { dynamic_variables: dynamicVariables },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean; message?: string; conversation_id?: string | null;
  };
  if (!res.ok || json.success === false) {
    throw new Error(`ElevenLabs could not place the call (${res.status}): ${json.message ?? 'no message'}`);
  }
  return { conversationId: json.conversation_id ?? null };
}

export async function getConversation(conversationId: string): Promise<ConversationData> {
  const res = await fetch(`${BASE}/conversations/${encodeURIComponent(conversationId)}`, {
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs conversation lookup failed (${res.status})`);
  return (await res.json()) as ConversationData;
}

export const MOCK_CONVERSATION: ConversationData = {
  conversation_id: 'mock-conversation',
  status: 'done',
  transcript: [
    { role: 'agent', message: 'Hi, this is an automated verification call on behalf of Harbor Coffee Roasters. Am I speaking with someone at Uline who can help with a quick billing question?' },
    { role: 'user', message: 'Yes, this is accounts receivable.' },
    { role: 'agent', message: 'Did Uline recently change its bank account for payments to one ending in 6 7 8 9?' },
    { role: 'user', message: 'No. We never changed banks.' },
    { role: 'agent', message: 'Thank you. The payment will be held and Harbor Coffee Roasters will follow up. Goodbye.' },
  ],
  analysis: {
    data_collection_results: {
      bank_change_confirmed: { value: 'no' },
      stated_amount: { value: 0 },
    },
  },
};

'use client';

import { ConversationProvider, useConversationControls, useConversationStatus } from '@elevenlabs/react';
import { useEffect, useRef, useState } from 'react';

/** Tells the server which ElevenLabs conversation belongs to this call, so it can follow it. */
function sync(callId: string, conversationId: string | null) {
  return fetch(`/api/calls/${callId}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  });
}

function CallControls({ callId }: { callId: string }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const [error, setError] = useState<string | null>(null);
  const wasConnected = useRef(false);
  const conversationId = useRef<string | null>(null);

  async function start() {
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch(`/api/calls/${callId}/browser-session`);
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(`Could not load the call details: ${json.error ?? `error ${res.status}`}`);
      }
      const session = (await res.json()) as { agentId: string; dynamicVariables: Record<string, string> };
      // startSession returns nothing; the conversation id and connection errors arrive by callback.
      startSession({
        agentId: session.agentId,
        dynamicVariables: session.dynamicVariables,
        onConnect: ({ conversationId: id }) => {
          conversationId.current = id;
          void sync(callId, id);
        },
        onError: (message) => setError(message),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the browser call.');
    }
  }

  useEffect(() => {
    if (status === 'connected') wasConnected.current = true;
    if (status === 'disconnected' && wasConnected.current) {
      wasConnected.current = false;
      void sync(callId, conversationId.current);
    }
  }, [status, callId]);

  return (
    <div className="space-y-2">
      {status === 'connected' ? (
        <button onClick={() => endSession()}
          className="rounded-lg bg-red-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-red-700">
          End call
        </button>
      ) : (
        <button onClick={start} disabled={status === 'connecting'}
          className="btn-primary px-5 py-3 text-base">
          {status === 'connecting' ? 'Connecting…' : 'Start browser call'}
        </button>
      )}
      <p className="text-sm text-gray-600">
        {status === 'connected' ? 'The agent is speaking. Answer as the vendor.' : 'Uses your microphone. The agent speaks first.'}
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function BrowserCall({ callId }: { callId: string }) {
  return (
    <ConversationProvider>
      <CallControls callId={callId} />
    </ConversationProvider>
  );
}

'use client';

import {
  ConversationProvider,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from '@elevenlabs/react';
import { useEffect, useRef, useState } from 'react';

/** Tells the server which ElevenLabs conversation belongs to this call, so it can follow it. */
function sync(callId: string, conversationId: string | null) {
  return fetch(`/api/calls/${callId}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  });
}

function PhoneGlyph({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </svg>
  );
}

/** mm:ss since the call connected. */
function useCallTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [running]);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function CallControls({ callId, vendorName }: { callId: string; vendorName: string }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const [error, setError] = useState<string | null>(null);
  const wasConnected = useRef(false);
  const conversationId = useRef<string | null>(null);
  const connected = status === 'connected';
  const elapsed = useCallTimer(connected);

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

  const statusLine = connected
    ? isSpeaking
      ? 'The agent is speaking…'
      : `Your turn: answer as ${vendorName}`
    : status === 'connecting'
      ? 'Connecting…'
      : 'Ringing…';

  return (
    <div className="flex flex-col items-center gap-6">
      {/* What the call is doing right now, with a live sound wave. */}
      <div className="flex h-16 flex-col items-center justify-center gap-2">
        <span className="flex h-8 items-center gap-1" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
            <span
              key={bar}
              className={`w-1 rounded-full transition-colors ${connected ? 'animate-wave h-full' : 'h-1.5'} ${
                connected && isSpeaking ? 'bg-white' : connected ? 'bg-green-400' : 'bg-white/30'
              }`}
              style={{ animationDelay: `${bar * 0.1}s`, animationDuration: isSpeaking ? '0.7s' : '1.4s' }}
            />
          ))}
        </span>
        <p className={`text-base font-medium ${connected && !isSpeaking ? 'text-green-300' : 'text-gray-200'}`}>
          {statusLine}
          {connected && <span className="ml-2 tabular-nums text-gray-400">{elapsed}</span>}
        </p>
      </div>

      {connected ? (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => endSession()}
            aria-label="Hang up"
            className="grid h-20 w-20 place-items-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/40 transition-transform hover:scale-105 active:scale-95"
          >
            <PhoneGlyph className="h-8 w-8 rotate-[135deg]" />
          </button>
          <span className="text-sm text-gray-400">Hang up</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={start}
            disabled={status === 'connecting'}
            aria-label="Answer the call"
            className="relative grid h-20 w-20 place-items-center rounded-full bg-green-500 text-white shadow-xl shadow-green-500/40 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            {status !== 'connecting' && <span className="animate-ripple absolute inset-0 rounded-full bg-green-500/50" />}
            <PhoneGlyph className="relative h-8 w-8" />
          </button>
          <span className="text-sm text-gray-400">{status === 'connecting' ? 'Connecting…' : 'Answer (uses your microphone)'}</span>
        </div>
      )}
      {error && <p className="max-w-sm rounded-xl bg-red-500/15 p-3 text-center text-sm text-red-200">{error}</p>}
    </div>
  );
}

export function BrowserCall({ callId, vendorName }: { callId: string; vendorName: string }) {
  return (
    <ConversationProvider>
      <CallControls callId={callId} vendorName={vendorName} />
    </ConversationProvider>
  );
}

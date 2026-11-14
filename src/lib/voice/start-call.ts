import type { CallChannel } from '../types';

export async function startVerificationCall(
  invoiceId: string,
  channel?: CallChannel,
): Promise<{ callId: string; channel: CallChannel }> {
  void invoiceId;
  void channel;
  throw new Error('startVerificationCall is not implemented yet'); // Lane 3 replaces this in Task 3.4
}

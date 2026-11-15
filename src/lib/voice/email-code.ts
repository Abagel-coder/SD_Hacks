import { randomInt } from 'node:crypto';
import type { CallOutcome } from '../types';

/**
 * Two-channel proof of control. A scammer can fake a domain or answer a phone, but controlling the
 * vendor's real phone line AND the inbox Bright Data found on the vendor's own website is much harder.
 * At call start we email a one-time code to that public address (never the invoice's), and the agent
 * asks the person who said "yes" to read it back. A wrong or missing code escalates to the owner:
 * the invoice stays frozen with an alert, nothing is blocklisted (the inbox may simply be someone else's).
 */

export type CodeCheck = 'passed' | 'failed' | 'not_sent';

type Env = Record<string, string | undefined>;

/** Off unless EMAIL_CODE_CHECK=1, so every call behaves exactly as before until the team switches it on. */
export function emailCodeEnabled(env: Env = process.env): boolean {
  return env.EMAIL_CODE_CHECK === '1';
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** What the agent says aloud: 'customer.service@uline.com' -> 'c***@uline.com'. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return "the vendor's public email address";
  return `${local[0]}***@${domain}`;
}

/** The only place that decides who gets the code. Mirrors dial-guard: allow-list first, demo redirect. */
export function resolveEmailRecipient(found: string | null, env: Env): { sendTo: string } | { error: string } {
  const allowed = (env.ALLOWED_EMAIL_RECIPIENTS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!found) return { error: 'No public email address is known for this vendor.' };
  const target = (env.DEMO_EMAIL_TO?.trim() || found).toLowerCase();
  if (!allowed.includes(target)) return { error: `Refusing to email ${target}: it is not in ALLOWED_EMAIL_RECIPIENTS.` };
  return { sendTo: target };
}

const WORDS: Record<string, string> = {
  zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9',
};

/** 'four two nine, one 1 seven' -> '429117'. */
export function digitsFromSpeech(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => (/^\d+$/.test(token) ? token : WORDS[token] ?? ''))
    .join('');
}

export function codeMatches(expected: string, spoken: string | null | undefined): boolean {
  const digits = digitsFromSpeech(spoken);
  return digits.length > 0 && digits === expected;
}

/**
 * Combine the call outcome with the code check. Only a "confirmed" call depends on the code: a match
 * keeps it confirmed, a wrong or missing code becomes 'escalate'. Without a code, nothing changes.
 */
export function decideWithCode(
  outcome: CallOutcome, emailCode: string | null, codeReadBack: string | null,
): { decision: CallOutcome | 'escalate'; codeCheck: CodeCheck | null } {
  if (!emailCode || outcome !== 'confirmed') return { decision: outcome, codeCheck: null };
  return codeMatches(emailCode, codeReadBack)
    ? { decision: 'confirmed', codeCheck: 'passed' }
    : { decision: 'escalate', codeCheck: 'failed' };
}

export async function sendCodeEmail(
  to: string, code: string, ctx: { businessName: string; vendorName: string },
): Promise<{ mocked: boolean }> {
  if (process.env.MOCK_EMAIL === '1') {
    console.log(`[MOCK_EMAIL] would email verification code to ${to}`);
    return { mocked: true };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Invoice Guard <onboarding@resend.dev>',
      to: [to],
      subject: `${ctx.vendorName}: payment verification code from ${ctx.businessName}`,
      text:
        `${ctx.businessName} is on the phone with ${ctx.vendorName} to verify a bank account change.\n\n` +
        `Your one-time verification code is: ${code}\n\n` +
        'Read it to the caller only if you are on that call. If you did not request a bank change, ignore this email.',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { mocked: false };
}

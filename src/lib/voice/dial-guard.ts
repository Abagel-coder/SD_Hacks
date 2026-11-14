/**
 * The only place that decides which number gets dialled.
 * A number that is not on the allow-list is never dialled.
 */
export function resolveDialNumber(
  found: string | null,
  env: { ALLOWED_CALL_NUMBERS?: string; DEMO_CALL_NUMBER?: string },
): { dialed: string } | { error: string } {
  const allowed = (env.ALLOWED_CALL_NUMBERS ?? '').split(',').map((n) => n.trim()).filter(Boolean);
  const target = env.DEMO_CALL_NUMBER?.trim() || found;
  if (!target) return { error: 'No verified phone number is known for this vendor.' };
  if (!allowed.includes(target)) {
    return { error: `Refusing to dial ${target}: it is not in ALLOWED_CALL_NUMBERS.` };
  }
  return { dialed: target };
}

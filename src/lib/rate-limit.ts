/**
 * Basic fixed-window rate limit, per key, in memory. On Vercel each warm instance keeps its own
 * counts, so this is a speed bump against loops and abuse, not a hard quota.
 */
export const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number } = RATE_LIMIT,
  nowMs = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  if (windows.size > 5000) {
    for (const [k, w] of windows) if (w.resetAt <= nowMs) windows.delete(k);
  }
  const w = windows.get(key);
  if (!w || w.resetAt <= nowMs) {
    windows.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { ok: true };
  }
  if (w.count >= limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - nowMs) / 1000)) };
  w.count += 1;
  return { ok: true };
}

export function resetRateLimits() {
  windows.clear();
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** A 429 response when this IP is over the limit for this bucket, else null. */
export function rateLimited(req: Request, bucket: string): Response | null {
  const result = checkRateLimit(`${bucket}:${clientIp(req)}`);
  if (result.ok) return null;
  return Response.json(
    { error: `Too many requests. Try again in ${result.retryAfterSeconds} seconds.` },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}

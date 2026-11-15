export function money(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}

/** '2026-11-14T18:03:09Z' -> '10:03:09 AM' in the viewer's timezone. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US');
}

/**
 * US numbers in one format: '+18002955510' and '800.295.5510' -> '(800) 295-5510'.
 * Non-US (+44 …) or unparseable values come back unchanged.
 */
export function formatPhone(value: string): string {
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return value;
  const digits = trimmed.replace(/\D/g, '');
  let national: string | null = null;
  if (digits.length === 11 && digits.startsWith('1')) national = digits.slice(1);
  else if (digits.length === 10 && !trimmed.startsWith('+')) national = digits;
  if (!national) return value;
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

/** Masks any run of 8+ digits (a full account number) as '•••• ' plus its last 4 digits. */
export function maskLongNumbers(text: string): string {
  return text.replace(/\d{8,}/g, (run) => `•••• ${run.slice(-4)}`);
}

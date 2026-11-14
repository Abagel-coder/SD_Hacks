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

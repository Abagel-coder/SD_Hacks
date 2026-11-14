const SUFFIXES = /\b(inc|llc|ltd|co|corp|corporation|company|incorporated)\b/g;

export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

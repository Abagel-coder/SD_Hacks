export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.trim().toLowerCase();
  if (d.includes('@')) d = d.split('@').pop() ?? '';
  d = d.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/^www\./, '');
  const labels = d.split('.').filter(Boolean);
  if (labels.length < 2) return null;
  return labels.slice(-2).join('.');
}

export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return prev[b.length];
}

/** Both arguments must already be normalized with normalizeDomain. */
export function isLookalike(sender: string, real: string): boolean {
  if (sender === real) return false;
  if (editDistance(sender, real) <= 2) return true;
  const senderLabel = sender.split('.')[0];
  const realLabel = real.split('.')[0];
  return realLabel.length >= 4 && senderLabel.includes(realLabel);
}

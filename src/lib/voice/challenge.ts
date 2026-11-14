const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function buildChallenge(
  history: { amount: number; invoice_date: string | null }[],
  businessName: string,
): { question: string; expectedAmount: number } | null {
  const dated = history
    .filter((h): h is { amount: number; invoice_date: string } => typeof h.invoice_date === 'string')
    .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
  const pick = dated[1] ?? dated[0];
  if (!pick) return null;
  const month = MONTHS[Number(pick.invoice_date.slice(5, 7)) - 1];
  if (!month) return null;
  return {
    question: `What was the total amount on your ${month} invoice to ${businessName}?`,
    expectedAmount: pick.amount,
  };
}

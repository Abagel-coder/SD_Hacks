const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * `invoiceDate` is the date of the invoice being verified. Invoices from that month are skipped:
 * one approved minutes ago (such as the demo's legit upload) is not a fair question.
 */
export function buildChallenge(
  history: { amount: number; invoice_date: string | null }[],
  businessName: string,
  invoiceDate?: string | null,
): { question: string; expectedAmount: number } | null {
  const monthStart = invoiceDate?.slice(0, 7); // 'YYYY-MM'; any 'YYYY-MM-DD' in that month sorts after it
  const dated = history
    .filter((h): h is { amount: number; invoice_date: string } => typeof h.invoice_date === 'string')
    .filter((h) => !monthStart || h.invoice_date < monthStart)
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

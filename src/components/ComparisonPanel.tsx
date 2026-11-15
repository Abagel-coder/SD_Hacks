import { formatPhone, money } from '@/lib/format';
import type { InvoiceRow, VendorRow } from '@/lib/types';

type Cell = { text: string; key: string | null };

const NONE: Cell = { text: '—', key: null };

function domainCell(value: string | null | undefined): Cell {
  if (!value) return NONE;
  const key = value.trim().toLowerCase().replace(/^www\./, '');
  return { text: key, key };
}

function phoneCell(value: string | null | undefined): Cell {
  if (!value) return NONE;
  const digits = value.replace(/\D/g, '');
  return { text: formatPhone(value), key: digits.slice(-10) || null };
}

function bankCell(value: string | null | undefined): Cell {
  if (!value) return NONE;
  return { text: `•••• ${value.slice(-4)}`, key: value };
}

interface Row {
  label: string;
  invoice: Cell;
  web: Cell;
  file: Cell;
  /** Extra mismatch rule for rows that are not a simple equality check. */
  mismatch?: boolean;
  note?: string;
}

/** The invoice's value is a mismatch when it differs from any reference we actually have. */
function isMismatch(row: Row): boolean {
  if (row.mismatch !== undefined) return row.mismatch;
  if (!row.invoice.key) return false;
  return [row.web.key, row.file.key].some((ref) => ref !== null && ref !== row.invoice.key);
}

function buildRows(invoice: InvoiceRow, vendor: VendorRow | null): Row[] {
  const intel = invoice.intel?.available ? invoice.intel : null;
  const min = vendor?.amount_min ?? null;
  const max = vendor?.amount_max ?? null;
  const range = min !== null && max !== null ? `${money(min, invoice.currency)} – ${money(max, invoice.currency)}` : null;

  return [
    {
      label: 'Sender domain',
      invoice: domainCell(invoice.sender_domain),
      web: domainCell(intel?.realDomain),
      file: domainCell(vendor?.real_domain),
    },
    {
      label: 'Phone',
      invoice: phoneCell(invoice.extracted?.phoneOnInvoice),
      web: phoneCell(intel?.officialPhone),
      file: phoneCell(vendor?.verified_phone),
      note: 'We only ever call the public number, never the one on the invoice.',
    },
    {
      label: 'Bank account',
      invoice: bankCell(invoice.bank_account),
      web: { text: 'not published', key: null },
      file: bankCell(vendor?.bank_account),
    },
    {
      label: 'Amount',
      invoice: { text: money(invoice.amount, invoice.currency), key: null },
      web: { text: 'n/a', key: null },
      file: range ? { text: range, key: null } : NONE,
      mismatch: min !== null && max !== null && (invoice.amount < min || invoice.amount > max),
    },
  ];
}

/** Side-by-side: what the invoice claims vs what the public web and our vendor record say. */
export function ComparisonPanel({ invoice, vendor }: { invoice: InvoiceRow; vendor: VendorRow | null }) {
  const rows = buildRows(invoice, vendor);
  const mismatches = rows.filter(isMismatch).length;

  return (
    <section className="card text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-title">Does the invoice match?</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            mismatches > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}
        >
          {mismatches > 0 ? `${mismatches} mismatch${mismatches === 1 ? '' : 'es'}` : 'All consistent'}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500">
            <tr className="*:px-2 *:py-1.5">
              <th className="w-28" />
              <th>Invoice says</th>
              <th>Public web says</th>
              <th>On file</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const bad = isMismatch(row);
              return (
                <tr key={row.label} className="border-t border-gray-200 align-top *:px-2 *:py-2">
                  <th scope="row" className="font-medium text-gray-600">{row.label}</th>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[13px] ${
                        bad ? 'bg-red-100 font-semibold text-red-800 ring-1 ring-red-300' : 'text-gray-900'
                      }`}
                    >
                      {bad && <span aria-hidden>✕</span>}
                      {row.invoice.text}
                      {bad && <span className="sr-only">(mismatch)</span>}
                    </span>
                    {bad && row.note && <p className="mt-1 text-xs text-red-700">{row.note}</p>}
                  </td>
                  <td className="font-mono text-[13px] text-gray-700">{row.web.text}</td>
                  <td className="font-mono text-[13px] text-gray-700">{row.file.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

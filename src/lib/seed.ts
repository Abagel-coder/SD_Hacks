import { db } from './db';
import { DROP_STATEMENTS, SCHEMA_STATEMENTS } from './schema';
import { normalizeVendorName } from './vendors';

const HISTORY_DATES = [
  '2026-05-28', '2026-06-28', '2026-07-28', '2026-08-28', '2026-09-28', '2026-10-28',
];

export const SEED_VENDORS = [
  {
    name: 'Uline', domain: 'uline.com', bankAccount: '004417729035', bankRouting: '110000000',
    amountMin: 1100, amountMax: 1500,
    amounts: [1212.4, 1340.0, 1198.75, 1405.2, 1284.5, 1367.9],
  },
  {
    name: 'Grainger', domain: 'grainger.com', bankAccount: '008823340917', bankRouting: '110000000',
    amountMin: 600, amountMax: 950,
    amounts: [642.1, 710.0, 688.35, 905.6, 731.25, 799.0],
  },
  {
    name: 'Sysco', domain: 'sysco.com', bankAccount: '002291847756', bankRouting: '110000000',
    amountMin: 2800, amountMax: 3600,
    amounts: [2950.0, 3120.45, 2875.3, 3410.0, 3288.15, 3055.7],
  },
];

export async function resetDatabase(): Promise<void> {
  const sql = db();
  for (const statement of DROP_STATEMENTS) await sql.query(statement);
  for (const statement of SCHEMA_STATEMENTS) await sql.query(statement);

  for (const v of SEED_VENDORS) {
    const rows = await sql`
      insert into vendors (name, normalized_name, real_domain, bank_account, bank_routing, amount_min, amount_max)
      values (${v.name}, ${normalizeVendorName(v.name)}, ${v.domain}, ${v.bankAccount}, ${v.bankRouting}, ${v.amountMin}, ${v.amountMax})
      returning id`;
    const vendorId = rows[0].id as string;

    for (let i = 0; i < HISTORY_DATES.length; i++) {
      const date = HISTORY_DATES[i];
      await sql`
        insert into invoices (vendor_id, vendor_name, invoice_number, sender_email, sender_domain,
          amount, currency, bank_account, bank_routing, invoice_date, due_date,
          risk_score, risk_reasons, explanation, status, created_at, updated_at)
        values (${vendorId}, ${v.name}, ${`${v.name.slice(0, 3).toUpperCase()}-${date.slice(0, 7)}`},
          ${`billing@${v.domain}`}, ${v.domain},
          ${v.amounts[i]}, 'USD', ${v.bankAccount}, ${v.bankRouting}, ${date}, ${date},
          0, '[]'::jsonb, 'Matches this vendor''s history. No risk signals.', 'approved',
          ${date}::timestamptz, ${date}::timestamptz)`;
    }
  }
}

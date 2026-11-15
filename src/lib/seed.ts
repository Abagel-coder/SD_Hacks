import { db } from './db';
import { DROP_STATEMENTS, SCHEMA_STATEMENTS } from './schema';
import { at, riskScore, SAMPLE_SCAMS, transcriptFor } from './seed-history';
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

/** Public phone numbers the sample calls went to (the same ones warm-intel finds). */
const SAMPLE_PHONES: Record<string, string> = {
  Uline: '+18002955510', Grainger: '+18004724643', Sysco: '+18888365662',
};

export async function resetDatabase(now = new Date()): Promise<void> {
  const sql = db();
  const vendorIds: Record<string, string> = {};
  for (const statement of DROP_STATEMENTS) await sql.query(statement);
  for (const statement of SCHEMA_STATEMENTS) await sql.query(statement);

  for (const v of SEED_VENDORS) {
    const rows = await sql`
      insert into vendors (name, normalized_name, real_domain, bank_account, bank_routing, amount_min, amount_max)
      values (${v.name}, ${normalizeVendorName(v.name)}, ${v.domain}, ${v.bankAccount}, ${v.bankRouting}, ${v.amountMin}, ${v.amountMax})
      returning id`;
    const vendorId = rows[0].id as string;
    vendorIds[v.name] = vendorId;

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

  await seedSampleHistory(vendorIds, now);
}

/**
 * Past scams a verification call already stopped (see seed-history.ts). Blocked invoices are left out
 * of vendor history, so they never change how a new invoice is scored. No embeddings are written.
 */
async function seedSampleHistory(vendorIds: Record<string, string>, now: Date): Promise<void> {
  const sql = db();
  const business = process.env.BUSINESS_NAME || 'Harbor Coffee Roasters';
  const blockReason = 'Vendor denied this bank change by a verification call';

  for (const scam of SAMPLE_SCAMS) {
    const received = at(now, scam.daysAgo);
    const callStart = at(now, scam.daysAgo, 4);
    const callEnd = at(now, scam.daysAgo, 6);
    const date = received.toISOString().slice(0, 10);
    const score = riskScore(scam.reasons);
    const explanation = `${scam.reasons.map((r) => r.detail).join(' ')} Frozen until ${scam.vendorName} confirms by a verification call.`;
    const phone = SAMPLE_PHONES[scam.vendorName] ?? null;

    const inv = await sql`
      insert into invoices (vendor_id, vendor_name, invoice_number, sender_email, sender_domain,
        amount, currency, bank_account, bank_routing, invoice_date, due_date,
        risk_score, risk_reasons, explanation, status, created_at, updated_at)
      values (${vendorIds[scam.vendorName] ?? null}, ${scam.vendorName}, ${scam.invoiceNumber},
        ${`billing@${scam.senderDomain}`}, ${scam.senderDomain},
        ${scam.amount}, 'USD', ${scam.bankAccount}, '021000021', ${date}, ${date},
        ${score}, ${JSON.stringify(scam.reasons)}::jsonb, ${explanation}, 'blocked',
        ${received.toISOString()}::timestamptz, ${callEnd.toISOString()}::timestamptz)
      returning id`;
    const invoiceId = inv[0].id as string;

    const call = await sql`
      insert into calls (invoice_id, channel, number_found, status, outcome, transcript, started_at, ended_at)
      values (${invoiceId}, 'browser', ${phone}, 'completed', 'denied',
        ${JSON.stringify(transcriptFor(scam, business))}::jsonb,
        ${callStart.toISOString()}::timestamptz, ${callEnd.toISOString()}::timestamptz)
      returning id`;
    const callId = call[0].id as string;

    for (const [kind, value] of [['bank_account', scam.bankAccount], ['domain', scam.senderDomain]] as const) {
      await sql`
        insert into blocklist (kind, value, reason, source_invoice_id, created_at)
        values (${kind}, ${value}, ${blockReason}, ${invoiceId}, ${callEnd.toISOString()}::timestamptz)
        on conflict (kind, value) do nothing`;
    }

    const audit: [string, string, unknown, unknown, string, Date][] = [
      ['agent', 'score_risk', { blocklistHits: 0 }, { score, reasons: scam.reasons, freeze: true },
        `Risk score ${score} from ${scam.reasons.length} signal(s).`, received],
      ['agent', 'freeze_payment', { score }, { status: 'frozen' },
        'Payment frozen until the vendor is confirmed by a verification call.', received],
      ['owner', 'start_verification_call', { channel: 'browser' }, { callId, numberFound: phone },
        'Owner asked for phone verification. The agent uses the publicly verified number, never the one on the invoice.', callStart],
      ['agent', 'verification_call_result', { callId, channel: 'browser' }, { bankChangeConfirmed: 'no', outcome: 'denied' },
        'The vendor\'s answer to the bank change question was "no". Outcome: denied.', callEnd],
      ['agent', 'owner_alert', { callId, outcome: 'denied' },
        { blocklisted: { bankAccount: scam.bankAccount, domain: scam.senderDomain } },
        'Payment blocked. Owner alerted with the call transcript.', callEnd],
    ];
    for (const [actor, action, input, result, reason, when] of audit) {
      await sql`
        insert into audit_log (invoice_id, actor, action, input, result, reason, created_at)
        values (${invoiceId}, ${actor}, ${action}, ${JSON.stringify(input)}::jsonb, ${JSON.stringify(result)}::jsonb,
          ${reason}, ${when.toISOString()}::timestamptz)`;
    }
  }
}

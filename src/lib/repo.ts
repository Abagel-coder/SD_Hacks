import {
  toBlocklistSummary, type BlocklistEntryRow, type BlocklistStatsRow, type BlocklistSummary,
} from './blocklist';
import { db } from './db';
import { toVectorLiteral, type NearestBlocked } from './similar';
import { digitsOnly } from './util';
import { normalizeVendorName } from './vendors';
import type {
  AuditRow, BlocklistHit, BlocklistKind, CallChannel, CallOutcome, CallRow, CallStatus,
  ExtractedInvoice, InvoiceDetail, InvoiceRow, InvoiceStatus, RiskResult, SimilarScam, TranscriptTurn,
  VendorIntel, VendorRow,
} from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres throws on a malformed uuid, so check before querying. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

// ---------- vendors ----------

export async function findVendorByName(name: string): Promise<VendorRow | null> {
  const n = normalizeVendorName(name);
  if (!n) return null;
  const rows = await db()`
    select * from vendors
    where normalized_name = ${n}
       or ${n} like '%' || normalized_name || '%'
       or normalized_name like '%' || ${n} || '%'
    order by (normalized_name = ${n}) desc, length(normalized_name) desc
    limit 1`;
  return (rows[0] as VendorRow | undefined) ?? null;
}

export async function getVendor(id: string): Promise<VendorRow | null> {
  if (!isUuid(id)) return null;
  const rows = await db()`select * from vendors where id = ${id}`;
  return (rows[0] as VendorRow | undefined) ?? null;
}

export async function saveVendorIntel(vendorId: string, intel: VendorIntel): Promise<void> {
  await db()`
    update vendors set
      intel = ${JSON.stringify(intel)}::jsonb,
      intel_fetched_at = now(),
      real_domain = coalesce(real_domain, ${intel.realDomain}),
      verified_phone = coalesce(verified_phone, ${intel.officialPhone}),
      public_email = coalesce(public_email, ${intel.publicEmail})
    where id = ${vendorId}`;
}

export async function updateVendorBank(
  vendorId: string, bankAccount: string, bankRouting: string | null,
): Promise<void> {
  await db()`
    update vendors set bank_account = ${bankAccount}, bank_routing = coalesce(${bankRouting}, bank_routing)
    where id = ${vendorId}`;
}

export async function getVendorHistory(vendorId: string): Promise<InvoiceRow[]> {
  const rows = await db()`
    select * from invoices
    where vendor_id = ${vendorId} and status = 'approved' and invoice_date is not null
    order by invoice_date desc`;
  return rows as InvoiceRow[];
}

// ---------- invoices ----------

export async function insertInvoice(f: {
  vendorId: string | null; fileName: string; extracted: ExtractedInvoice; senderDomain: string | null;
}): Promise<InvoiceRow> {
  const e = f.extracted;
  const rows = await db()`
    insert into invoices (vendor_id, file_name, extracted, vendor_name, invoice_number,
      sender_email, sender_domain, amount, currency, bank_account, bank_routing,
      due_date, invoice_date, status)
    values (${f.vendorId}, ${f.fileName}, ${JSON.stringify(e)}::jsonb, ${e.vendorName}, ${e.invoiceNumber},
      ${e.senderEmail}, ${f.senderDomain}, ${e.amount}, ${e.currency}, ${e.bankAccount}, ${e.bankRouting},
      ${e.dueDate}, ${e.invoiceDate}, 'pending')
    returning *`;
  return rows[0] as InvoiceRow;
}

export async function saveRisk(id: string, r: {
  risk: RiskResult; explanation: string; intel: VendorIntel; status: InvoiceStatus;
}): Promise<InvoiceRow> {
  const rows = await db()`
    update invoices set
      risk_score = ${r.risk.score},
      risk_reasons = ${JSON.stringify(r.risk.reasons)}::jsonb,
      explanation = ${r.explanation},
      intel = ${JSON.stringify(r.intel)}::jsonb,
      status = ${r.status},
      updated_at = now()
    where id = ${id}
    returning *`;
  return rows[0] as InvoiceRow;
}

export async function setInvoiceStatus(
  id: string, to: InvoiceStatus, from: InvoiceStatus,
): Promise<boolean> {
  const rows = await db()`
    update invoices set status = ${to}, updated_at = now()
    where id = ${id} and status = ${from}
    returning id`;
  return rows.length === 1;
}

export async function listInvoices(): Promise<InvoiceRow[]> {
  const rows = await db()`select * from invoices order by created_at desc limit 60`;
  return rows as InvoiceRow[];
}

export async function getInvoice(id: string): Promise<InvoiceRow | null> {
  if (!isUuid(id)) return null;
  const rows = await db()`select * from invoices where id = ${id}`;
  return (rows[0] as InvoiceRow | undefined) ?? null;
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const invoice = await getInvoice(id);
  if (!invoice) return null;
  const sql = db();
  const [vendor, calls, audit] = await Promise.all([
    invoice.vendor_id ? getVendor(invoice.vendor_id) : Promise.resolve(null),
    sql`select * from calls where invoice_id = ${id} order by started_at desc limit 1`,
    sql`select * from audit_log where invoice_id = ${id} order by id asc`,
  ]);
  const latest = (calls[0] as CallRow | undefined) ?? null;
  // The expected challenge answer must never reach the browser.
  const call = latest ? { ...latest, challenge_answer: null, email_code: null } : null;
  return { invoice, vendor, call, audit: audit as AuditRow[] };
}

// ---------- blocklist ----------

export async function findBlocklistHits(
  bankAccount: string | null, senderDomain: string | null,
): Promise<BlocklistHit[]> {
  const rows = await db()`
    select kind, value, reason from blocklist
    where (kind = 'bank_account' and value = ${digitsOnly(bankAccount)})
       or (kind = 'domain' and value = ${senderDomain ?? ''})`;
  return rows as BlocklistHit[];
}

export async function addToBlocklist(
  kind: BlocklistKind, value: string, reason: string, sourceInvoiceId: string,
): Promise<void> {
  const stored = kind === 'bank_account' ? digitsOnly(value) : value;
  if (!stored) return;
  await db()`
    insert into blocklist (kind, value, reason, source_invoice_id)
    values (${kind}, ${stored}, ${reason}, ${sourceInvoiceId})
    on conflict (kind, value) do nothing`;
}

// ---------- calls ----------

export async function createCall(f: {
  invoiceId: string; channel: CallChannel; numberFound: string | null; numberDialed: string | null;
  challengeQuestion: string | null; challengeAnswer: string | null;
  emailFound?: string | null; emailSentTo?: string | null; emailCode?: string | null;
  codeCheck?: 'passed' | 'failed' | 'not_sent' | null;
}): Promise<CallRow> {
  const rows = await db()`
    insert into calls (invoice_id, channel, number_found, number_dialed, challenge_question, challenge_answer,
      email_found, email_sent_to, email_code, code_check)
    values (${f.invoiceId}, ${f.channel}, ${f.numberFound}, ${f.numberDialed},
      ${f.challengeQuestion}, ${f.challengeAnswer},
      ${f.emailFound ?? null}, ${f.emailSentTo ?? null}, ${f.emailCode ?? null}, ${f.codeCheck ?? null})
    returning *`;
  return rows[0] as CallRow;
}

export async function updateCall(id: string, p: {
  status?: CallStatus; outcome?: CallOutcome; conversationId?: string;
  transcript?: TranscriptTurn[]; ended?: boolean; codeCheck?: 'passed' | 'failed' | 'not_sent';
}): Promise<void> {
  await db()`
    update calls set
      status = coalesce(${p.status ?? null}, status),
      outcome = coalesce(${p.outcome ?? null}, outcome),
      conversation_id = coalesce(${p.conversationId ?? null}, conversation_id),
      transcript = coalesce(${p.transcript ? JSON.stringify(p.transcript) : null}::jsonb, transcript),
      code_check = coalesce(${p.codeCheck ?? null}, code_check),
      ended_at = case when ${p.ended ?? false} then now() else ended_at end
    where id = ${id}`;
}

export async function claimCall(id: string, to: 'completed' | 'failed'): Promise<boolean> {
  const rows = await db()`
    update calls set status = ${to}, ended_at = now()
    where id = ${id} and status in ('initiated', 'in_progress')
    returning id`;
  return rows.length === 1;
}

export async function getCall(id: string): Promise<CallRow | null> {
  if (!isUuid(id)) return null;
  const rows = await db()`select * from calls where id = ${id}`;
  return (rows[0] as CallRow | undefined) ?? null;
}

/** The call still running for this invoice, if any (newest first). */
export async function getActiveCallForInvoice(invoiceId: string): Promise<CallRow | null> {
  if (!isUuid(invoiceId)) return null;
  const rows = await db()`
    select * from calls
    where invoice_id = ${invoiceId} and status in ('initiated', 'in_progress')
    order by started_at desc limit 1`;
  return (rows[0] as CallRow | undefined) ?? null;
}

export async function getCallByConversationId(conversationId: string): Promise<CallRow | null> {
  const rows = await db()`select * from calls where conversation_id = ${conversationId} limit 1`;
  return (rows[0] as CallRow | undefined) ?? null;
}

// P2: Gemini result cache (see src/lib/gemini/cache.ts).
export async function getGeminiCache(key: string): Promise<unknown | null> {
  const rows = await db()`select result from gemini_cache where key = ${key}`;
  return rows[0]?.result ?? null;
}

export async function putGeminiCache(key: string, kind: 'extract' | 'explain', result: unknown): Promise<void> {
  await db()`
    insert into gemini_cache (key, kind, result) values (${key}, ${kind}, ${JSON.stringify(result)}::jsonb)
    on conflict (key) do update set result = excluded.result, created_at = now()`;
}

// ---------- blocklist page ----------

export async function getBlocklistSummary(): Promise<BlocklistSummary> {
  const sql = db();
  const [stats, rows] = await Promise.all([
    sql`
      select
        (select count(*)::int from invoices where status = 'blocked') as blocked_count,
        (select coalesce(sum(amount), 0)::float8 from invoices where status = 'blocked') as blocked_total,
        (select count(*)::int from blocklist) as entry_count`,
    sql`
      select b.id, b.kind, b.value, b.reason, b.source_invoice_id, b.created_at,
        i.vendor_name, i.amount
      from blocklist b
      left join invoices i on i.id = b.source_invoice_id
      order by b.created_at desc
      limit 200`,
  ]);
  return toBlocklistSummary(stats[0] as BlocklistStatsRow, rows as BlocklistEntryRow[]);
}

// ---------- similar-scam detection (pgvector) ----------

export async function saveInvoiceEmbedding(invoiceId: string, embedding: number[]): Promise<void> {
  await db()`
    insert into invoice_embeddings (invoice_id, embedding)
    values (${invoiceId}, ${toVectorLiteral(embedding)}::vector)
    on conflict (invoice_id) do update set embedding = excluded.embedding, created_at = now()`;
}

/** The blocked invoice closest to this embedding by cosine distance, or null when none is blocked. */
export async function findNearestBlocked(embedding: number[], excludeInvoiceId: string): Promise<NearestBlocked | null> {
  const vector = toVectorLiteral(embedding);
  const rows = await db()`
    select i.id as "invoiceId", i.updated_at as "blockedAt",
      1 - (e.embedding <=> ${vector}::vector) as similarity
    from invoice_embeddings e
    join invoices i on i.id = e.invoice_id
    where i.status = 'blocked' and i.id <> ${excludeInvoiceId}
    order by e.embedding <=> ${vector}::vector
    limit 1`;
  const row = rows[0] as { invoiceId: string; blockedAt: string | Date; similarity: unknown } | undefined;
  if (!row) return null;
  const blockedAt = row.blockedAt instanceof Date ? row.blockedAt.toISOString() : String(row.blockedAt);
  return { invoiceId: row.invoiceId, blockedAt, similarity: row.similarity };
}

export async function saveSimilarScam(invoiceId: string, similar: SimilarScam): Promise<void> {
  await db()`update invoices set similar_scam = ${JSON.stringify(similar)}::jsonb where id = ${invoiceId}`;
}

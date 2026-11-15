export type InvoiceStatus = 'pending' | 'frozen' | 'verifying' | 'approved' | 'blocked';
export type CallOutcome = 'confirmed' | 'denied' | 'unclear';
export type CallStatus = 'initiated' | 'in_progress' | 'completed' | 'failed';
export type CallChannel = 'phone' | 'browser';
export type BlocklistKind = 'bank_account' | 'domain' | 'phone';
export type AuditActor = 'agent' | 'owner' | 'system';

export type RiskCode =
  | 'BLOCKLIST_HIT'
  | 'BANK_CHANGED'
  | 'LOOKALIKE_DOMAIN'
  | 'DOMAIN_MISMATCH'
  | 'NEW_DOMAIN'
  | 'AMOUNT_ANOMALY'
  | 'URGENCY_OR_SECRECY'
  | 'UNKNOWN_VENDOR'
  | 'AI_FLAGGED'
  | 'NO_WEB_PRESENCE';

/** What Gemini reads off the invoice. Stored in invoices.extracted. */
export interface ExtractedInvoice {
  vendorName: string;
  invoiceNumber: string | null;
  senderEmail: string | null;
  senderDomain: string | null;
  amount: number;
  currency: string;
  bankAccount: string | null;
  bankRouting: string | null;
  dueDate: string | null; // YYYY-MM-DD
  invoiceDate: string | null; // YYYY-MM-DD
  urgencyPhrases: string[];
  secrecyPhrases: string[];
  phoneOnInvoice: string | null;
  /** P2: anomalies Gemini noticed that the rule engine does not check. Optional, so older rows still type-check. */
  aiIndicators?: AiIndicator[];
}

export interface AiIndicator {
  signal: string; // what looks wrong, in a few words
  evidence: string; // the exact text on the invoice that shows it
}

/** What Bright Data found on the public web. Stored in vendors.intel and invoices.intel. */
export interface VendorIntel {
  available: boolean; // false when Bright Data failed or timed out
  senderDomain: string | null; // the sender domain this result was computed for
  realDomain: string | null;
  officialPhone: string | null; // E.164 when possible
  publicEmail: string | null;
  senderDomainMatches: boolean | null;
  senderDomainAgeDays: number | null;
  sources: string[];
  /** P2: exact-match Google search for the sender domain. null = not checked or the search failed. */
  senderWebPresence?: { results: number; mentions: number } | null;
}

export interface RiskReason {
  code: RiskCode;
  points: number;
  detail: string;
}

export interface RiskResult {
  score: number; // 0 to 100
  reasons: RiskReason[];
  freeze: boolean;
}

export interface BlocklistHit {
  kind: BlocklistKind;
  value: string;
  reason: string;
}

// Row types match database columns exactly.
// Timestamps are Date objects on the server and ISO strings once sent as JSON.
// Only the UI reads timestamps, so they are typed as string.

export interface VendorRow {
  id: string;
  name: string;
  normalized_name: string;
  real_domain: string | null;
  verified_phone: string | null;
  public_email: string | null;
  bank_account: string | null;
  bank_routing: string | null;
  amount_min: number | null;
  amount_max: number | null;
  intel: VendorIntel | null;
  intel_fetched_at: string | null;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  vendor_id: string | null;
  file_name: string | null;
  extracted: ExtractedInvoice | null;
  intel: VendorIntel | null;
  vendor_name: string;
  invoice_number: string | null;
  sender_email: string | null;
  sender_domain: string | null;
  amount: number;
  currency: string;
  bank_account: string | null;
  bank_routing: string | null;
  due_date: string | null;
  invoice_date: string | null;
  risk_score: number | null;
  risk_reasons: RiskReason[] | null;
  explanation: string | null;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
  /** P1: closest blocked invoice by embedding, when above the threshold. Evidence only; never scored. */
  similar_scam?: SimilarScam | null;
}

/** Stored in invoices.similar_scam. */
export interface SimilarScam {
  invoiceId: string;
  /** Cosine similarity, 0 to 1. Show as a percentage. */
  similarity: number;
  /** When the matched invoice was blocked (its updated_at). */
  blockedAt: string;
}

export interface TranscriptTurn {
  role: 'agent' | 'user';
  message: string;
}

export interface CallRow {
  id: string;
  invoice_id: string;
  channel: CallChannel;
  number_found: string | null;
  number_dialed: string | null;
  conversation_id: string | null;
  status: CallStatus;
  outcome: CallOutcome | null;
  challenge_question: string | null;
  challenge_answer: string | null; // expected amount as text; never sent to the agent or the browser
  transcript: TranscriptTurn[] | null;
  started_at: string;
  ended_at: string | null;
}

export interface AuditRow {
  id: number;
  invoice_id: string | null;
  actor: AuditActor;
  action: string;
  input: unknown;
  result: unknown;
  reason: string | null;
  created_at: string;
}

/** Response of GET /api/invoices/:id */
export interface InvoiceDetail {
  invoice: InvoiceRow;
  vendor: VendorRow | null;
  call: CallRow | null; // latest call, challenge_answer removed
  audit: AuditRow[];
}

/** What the voice agent reported, plus what we expected. Input to classifyOutcome. */
export interface CallReport {
  bankChangeConfirmed: 'yes' | 'no' | 'unclear';
  statedAmount: number | null;
  expectedAmount: number | null; // null when the vendor has no history
}

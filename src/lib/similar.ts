import type { ExtractedInvoice, SimilarScam } from './types';

/** gemini-embedding-2 truncated to 768 dims (must match `vector(768)` in schema.ts). */
export const EMBEDDING_DIM = 768;

/**
 * Cosine similarity at or above this counts as "similar to a blocked scam".
 * Calibrated 2026-11-14 with live gemini-embedding-2 against the blocked u1ine scam:
 * scam variants scored 0.937 to 0.956; legit Uline 0.879, legit Uline bank change 0.886, Grainger 0.836.
 */
export const SIMILAR_SCAM_THRESHOLD = 0.92;

/** The fields that make one scam look like another, as stable text for the embedding model. */
export function embeddingText(invoice: ExtractedInvoice, senderDomain: string | null): string {
  const amount = Number.isFinite(invoice.amount) ? invoice.amount.toFixed(2) : 'unknown';
  return [
    `vendor: ${invoice.vendorName}`,
    `sender domain: ${senderDomain ?? invoice.senderDomain ?? 'unknown'}`,
    `bank account: ${invoice.bankAccount ?? 'none'}`,
    `amount: ${amount} ${invoice.currency}`,
    `urgency: ${invoice.urgencyPhrases.join(' | ') || 'none'}`,
    `secrecy: ${invoice.secrecyPhrases.join(' | ') || 'none'}`,
  ].join('\n');
}

/** pgvector text literal, e.g. '[0.1,0.2]'. Rejects wrong sizes and non-finite values. */
export function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIM) {
    throw new Error(`Expected ${EMBEDDING_DIM} embedding values, got ${values.length}`);
  }
  if (!values.every(Number.isFinite)) throw new Error('Embedding has non-finite values');
  return `[${values.join(',')}]`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) throw new Error('Vectors must be the same non-zero length');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** The closest blocked invoice, as returned by the pgvector query. */
export interface NearestBlocked {
  invoiceId: string;
  /** 1 - cosine distance; may arrive as a string from Postgres. */
  similarity: unknown;
  blockedAt: string;
}

/** Evidence only: a match never changes the risk score. */
export function pickSimilarScam(
  nearest: NearestBlocked | null,
  threshold = SIMILAR_SCAM_THRESHOLD,
): SimilarScam | null {
  if (!nearest) return null;
  const similarity = Number(nearest.similarity);
  if (!Number.isFinite(similarity) || similarity < threshold) return null;
  return {
    invoiceId: nearest.invoiceId,
    similarity: Math.round(Math.min(1, similarity) * 1000) / 1000,
    blockedAt: nearest.blockedAt,
  };
}

/**
 * MOCK_EMBEDDINGS=1: a deterministic bag-of-words vector, so identical invoices match exactly
 * and unrelated ones mostly don't, with no network call.
 */
export function mockEmbedding(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  for (const token of text.toLowerCase().split(/[^a-z0-9.@]+/).filter(Boolean)) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
    v[(h >>> 0) % EMBEDDING_DIM] += 1;
  }
  return v;
}

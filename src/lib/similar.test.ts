import { describe, expect, it } from 'vitest';
import { MOCK_EXTRACTED } from './mocks';
import {
  EMBEDDING_DIM, SIMILAR_SCAM_THRESHOLD, cosineSimilarity, embeddingText, mockEmbedding, pickSimilarScam,
  toVectorLiteral,
} from './similar';

const nearest = (similarity: unknown) => ({
  invoiceId: '22222222-2222-2222-2222-222222222222', similarity, blockedAt: '2026-11-14T16:26:00Z',
});

describe('pickSimilarScam', () => {
  it('returns null when there is no blocked invoice to compare with', () => {
    expect(pickSimilarScam(null)).toBeNull();
  });

  it('matches at or above the threshold', () => {
    expect(pickSimilarScam(nearest(0.97), 0.9)).toEqual({
      invoiceId: '22222222-2222-2222-2222-222222222222', similarity: 0.97, blockedAt: '2026-11-14T16:26:00Z',
    });
    expect(pickSimilarScam(nearest(0.9), 0.9)?.similarity).toBe(0.9);
  });

  it('does not match below the threshold', () => {
    expect(pickSimilarScam(nearest(0.8999), 0.9)).toBeNull();
  });

  it('accepts Postgres numeric strings and rounds to 3 places', () => {
    expect(pickSimilarScam(nearest('0.95432'), 0.9)?.similarity).toBe(0.954);
  });

  it('caps float error above 1 and ignores garbage', () => {
    expect(pickSimilarScam(nearest(1.0000002), 0.9)?.similarity).toBe(1);
    expect(pickSimilarScam(nearest('NaN'), 0.9)).toBeNull();
    expect(pickSimilarScam(nearest(null), 0)).toEqual(expect.objectContaining({ similarity: 0 }));
  });

  it('uses the module threshold by default', () => {
    expect(pickSimilarScam(nearest(SIMILAR_SCAM_THRESHOLD))).not.toBeNull();
    expect(pickSimilarScam(nearest(SIMILAR_SCAM_THRESHOLD - 0.01))).toBeNull();
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for the same direction and 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('is 0 for a zero vector and rejects mismatched lengths', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 2])).toThrow();
  });
});

describe('embeddingText', () => {
  it('includes the fields that identify a scam', () => {
    const text = embeddingText(MOCK_EXTRACTED, 'u1ine.com');
    expect(text).toContain('vendor: Uline');
    expect(text).toContain('sender domain: u1ine.com');
    expect(text).toContain(`bank account: ${MOCK_EXTRACTED.bankAccount}`);
    expect(text).toContain(`amount: ${MOCK_EXTRACTED.amount.toFixed(2)}`);
  });

  it('marks empty phrase lists as none', () => {
    const text = embeddingText({ ...MOCK_EXTRACTED, urgencyPhrases: [], secrecyPhrases: [] }, null);
    expect(text).toContain('urgency: none');
    expect(text).toContain('secrecy: none');
  });
});

describe('toVectorLiteral', () => {
  it('formats a pgvector literal of the right size', () => {
    const v = new Array(EMBEDDING_DIM).fill(0.5);
    expect(toVectorLiteral(v)).toBe(`[${v.join(',')}]`);
  });

  it('rejects the wrong size or non-finite values', () => {
    expect(() => toVectorLiteral([1, 2])).toThrow();
    expect(() => toVectorLiteral(new Array(EMBEDDING_DIM).fill(NaN))).toThrow();
  });
});

describe('mockEmbedding', () => {
  it('matches the same invoice exactly and a different one less', () => {
    const scam = embeddingText(MOCK_EXTRACTED, 'u1ine.com');
    const legit = embeddingText(
      { ...MOCK_EXTRACTED, bankAccount: '004417729035', amount: 1318.4, urgencyPhrases: [], secrecyPhrases: [] },
      'uline.com',
    );
    expect(mockEmbedding(scam)).toHaveLength(EMBEDDING_DIM);
    expect(cosineSimilarity(mockEmbedding(scam), mockEmbedding(scam))).toBeCloseTo(1);
    expect(cosineSimilarity(mockEmbedding(scam), mockEmbedding(legit))).toBeLessThan(SIMILAR_SCAM_THRESHOLD);
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_VENDORS } from './seed';
import { at, riskScore, SAMPLE_SCAMS, transcriptFor } from './seed-history';

describe('seed demo history', () => {
  it('has about six blocked scams totaling about $30,000', () => {
    expect(SAMPLE_SCAMS).toHaveLength(6);
    const total = SAMPLE_SCAMS.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeGreaterThan(28_000);
    expect(total).toBeLessThan(32_000);
  });

  it('spreads them over the last 30 days, never in the future', () => {
    const now = new Date('2026-11-15T19:00:00Z');
    for (const s of SAMPLE_SCAMS) {
      const when = at(now, s.daysAgo, 6);
      expect(when.getTime()).toBeLessThan(now.getTime());
      expect(now.getTime() - when.getTime()).toBeLessThanOrEqual(30 * 86_400_000);
    }
  });

  it('never uses the on-stage scam domain or account, or a real vendor account or domain', () => {
    const realAccounts = SEED_VENDORS.map((v) => v.bankAccount);
    const realDomains = SEED_VENDORS.map((v) => v.domain);
    for (const s of SAMPLE_SCAMS) {
      expect(s.senderDomain).not.toBe('u1ine.com');
      expect(realDomains).not.toContain(s.senderDomain);
      expect(s.bankAccount).not.toBe('000123456789');
      expect(s.bankAccount.endsWith('6789')).toBe(false);
      expect(s.bankAccount.endsWith('0044')).toBe(false); // samples/bank-change-uline.pdf
      for (const real of realAccounts) {
        expect(s.bankAccount).not.toBe(real);
        expect(s.bankAccount.slice(-4)).not.toBe(real.slice(-4));
      }
    }
  });

  it('gives each scam its own account and domain', () => {
    expect(new Set(SAMPLE_SCAMS.map((s) => s.bankAccount)).size).toBe(SAMPLE_SCAMS.length);
    expect(new Set(SAMPLE_SCAMS.map((s) => s.senderDomain)).size).toBe(SAMPLE_SCAMS.length);
  });

  it('scores each one high enough to have been frozen, with a denial on the call', () => {
    for (const s of SAMPLE_SCAMS) {
      expect(riskScore(s.reasons)).toBeGreaterThanOrEqual(60);
      const transcript = transcriptFor(s, 'Harbor Coffee Roasters');
      expect(transcript.some((t) => t.role === 'user' && /^No\b/.test(t.message))).toBe(true);
      expect(transcript.some((t) => t.message.includes(s.bankAccount.slice(-4).split('').join(' ')))).toBe(true);
    }
  });

  it('writes no embeddings, so the on-stage scam gets no similar-scam match', () => {
    const seed = readFileSync(path.join(__dirname, 'seed.ts'), 'utf8');
    expect(seed).not.toMatch(/insert into invoice_embeddings/i);
  });
});

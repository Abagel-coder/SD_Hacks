import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VendorIntel, VendorRow } from '../types';

vi.mock('../seed', () => ({ SEED_VENDORS: [{ name: 'Uline' }, { name: 'Grainger' }] }));
vi.mock('../repo', () => ({ findVendorByName: vi.fn(), saveVendorIntel: vi.fn() }));
vi.mock('./verify-vendor', () => ({ verifyVendor: vi.fn() }));

const { findVendorByName, saveVendorIntel } = await import('../repo');
const { verifyVendor } = await import('./verify-vendor');
const { warmVendorIntel } = await import('./warm');

const vendorRow = (name: string, domain: string, intel: VendorIntel | null = null): VendorRow => ({
  id: `id-${name}`, name, normalized_name: name.toLowerCase(), real_domain: domain, verified_phone: null,
  public_email: null, bank_account: null, bank_routing: null, amount_min: null, amount_max: null,
  intel, intel_fetched_at: null, created_at: '2026-11-14T00:00:00Z',
});

const intelFor = (domain: string, available = true): VendorIntel => ({
  available, senderDomain: domain, realDomain: available ? domain : null, officialPhone: available ? '+18005550000' : null,
  publicEmail: null, senderDomainMatches: available ? true : null, senderDomainAgeDays: available ? 10_000 : null, sources: [],
});

describe('warmVendorIntel', () => {
  beforeEach(() => {
    vi.stubEnv('MOCK_BRIGHTDATA', '0');
    vi.mocked(findVendorByName).mockImplementation(async (name) =>
      name === 'Uline' ? vendorRow('Uline', 'uline.com', intelFor('uline.com')) : vendorRow('Grainger', 'grainger.com'));
    vi.mocked(verifyVendor).mockImplementation(async (_name, sender) => intelFor(sender as string));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('refuses to run with MOCK_BRIGHTDATA=1 so mock data never lands in the cache', async () => {
    vi.stubEnv('MOCK_BRIGHTDATA', '1');
    await expect(warmVendorIntel()).rejects.toThrow('MOCK_BRIGHTDATA');
    expect(verifyVendor).not.toHaveBeenCalled();
    expect(saveVendorIntel).not.toHaveBeenCalled();
  });

  it('looks up every seeded vendor with its real domain as the sender and saves the result', async () => {
    const results = await warmVendorIntel();
    expect(verifyVendor).toHaveBeenCalledWith('Uline', 'uline.com', intelFor('uline.com'));
    expect(verifyVendor).toHaveBeenCalledWith('Grainger', 'grainger.com', null);
    expect(saveVendorIntel).toHaveBeenCalledWith('id-Uline', intelFor('uline.com'));
    expect(saveVendorIntel).toHaveBeenCalledWith('id-Grainger', intelFor('grainger.com'));
    expect(results.map((r) => [r.vendor, r.ok])).toEqual([['Uline', true], ['Grainger', true]]);
  });

  it('ignores the existing cache when forced', async () => {
    await warmVendorIntel({ force: true });
    expect(verifyVendor).toHaveBeenCalledWith('Uline', 'uline.com', null);
  });

  it('keeps going when one vendor fails, and never saves an unavailable result', async () => {
    vi.mocked(verifyVendor).mockImplementation(async (name, sender) => {
      if (name === 'Uline') throw new Error('Bright Data upstream 502');
      return intelFor(sender as string, false);
    });
    const results = await warmVendorIntel();
    expect(results).toEqual([
      expect.objectContaining({ vendor: 'Uline', ok: false, error: 'Bright Data upstream 502' }),
      expect.objectContaining({ vendor: 'Grainger', ok: false, error: 'lookup came back unavailable' }),
    ]);
    expect(saveVendorIntel).not.toHaveBeenCalled();
  });

  it('reports a vendor that is missing from the database', async () => {
    vi.mocked(findVendorByName).mockResolvedValue(null);
    const results = await warmVendorIntel({ names: ['Nobody'] });
    expect(results).toEqual([expect.objectContaining({ vendor: 'Nobody', ok: false, error: 'not in the vendors table' })]);
    expect(verifyVendor).not.toHaveBeenCalled();
  });
});

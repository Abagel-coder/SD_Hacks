import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_INTEL } from '../mocks';
import type { VendorIntel } from '../types';

vi.mock('./public-facts', () => ({ lookupPublicFacts: vi.fn() }));
vi.mock('./domain-age', () => ({ lookupDomainAgeDays: vi.fn() }));

const { lookupPublicFacts } = await import('./public-facts');
const { lookupDomainAgeDays } = await import('./domain-age');
const { verifyVendor } = await import('./verify-vendor');

const LIVE_FACTS = {
  realDomain: 'uline.com', officialPhone: '+18002955510',
  publicEmail: 'customer.service@uline.com', sources: ['https://www.uline.com/CustomerService/Contacts'],
};

const cachedFor = (senderDomain: string, senderDomainAgeDays: number | null): VendorIntel => ({
  available: true, senderDomain, ...LIVE_FACTS,
  senderDomainMatches: senderDomain === 'uline.com', senderDomainAgeDays,
});

describe('verifyVendor cache', () => {
  beforeEach(() => {
    vi.stubEnv('MOCK_BRIGHTDATA', '0');
    vi.mocked(lookupPublicFacts).mockResolvedValue(LIVE_FACTS);
    vi.mocked(lookupDomainAgeDays).mockResolvedValue(11305);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('reuses a cached "not registered" (null) age for the same sender instead of looking it up again', async () => {
    const intel = await verifyVendor('Uline', 'u1ine.com', cachedFor('u1ine.com', null));
    expect(lookupDomainAgeDays).not.toHaveBeenCalled();
    expect(lookupPublicFacts).not.toHaveBeenCalled();
    expect(intel.senderDomainAgeDays).toBeNull();
    expect(intel.senderDomainMatches).toBe(false);
  });

  it('looks up the age again when the sender domain differs from the cached one', async () => {
    vi.mocked(lookupDomainAgeDays).mockResolvedValue(null);
    const intel = await verifyVendor('Uline', 'u1ine.com', cachedFor('uline.com', 11305));
    expect(lookupDomainAgeDays).toHaveBeenCalledWith('u1ine.com');
    expect(lookupPublicFacts).not.toHaveBeenCalled();
    expect(intel.senderDomainAgeDays).toBeNull();
  });

  it('ignores mock intel left in the cache by a MOCK_BRIGHTDATA=1 run', async () => {
    const intel = await verifyVendor('Uline', 'uline.com', { ...MOCK_INTEL, senderDomain: 'uline.com' });
    expect(lookupPublicFacts).toHaveBeenCalledWith('Uline');
    expect(lookupDomainAgeDays).toHaveBeenCalledWith('uline.com');
    expect(intel.officialPhone).toBe('+18002955510');
    expect(intel.senderDomainAgeDays).toBe(11305);
  });

  it('does not reuse cache entries from a failed lookup', async () => {
    const failed: VendorIntel = {
      available: false, senderDomain: 'uline.com', realDomain: null, officialPhone: null, publicEmail: null,
      senderDomainMatches: null, senderDomainAgeDays: null, sources: [],
    };
    await verifyVendor('Uline', 'uline.com', failed);
    expect(lookupPublicFacts).toHaveBeenCalled();
    expect(lookupDomainAgeDays).toHaveBeenCalled();
  });
});

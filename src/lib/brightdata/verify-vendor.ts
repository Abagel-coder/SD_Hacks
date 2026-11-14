import { MOCK_INTEL } from '../mocks';
import { normalizeDomain } from '../risk/domains';
import type { VendorIntel } from '../types';
import { isMock } from '../util';
import { lookupDomainAgeDays } from './domain-age';
import { lookupPublicFacts } from './public-facts';

export async function verifyVendor(
  vendorName: string,
  senderDomain: string | null,
  cached: VendorIntel | null,
): Promise<VendorIntel> {
  if (isMock('BRIGHTDATA')) return { ...MOCK_INTEL, senderDomain };

  const sender = normalizeDomain(senderDomain);
  const cachedFacts = cached && cached.available && cached.realDomain
    ? {
        realDomain: cached.realDomain, officialPhone: cached.officialPhone,
        publicEmail: cached.publicEmail, sources: cached.sources,
      }
    : null;
  const cachedAge = cached && cached.senderDomain === sender ? cached.senderDomainAgeDays : null;

  const [facts, ageDays] = await Promise.all([
    cachedFacts ?? lookupPublicFacts(vendorName),
    cachedAge ?? (sender ? lookupDomainAgeDays(sender) : null),
  ]);

  return {
    available: true,
    senderDomain: sender,
    realDomain: facts.realDomain,
    officialPhone: facts.officialPhone,
    publicEmail: facts.publicEmail,
    senderDomainMatches: sender && facts.realDomain ? sender === facts.realDomain : null,
    senderDomainAgeDays: ageDays,
    sources: facts.sources,
  };
}

import { MOCK_INTEL } from '../mocks';
import { normalizeDomain } from '../risk/domains';
import type { VendorIntel } from '../types';
import { isMock } from '../util';
import { lookupDomainAgeDays } from './domain-age';
import { lookupPublicFacts } from './public-facts';
import { lookupWebPresence } from './web-presence';

function isMockIntel(intel: VendorIntel): boolean {
  return intel.officialPhone === MOCK_INTEL.officialPhone
    && JSON.stringify(intel.sources) === JSON.stringify(MOCK_INTEL.sources);
}

export async function verifyVendor(
  vendorName: string,
  senderDomain: string | null,
  cached: VendorIntel | null,
): Promise<VendorIntel> {
  if (isMock('BRIGHTDATA')) return { ...MOCK_INTEL, senderDomain };

  const sender = normalizeDomain(senderDomain);
  // A failed lookup, or mock intel written while MOCK_BRIGHTDATA=1, is never reused as a cache hit.
  const usable = cached && cached.available && !isMockIntel(cached) ? cached : null;
  const cachedFacts = usable && usable.realDomain
    ? {
        realDomain: usable.realDomain, officialPhone: usable.officialPhone,
        publicEmail: usable.publicEmail, sources: usable.sources,
      }
    : null;
  // null is a real answer ("not registered"), so the cache hit is keyed on the sender domain, not the value.
  const ageCached = usable !== null && sender !== null && usable.senderDomain === sender;

  // Web presence only matters for a sender that is not the vendor's own domain; it is cached with the sender.
  // Only a real answer is cached; an unknown (failed search) is retried next time.
  const presenceCached = ageCached && usable.senderWebPresence != null;
  const needPresence = sender !== null && sender !== (cachedFacts?.realDomain ?? null);

  const [facts, ageDays, presence] = await Promise.all([
    cachedFacts ?? lookupPublicFacts(vendorName),
    ageCached ? usable.senderDomainAgeDays : sender ? lookupDomainAgeDays(sender) : null,
    presenceCached ? usable.senderWebPresence! : needPresence && sender ? lookupWebPresence(sender) : null,
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
    senderWebPresence: sender && sender === facts.realDomain ? null : presence,
  };
}

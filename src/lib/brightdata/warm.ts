import { findVendorByName, saveVendorIntel } from '../repo';
import { SEED_VENDORS } from '../seed';
import { isMock } from '../util';
import { verifyVendor } from './verify-vendor';

export interface WarmResult {
  vendor: string;
  ok: boolean;
  ms: number;
  realDomain?: string | null;
  officialPhone?: string | null;
  error?: string;
}

/**
 * Fill vendors.intel for the seeded vendors so the first live upload after `npm run db:reset`
 * takes about 2–3 s instead of about 12 s. The sender domain is the vendor's real domain (the
 * legit case). The scam sender's domain-age lookup is fast on its own. Vendors are looked up
 * one at a time to stay gentle on the Gemini free tier and Bright Data's per-query limits.
 */
export async function warmVendorIntel(
  opts: { names?: string[]; force?: boolean } = {},
): Promise<WarmResult[]> {
  if (isMock('BRIGHTDATA')) {
    throw new Error('MOCK_BRIGHTDATA=1: refusing to warm the cache with mock data. Run with MOCK_BRIGHTDATA=0.');
  }
  const names = opts.names ?? SEED_VENDORS.map((v) => v.name);
  const results: WarmResult[] = [];

  for (const name of names) {
    const started = Date.now();
    try {
      const vendor = await findVendorByName(name);
      if (!vendor) {
        results.push({ vendor: name, ok: false, ms: 0, error: 'not in the vendors table' });
        continue;
      }
      const intel = await verifyVendor(vendor.name, vendor.real_domain, opts.force ? null : vendor.intel);
      if (!intel.available) {
        results.push({ vendor: name, ok: false, ms: Date.now() - started, error: 'lookup came back unavailable' });
        continue;
      }
      await saveVendorIntel(vendor.id, intel);
      results.push({
        vendor: name, ok: true, ms: Date.now() - started,
        realDomain: intel.realDomain, officialPhone: intel.officialPhone,
      });
    } catch (err) {
      results.push({
        vendor: name, ok: false, ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

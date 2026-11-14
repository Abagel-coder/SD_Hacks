import { fetchPage } from './client';
import { registrationAgeDays } from './parse';

export async function lookupDomainAgeDays(domain: string): Promise<number | null> {
  const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  try {
    return registrationAgeDays(JSON.parse(await fetchPage(url, false, 8_000)), new Date());
  } catch (err) {
    console.error('RDAP through Bright Data failed, trying direct', err);
  }
  try {
    // rdap.org sits behind Cloudflare, which returns 403 to Node's fetch unless a User-Agent is set.
    const res = await fetch(url, {
      headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'invoice-fraud-agent/0.1' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return registrationAgeDays(await res.json(), new Date());
  } catch {
    return null;
  }
}

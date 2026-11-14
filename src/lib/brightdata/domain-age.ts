import { fetchPage } from './client';
import { registrationAgeDays } from './parse';

type Answer = { age: number | null; authoritative: boolean };

/**
 * Domain age from RDAP. Web Unlocker and a direct request run in parallel and the first
 * authoritative answer wins. Unlocker hangs on unregistered domains (seen live with u1ine.com),
 * while a direct RDAP 404 is a definitive "not registered", so the slow path never blocks the
 * pipeline. Never throws.
 */
export async function lookupDomainAgeDays(domain: string): Promise<number | null> {
  const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  const now = new Date();

  const viaUnlocker = async (): Promise<Answer> => {
    const age = registrationAgeDays(JSON.parse(await fetchPage(url, false, 8_000)), now);
    return { age, authoritative: age !== null };
  };

  const direct = async (): Promise<Answer> => {
    // rdap.org sits behind Cloudflare, which returns 403 to Node's fetch unless a User-Agent is set.
    const res = await fetch(url, {
      headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'invoice-fraud-agent/0.1' },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return { age: null, authoritative: true };
    if (!res.ok) throw new Error(`RDAP ${res.status}`);
    const age = registrationAgeDays(await res.json(), now);
    return { age, authoritative: age !== null };
  };

  return new Promise<number | null>((resolve) => {
    let pending = 2;
    const settle = (answer: Answer | null, source: string, err?: unknown) => {
      if (err) console.error(`RDAP via ${source} failed`, err);
      if (answer?.authoritative) return resolve(answer.age);
      if (--pending === 0) resolve(null);
    };
    viaUnlocker().then((a) => settle(a, 'Bright Data'), (e) => settle(null, 'Bright Data', e));
    direct().then((a) => settle(a, 'direct'), (e) => settle(null, 'direct', e));
  });
}

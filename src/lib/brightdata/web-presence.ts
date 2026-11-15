import { normalizeDomain } from '../risk/domains';
import { googleSearch } from './client';

/**
 * How visible the sender domain is on the public web. A real business domain is mentioned in nearly
 * every result for an exact search (uline.com 6/6, grainger.com 5/5 live); a freshly made scam domain
 * gets unrelated results and 0 mentions (u1ine.com 0/9). Two query variants: the second has a
 * different query string, so Bright Data's "this query recently failed" block does not apply.
 * Returns null when neither gives usable results, so a Bright Data hiccup is never mistaken for
 * "no presence". Never throws.
 */
export async function lookupWebPresence(domain: string): Promise<{ results: number; mentions: number } | null> {
  const needle = domain.toLowerCase();
  for (const query of [`"${domain}"`, `"${domain}" invoice`]) {
    try {
      const results = await googleSearch(query, { noAutocorrect: true });
      if (results.length === 0) continue;
      const mentions = results.filter((r) =>
        normalizeDomain(r.link) === needle || `${r.title} ${r.description}`.toLowerCase().includes(needle)).length;
      return { results: results.length, mentions };
    } catch (err) {
      console.warn(`Web presence search failed for ${query}`, (err as Error).message);
    }
  }
  return null;
}

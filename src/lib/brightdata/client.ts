const ENDPOINT = 'https://api.brightdata.com/request';

export interface SerpResult {
  link: string;
  title: string;
  description: string;
}

async function request(zone: string | undefined, url: string, extra: Record<string, unknown> = {}): Promise<string> {
  if (!process.env.BRIGHTDATA_API_KEY || !zone) throw new Error('Bright Data env vars are not set');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ zone, url, format: 'raw', ...extra }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Bright Data ${res.status}: ${body.slice(0, 200)}`);
  return body;
}

export async function googleSearch(query: string): Promise<SerpResult[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&brd_json=1`;
  let parsed = JSON.parse(await request(process.env.BRIGHTDATA_SERP_ZONE, url));
  // Some zone settings wrap the result as { status_code, headers, body }.
  if (typeof parsed?.body === 'string') parsed = JSON.parse(parsed.body);
  const organic: { link?: string; title?: string; description?: string }[] = parsed?.organic ?? [];
  return organic
    .filter((o) => typeof o.link === 'string')
    .map((o) => ({ link: o.link as string, title: o.title ?? '', description: o.description ?? '' }));
}

export async function fetchPage(url: string, asMarkdown = false): Promise<string> {
  return request(process.env.BRIGHTDATA_UNLOCKER_ZONE, url, asMarkdown ? { data_format: 'markdown' } : {});
}

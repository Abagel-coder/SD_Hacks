import { formatPhone } from '@/lib/format';
import type { InvoiceRow } from '@/lib/types';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** One link per hostname, in the order found. */
function uniqueByHost(urls: string[]): { host: string; url: string }[] {
  const seen = new Map<string, string>();
  for (const url of urls) {
    const host = hostOf(url);
    if (!seen.has(host)) seen.set(host, url);
  }
  return [...seen].map(([host, url]) => ({ host, url }));
}

/** 11305 -> '31 years'; under a year stays in days. */
function domainAge(days: number): string {
  if (days < 365) return `${days} days`;
  const years = Math.round(days / 365.25);
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 -mx-2 rounded-lg border-b border-gray-100 px-2 py-2 transition-colors last:border-b-0 hover:bg-gray-50">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function VendorCheck({ invoice }: { invoice: InvoiceRow }) {
  const intel = invoice.intel;
  const phoneOnInvoice = invoice.extracted?.phoneOnInvoice;
  const sources = intel ? uniqueByHost(intel.sources).slice(0, 3) : [];
  return (
    <section className="card p-6 text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">Public web check</h2>
        <span className="rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
          Looked up live with Bright Data
        </span>
      </div>
      {!intel || !intel.available ? (
        <p className="mt-2 text-sm text-gray-600">The public web check was unavailable for this invoice.</p>
      ) : (
        <>
          <dl className="mt-2 text-sm">
            <Row label="Invoice sent from" value={invoice.sender_domain ?? 'unknown'} />
            <Row label="Vendor's real website" value={intel.realDomain ?? 'not found'} />
            <Row label="Sender matches real website"
              value={intel.senderDomainMatches === null ? 'unknown' : intel.senderDomainMatches ? 'Yes' : 'No'} />
            <Row label="Sender domain age"
              value={intel.senderDomainAgeDays === null ? 'no registration record' : domainAge(intel.senderDomainAgeDays)} />
            {intel.senderWebPresence && (
              <Row label="Sender domain on the web"
                value={`mentioned in ${intel.senderWebPresence.mentions} of ${intel.senderWebPresence.results} search results`} />
            )}
            <Row label="Official phone" value={intel.officialPhone ? formatPhone(intel.officialPhone) : 'not found'} />
            <Row label="Public contact email" value={intel.publicEmail ?? 'not found'} />
            <Row label="Phone printed on invoice" value={phoneOnInvoice ? formatPhone(phoneOnInvoice) : 'none'} />
          </dl>
          {sources.length > 0 && (
            <p className="mt-2 truncate text-xs text-gray-500">
              Sources:{' '}
              {sources.map((source, index) => (
                <a key={source.host} href={source.url} target="_blank" rel="noreferrer" className="underline">
                  {index > 0 ? ', ' : ''}{source.host}
                </a>
              ))}
            </p>
          )}
        </>
      )}
    </section>
  );
}

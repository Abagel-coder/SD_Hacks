import type { InvoiceRow } from '@/lib/types';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1 last:border-b-0">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function VendorCheck({ invoice }: { invoice: InvoiceRow }) {
  const intel = invoice.intel;
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Public web check</h2>
      <p className="text-xs text-gray-500">Looked up live with Bright Data</p>
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
              value={intel.senderDomainAgeDays === null ? 'no registration record' : `${intel.senderDomainAgeDays} days`} />
            <Row label="Official phone" value={intel.officialPhone ?? 'not found'} />
            <Row label="Public contact email" value={intel.publicEmail ?? 'not found'} />
            <Row label="Phone printed on invoice" value={invoice.extracted?.phoneOnInvoice ?? 'none'} />
          </dl>
          {intel.sources.length > 0 && (
            <p className="mt-2 truncate text-xs text-gray-500">
              Sources:{' '}
              {intel.sources.slice(0, 3).map((source, index) => (
                <a key={source} href={source} target="_blank" rel="noreferrer" className="underline">
                  {index > 0 ? ', ' : ''}{hostOf(source)}
                </a>
              ))}
            </p>
          )}
        </>
      )}
    </section>
  );
}

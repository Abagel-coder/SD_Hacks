'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { InvoiceRow } from '@/lib/types';

export function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose an invoice file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices', { method: 'POST', body: form });
      const json = (await res.json()) as { invoice?: InvoiceRow; error?: string };
      if (!res.ok || !json.invoice) throw new Error(json.error ?? 'Upload failed.');
      onUploaded();
      router.push(`/invoices/${json.invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 text-gray-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Check a new invoice</h2>
        <p className="text-sm text-gray-500">PDF, PNG or JPEG</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
        <label className="group flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:border-gray-900">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black text-white" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{fileName ?? 'Choose an invoice file'}</span>
            <span className="block text-xs text-gray-500">{fileName ? 'Click to change' : 'Click to browse'}</span>
          </span>
          <input
            name="file"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="sr-only"
            onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? null)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="eyebrow">Sender email (optional)</span>
          <input name="senderEmail" type="email" placeholder="billing@vendor.com" className="field" />
        </label>
        <button type="submit" disabled={busy} className="btn h-[2.9rem]">
          {busy ? 'Checking…' : 'Check invoice'}
          {!busy && <span aria-hidden>→</span>}
        </button>
      </div>
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
          Reading, verifying the vendor and scoring. This takes up to 30 seconds.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </form>
  );
}

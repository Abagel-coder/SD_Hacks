'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { InvoiceRow } from '@/lib/types';

export function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <form
      onSubmit={submit}
      className="ig-panel flex flex-wrap items-end gap-4 rounded-2xl p-5 text-white sm:p-6"
    >
      <div className="min-w-[12rem] flex-1">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ig-green)]">
          Check an invoice
        </p>
        <p className="mb-4 max-w-md text-sm text-white/55">
          Drop a PDF or image. We read it, fact-check the vendor on the public web, and score the risk.
        </p>
      </div>
      <label className="flex min-w-[10rem] flex-1 flex-col text-sm">
        <span className="mb-1.5 font-medium text-white/80">Invoice (PDF or image)</span>
        <input
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="text-sm text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
        />
      </label>
      <label className="flex min-w-[12rem] flex-1 flex-col text-sm">
        <span className="mb-1.5 font-medium text-white/80">Sender email (optional)</span>
        <input
          name="senderEmail"
          type="email"
          placeholder="billing@vendor.com"
          className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-white/35 focus:border-[var(--ig-green)] focus:outline-none"
        />
      </label>
      <button type="submit" disabled={busy} className="ig-btn rounded-full px-5 py-2.5 text-sm disabled:opacity-50">
        {busy ? 'Checking invoice…' : 'Check invoice'}
      </button>
      {busy && (
        <span className="w-full text-sm text-white/50">
          Reading, verifying the vendor and scoring. This takes up to 30 seconds.
        </span>
      )}
      {error && <span className="w-full text-sm text-red-400">{error}</span>}
    </form>
  );
}

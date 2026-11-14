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
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <label className="flex flex-col text-sm">
        <span className="mb-1 font-medium">Invoice (PDF or image)</span>
        <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="text-sm" />
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 font-medium">Sender email (optional)</span>
        <input name="senderEmail" type="email" placeholder="billing@vendor.com"
          className="rounded border px-2 py-1" />
      </label>
      <button type="submit" disabled={busy}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Checking invoice…' : 'Check invoice'}
      </button>
      {busy && <span className="text-sm text-gray-600">Reading, verifying the vendor and scoring. This takes up to 30 seconds.</span>}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </form>
  );
}

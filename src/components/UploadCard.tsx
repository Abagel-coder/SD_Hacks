'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { UploadProgress } from '@/components/UploadProgress';
import type { InvoiceRow } from '@/lib/types';

export function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
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
    setFinished(false);
    setError(null);
    try {
      const res = await fetch('/api/invoices', { method: 'POST', body: form });
      const json = (await res.json()) as { invoice?: InvoiceRow; error?: string };
      if (!res.ok || !json.invoice) throw new Error(json.error ?? 'Upload failed.');
      onUploaded();
      // Let the last step tick to done before leaving the page.
      setFinished(true);
      await new Promise((resolve) => setTimeout(resolve, 450));
      router.push(`/invoices/${json.invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-300 bg-background p-4 text-gray-900">
      <label className="flex flex-col text-sm text-gray-900">
        <span className="mb-1 font-medium text-gray-900">Invoice (PDF or image)</span>
        <input
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-gray-900"
        />
      </label>
      <label className="flex flex-col text-sm text-gray-900">
        <span className="mb-1 font-medium text-gray-900">Sender email (optional)</span>
        <input
          name="senderEmail"
          type="email"
          placeholder="billing@vendor.com"
          className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 placeholder:text-gray-500"
        />
      </label>
      <button type="submit" disabled={busy}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Checking invoice…' : 'Check invoice'}
      </button>
      {busy && <UploadProgress done={finished} />}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </form>
  );
}

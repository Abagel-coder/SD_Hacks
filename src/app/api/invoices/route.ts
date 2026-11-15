import { processInvoice } from '@/lib/pipeline';
import { rateLimited } from '@/lib/rate-limit';
import { listInvoices } from '@/lib/repo';
import { bodyTooLarge, checkUpload } from '@/lib/upload';

export const maxDuration = 60;

export async function GET() {
  return Response.json({ invoices: await listInvoices() });
}

export async function POST(req: Request) {
  const limited = rateLimited(req, 'upload') ?? bodyTooLarge(req);
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) {
    return Response.json({ error: 'Attach an invoice file.' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = checkUpload(file.size, bytes);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });
  const senderEmailRaw = form.get('senderEmail');
  const senderEmail = typeof senderEmailRaw === 'string' && senderEmailRaw.trim() ? senderEmailRaw.trim() : undefined;

  try {
    const invoice = await processInvoice({
      bytes,
      mimeType: check.mimeType,
      fileName: file.name,
      senderEmail,
    });
    return Response.json({ invoice }, { status: 201 });
  } catch (err) {
    console.error('processInvoice failed', err);
    return Response.json({ error: 'Could not read this invoice. Try again.' }, { status: 502 });
  }
}

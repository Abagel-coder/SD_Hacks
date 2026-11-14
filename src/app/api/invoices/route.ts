import { processInvoice } from '@/lib/pipeline';
import { listInvoices } from '@/lib/repo';

export const maxDuration = 60;

export async function GET() {
  return Response.json({ invoices: await listInvoices() });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Attach an invoice file.' }, { status: 400 });
  }
  const senderEmailRaw = form.get('senderEmail');
  const senderEmail = typeof senderEmailRaw === 'string' && senderEmailRaw.trim() ? senderEmailRaw.trim() : undefined;

  try {
    const invoice = await processInvoice({
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type || 'application/pdf',
      fileName: file.name,
      senderEmail,
    });
    return Response.json({ invoice }, { status: 201 });
  } catch (err) {
    console.error('processInvoice failed', err);
    return Response.json({ error: 'Could not read this invoice. Try again.' }, { status: 502 });
  }
}

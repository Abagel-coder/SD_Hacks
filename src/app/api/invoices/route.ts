import { listInvoices } from '@/lib/repo';

export async function GET() {
  return Response.json({ invoices: await listInvoices() });
}

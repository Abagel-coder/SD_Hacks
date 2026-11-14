import { getInvoiceDetail } from '@/lib/repo';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getInvoiceDetail(id);
  if (!detail) return Response.json({ error: 'Invoice not found' }, { status: 404 });
  return Response.json(detail);
}

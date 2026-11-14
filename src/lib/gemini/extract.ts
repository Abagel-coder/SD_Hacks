import { MOCK_EXTRACTED } from '../mocks';
import type { ExtractedInvoice } from '../types';

export async function extractInvoice(
  file: { bytes: Buffer; mimeType: string },
  senderEmail?: string,
): Promise<ExtractedInvoice> {
  void file;
  void senderEmail;
  return MOCK_EXTRACTED; // Lane 2 replaces this body in Task 2.1
}

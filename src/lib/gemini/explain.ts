import { MOCK_EXPLANATION } from '../mocks';
import type { ExtractedInvoice, RiskResult } from '../types';

export async function explainRisk(invoice: ExtractedInvoice, risk: RiskResult): Promise<string> {
  void invoice;
  void risk;
  return MOCK_EXPLANATION; // Lane 2 replaces this body in Task 2.2
}

import { MOCK_INTEL } from '../mocks';
import type { VendorIntel } from '../types';

export async function verifyVendor(
  vendorName: string,
  senderDomain: string | null,
  cached: VendorIntel | null,
): Promise<VendorIntel> {
  void vendorName;
  void cached;
  return { ...MOCK_INTEL, senderDomain }; // Lane 2 replaces this body in Task 2.5
}

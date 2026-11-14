import type { ExtractedInvoice, VendorIntel } from './types';

export const MOCK_EXTRACTED: ExtractedInvoice = {
  vendorName: 'Uline',
  invoiceNumber: 'ULI-2026-11',
  senderEmail: 'billing@u1ine.com',
  senderDomain: 'u1ine.com',
  amount: 4870.0,
  currency: 'USD',
  bankAccount: '000123456789',
  bankRouting: '110000000',
  dueDate: '2026-11-16',
  invoiceDate: '2026-11-14',
  urgencyPhrases: ['payment must be sent today to avoid service interruption'],
  secrecyPhrases: ['please do not call our office about this change'],
  phoneOnInvoice: '+15555550199',
};

export const MOCK_INTEL: VendorIntel = {
  available: true,
  senderDomain: 'u1ine.com',
  realDomain: 'uline.com',
  officialPhone: '+15555550100',
  publicEmail: 'customer.service@uline.com',
  senderDomainMatches: false,
  senderDomainAgeDays: 12,
  sources: ['https://www.uline.com/CustomerService/ContactUs'],
};

export const MOCK_EXPLANATION =
  'This invoice claims to be from Uline but was sent from u1ine.com, a lookalike of the real ' +
  'uline.com. It asks you to pay a bank account that does not match the one on file, for more ' +
  'than three times the usual amount, and pressures you to pay today without calling.';

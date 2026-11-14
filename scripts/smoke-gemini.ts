import { readFileSync } from 'node:fs';
import { extractInvoice } from '../src/lib/gemini/extract';

const path = process.argv[2];
if (!path) throw new Error('Usage: tsx --env-file=.env.local scripts/smoke-gemini.ts <invoice.pdf|png>');
const mimeType = path.endsWith('.pdf') ? 'application/pdf' : path.endsWith('.png') ? 'image/png' : 'image/jpeg';

extractInvoice({ bytes: readFileSync(path), mimeType }).then(
  (invoice) => console.log(JSON.stringify(invoice, null, 2)),
  (err) => { console.error(err); process.exit(1); },
);

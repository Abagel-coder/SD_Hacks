import { verifyVendor } from '../src/lib/brightdata/verify-vendor';

const [vendor, senderDomain] = process.argv.slice(2);
if (!vendor) throw new Error('Usage: tsx --env-file=.env.local scripts/smoke-brightdata.ts "<vendor>" [sender-domain]');

const started = Date.now();
verifyVendor(vendor, senderDomain ?? null, null).then(
  (intel) => console.log(JSON.stringify(intel, null, 2), `\n${Date.now() - started} ms`),
  (err) => { console.error(err); process.exit(1); },
);

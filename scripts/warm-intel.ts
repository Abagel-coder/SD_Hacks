// Warm the Bright Data intel cache after `npm run db:reset` so the first demo upload is fast.
// Usage: MOCK_GEMINI=0 MOCK_BRIGHTDATA=0 npx tsx --env-file=.env.local scripts/warm-intel.ts [--force]
import { warmVendorIntel } from '../src/lib/brightdata/warm';

const force = process.argv.includes('--force');

warmVendorIntel({ force }).then(
  (results) => {
    for (const r of results) {
      const detail = r.ok ? `${r.realDomain ?? '?'}  ${r.officialPhone ?? 'no phone'}` : `FAILED: ${r.error}`;
      console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.vendor.padEnd(10)} ${String(r.ms).padStart(6)} ms  ${detail}`);
    }
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      console.error(`${failed} vendor(s) not warmed. Uploads for them will do a live lookup (about 12 s).`);
      process.exit(1);
    }
    console.log('Intel cache warm.');
    process.exit(0);
  },
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

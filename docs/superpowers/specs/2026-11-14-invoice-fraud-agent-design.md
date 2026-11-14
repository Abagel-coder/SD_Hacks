# Invoice Fraud Agent for Small Businesses: Design

Date: 2026-11-14
Status: approved. Updated after API research on 2026-11-14 (see section 12).
Team: 4 people, all full-stack TypeScript. Budget: 12 to 24 hours, planned at 18.

## 1. What we are building

A finance agent that stops invoice fraud (fake bank-change requests) for small businesses.
An owner uploads an invoice. The agent reads it, checks it against the vendor's history and
the public web, scores the risk, and freezes risky payments. The owner clicks "Verify by
phone" and an AI voice agent calls the vendor's publicly verified number, never the number on
the invoice, and asks whether they requested the change. The payment is approved or blocked
based on the call.

**Demo:** a flagged invoice is frozen, a teammate's phone rings, they say "we never changed
banks," and the payment flips to blocked live on the dashboard.

**Tracks:** Bright Data (Data for Good), ElevenLabs, Neon, MLH Gemini, Best Overall.

## 2. Scope

In:

- Invoice upload (PDF or image) on the dashboard
- Gemini extraction to JSON and a plain-English risk explanation
- Bright Data vendor verification: real website, phone, contact email, domain match, domain age
- Risk engine in our own code: 0 to 100 score plus reasons
- Freeze on high risk
- Verification call through ElevenLabs Agents and Twilio, with a browser-call fallback
- Decision logic: approve and save new bank details, or block, blocklist and alert
- Neon tables: vendors, invoices, calls, audit_log, blocklist
- Dashboard: invoice list, status badges, risk reasons, verify button, live call status,
  transcript, audit log, owner alert

Out (do not build):

- pgvector scam-similarity search
- Mastra
- Email inbox intake
- Real payment rails (payment status is a column in Neon)
- Login, multi-business tenancy

## 3. Architecture

One Next.js App Router app in TypeScript, deployed on Vercel. Neon Postgres is the only
state. The pipeline is plain functions called from route handlers. The dashboard polls.

```
Upload ──> POST /api/invoices
             1. extractInvoice()      Gemini          (lane 2)
             2. match vendor in Neon                  (lane 1)
             3. verifyVendor()        Bright Data     (lane 2, cached in vendors.intel)
             4. scoreInvoice()        pure code       (lane 1)
             5. explainRisk()         Gemini          (lane 2)
             6. status = frozen | approved, audit_log rows written
Dashboard ──> POST /api/invoices/:id/verify
             startVerificationCall()  ElevenLabs + Twilio   (lane 3)
ElevenLabs ──> POST /api/webhooks/elevenlabs
             classifyOutcome() -> applyDecision()           (lanes 3 + 1)
Dashboard <── GET /api/invoices, GET /api/invoices/:id  (poll every 1.5 s)
```

### Status machine

| From | Event | To |
|---|---|---|
| pending | score < 50 and no hard flag | approved |
| pending | score >= 50, or bank details changed, or blocklist hit | frozen |
| frozen | owner clicks Verify by phone | verifying |
| verifying | outcome confirmed | approved (new bank details saved to vendor) |
| verifying | outcome denied or unclear | blocked (bank account and sender domain blocklisted, alert shown) |
| verifying | call failed or no answer | frozen (retry allowed) |

The voice agent reports what it heard. Our code makes the decision.

## 4. Data model (Neon)

```sql
vendors(
  id uuid pk, name text, normalized_name text unique,
  real_domain text, verified_phone text, public_email text,
  bank_account text, bank_routing text,
  amount_min numeric, amount_max numeric,
  intel jsonb, intel_fetched_at timestamptz, created_at timestamptz)

invoices(
  id uuid pk, vendor_id uuid null -> vendors, file_name text,
  extracted jsonb, intel jsonb, vendor_name text, invoice_number text,
  sender_email text, sender_domain text,
  amount numeric, currency text, bank_account text, bank_routing text,
  due_date date, invoice_date date,
  risk_score int, risk_reasons jsonb, explanation text,
  status text check in (pending, frozen, verifying, approved, blocked),
  created_at timestamptz, updated_at timestamptz)

calls(
  id uuid pk, invoice_id uuid -> invoices,
  channel text check in (phone, browser),
  number_found text, number_dialed text, conversation_id text,
  status text check in (initiated, in_progress, completed, failed),
  outcome text null check in (confirmed, denied, unclear),
  challenge_question text, challenge_answer text,
  transcript jsonb, started_at timestamptz, ended_at timestamptz)

audit_log(
  id bigserial pk, invoice_id uuid null, actor text check in (agent, owner, system),
  action text, input jsonb, result jsonb, reason text, created_at timestamptz)

blocklist(
  id uuid pk, kind text check in (bank_account, domain, phone),
  value text, reason text, source_invoice_id uuid, created_at timestamptz,
  unique(kind, value))
```

Vendor history is the vendor's past `approved` invoices in the `invoices` table. The seed
loads three vendors with six months of history each.

## 5. Shared contracts

All four lanes build against these. They live in `src/lib/types.ts` and are committed in the
first hour, together with mock implementations.

```ts
type InvoiceStatus = 'pending' | 'frozen' | 'verifying' | 'approved' | 'blocked';
type CallOutcome = 'confirmed' | 'denied' | 'unclear';

interface ExtractedInvoice {
  vendorName: string; invoiceNumber: string | null;
  senderEmail: string | null; senderDomain: string | null;
  amount: number; currency: string;
  bankAccount: string | null; bankRouting: string | null;
  dueDate: string | null; invoiceDate: string | null;      // ISO dates
  urgencyPhrases: string[]; secrecyPhrases: string[];
  phoneOnInvoice: string | null;
}

interface VendorIntel {
  available: boolean;                 // false when Bright Data failed
  senderDomain: string | null;        // the sender domain this result was computed for
  realDomain: string | null; officialPhone: string | null; publicEmail: string | null;
  senderDomainMatches: boolean | null;
  senderDomainAgeDays: number | null;
  sources: string[];                  // URLs used
}

interface RiskReason { code: RiskCode; points: number; detail: string; }
interface RiskResult { score: number; reasons: RiskReason[]; freeze: boolean; }

// lane 2
extractInvoice(file: { bytes: Buffer; mimeType: string }, senderEmail?: string): Promise<ExtractedInvoice>
explainRisk(invoice: ExtractedInvoice, risk: RiskResult): Promise<string>
verifyVendor(vendorName: string, senderDomain: string | null, cached: VendorIntel | null): Promise<VendorIntel>
// lane 1
scoreInvoice(input: { invoice: ExtractedInvoice; vendor: VendorRow | null;
                      intel: VendorIntel; blocklistHits: BlocklistHit[] }): RiskResult
applyDecision(invoiceId: string, callId: string, outcome: CallOutcome | 'failed'): Promise<void>
// lane 3
startVerificationCall(invoiceId: string, channel?: 'phone' | 'browser'): Promise<{ callId: string; channel: 'phone' | 'browser' }>
classifyOutcome(report: CallReport): CallOutcome
```

### API routes

| Route | Owner | Purpose |
|---|---|---|
| POST /api/invoices | lane 1 | multipart upload, runs the pipeline, returns the invoice |
| GET /api/invoices | lane 1 | list for the dashboard |
| GET /api/invoices/:id | lane 1 | invoice plus latest call plus audit log |
| POST /api/invoices/:id/verify | lane 3 | starts the phone call |
| POST /api/webhooks/elevenlabs | lane 3 | post-call webhook |
| GET /api/calls/:id/browser-session | lane 3 | credentials and variables for the browser fallback |
| POST /api/calls/:id/sync | lane 3 | polled by the dashboard while verifying: live call status, and completes the call if the webhook is late |

## 6. Risk engine

Pure function, no I/O, unit tested.

| Code | Condition | Points |
|---|---|---|
| BLOCKLIST_HIT | bank account or sender domain is on the blocklist | score set to 100, freeze |
| BANK_CHANGED | known vendor and bank account or routing differs from file | 40, freeze |
| LOOKALIKE_DOMAIN | sender domain is edit distance 1 or 2 from the vendor's real domain | 30 |
| DOMAIN_MISMATCH | sender domain differs from the real domain and is not a lookalike | 20 |
| NEW_DOMAIN | sender domain age under 90 days | 20 |
| AMOUNT_ANOMALY | amount over 1.5 times the vendor's normal maximum | 20 |
| URGENCY_OR_SECRECY | any urgency or secrecy phrase extracted | 15 |
| UNKNOWN_VENDOR | no vendor history in Neon | 10 |

Score is the sum, capped at 100. `freeze` is true when the score is 50 or more or a rule
marked "freeze" fires. LOOKALIKE_DOMAIN and DOMAIN_MISMATCH are mutually exclusive.
The real domain comes from `vendors.real_domain` when known, otherwise from Bright Data.

## 7. Verification call

- The agent is one ElevenLabs agent configured once. Each call passes dynamic variables:
  business name, vendor name, last four digits of the new bank account, the challenge
  question, and the invoice id.
- The challenge question is built from Neon history, for example "What was the total on your
  September invoice to us?" The expected answer is held by our server, not given to the
  agent, so a caller cannot talk the agent into revealing it.
- The agent collects two facts: did they confirm requesting the bank change (yes, no,
  unclear) and what amount they gave for the challenge.
- `classifyOutcome`: `confirmed` only when the bank change is confirmed and the stated
  amount is within 1 percent of the expected amount. A vendor with no history has no
  challenge question, and a clear yes alone confirms. `denied` when they say they did not
  request it. Everything else is `unclear`.
- **Call safety:** `startVerificationCall` refuses to dial any number not in the
  `ALLOWED_CALL_NUMBERS` env list. `calls.number_found` stores the number Bright Data found
  and `calls.number_dialed` stores the number actually dialled. The dashboard shows both and
  labels the difference "demo redirect". This prevents the agent from calling a real business.
- **Fallback:** if Twilio is not working, the same agent runs in the browser through the
  ElevenLabs web SDK with the same variables. The same post-call webhook and the
  `/api/calls/:id/sync` poll complete it through `classifyOutcome` and `applyDecision`.
  Lane 3 builds this path first because it needs no Twilio account.

## 8. Error handling

| Failure | Behaviour |
|---|---|
| Gemini extraction fails | upload returns an error, nothing is saved, the user retries |
| Gemini explanation fails | explanation is built from the reason list in code |
| Bright Data fails or times out (25 s) | `intel.available = false`, no points added, audit row records it |
| Call cannot start or is not answered | invoice returns to `frozen`, the call row is `failed`, retry is offered |
| Webhook signature invalid | 401, nothing changes |
| Webhook arrives twice | second delivery is ignored (call already `completed`) |

Every integration has a mock flag (`MOCK_GEMINI`, `MOCK_BRIGHTDATA`, `MOCK_CALL`). With the
flag set, the function returns a canned result. These are the development stubs and the
on-stage safety net.

Every pipeline step writes an `audit_log` row with its input, result and reason.

## 9. Lanes

| Lane | Owns |
|---|---|
| 1. Platform and risk | scaffold, schema, seed, types, mocks, risk engine, pipeline route, read routes, decision logic, audit log, deploy |
| 2. Intelligence | Gemini extraction and explanation, Bright Data lookup, domain match, domain age, intel cache |
| 3. Voice | ElevenLabs agent, Twilio, verify route, webhook, outcome classification, browser fallback |
| 4. Dashboard and demo | all UI, sample invoice files, demo script, backup video, submission text |

Each lane owns its own files. Shared files (`types.ts`, `schema.sql`) change only by
agreement in the team chat.

## 10. Testing

- Unit tests (Vitest): risk engine, lookalike detection, `classifyOutcome`, challenge-question
  builder.
- One smoke script per integration: Gemini on a sample PDF, Bright Data on a real vendor
  name, one test call.
- Rehearsal checklist run at least three times before judging, once with every mock flag on.

## 11. Schedule (18 hours)

| Hours | Milestone |
|---|---|
| 0 to 1 | Kickoff together: scaffold, schema, types, mocks, env vars, deploy an empty app |
| 1 to 8 | Lanes build in parallel against mocks |
| 8 | Checkpoint 1: real upload reaches `frozen` on the deployed app |
| 8 to 12 | Call loop, webhook, decision, live dashboard |
| 12 | Checkpoint 2: full demo works end to end once |
| 12 to 15 | Fallbacks, polish, edge cases |
| 15 | Feature freeze |
| 15 to 18 | Rehearse, record backup video, write the submission |

## 12. Changes after API research (2026-11-14)

- **Twilio needs a paid account.** Twilio's trial docs say trial numbers are shared and the
  `<Stream>` verb is blocked, so the ElevenLabs phone call needs an upgraded account and one
  purchased number. Without it, the browser call is the demo.
- **Database reset is a script, not a route.** `npm run db:reset` replaces
  `POST /api/demo/reset`, so nobody can wipe the demo database from a public URL.
- **`invoices.intel` added** so the dashboard can show the public-web check for vendors that
  have no row in `vendors`. `vendors.intel` remains the cache.
- **Amounts are `double precision` and dates are `text` (YYYY-MM-DD)** so the driver returns
  plain numbers and strings.
- **Domain age comes from RDAP** fetched through Bright Data Web Unlocker; Bright Data's API
  catalog has no WHOIS dataset.
- **Call completion has two paths:** the ElevenLabs post-call webhook, and a sync poll of the
  conversation API. Either can finish a call; a compare-and-set makes the second a no-op.
- **Gemini fallback for the call report:** if ElevenLabs' data collection fields are missing,
  Gemini reads the transcript to produce the same two facts.


# Demo script (about 3 minutes)

Roles: Presenter (talks, drives the laptop), Vendor (answers the **browser** verification call
into the laptop microphone), Operator (second laptop, ready with the fallbacks below).

The team is **not using Twilio**. Live verification is the ElevenLabs browser call
(`CALL_CHANNEL=browser`). Mock mode (`MOCK_CALL=1`) still flips the badge without a real call.

## Before going on

1. `npm run db:reset`
2. Warm the Bright Data intel cache (live only; refuses mock flags):
   `MOCK_GEMINI=0 MOCK_BRIGHTDATA=0 npx tsx --env-file=.env.local scripts/warm-intel.ts`
3. Open the production URL. Confirm 18 approved invoices.
4. Laptop mic ready; allow microphone access when the browser asks. Vendor sits next to the laptop.
5. `samples/legit-uline.pdf` and `samples/scam-uline.pdf` are on the desktop.
6. The backup video is open in a tab.

## Script

1. **The problem (20 s).** "A small business gets an email from a real supplier: our bank details
   have changed, please pay the new account. It is a scammer. The money is gone. Nobody at a
   ten-person company has time to check every invoice." (If you quote a loss figure, take it from
   the latest FBI IC3 report and say the year.)
2. **A normal invoice (20 s).** Upload `legit-uline.pdf`, sender `billing@uline.com`.
   "Gemini reads it. It matches Uline's history in Neon. Risk zero. Approved."
3. **The scam (45 s).** Upload `scam-uline.pdf`, sender `billing@u1ine.com`.
   "Same supplier name. Our risk engine, which is our own code and not an LLM, compares it with
   Uline's history: new bank account, three times the normal amount, pressure to pay today.
   Bright Data checked the public web live: Uline's real site is uline.com, and this came from
   u1ine.com with a number one. Score 100. The payment is frozen." Point at the Gemini explanation.
4. **The call (60 s).** "Now the agent verifies, using the phone number Bright Data found on
   Uline's real website, never the number on the invoice — here as a live browser call through
   ElevenLabs." Click **Verify in browser** (or **Verify by phone** if `MOCK_CALL=1` for the
   mock path). Allow the mic. Vendor answers into the laptop: "Accounts receivable." Agent asks
   about the bank change. Vendor: **"No. We never changed banks."**
   Stay silent and let the audience watch the badge flip to **Blocked**.
5. **The result (30 s).** Show the transcript and the audit log. "Every step the agent took is in
   Neon with its inputs and its reason. The scammer's account and domain are now on a shared
   blocklist." Upload the scam invoice again: "Caught instantly, for every business."
6. **Close (15 s).** "Gemini reads, Bright Data fact-checks, our code decides, ElevenLabs calls,
   Neon remembers. If the vendor had said yes, it would have asked them the amount of their
   September invoice, which only the real vendor knows."

## If something breaks

| Problem | Do this |
|---|---|
| Browser call does not connect within 10 seconds | Wait for Frozen, click **Verify in browser** again, re-allow the mic; Vendor answers into the laptop microphone |
| Browser call still fails | Operator switches the projector to the second laptop, which runs locally with `MOCK_CALL=1` |
| Upload hangs past 40 seconds | Reload and upload again; Operator sets `MOCK_BRIGHTDATA=1` on the local fallback |
| Venue wifi is down | Play the backup video |

## Rehearsal checklist (run three times; once with every `MOCK_*` flag set to 1)

- [ ] Legit invoice: approved, risk 0
- [ ] Scam invoice: frozen, risk 70 or more, at least three reasons, explanation shown
- [ ] Public web check shows uline.com and "No" for the sender match
- [ ] Browser call connects (or mock path completes) within 10 seconds of the click
- [ ] "We never changed banks" gives Blocked within 20 seconds of hanging up
- [ ] Transcript and audit log are visible
- [ ] Re-uploading the scam shows a blocklist reason
- [ ] After `npm run db:reset`, the confirmed path works: say "yes", then "one thousand two hundred
      eighty-four dollars and fifty cents"; the invoice becomes Approved
- [ ] The whole run fits in 3 minutes

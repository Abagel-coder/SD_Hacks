# Invoice Fraud Agent: Video Speaking Points (3 min)

## 1. The problem (0:00–0:20)
- Scammers pose as a real supplier and email: "our bank details changed, pay this new account."
- Once you pay, the money is gone.
- Small businesses have no fraud team to catch it.

## 2. Normal invoice (0:20–0:40)
*Upload `legit-uline.pdf`*
- Our app is built with **Next.js** and hosted on **Vercel**.
- **Google Gemini** reads the invoice PDF: vendor, amount, bank account.
- **Neon Postgres** holds the vendor's payment history; everything matches.
- Risk 0, approved automatically.

## 3. Scam invoice (0:40–1:20)
*Upload `scam-uline.pdf` from `billing@u1ine.com`*
- Our own **TypeScript risk engine** (not an AI) makes the decision, so it's predictable.
- It spots a new bank account, 3× the normal amount, and "pay today" pressure.
- **Bright Data** checks the web live: the real site is uline.com, but this came from u1ine.com.
- **Gemini** explains the warning signs in plain English.
- Risk 100, payment frozen.

## 4. The verification call (1:20–2:15)
*Click Verify in browser → Start browser call*
- An **ElevenLabs** AI voice agent calls the vendor.
- It uses the number Bright Data found on the real website, never the one on the invoice.
- *(Stay quiet; let the call play. The vendor says: "No, we never changed banks.")*
- ElevenLabs sends the result back to our app, and it's blocked automatically.

## 5. The result (2:15–2:35)
*Show transcript and audit log; re-upload the scam*
- The full call transcript is saved.
- Every step is logged in **Neon** with the reason.
- The scammer goes on a blocklist, so a second try is caught instantly.

## 6. Wrap-up (2:35–3:00)
- **Gemini** reads, **Bright Data** fact-checks, our code decides, **ElevenLabs** calls, **Neon** remembers.
- If the vendor had said yes, the agent asks for a past invoice amount that only the real vendor knows.
- Invoice Fraud Agent: every bank change gets a phone call.

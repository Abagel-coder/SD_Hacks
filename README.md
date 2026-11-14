# Invoice Fraud Agent

Finance agent for small businesses: reads invoices, scores fraud risk, freezes risky
payments and phones the vendor to verify bank changes.

## Run locally

1. `cp .env.example .env.local` and fill in the values from the team chat.
2. `npm install`
3. `npm run db:reset` (drops, creates and seeds the Neon database)
4. `npm run dev` and open http://localhost:3000
5. `npm test`

Plan: `docs/superpowers/plans/2026-11-14-invoice-fraud-agent.md`

export const DROP_STATEMENTS: string[] = [
  'drop table if exists invoice_embeddings, gemini_cache, blocklist, audit_log, calls, invoices, vendors cascade',
];

/**
 * P1: similar-scam detection. Idempotent, so `npm run db:migrate` can apply it to the live shared DB
 * without a reset. Embeddings live in their own table so `select * from invoices` stays small.
 */
export const PGVECTOR_STATEMENTS: string[] = [
  'create extension if not exists vector',
  `create table if not exists invoice_embeddings (
    invoice_id uuid primary key references invoices(id) on delete cascade,
    embedding vector(768) not null,
    created_at timestamptz not null default now()
  )`,
  'alter table invoices add column if not exists similar_scam jsonb',
];

export const SCHEMA_STATEMENTS: string[] = [
  `create table vendors (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    normalized_name text not null unique,
    real_domain text,
    verified_phone text,
    public_email text,
    bank_account text,
    bank_routing text,
    amount_min double precision,
    amount_max double precision,
    intel jsonb,
    intel_fetched_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create table invoices (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid references vendors(id),
    file_name text,
    extracted jsonb,
    intel jsonb,
    vendor_name text not null,
    invoice_number text,
    sender_email text,
    sender_domain text,
    amount double precision not null,
    currency text not null default 'USD',
    bank_account text,
    bank_routing text,
    due_date text,
    invoice_date text,
    risk_score int,
    risk_reasons jsonb,
    explanation text,
    status text not null default 'pending'
      check (status in ('pending','frozen','verifying','approved','blocked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table calls (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references invoices(id),
    channel text not null check (channel in ('phone','browser')),
    number_found text,
    number_dialed text,
    conversation_id text,
    status text not null default 'initiated'
      check (status in ('initiated','in_progress','completed','failed')),
    outcome text check (outcome in ('confirmed','denied','unclear')),
    challenge_question text,
    challenge_answer text,
    transcript jsonb,
    started_at timestamptz not null default now(),
    ended_at timestamptz
  )`,
  `create table audit_log (
    id bigserial primary key,
    invoice_id uuid,
    actor text not null check (actor in ('agent','owner','system')),
    action text not null,
    input jsonb,
    result jsonb,
    reason text,
    created_at timestamptz not null default now()
  )`,
  `create table blocklist (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('bank_account','domain','phone')),
    value text not null,
    reason text,
    source_invoice_id uuid,
    created_at timestamptz not null default now(),
    unique (kind, value)
  )`,
  // P2: Gemini results keyed by content hash, so re-uploading the same file makes no Gemini call.
  `create table if not exists gemini_cache (
    key text primary key,
    kind text not null check (kind in ('extract','explain')),
    result jsonb not null,
    created_at timestamptz not null default now()
  )`,
  ...PGVECTOR_STATEMENTS,
];

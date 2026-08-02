-- Fantasy Chey Chey
-- Migration 003: Sync audit
-- Sync history is server-only and must never expose secrets or raw credentials.

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  scope text not null,
  idempotency_key text not null unique,
  status text not null
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_upserted integer not null default 0 check (records_upserted >= 0),
  error_message text,
  created_at timestamptz not null default now()
);
create index sync_runs_source_started_idx
  on public.sync_runs (source_name, started_at desc);
alter table public.sync_runs enable row level security;
grant all on public.sync_runs to service_role;

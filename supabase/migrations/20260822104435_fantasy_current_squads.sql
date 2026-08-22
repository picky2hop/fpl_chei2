create table public.fantasy_entry_current_squads (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  fpl_entry_id bigint not null check (fpl_entry_id > 0),
  gameweek_id uuid not null references public.gameweeks (id),
  gameweek_number integer not null check (gameweek_number > 0),
  squad jsonb not null check (jsonb_typeof(squad) = 'object'),
  source_synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, fpl_entry_id)
);

create index fantasy_current_squads_gameweek_idx
  on public.fantasy_entry_current_squads (season_id, gameweek_id, fpl_entry_id);

alter table public.fantasy_entry_current_squads enable row level security;

revoke all on table public.fantasy_entry_current_squads from anon, authenticated;
grant all on table public.fantasy_entry_current_squads to service_role;

create policy "Fantasy current squads are server only"
  on public.fantasy_entry_current_squads
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Fantasy Chey Chey
-- Migration 001: Identity and Competition Core
-- Source of truth for fixture data: Fantasy Premier League Official API.

create extension if not exists pgcrypto;
create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  line_user_id text not null unique,
  display_name text not null,
  avatar_url text,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  role text not null default 'player'
    check (role in ('player', 'admin')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  external_season_id bigint unique,
  name text not null,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.gameweeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  external_gameweek_id bigint not null,
  number smallint not null check (number > 0),
  name text,
  status text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, number),
  unique (season_id, external_gameweek_id)
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  external_team_id bigint not null unique,
  name text not null,
  short_name text,
  code text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  external_fixture_id bigint not null unique,
  season_id uuid not null references public.seasons (id),
  gameweek_id uuid references public.gameweeks (id),
  home_team_id uuid not null references public.teams (id),
  away_team_id uuid not null references public.teams (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create table public.fixture_source_records (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null unique references public.fixtures (id),
  source_name text not null default 'fpl_api'
    check (source_name = 'fpl_api'),
  kickoff_at timestamptz,
  status text not null,
  home_score smallint check (home_score is null or home_score >= 0),
  away_score smallint check (away_score is null or away_score >= 0),
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index seasons_one_current_idx
  on public.seasons (is_current)
  where is_current = true;
create unique index gameweeks_one_current_per_season_idx
  on public.gameweeks (season_id)
  where is_current = true;
create index gameweeks_season_id_idx
  on public.gameweeks (season_id);
create index fixtures_season_gameweek_idx
  on public.fixtures (season_id, gameweek_id);
create index fixtures_home_team_id_idx
  on public.fixtures (home_team_id);
create index fixtures_away_team_id_idx
  on public.fixtures (away_team_id);
alter table public.app_users enable row level security;
alter table public.seasons enable row level security;
alter table public.gameweeks enable row level security;
alter table public.teams enable row level security;
alter table public.fixtures enable row level security;
alter table public.fixture_source_records enable row level security;
grant select on public.app_users to authenticated;
grant select on public.seasons to authenticated;
grant select on public.gameweeks to authenticated;
grant select on public.teams to authenticated;
grant select on public.fixtures to authenticated;
grant all on public.app_users to service_role;
grant all on public.seasons to service_role;
grant all on public.gameweeks to service_role;
grant all on public.teams to service_role;
grant all on public.fixtures to service_role;
grant all on public.fixture_source_records to service_role;
create policy "Authenticated users can read active users"
  on public.app_users
  for select
  to authenticated
  using (status = 'active');
create policy "Authenticated users can read seasons"
  on public.seasons
  for select
  to authenticated
  using (true);
create policy "Authenticated users can read gameweeks"
  on public.gameweeks
  for select
  to authenticated
  using (true);
create policy "Authenticated users can read teams"
  on public.teams
  for select
  to authenticated
  using (true);
create policy "Authenticated users can read fixtures"
  on public.fixtures
  for select
  to authenticated
  using (true);
-- Source records contain API payload data and are server-only.;

create table public.fantasy_leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  fpl_league_id bigint not null check (fpl_league_id > 0),
  official_name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  last_synced_at timestamptz,
  last_sync_status text not null default 'never'
    check (last_sync_status in ('never', 'succeeded', 'failed')),
  last_error_message text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, fpl_league_id),
  check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create table public.fantasy_league_membership_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  league_id uuid not null references public.fantasy_leagues (id),
  gameweek_id uuid not null references public.gameweeks (id),
  fpl_entry_id bigint not null check (fpl_entry_id > 0),
  fpl_team_name text not null,
  fpl_manager_name text not null,
  source_synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, league_id, gameweek_id, fpl_entry_id)
);

create table public.fantasy_entry_gameweek_scores (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  gameweek_id uuid not null references public.gameweeks (id),
  fpl_entry_id bigint not null check (fpl_entry_id > 0),
  fpl_team_name text not null,
  fpl_manager_name text not null,
  points integer not null,
  event_transfers integer not null default 0 check (event_transfers >= 0),
  event_transfers_cost integer not null default 0 check (event_transfers_cost >= 0),
  points_on_bench integer not null default 0,
  source_synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, gameweek_id, fpl_entry_id)
);

create table public.fantasy_league_awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  league_id uuid not null references public.fantasy_leagues (id),
  gameweek_id uuid not null references public.gameweeks (id),
  fpl_entry_id bigint not null check (fpl_entry_id > 0),
  award text not null check (award in ('champion', 'wooden_spoon')),
  selected_by uuid not null references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, league_id, gameweek_id, fpl_entry_id, award)
);

create index fantasy_leagues_season_status_idx
  on public.fantasy_leagues (season_id, status, updated_at desc);

create index fantasy_membership_league_gameweek_idx
  on public.fantasy_league_membership_snapshots (season_id, league_id, gameweek_id, fpl_entry_id);

create index fantasy_membership_entry_idx
  on public.fantasy_league_membership_snapshots (season_id, fpl_entry_id, gameweek_id);

create index fantasy_entry_scores_gameweek_points_idx
  on public.fantasy_entry_gameweek_scores (season_id, gameweek_id, points desc);

create index fantasy_entry_scores_entry_idx
  on public.fantasy_entry_gameweek_scores (season_id, fpl_entry_id, gameweek_id);

create index fantasy_league_awards_lookup_idx
  on public.fantasy_league_awards (season_id, league_id, gameweek_id, award);

create index fantasy_league_awards_gameweek_idx
  on public.fantasy_league_awards (gameweek_id);

create index fantasy_league_awards_entry_idx
  on public.fantasy_league_awards (fpl_entry_id);

alter table public.fantasy_leagues enable row level security;
alter table public.fantasy_league_membership_snapshots enable row level security;
alter table public.fantasy_entry_gameweek_scores enable row level security;
alter table public.fantasy_league_awards enable row level security;

revoke all on table public.fantasy_leagues from anon, authenticated;
revoke all on table public.fantasy_league_membership_snapshots from anon, authenticated;
revoke all on table public.fantasy_entry_gameweek_scores from anon, authenticated;
revoke all on table public.fantasy_league_awards from anon, authenticated;

grant all on table public.fantasy_leagues to service_role;
grant all on table public.fantasy_league_membership_snapshots to service_role;
grant all on table public.fantasy_entry_gameweek_scores to service_role;
grant all on table public.fantasy_league_awards to service_role;

create policy "Fantasy leagues are server only"
  on public.fantasy_leagues
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Fantasy league membership is server only"
  on public.fantasy_league_membership_snapshots
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Fantasy entry scores are server only"
  on public.fantasy_entry_gameweek_scores
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Fantasy league awards are server only"
  on public.fantasy_league_awards
  for all
  to anon, authenticated
  using (false)
  with check (false);

insert into public.fantasy_leagues (season_id, fpl_league_id, official_name)
select season.id, source.fpl_league_id, source.bootstrap_name
from public.seasons as season
cross join (values
  (819498::bigint, 'เชยเชย Cup'::text),
  (819502::bigint, 'เขาค้อ inLove'::text)
) as source(fpl_league_id, bootstrap_name)
where season.status = 'active'
on conflict (season_id, fpl_league_id) do nothing;

create or replace function public.apply_fantasy_league_sync(
  p_job_run_id uuid,
  p_synced_at timestamptz,
  p_leagues jsonb,
  p_memberships jsonb,
  p_scores jsonb,
  p_players jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_leagues_count integer;
  v_memberships_count integer;
  v_scores_count integer;
  v_players_count integer;
  v_result jsonb;
begin
  if jsonb_typeof(p_leagues) <> 'array'
    or jsonb_typeof(p_memberships) <> 'array'
    or jsonb_typeof(p_scores) <> 'array'
    or jsonb_typeof(p_players) <> 'array'
  then
    raise exception using errcode = '22023', message = 'invalid fantasy league sync snapshot shape';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fantasy-league-sync', 0));

  insert into public.fantasy_leagues (
    id,
    season_id,
    fpl_league_id,
    official_name,
    status,
    last_synced_at,
    last_sync_status,
    last_error_message,
    archived_at,
    updated_at
  )
  select
    item.id,
    item.season_id,
    item.fpl_league_id,
    item.official_name,
    item.status,
    p_synced_at,
    'succeeded',
    null,
    item.archived_at,
    p_synced_at
  from jsonb_to_recordset(p_leagues) as item(
    id uuid,
    season_id uuid,
    fpl_league_id bigint,
    official_name text,
    status text,
    archived_at timestamptz
  )
  on conflict (id) do update
  set official_name = excluded.official_name,
      status = excluded.status,
      last_synced_at = excluded.last_synced_at,
      last_sync_status = excluded.last_sync_status,
      last_error_message = excluded.last_error_message,
      archived_at = excluded.archived_at,
      updated_at = excluded.updated_at;

  insert into public.fantasy_league_membership_snapshots (
    season_id,
    league_id,
    gameweek_id,
    fpl_entry_id,
    fpl_team_name,
    fpl_manager_name,
    source_synced_at,
    updated_at
  )
  select
    item.season_id,
    item.league_id,
    item.gameweek_id,
    item.fpl_entry_id,
    item.fpl_team_name,
    item.fpl_manager_name,
    p_synced_at,
    p_synced_at
  from jsonb_to_recordset(p_memberships) as item(
    season_id uuid,
    league_id uuid,
    gameweek_id uuid,
    fpl_entry_id bigint,
    fpl_team_name text,
    fpl_manager_name text
  )
  on conflict (season_id, league_id, gameweek_id, fpl_entry_id) do update
  set fpl_team_name = excluded.fpl_team_name,
      fpl_manager_name = excluded.fpl_manager_name,
      source_synced_at = excluded.source_synced_at,
      updated_at = excluded.updated_at;

  insert into public.fantasy_entry_gameweek_scores (
    season_id,
    gameweek_id,
    fpl_entry_id,
    fpl_team_name,
    fpl_manager_name,
    points,
    event_transfers,
    event_transfers_cost,
    points_on_bench,
    source_synced_at,
    updated_at
  )
  select
    item.season_id,
    item.gameweek_id,
    item.fpl_entry_id,
    item.fpl_team_name,
    item.fpl_manager_name,
    item.points,
    item.event_transfers,
    item.event_transfers_cost,
    item.points_on_bench,
    p_synced_at,
    p_synced_at
  from jsonb_to_recordset(p_scores) as item(
    season_id uuid,
    gameweek_id uuid,
    fpl_entry_id bigint,
    fpl_team_name text,
    fpl_manager_name text,
    points integer,
    event_transfers integer,
    event_transfers_cost integer,
    points_on_bench integer
  )
  on conflict (season_id, gameweek_id, fpl_entry_id) do update
  set fpl_team_name = excluded.fpl_team_name,
      fpl_manager_name = excluded.fpl_manager_name,
      points = excluded.points,
      event_transfers = excluded.event_transfers,
      event_transfers_cost = excluded.event_transfers_cost,
      points_on_bench = excluded.points_on_bench,
      source_synced_at = excluded.source_synced_at,
      updated_at = excluded.updated_at;

  insert into public.fantasy_player_gameweek_stats (
    season_id,
    gameweek_id,
    fpl_player_id,
    player_name,
    position,
    club_id,
    club_name,
    status,
    selected_by_percent,
    transfers_in_event,
    transfers_out_event,
    form,
    is_global_captain,
    is_global_vice_captain,
    source_synced_at,
    updated_at
  )
  select
    item.season_id,
    item.gameweek_id,
    item.fpl_player_id,
    item.player_name,
    item.position,
    item.club_id,
    item.club_name,
    item.status,
    item.selected_by_percent,
    item.transfers_in_event,
    item.transfers_out_event,
    item.form,
    item.is_global_captain,
    item.is_global_vice_captain,
    p_synced_at,
    p_synced_at
  from jsonb_to_recordset(p_players) as item(
    season_id uuid,
    gameweek_id uuid,
    fpl_player_id bigint,
    player_name text,
    position text,
    club_id bigint,
    club_name text,
    status text,
    selected_by_percent numeric,
    transfers_in_event integer,
    transfers_out_event integer,
    form numeric,
    is_global_captain boolean,
    is_global_vice_captain boolean
  )
  on conflict (season_id, gameweek_id, fpl_player_id) do update
  set player_name = excluded.player_name,
      position = excluded.position,
      club_id = excluded.club_id,
      club_name = excluded.club_name,
      status = excluded.status,
      selected_by_percent = excluded.selected_by_percent,
      transfers_in_event = excluded.transfers_in_event,
      transfers_out_event = excluded.transfers_out_event,
      form = excluded.form,
      is_global_captain = excluded.is_global_captain,
      is_global_vice_captain = excluded.is_global_vice_captain,
      source_synced_at = excluded.source_synced_at,
      updated_at = excluded.updated_at;

  v_leagues_count := jsonb_array_length(p_leagues);
  v_memberships_count := jsonb_array_length(p_memberships);
  v_scores_count := jsonb_array_length(p_scores);
  v_players_count := jsonb_array_length(p_players);
  v_result := jsonb_build_object(
    'jobRunId', p_job_run_id,
    'leaguesUpserted', v_leagues_count,
    'membershipsUpserted', v_memberships_count,
    'scoresUpserted', v_scores_count,
    'playersUpserted', v_players_count
  );

  update public.job_runs
  set status = 'succeeded',
      finished_at = clock_timestamp(),
      records_upserted = v_memberships_count + v_scores_count + v_players_count,
      error_message = null,
      error_code = null,
      details = jsonb_build_object('result', v_result)
  where id = p_job_run_id and status = 'running';

  return v_result;
end;
$$;

revoke all on function public.apply_fantasy_league_sync(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_fantasy_league_sync(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)
  to service_role;

create or replace function public.replace_fantasy_league_awards(
  p_season_id uuid,
  p_league_id uuid,
  p_gameweek_id uuid,
  p_selected_by uuid,
  p_awards jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_awards) <> 'array' then
    raise exception using errcode = '22023', message = 'fantasy league awards must be a JSON array';
  end if;

  delete from public.fantasy_league_awards
  where season_id = p_season_id
    and league_id = p_league_id
    and gameweek_id = p_gameweek_id;

  insert into public.fantasy_league_awards (
    season_id,
    league_id,
    gameweek_id,
    fpl_entry_id,
    award,
    selected_by,
    updated_at
  )
  select
    p_season_id,
    p_league_id,
    p_gameweek_id,
    item.fpl_entry_id,
    item.award,
    p_selected_by,
    now()
  from jsonb_to_recordset(p_awards) as item(fpl_entry_id bigint, award text)
  where item.award in ('champion', 'wooden_spoon')
    and exists (
      select 1
      from public.fantasy_league_membership_snapshots as membership
      where membership.season_id = p_season_id
        and membership.league_id = p_league_id
        and membership.gameweek_id = p_gameweek_id
        and membership.fpl_entry_id = item.fpl_entry_id
    )
  on conflict (season_id, league_id, gameweek_id, fpl_entry_id, award) do update
  set selected_by = excluded.selected_by,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.replace_fantasy_league_awards(uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_fantasy_league_awards(uuid, uuid, uuid, uuid, jsonb)
  to service_role;

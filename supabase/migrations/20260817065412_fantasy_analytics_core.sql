-- Fantasy analytics uses immutable-ish snapshots from the FPL API.
-- All access goes through server routes using the existing service client.

create table public.fantasy_entry_mappings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  app_user_id uuid not null references public.app_users (id),
  fpl_entry_id bigint not null check (fpl_entry_id > 0),
  fpl_team_name text not null,
  fpl_manager_name text not null,
  mapping_status text not null default 'active'
    check (mapping_status in ('active', 'archived')),
  last_validation_status text not null default 'valid'
    check (last_validation_status in ('valid', 'error')),
  last_error_message text,
  linked_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (mapping_status = 'active' and archived_at is null)
    or (mapping_status = 'archived' and archived_at is not null)
  )
);

create unique index fantasy_entry_mappings_active_user_idx
  on public.fantasy_entry_mappings (season_id, app_user_id)
  where mapping_status = 'active';

create unique index fantasy_entry_mappings_active_entry_idx
  on public.fantasy_entry_mappings (season_id, fpl_entry_id)
  where mapping_status = 'active';

create index fantasy_entry_mappings_season_status_idx
  on public.fantasy_entry_mappings (season_id, mapping_status, updated_at desc);

create table public.fantasy_gameweek_scores (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  mapping_id uuid not null references public.fantasy_entry_mappings (id),
  gameweek_id uuid not null references public.gameweeks (id),
  points integer not null,
  event_transfers integer not null default 0 check (event_transfers >= 0),
  event_transfers_cost integer not null default 0 check (event_transfers_cost >= 0),
  points_on_bench integer not null default 0,
  source_synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mapping_id, gameweek_id)
);

create index fantasy_gameweek_scores_season_gameweek_idx
  on public.fantasy_gameweek_scores (season_id, gameweek_id, points desc);

create index fantasy_gameweek_scores_mapping_idx
  on public.fantasy_gameweek_scores (mapping_id, gameweek_id);

create table public.fantasy_player_gameweek_stats (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  gameweek_id uuid not null references public.gameweeks (id),
  fpl_player_id bigint not null check (fpl_player_id > 0),
  player_name text not null,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  club_id bigint not null check (club_id > 0),
  club_name text not null,
  status text not null,
  selected_by_percent numeric(7,3) not null default 0 check (selected_by_percent >= 0),
  transfers_in_event integer not null default 0 check (transfers_in_event >= 0),
  transfers_out_event integer not null default 0 check (transfers_out_event >= 0),
  form numeric(7,3) not null default 0 check (form >= 0),
  is_global_captain boolean not null default false,
  is_global_vice_captain boolean not null default false,
  source_synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, gameweek_id, fpl_player_id)
);

create index fantasy_player_stats_current_lookup_idx
  on public.fantasy_player_gameweek_stats (season_id, gameweek_id, position, selected_by_percent desc);

create index fantasy_player_stats_transfer_lookup_idx
  on public.fantasy_player_gameweek_stats (season_id, gameweek_id, transfers_in_event desc, transfers_out_event desc);

create table public.fantasy_awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  gameweek_id uuid not null references public.gameweeks (id),
  mapping_id uuid not null references public.fantasy_entry_mappings (id),
  award text not null check (award in ('champion', 'wooden_spoon')),
  selected_by uuid not null references public.app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, gameweek_id, mapping_id, award)
);

create index fantasy_awards_season_gameweek_idx
  on public.fantasy_awards (season_id, gameweek_id, award);

create index job_runs_fantasy_sync_idx
  on public.job_runs (job_type, started_at desc)
  where job_type = 'fantasy_sync';

alter table public.fantasy_entry_mappings enable row level security;
alter table public.fantasy_gameweek_scores enable row level security;
alter table public.fantasy_player_gameweek_stats enable row level security;
alter table public.fantasy_awards enable row level security;

revoke all on table public.fantasy_entry_mappings from anon, authenticated;
revoke all on table public.fantasy_gameweek_scores from anon, authenticated;
revoke all on table public.fantasy_player_gameweek_stats from anon, authenticated;
revoke all on table public.fantasy_awards from anon, authenticated;

grant all on table public.fantasy_entry_mappings to service_role;
grant all on table public.fantasy_gameweek_scores to service_role;
grant all on table public.fantasy_player_gameweek_stats to service_role;
grant all on table public.fantasy_awards to service_role;

create policy "Fantasy mappings are server only"
  on public.fantasy_entry_mappings
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Fantasy scores are server only"
  on public.fantasy_gameweek_scores
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Fantasy player stats are server only"
  on public.fantasy_player_gameweek_stats
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Fantasy awards are server only"
  on public.fantasy_awards
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.apply_fantasy_sync(
  p_job_run_id uuid,
  p_synced_at timestamptz,
  p_scores jsonb,
  p_players jsonb,
  p_mapping_results jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_scores_count integer;
  v_players_count integer;
  v_mappings_count integer;
  v_result jsonb;
begin
  if jsonb_typeof(p_scores) <> 'array'
    or jsonb_typeof(p_players) <> 'array'
    or jsonb_typeof(p_mapping_results) <> 'array'
  then
    raise exception using errcode = '22023', message = 'invalid fantasy sync snapshot shape';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fantasy-sync:active-season', 0));

  insert into public.fantasy_gameweek_scores (
    season_id,
    mapping_id,
    gameweek_id,
    points,
    event_transfers,
    event_transfers_cost,
    points_on_bench,
    source_synced_at,
    updated_at
  )
  select
    item.season_id,
    item.mapping_id,
    item.gameweek_id,
    item.points,
    item.event_transfers,
    item.event_transfers_cost,
    item.points_on_bench,
    p_synced_at,
    p_synced_at
  from jsonb_to_recordset(p_scores) as item(
    season_id uuid,
    mapping_id uuid,
    gameweek_id uuid,
    points integer,
    event_transfers integer,
    event_transfers_cost integer,
    points_on_bench integer
  )
  on conflict (mapping_id, gameweek_id) do update
  set season_id = excluded.season_id,
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

  update public.fantasy_entry_mappings as mapping
  set last_validation_status = item.last_validation_status,
      last_error_message = case
        when item.last_validation_status = 'valid' then null
        else item.last_error_message
      end,
      fpl_team_name = coalesce(item.fpl_team_name, mapping.fpl_team_name),
      fpl_manager_name = coalesce(item.fpl_manager_name, mapping.fpl_manager_name),
      updated_at = p_synced_at
  from jsonb_to_recordset(p_mapping_results) as item(
    mapping_id uuid,
    last_validation_status text,
    last_error_message text,
    fpl_team_name text,
    fpl_manager_name text
  )
  where mapping.id = item.mapping_id
    and item.last_validation_status in ('valid', 'error');

  v_scores_count := jsonb_array_length(p_scores);
  v_players_count := jsonb_array_length(p_players);
  v_mappings_count := jsonb_array_length(p_mapping_results);
  v_result := jsonb_build_object(
    'jobRunId', p_job_run_id,
    'scoresUpserted', v_scores_count,
    'playersUpserted', v_players_count,
    'mappingsUpdated', v_mappings_count
  );

  update public.job_runs
  set status = 'succeeded',
      finished_at = clock_timestamp(),
      records_upserted = v_scores_count + v_players_count,
      error_message = null,
      error_code = null,
      details = jsonb_build_object('result', v_result)
  where id = p_job_run_id and status = 'running';

  return v_result;
end;
$$;

create or replace function public.replace_fantasy_awards(
  p_season_id uuid,
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
    raise exception using errcode = '22023', message = 'fantasy awards must be a JSON array';
  end if;

  delete from public.fantasy_awards
  where season_id = p_season_id and gameweek_id = p_gameweek_id;

  insert into public.fantasy_awards (
    season_id,
    gameweek_id,
    mapping_id,
    award,
    selected_by,
    updated_at
  )
  select
    p_season_id,
    p_gameweek_id,
    item.mapping_id,
    item.award,
    p_selected_by,
    now()
  from jsonb_to_recordset(p_awards) as item(mapping_id uuid, award text)
  where item.award in ('champion', 'wooden_spoon')
    and exists (
      select 1
      from public.fantasy_entry_mappings as mapping
      where mapping.id = item.mapping_id and mapping.season_id = p_season_id
    )
  on conflict (season_id, gameweek_id, mapping_id, award) do update
  set selected_by = excluded.selected_by,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.apply_fantasy_sync(uuid, timestamptz, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_fantasy_sync(uuid, timestamptz, jsonb, jsonb, jsonb)
  to service_role;

revoke all on function public.replace_fantasy_awards(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_fantasy_awards(uuid, uuid, uuid, jsonb)
  to service_role;

create or replace function public.replace_fantasy_mapping(
  p_mapping_id uuid,
  p_season_id uuid,
  p_app_user_id uuid,
  p_fpl_entry_id bigint,
  p_fpl_team_name text,
  p_fpl_manager_name text,
  p_archived_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_new_mapping_id uuid;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('fantasy-mapping:' || p_season_id::text, 0));

  if not exists (
    select 1 from public.fantasy_entry_mappings
    where id = p_mapping_id and season_id = p_season_id
  ) then
    raise exception using errcode = 'P0002', message = 'fantasy mapping is unavailable';
  end if;

  update public.fantasy_entry_mappings
  set mapping_status = 'archived',
      archived_at = coalesce(p_archived_at, now()),
      updated_at = coalesce(p_archived_at, now())
  where id = p_mapping_id;

  insert into public.fantasy_entry_mappings (
    season_id,
    app_user_id,
    fpl_entry_id,
    fpl_team_name,
    fpl_manager_name,
    linked_at,
    updated_at
  )
  values (
    p_season_id,
    p_app_user_id,
    p_fpl_entry_id,
    p_fpl_team_name,
    p_fpl_manager_name,
    coalesce(p_archived_at, now()),
    coalesce(p_archived_at, now())
  )
  returning id into v_new_mapping_id;

  select to_jsonb(mapping) into v_result
  from public.fantasy_entry_mappings as mapping
  where mapping.id = v_new_mapping_id;

  return v_result;
end;
$$;

revoke all on function public.replace_fantasy_mapping(uuid, uuid, uuid, bigint, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.replace_fantasy_mapping(uuid, uuid, uuid, bigint, text, text, timestamptz)
  to service_role;

alter table public.fantasy_entry_gameweek_scores
  add column calculation_method text not null default 'legacy_fpl_history'
  check (calculation_method in ('legacy_fpl_history', 'starting_xi_captain_v1'));

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
    id, season_id, fpl_league_id, official_name, status, last_synced_at,
    last_sync_status, last_error_message, archived_at, updated_at
  )
  select item.id, item.season_id, item.fpl_league_id, item.official_name, item.status,
    p_synced_at, 'succeeded', null, item.archived_at, p_synced_at
  from jsonb_to_recordset(p_leagues) as item(
    id uuid, season_id uuid, fpl_league_id bigint, official_name text,
    status text, archived_at timestamptz
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
    season_id, league_id, gameweek_id, fpl_entry_id, fpl_team_name,
    fpl_manager_name, source_synced_at, updated_at
  )
  select item.season_id, item.league_id, item.gameweek_id, item.fpl_entry_id,
    item.fpl_team_name, item.fpl_manager_name, p_synced_at, p_synced_at
  from jsonb_to_recordset(p_memberships) as item(
    season_id uuid, league_id uuid, gameweek_id uuid, fpl_entry_id bigint,
    fpl_team_name text, fpl_manager_name text
  )
  on conflict (season_id, league_id, gameweek_id, fpl_entry_id) do update
  set fpl_team_name = excluded.fpl_team_name,
      fpl_manager_name = excluded.fpl_manager_name,
      source_synced_at = excluded.source_synced_at,
      updated_at = excluded.updated_at;

  insert into public.fantasy_entry_gameweek_scores (
    season_id, gameweek_id, fpl_entry_id, fpl_team_name, fpl_manager_name,
    points, event_transfers, event_transfers_cost, points_on_bench,
    calculation_method, source_synced_at, updated_at
  )
  select item.season_id, item.gameweek_id, item.fpl_entry_id, item.fpl_team_name,
    item.fpl_manager_name, item.points, item.event_transfers,
    item.event_transfers_cost, item.points_on_bench,
    coalesce(item.calculation_method, 'legacy_fpl_history'), p_synced_at, p_synced_at
  from jsonb_to_recordset(p_scores) as item(
    season_id uuid, gameweek_id uuid, fpl_entry_id bigint, fpl_team_name text,
    fpl_manager_name text, points integer, event_transfers integer,
    event_transfers_cost integer, points_on_bench integer,
    calculation_method text
  )
  on conflict (season_id, gameweek_id, fpl_entry_id) do update
  set fpl_team_name = excluded.fpl_team_name,
      fpl_manager_name = excluded.fpl_manager_name,
      points = excluded.points,
      event_transfers = excluded.event_transfers,
      event_transfers_cost = excluded.event_transfers_cost,
      points_on_bench = excluded.points_on_bench,
      calculation_method = excluded.calculation_method,
      source_synced_at = excluded.source_synced_at,
      updated_at = excluded.updated_at;

  insert into public.fantasy_player_gameweek_stats (
    season_id, gameweek_id, fpl_player_id, player_name, position, club_id,
    club_name, status, selected_by_percent, transfers_in_event,
    transfers_out_event, form, is_global_captain, is_global_vice_captain,
    source_synced_at, updated_at
  )
  select item.season_id, item.gameweek_id, item.fpl_player_id, item.player_name,
    item.position, item.club_id, item.club_name, item.status,
    item.selected_by_percent, item.transfers_in_event, item.transfers_out_event,
    item.form, item.is_global_captain, item.is_global_vice_captain,
    p_synced_at, p_synced_at
  from jsonb_to_recordset(p_players) as item(
    season_id uuid, gameweek_id uuid, fpl_player_id bigint, player_name text,
    position text, club_id bigint, club_name text, status text,
    selected_by_percent numeric, transfers_in_event integer,
    transfers_out_event integer, form numeric, is_global_captain boolean,
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
  set status = 'succeeded', finished_at = clock_timestamp(),
      records_upserted = v_memberships_count + v_scores_count + v_players_count,
      error_message = null, error_code = null,
      details = jsonb_build_object('result', v_result)
  where id = p_job_run_id and status = 'running';

  return v_result;
end;
$$;

revoke all on function public.apply_fantasy_league_sync(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_fantasy_league_sync(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)
  to service_role;

create or replace function public.apply_fantasy_score_recalculation(
  p_job_run_id uuid,
  p_scores jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_scores_count integer;
  v_result jsonb;
begin
  if jsonb_typeof(p_scores) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid fantasy score recalculation shape';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fantasy-score-recalculation', 0));

  insert into public.fantasy_entry_gameweek_scores (
    season_id, gameweek_id, fpl_entry_id, fpl_team_name, fpl_manager_name,
    points, event_transfers, event_transfers_cost, points_on_bench,
    calculation_method, source_synced_at, updated_at
  )
  select item.season_id, item.gameweek_id, item.fpl_entry_id, item.fpl_team_name,
    item.fpl_manager_name, item.points, item.event_transfers,
    item.event_transfers_cost, item.points_on_bench, item.calculation_method,
    item.source_synced_at, clock_timestamp()
  from jsonb_to_recordset(p_scores) as item(
    season_id uuid, gameweek_id uuid, fpl_entry_id bigint, fpl_team_name text,
    fpl_manager_name text, points integer, event_transfers integer,
    event_transfers_cost integer, points_on_bench integer,
    calculation_method text, source_synced_at timestamptz
  )
  on conflict (season_id, gameweek_id, fpl_entry_id) do update
  set fpl_team_name = excluded.fpl_team_name,
      fpl_manager_name = excluded.fpl_manager_name,
      points = excluded.points,
      event_transfers = excluded.event_transfers,
      event_transfers_cost = excluded.event_transfers_cost,
      points_on_bench = excluded.points_on_bench,
      calculation_method = excluded.calculation_method,
      source_synced_at = excluded.source_synced_at,
      updated_at = excluded.updated_at;

  v_scores_count := jsonb_array_length(p_scores);
  v_result := jsonb_build_object('jobRunId', p_job_run_id, 'scoresUpserted', v_scores_count);
  update public.job_runs
  set status = 'succeeded', finished_at = clock_timestamp(),
      records_upserted = v_scores_count, error_message = null,
      error_code = null, details = jsonb_build_object('result', v_result)
  where id = p_job_run_id and status = 'running';
  return v_result;
end;
$$;

revoke all on function public.apply_fantasy_score_recalculation(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_fantasy_score_recalculation(uuid, jsonb)
  to service_role;

create or replace function public.apply_fantasy_player_stats_sync(
  p_job_run_id uuid,
  p_synced_at timestamptz,
  p_players jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_players_count integer;
  v_result jsonb;
begin
  if jsonb_typeof(p_players) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid fantasy player stats snapshot shape';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fantasy-player-stats-sync', 0));

  insert into public.fantasy_player_gameweek_stats (
    season_id, gameweek_id, fpl_player_id, photo_key, player_name, position,
    club_id, club_name, status, selected_by_percent, transfers_in_event,
    transfers_out_event, form, is_global_captain, is_global_vice_captain,
    source_synced_at, updated_at
  )
  select item.season_id, item.gameweek_id, item.fpl_player_id, item.photo_key,
    item.player_name, item.position, item.club_id, item.club_name, item.status,
    item.selected_by_percent, item.transfers_in_event, item.transfers_out_event,
    item.form, item.is_global_captain, item.is_global_vice_captain,
    p_synced_at, p_synced_at
  from jsonb_to_recordset(p_players) as item(
    season_id uuid, gameweek_id uuid, fpl_player_id bigint, photo_key text,
    player_name text, position text, club_id bigint, club_name text, status text,
    selected_by_percent numeric, transfers_in_event integer,
    transfers_out_event integer, form numeric, is_global_captain boolean,
    is_global_vice_captain boolean
  )
  on conflict (season_id, gameweek_id, fpl_player_id) do update
  set photo_key = excluded.photo_key,
      player_name = excluded.player_name,
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

  v_players_count := jsonb_array_length(p_players);
  v_result := jsonb_build_object('jobRunId', p_job_run_id, 'playersUpserted', v_players_count);
  update public.job_runs
  set status = 'succeeded', finished_at = clock_timestamp(),
      records_upserted = v_players_count, error_message = null,
      error_code = null, details = jsonb_build_object('result', v_result)
  where id = p_job_run_id and status = 'running';
  return v_result;
end;
$$;

revoke all on function public.apply_fantasy_player_stats_sync(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_fantasy_player_stats_sync(uuid, timestamptz, jsonb)
  to service_role;

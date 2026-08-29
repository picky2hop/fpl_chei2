alter table public.fantasy_player_gameweek_stats
  add column if not exists defensive_contribution numeric(7,3) not null default 0,
  add column if not exists bps integer not null default 0,
  add column if not exists points_per_game numeric(7,3) not null default 0,
  add column if not exists expected_goal_involvements_per_90 numeric(7,3) not null default 0,
  add column if not exists latest_finished_gameweek_points integer;

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
    transfers_out_event, form, defensive_contribution, bps, points_per_game,
    expected_goal_involvements_per_90, latest_finished_gameweek_points,
    is_global_captain, is_global_vice_captain, source_synced_at, updated_at
  )
  select item.season_id, item.gameweek_id, item.fpl_player_id, item.photo_key,
    item.player_name, item.position, item.club_id, item.club_name, item.status,
    item.selected_by_percent, item.transfers_in_event, item.transfers_out_event,
    item.form, item.defensive_contribution, item.bps, item.points_per_game,
    item.expected_goal_involvements_per_90, item.latest_finished_gameweek_points,
    item.is_global_captain, item.is_global_vice_captain, p_synced_at, p_synced_at
  from jsonb_to_recordset(p_players) as item(
    season_id uuid, gameweek_id uuid, fpl_player_id bigint, photo_key text,
    player_name text, position text, club_id bigint, club_name text, status text,
    selected_by_percent numeric, transfers_in_event integer,
    transfers_out_event integer, form numeric, defensive_contribution numeric,
    bps integer, points_per_game numeric,
    expected_goal_involvements_per_90 numeric,
    latest_finished_gameweek_points integer, is_global_captain boolean,
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
      defensive_contribution = excluded.defensive_contribution,
      bps = excluded.bps,
      points_per_game = excluded.points_per_game,
      expected_goal_involvements_per_90 = excluded.expected_goal_involvements_per_90,
      latest_finished_gameweek_points = excluded.latest_finished_gameweek_points,
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

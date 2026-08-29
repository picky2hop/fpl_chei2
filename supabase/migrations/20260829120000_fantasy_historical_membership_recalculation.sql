drop function if exists public.apply_fantasy_score_recalculation(uuid, jsonb);

create function public.apply_fantasy_score_recalculation(
  p_job_run_id uuid,
  p_memberships jsonb,
  p_scores jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_memberships_count integer;
  v_scores_count integer;
  v_result jsonb;
begin
  if jsonb_typeof(p_memberships) <> 'array'
    or jsonb_typeof(p_scores) <> 'array'
  then
    raise exception using errcode = '22023', message = 'invalid fantasy score recalculation shape';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fantasy-score-recalculation', 0));

  insert into public.fantasy_league_membership_snapshots (
    season_id, league_id, gameweek_id, fpl_entry_id, fpl_team_name,
    fpl_manager_name, source_synced_at, updated_at
  )
  select item.season_id, item.league_id, item.gameweek_id, item.fpl_entry_id,
    item.fpl_team_name, item.fpl_manager_name, item.source_synced_at, clock_timestamp()
  from jsonb_to_recordset(p_memberships) as item(
    season_id uuid, league_id uuid, gameweek_id uuid, fpl_entry_id bigint,
    fpl_team_name text, fpl_manager_name text, source_synced_at timestamptz
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

  v_memberships_count := jsonb_array_length(p_memberships);
  v_scores_count := jsonb_array_length(p_scores);
  v_result := jsonb_build_object(
    'jobRunId', p_job_run_id,
    'membershipsUpserted', v_memberships_count,
    'scoresUpserted', v_scores_count
  );

  update public.job_runs
  set status = 'succeeded', finished_at = clock_timestamp(),
      records_upserted = v_memberships_count + v_scores_count,
      error_message = null, error_code = null,
      details = jsonb_build_object('result', v_result)
  where id = p_job_run_id and status = 'running';

  return v_result;
end;
$$;

revoke all on function public.apply_fantasy_score_recalculation(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_fantasy_score_recalculation(uuid, jsonb, jsonb)
  to service_role;

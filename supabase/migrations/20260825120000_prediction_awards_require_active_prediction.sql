-- Keep the existing atomic sync pipeline, then rebuild affected gameweek scores
-- and awards from participants who have at least one active prediction in that GW.
-- The wrapper runs inside the same transaction as the legacy function.
alter function public.apply_fpl_sync(uuid, timestamptz, jsonb, jsonb, jsonb)
  rename to apply_fpl_sync_legacy;

revoke all on function public.apply_fpl_sync_legacy(uuid, timestamptz, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.apply_fpl_sync_legacy(uuid, timestamptz, jsonb, jsonb, jsonb)
  to service_role;

create or replace function public.apply_fpl_sync(
  p_job_run_id uuid,
  p_synced_at timestamptz,
  p_teams jsonb,
  p_gameweeks jsonb,
  p_fixtures jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_gameweek_id uuid;
  v_scoring_version integer;
begin
  v_result := public.apply_fpl_sync_legacy(
    p_job_run_id,
    p_synced_at,
    p_teams,
    p_gameweeks,
    p_fixtures
  );

  for v_gameweek_id in
    select value::uuid
    from jsonb_array_elements_text(coalesce(v_result->'affectedGameweekIds', '[]'::jsonb)) as affected(value)
  loop
    delete from public.gameweek_scores as score
    where score.gameweek_id = v_gameweek_id
      and not exists (
        select 1
        from public.gameweek_participants as participant
        join public.predictions as prediction
          on prediction.user_id = participant.user_id
          and prediction.status = 'active'
        join public.fixtures as fixture
          on fixture.id = prediction.fixture_id
          and fixture.gameweek_id = v_gameweek_id
        where participant.gameweek_id = v_gameweek_id
          and participant.user_id = score.user_id
          and participant.status = 'active'
      );

    select scoring_version
    into v_scoring_version
    from public.gameweeks
    where id = v_gameweek_id;

    delete from public.gameweek_awards
    where gameweek_id = v_gameweek_id;

    insert into public.gameweek_awards (
      gameweek_id,
      user_id,
      award,
      points,
      scoring_version
    )
    select v_gameweek_id, score.user_id, 'champion', score.points, v_scoring_version
    from public.gameweek_scores as score
    where score.gameweek_id = v_gameweek_id
      and score.points = (
        select max(candidate.points)
        from public.gameweek_scores as candidate
        where candidate.gameweek_id = v_gameweek_id
      )
    union all
    select v_gameweek_id, score.user_id, 'wooden_spoon', score.points, v_scoring_version
    from public.gameweek_scores as score
    where score.gameweek_id = v_gameweek_id
      and score.points = (
        select min(candidate.points)
        from public.gameweek_scores as candidate
        where candidate.gameweek_id = v_gameweek_id
      );
  end loop;

  return v_result;
end;
$$;

revoke all on function public.apply_fpl_sync(uuid, timestamptz, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.apply_fpl_sync(uuid, timestamptz, jsonb, jsonb, jsonb)
  to service_role;

alter table public.job_runs
  add column if not exists error_code text,
  add column if not exists details jsonb not null default '{}'::jsonb;

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
  v_season_id uuid;
  v_team jsonb;
  v_gameweek jsonb;
  v_fixture jsonb;
  v_prediction record;
  v_previous record;
  v_fixture_id uuid;
  v_gameweek_id uuid;
  v_old_gameweek_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_status text;
  v_home_score smallint;
  v_away_score smallint;
  v_scoring_version integer;
  v_finished_count integer;
  v_rows integer;
  v_job_status text;
  v_job_details jsonb;
  v_affected_gameweek_ids uuid[] := array[]::uuid[];
  v_moved_fixture_ids uuid[] := array[]::uuid[];
  v_teams_count integer;
  v_gameweeks_count integer;
  v_fixtures_count integer;
  v_result jsonb;
begin
  if jsonb_typeof(p_teams) <> 'array'
    or jsonb_typeof(p_gameweeks) <> 'array'
    or jsonb_typeof(p_fixtures) <> 'array'
  then
    raise exception using errcode = '22023', message = 'invalid sync snapshot shape';
  end if;

  v_teams_count := jsonb_array_length(p_teams);
  v_gameweeks_count := jsonb_array_length(p_gameweeks);
  v_fixtures_count := jsonb_array_length(p_fixtures);

  if exists (
    select 1
    from jsonb_array_elements(p_teams) as item
    group by item->>'id'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_gameweeks) as item
    group by item->>'id'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_fixtures) as item
    group by item->>'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate sync snapshot identity';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fpl-sync:active-season', 0));

  select id
  into v_season_id
  from public.seasons
  where status = 'active'
  order by id
  limit 1;

  if v_season_id is null then
    raise exception using errcode = 'P0002', message = 'active season is unavailable';
  end if;

  select status, details
  into v_job_status, v_job_details
  from public.job_runs
  where id = p_job_run_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'sync job is unavailable';
  end if;

  if v_job_status = 'succeeded' and jsonb_typeof(v_job_details->'result') = 'object' then
    return v_job_details->'result';
  end if;

  if v_job_status <> 'running' then
    raise exception using errcode = '55000', message = 'sync job is not runnable';
  end if;

  for v_team in select value from jsonb_array_elements(p_teams)
  loop
    insert into public.teams (external_team_id, name, short_name, code, updated_at)
    values (
      (v_team->>'id')::bigint,
      v_team->>'name',
      v_team->>'short_name',
      v_team->>'code',
      p_synced_at
    )
    on conflict (external_team_id) do update
    set name = excluded.name,
        short_name = excluded.short_name,
        code = excluded.code,
        updated_at = excluded.updated_at;
  end loop;

  for v_gameweek in select value from jsonb_array_elements(p_gameweeks)
  loop
    insert into public.gameweeks (
      season_id,
      external_gameweek_id,
      number,
      name,
      is_current,
      status,
      updated_at
    )
    values (
      v_season_id,
      (v_gameweek->>'id')::bigint,
      (v_gameweek->>'id')::smallint,
      v_gameweek->>'name',
      (v_gameweek->>'is_current')::boolean,
      case when (v_gameweek->>'is_current')::boolean then 'open' else 'upcoming' end,
      p_synced_at
    )
    on conflict (season_id, external_gameweek_id) do update
    set number = excluded.number,
        name = excluded.name,
        is_current = excluded.is_current,
        status = case
          when public.gameweeks.status in ('closed', 'reopened') then public.gameweeks.status
          when excluded.is_current then 'open'
          else public.gameweeks.status
        end,
        updated_at = excluded.updated_at;
  end loop;

  for v_fixture in
    select value
    from jsonb_array_elements(p_fixtures)
    order by (value->>'id')::bigint
  loop
    select id into v_home_team_id
    from public.teams
    where external_team_id = (v_fixture->>'team_h')::bigint;

    select id into v_away_team_id
    from public.teams
    where external_team_id = (v_fixture->>'team_a')::bigint;

    select id into v_gameweek_id
    from public.gameweeks
    where season_id = v_season_id
      and external_gameweek_id = (v_fixture->>'event')::bigint;

    if v_home_team_id is null or v_away_team_id is null or v_gameweek_id is null then
      raise exception using errcode = '23503', message = 'fixture references unknown sync data';
    end if;

    v_status := case
      when coalesce((v_fixture->>'postponed')::boolean, false) then 'postponed'
      when (v_fixture->>'finished')::boolean then 'finished'
      when (v_fixture->>'started')::boolean then 'live'
      else 'scheduled'
    end;
    v_home_score := case when v_fixture->'team_h_score' = 'null'::jsonb then null else (v_fixture->>'team_h_score')::smallint end;
    v_away_score := case when v_fixture->'team_a_score' = 'null'::jsonb then null else (v_fixture->>'team_a_score')::smallint end;

    select id, gameweek_id, status, home_score, away_score
    into v_previous
    from public.fixtures
    where external_fixture_id = (v_fixture->>'id')::bigint
    for update;

    v_fixture_id := v_previous.id;
    v_old_gameweek_id := v_previous.gameweek_id;

    if v_fixture_id is null then
      insert into public.fixtures (
        external_fixture_id,
        season_id,
        gameweek_id,
        home_team_id,
        away_team_id,
        kickoff_at,
        status,
        home_score,
        away_score,
        last_synced_at,
        updated_at
      )
      values (
        (v_fixture->>'id')::bigint,
        v_season_id,
        v_gameweek_id,
        v_home_team_id,
        v_away_team_id,
        (v_fixture->>'kickoff_time')::timestamptz,
        v_status,
        v_home_score,
        v_away_score,
        p_synced_at,
        p_synced_at
      )
      returning id into v_fixture_id;

      if v_status = 'finished' and not v_gameweek_id = any(v_affected_gameweek_ids) then
        v_affected_gameweek_ids := array_append(v_affected_gameweek_ids, v_gameweek_id);
      end if;
    else
      if v_old_gameweek_id is distinct from v_gameweek_id then
        insert into public.fixture_gameweek_history (
          fixture_id,
          old_gameweek_id,
          new_gameweek_id,
          source,
          provider_payload
        )
        values (
          v_fixture_id,
          v_old_gameweek_id,
          v_gameweek_id,
          'fpl_api',
          jsonb_build_object('reason', 'fixture_gameweek_changed', 'fixture', v_fixture)
        );

        for v_prediction in
          update public.predictions
          set status = 'voided',
              void_reason = 'fixture_moved',
              voided_at = p_synced_at,
              updated_at = p_synced_at
          where fixture_id = v_fixture_id and status = 'active'
          returning id, user_id, fixture_id, outcome
        loop
          insert into public.prediction_events (
            prediction_id,
            user_id,
            fixture_id,
            event_type,
            previous_choice,
            reason
          )
          values (
            v_prediction.id,
            v_prediction.user_id,
            v_prediction.fixture_id,
            'voided',
            v_prediction.outcome,
            'fixture_moved'
          );
        end loop;

        update public.gameweeks
        set status = 'reopened', close_at = null, updated_at = p_synced_at
        where id = v_gameweek_id and status = 'closed';

        if v_old_gameweek_id is not null and not v_old_gameweek_id = any(v_affected_gameweek_ids) then
          v_affected_gameweek_ids := array_append(v_affected_gameweek_ids, v_old_gameweek_id);
        end if;
        if not v_gameweek_id = any(v_affected_gameweek_ids) then
          v_affected_gameweek_ids := array_append(v_affected_gameweek_ids, v_gameweek_id);
        end if;
        v_moved_fixture_ids := array_append(v_moved_fixture_ids, v_fixture_id);
      end if;

      if v_status = 'finished'
        and (
          v_previous.status is distinct from 'finished'
          or v_previous.home_score is distinct from v_home_score
          or v_previous.away_score is distinct from v_away_score
        )
        and not v_gameweek_id = any(v_affected_gameweek_ids)
      then
        v_affected_gameweek_ids := array_append(v_affected_gameweek_ids, v_gameweek_id);
      end if;

      update public.fixtures
      set season_id = v_season_id,
          gameweek_id = v_gameweek_id,
          home_team_id = v_home_team_id,
          away_team_id = v_away_team_id,
          kickoff_at = (v_fixture->>'kickoff_time')::timestamptz,
          status = v_status,
          home_score = v_home_score,
          away_score = v_away_score,
          last_synced_at = p_synced_at,
          updated_at = p_synced_at
      where id = v_fixture_id;
    end if;

    insert into public.fixture_source_records (
      fixture_id,
      source_name,
      status,
      kickoff_at,
      home_score,
      away_score,
      raw_payload,
      fetched_at,
      source_updated_at,
      updated_at
    )
    values (
      v_fixture_id,
      'fpl_api',
      v_status,
      (v_fixture->>'kickoff_time')::timestamptz,
      v_home_score,
      v_away_score,
      v_fixture,
      p_synced_at,
      p_synced_at,
      p_synced_at
    )
    on conflict (fixture_id) do update
    set status = excluded.status,
        kickoff_at = excluded.kickoff_at,
        home_score = excluded.home_score,
        away_score = excluded.away_score,
        raw_payload = excluded.raw_payload,
        fetched_at = excluded.fetched_at,
        source_updated_at = excluded.source_updated_at,
        updated_at = excluded.updated_at;
  end loop;

  perform 1
  from public.gameweeks
  where id = any(v_affected_gameweek_ids)
  order by id
  for update;

  for v_gameweek_id in
    select distinct affected_id
    from unnest(v_affected_gameweek_ids) as affected_id
    order by affected_id
  loop
    select count(*)
    into v_finished_count
    from public.fixtures
    where gameweek_id = v_gameweek_id and status = 'finished';

    if v_finished_count = 0 or exists (
      select 1
      from public.fixtures
      where gameweek_id = v_gameweek_id and status in ('scheduled', 'live')
    ) then
      delete from public.gameweek_awards where gameweek_id = v_gameweek_id;
      delete from public.gameweek_scores where gameweek_id = v_gameweek_id;
      update public.gameweeks
      set status = case when status = 'closed' then 'reopened' else status end,
          close_at = case when status = 'closed' then null else close_at end,
          updated_at = p_synced_at
      where id = v_gameweek_id;
      continue;
    end if;

    select scoring_version + 1
    into v_scoring_version
    from public.gameweeks
    where id = v_gameweek_id;

    delete from public.gameweek_awards where gameweek_id = v_gameweek_id;
    delete from public.gameweek_scores where gameweek_id = v_gameweek_id;

    insert into public.gameweek_scores (
      gameweek_id,
      user_id,
      points,
      correct_predictions,
      predicted_fixtures,
      counted_fixtures,
      scoring_version,
      updated_at
    )
    select
      v_gameweek_id,
      participant.user_id,
      coalesce(sum(
        case
          when fixture.id is null then 0
          when fixture.home_score > fixture.away_score and prediction.outcome = 'home' then 3
          when fixture.home_score = fixture.away_score and prediction.outcome = 'draw' then 3
          when fixture.home_score < fixture.away_score and prediction.outcome = 'away' then 3
          else 0
        end
      ), 0)::integer,
      count(fixture.id) filter (
        where (fixture.home_score > fixture.away_score and prediction.outcome = 'home')
          or (fixture.home_score = fixture.away_score and prediction.outcome = 'draw')
          or (fixture.home_score < fixture.away_score and prediction.outcome = 'away')
      )::integer,
      count(fixture.id)::integer,
      v_finished_count,
      v_scoring_version,
      p_synced_at
    from public.gameweek_participants as participant
    left join public.predictions as prediction
      on prediction.user_id = participant.user_id
      and prediction.status = 'active'
    left join public.fixtures as fixture
      on fixture.id = prediction.fixture_id
      and fixture.gameweek_id = v_gameweek_id
      and fixture.status = 'finished'
    where participant.gameweek_id = v_gameweek_id
      and participant.status = 'active'
    group by participant.user_id;

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

    update public.gameweeks
    set scoring_version = v_scoring_version,
        status = 'closed',
        close_at = p_synced_at,
        updated_at = p_synced_at
    where id = v_gameweek_id;
  end loop;

  v_result := jsonb_build_object(
    'jobRunId', p_job_run_id,
    'teamsUpserted', v_teams_count,
    'gameweeksUpserted', v_gameweeks_count,
    'fixturesUpserted', v_fixtures_count,
    'movedFixtureIds', to_jsonb(v_moved_fixture_ids),
    'affectedGameweekIds', to_jsonb(v_affected_gameweek_ids)
  );

  update public.job_runs
  set status = 'succeeded',
      finished_at = clock_timestamp(),
      records_upserted = v_teams_count + v_gameweeks_count + v_fixtures_count,
      affected_gameweek_ids = to_jsonb(v_affected_gameweek_ids),
      error_message = null,
      error_code = null,
      details = jsonb_build_object(
        'teams', v_teams_count,
        'gameweeks', v_gameweeks_count,
        'fixtures', v_fixtures_count,
        'movedFixtures', cardinality(v_moved_fixture_ids),
        'result', v_result
      )
  where id = p_job_run_id and status = 'running';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = 'P0002', message = 'running sync job could not be finalized';
  end if;

  return v_result;
end;
$$;

revoke all on function public.apply_fpl_sync(uuid, timestamptz, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.apply_fpl_sync(uuid, timestamptz, jsonb, jsonb, jsonb)
  to service_role;

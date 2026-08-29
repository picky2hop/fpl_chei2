-- Prevent predictions for later fixtures when a user missed the first
-- non-postponed fixture in the same gameweek.
-- The service role is the only role allowed to execute these operations.
create or replace function public.save_prediction(
  p_user_id uuid,
  p_fixture_id uuid,
  p_choice text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_fixture record;
  v_first_fixture record;
  v_existing record;
  v_prediction record;
  v_event_type text;
begin
  if p_choice not in ('home', 'draw', 'away') then
    raise exception 'Invalid prediction choice' using errcode = '22023';
  end if;

  select id, gameweek_id, external_fixture_id, kickoff_at, status
    into v_fixture
    from public.fixtures
   where id = p_fixture_id
   for update;

  if not found or v_fixture.status <> 'scheduled' or v_fixture.kickoff_at <= now() then
    raise exception 'Prediction is locked' using errcode = '55P03';
  end if;

  select id, kickoff_at, status
    into v_first_fixture
    from public.fixtures
   where gameweek_id = v_fixture.gameweek_id
     and status <> 'postponed'
   order by kickoff_at, external_fixture_id
   limit 1;

  if v_first_fixture.id is not null
     and v_first_fixture.id <> v_fixture.id
     and (v_first_fixture.status <> 'scheduled' or v_first_fixture.kickoff_at <= now())
     and not exists (
       select 1
         from public.predictions p
        where p.user_id = p_user_id
          and p.fixture_id = v_first_fixture.id
          and p.status = 'active'
     )
  then
    raise exception 'First fixture was missed'
      using errcode = 'P0001', hint = 'FIRST_FIXTURE_MISSED';
  end if;

  if not exists (
    select 1
      from public.gameweek_participants gp
     where gp.user_id = p_user_id
       and gp.gameweek_id = v_fixture.gameweek_id
       and gp.status = 'active'
  ) then
    raise exception 'User is not an active gameweek participant' using errcode = '42501';
  end if;

  select id, outcome
    into v_existing
    from public.predictions
   where user_id = p_user_id
     and fixture_id = p_fixture_id
     and status = 'active'
   for update;

  if found then
    update public.predictions
       set outcome = p_choice,
           updated_at = now()
     where id = v_existing.id
     returning id, user_id, fixture_id, outcome, status, updated_at
      into v_prediction;
    v_event_type := 'updated';
  else
    insert into public.predictions (user_id, fixture_id, outcome, status)
    values (p_user_id, p_fixture_id, p_choice, 'active')
    returning id, user_id, fixture_id, outcome, status, updated_at
      into v_prediction;
    v_event_type := 'created';
  end if;

  insert into public.prediction_events (
    prediction_id, user_id, fixture_id, event_type, previous_choice, choice
  ) values (
    v_prediction.id, p_user_id, p_fixture_id, v_event_type, v_existing.outcome, p_choice
  );

  return jsonb_build_object(
    'id', v_prediction.id,
    'fixture_id', v_prediction.fixture_id,
    'outcome', v_prediction.outcome,
    'status', v_prediction.status,
    'updated_at', v_prediction.updated_at
  );
end;
$$;

revoke execute on function public.save_prediction(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.save_prediction(uuid, uuid, text) to service_role;

create or replace function public.save_predictions(
  p_user_id uuid,
  p_predictions jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_fixture_id uuid;
  v_choice text;
  v_fixture record;
  v_first_fixture record;
  v_existing record;
  v_prediction record;
  v_event_type text;
  v_result jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_predictions) <> 'array' or jsonb_array_length(p_predictions) = 0 then
    raise exception 'Predictions are required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_predictions) as item
    group by item->>'fixtureId'
    having count(*) > 1
  ) then
    raise exception 'Each fixture may appear only once' using errcode = '22023';
  end if;

  -- Lock every fixture in deterministic order before writing any row.
  for v_item in
    select value
    from jsonb_array_elements(p_predictions)
    order by value->>'fixtureId'
  loop
    v_fixture_id := (v_item->>'fixtureId')::uuid;
    v_choice := v_item->>'choice';

    if v_choice not in ('home', 'draw', 'away') then
      raise exception 'Invalid prediction choice' using errcode = '22023';
    end if;

    select id, gameweek_id, external_fixture_id, kickoff_at, status
      into v_fixture
      from public.fixtures
     where id = v_fixture_id
     for update;

    if not found or v_fixture.status <> 'scheduled' or v_fixture.kickoff_at <= now() then
      raise exception 'Prediction is locked' using errcode = '55P03';
    end if;

    select id, kickoff_at, status
      into v_first_fixture
      from public.fixtures
     where gameweek_id = v_fixture.gameweek_id
       and status <> 'postponed'
     order by kickoff_at, external_fixture_id
     limit 1;

    if v_first_fixture.id is not null
       and v_first_fixture.id <> v_fixture.id
       and (v_first_fixture.status <> 'scheduled' or v_first_fixture.kickoff_at <= now())
       and not exists (
         select 1
           from public.predictions p
          where p.user_id = p_user_id
            and p.fixture_id = v_first_fixture.id
            and p.status = 'active'
       )
    then
      raise exception 'First fixture was missed'
        using errcode = 'P0001', hint = 'FIRST_FIXTURE_MISSED';
    end if;

    if not exists (
      select 1
        from public.gameweek_participants gp
       where gp.user_id = p_user_id
         and gp.gameweek_id = v_fixture.gameweek_id
         and gp.status = 'active'
    ) then
      raise exception 'User is not an active gameweek participant' using errcode = '42501';
    end if;
  end loop;

  for v_item in
    select value
    from jsonb_array_elements(p_predictions)
    order by value->>'fixtureId'
  loop
    v_fixture_id := (v_item->>'fixtureId')::uuid;
    v_choice := v_item->>'choice';
    v_existing := null;

    select id, outcome
      into v_existing
      from public.predictions
     where user_id = p_user_id
       and fixture_id = v_fixture_id
       and status = 'active'
     for update;

    if found then
      update public.predictions
         set outcome = v_choice,
             updated_at = now()
       where id = v_existing.id
       returning id, user_id, fixture_id, outcome, status, updated_at
        into v_prediction;
      v_event_type := 'updated';
    else
      insert into public.predictions (user_id, fixture_id, outcome, status)
      values (p_user_id, v_fixture_id, v_choice, 'active')
      returning id, user_id, fixture_id, outcome, status, updated_at
       into v_prediction;
      v_event_type := 'created';
    end if;

    insert into public.prediction_events (
      prediction_id, user_id, fixture_id, event_type, previous_choice, choice
    ) values (
      v_prediction.id, p_user_id, v_fixture_id, v_event_type, v_existing.outcome, v_choice
    );

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id', v_prediction.id,
      'fixture_id', v_prediction.fixture_id,
      'outcome', v_prediction.outcome,
      'status', v_prediction.status,
      'updated_at', v_prediction.updated_at
    ));
  end loop;

  return v_result;
end;
$$;

revoke execute on function public.save_predictions(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_predictions(uuid, jsonb) to service_role;

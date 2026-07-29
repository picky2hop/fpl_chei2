-- Keep the prediction write and audit event atomic. The server service role is
-- the only role allowed to execute this database-authoritative operation.
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
  v_existing record;
  v_prediction record;
  v_event_type text;
begin
  if p_choice not in ('home', 'draw', 'away') then
    raise exception 'Invalid prediction choice' using errcode = '22023';
  end if;

  select id, kickoff_at, status
    into v_fixture
    from public.fixtures
   where id = p_fixture_id
   for update;

  if not found or v_fixture.status <> 'scheduled' or v_fixture.kickoff_at <= now() then
    raise exception 'Prediction is locked' using errcode = '55P03';
  end if;

  if not exists (
    select 1
      from public.gameweek_participants gp
     where gp.user_id = p_user_id
       and gp.gameweek_id = (select gameweek_id from public.fixtures where id = p_fixture_id)
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

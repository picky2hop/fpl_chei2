-- Fantasy Chey Chey
-- Migration 002: Predictions and prediction security
-- Predictions store only the current value per user and fixture.

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  fixture_id uuid not null references public.fixtures (id),
  outcome text not null
    check (outcome in ('HOME', 'DRAW', 'AWAY')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fixture_id)
);
create index predictions_fixture_outcome_user_idx
  on public.predictions (fixture_id, outcome, user_id);
create index predictions_user_updated_idx
  on public.predictions (user_id, updated_at desc);
create schema if not exists private;
create or replace function private.can_write_prediction(p_fixture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.app_users as au
      where au.id = (select auth.uid())
        and au.status = 'active'
    )
    and exists (
      select 1
      from public.fixtures as f
      join public.fixture_source_records as fsr
        on fsr.fixture_id = f.id
      where f.id = p_fixture_id
        and fsr.kickoff_at is not null
        and now() < fsr.kickoff_at
    );
$$;
revoke all on function private.can_write_prediction(uuid)
  from public, anon, authenticated, service_role;
create or replace function private.prevent_prediction_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.fixture_id <> old.fixture_id then
    raise exception 'Prediction identity cannot be changed';
  end if;

  return new;
end;
$$;
create trigger predictions_identity_immutable
  before update on public.predictions
  for each row
  execute function private.prevent_prediction_identity_change();
alter table public.predictions enable row level security;
grant select, insert, update on public.predictions to authenticated;
grant all on public.predictions to service_role;
create policy "Authenticated users can read predictions"
  on public.predictions
  for select
  to authenticated
  using (true);
create policy "Players can insert own predictions before kickoff"
  on public.predictions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.can_write_prediction(fixture_id))
  );
create policy "Players can update own predictions before kickoff"
  on public.predictions
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.can_write_prediction(fixture_id))
  )
  with check (
    user_id = (select auth.uid())
    and (select private.can_write_prediction(fixture_id))
  );

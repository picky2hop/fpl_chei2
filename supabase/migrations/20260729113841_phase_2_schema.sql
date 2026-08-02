begin;

-- This migration extends the existing Phase 2 foundation already present in the
-- project. It deliberately preserves existing users, fixtures and predictions.

alter table public.seasons
  add column if not exists status text not null default 'upcoming';

update public.seasons
set status = case when is_current then 'active' else 'closed' end
where status = 'upcoming';

alter table public.seasons
  add constraint seasons_phase2_status_check
  check (status in ('upcoming', 'active', 'closed'));

alter table public.gameweeks
  add column if not exists close_at timestamptz,
  add column if not exists scoring_version integer not null default 1;

alter table public.gameweeks
  add constraint gameweeks_phase2_status_check
  check (status in ('upcoming', 'open', 'closed', 'reopened'));

alter table public.fixtures
  add column if not exists kickoff_at timestamptz,
  add column if not exists status text,
  add column if not exists home_score smallint,
  add column if not exists away_score smallint,
  add column if not exists last_synced_at timestamptz;

update public.fixtures as f
set
  kickoff_at = source.kickoff_at,
  status = source.status,
  home_score = source.home_score,
  away_score = source.away_score,
  last_synced_at = source.fetched_at
from public.fixture_source_records as source
where source.fixture_id = f.id;

alter table public.fixtures
  alter column status set default 'scheduled',
  alter column status set not null,
  alter column kickoff_at set not null,
  add constraint fixtures_phase2_status_check
    check (status in ('scheduled', 'live', 'finished', 'postponed')),
  add constraint fixtures_phase2_scores_check
    check (
      (home_score is null and away_score is null)
      or (home_score is not null and away_score is not null and home_score >= 0 and away_score >= 0)
    );

create index if not exists fixtures_gameweek_status_idx
  on public.fixtures (gameweek_id, status);

create table public.fixture_gameweek_history (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  old_gameweek_id uuid references public.gameweeks(id) on delete restrict,
  new_gameweek_id uuid references public.gameweeks(id) on delete restrict,
  source text not null default 'fpl_api',
  changed_at timestamptz not null default now(),
  provider_payload jsonb
);

create index fixture_gameweek_history_fixture_idx
  on public.fixture_gameweek_history (fixture_id, changed_at desc);

create table public.gameweek_participants (
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete restrict,
  status text not null default 'active',
  reason text,
  changed_at timestamptz not null default now(),
  primary key (gameweek_id, user_id),
  constraint gameweek_participants_status_check
    check (status in ('active', 'excluded'))
);

create index gameweek_participants_user_idx
  on public.gameweek_participants (user_id, gameweek_id);

alter table public.predictions
  add column if not exists status text not null default 'active',
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz;

alter table public.predictions
  drop constraint predictions_outcome_check;

update public.predictions
set outcome = lower(outcome)
where outcome <> lower(outcome);

alter table public.predictions
  add constraint predictions_phase2_outcome_check
    check (outcome in ('home', 'draw', 'away')),
  add constraint predictions_status_check
    check (status in ('active', 'voided'));

alter table public.predictions
  drop constraint predictions_user_id_fixture_id_key;

create unique index predictions_one_active_per_user_fixture_idx
  on public.predictions (user_id, fixture_id)
  where status = 'active';

create index predictions_active_fixture_idx
  on public.predictions (fixture_id, status, user_id);

create table public.prediction_events (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid references public.predictions(id) on delete set null,
  user_id uuid not null references public.app_users(id) on delete restrict,
  fixture_id uuid not null references public.fixtures(id) on delete restrict,
  event_type text not null,
  previous_choice text,
  choice text,
  reason text,
  created_at timestamptz not null default now(),
  constraint prediction_events_type_check
    check (event_type in ('created', 'updated', 'voided')),
  constraint prediction_events_previous_choice_check
    check (previous_choice is null or previous_choice in ('home', 'draw', 'away')),
  constraint prediction_events_choice_check
    check (choice is null or choice in ('home', 'draw', 'away'))
);

create index prediction_events_fixture_created_idx
  on public.prediction_events (fixture_id, created_at desc);

create index prediction_events_user_created_idx
  on public.prediction_events (user_id, created_at desc);

insert into public.prediction_events (prediction_id, user_id, fixture_id, event_type, choice, reason)
select id, user_id, fixture_id, 'created', outcome, 'legacy_backfill'
from public.predictions;

create table public.gameweek_scores (
  id uuid primary key default gen_random_uuid(),
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete restrict,
  points integer not null default 0 check (points >= 0),
  correct_predictions integer not null default 0 check (correct_predictions >= 0),
  predicted_fixtures integer not null default 0 check (predicted_fixtures >= 0),
  counted_fixtures integer not null default 0 check (counted_fixtures >= 0),
  scoring_version integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gameweek_id, user_id)
);

create index gameweek_scores_user_idx
  on public.gameweek_scores (user_id, gameweek_id);

create table public.gameweek_awards (
  id uuid primary key default gen_random_uuid(),
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete restrict,
  award text not null,
  points integer not null check (points >= 0),
  scoring_version integer not null,
  created_at timestamptz not null default now(),
  unique (gameweek_id, user_id, award),
  constraint gameweek_awards_award_check
    check (award in ('champion', 'wooden_spoon'))
);

create index gameweek_awards_user_idx
  on public.gameweek_awards (user_id, gameweek_id);

alter table public.sync_runs rename to job_runs;

alter table public.job_runs
  add column if not exists job_type text not null default 'fpl_sync',
  add column if not exists mode text not null default 'results',
  add column if not exists source text not null default 'fpl_api',
  add column if not exists affected_gameweek_ids jsonb not null default '[]'::jsonb;

update public.job_runs
set source = source_name,
    mode = case when scope in ('schedule', 'results', 'manual_schedule', 'manual_results') then scope else 'results' end;

alter table public.job_runs
  add constraint job_runs_phase2_mode_check
    check (mode in ('results', 'schedule', 'manual_results', 'manual_schedule', 'recalculate'));

create index job_runs_mode_started_idx
  on public.job_runs (mode, started_at desc);

create or replace function public.replace_gameweek_scoring(
  p_gameweek_id uuid,
  p_scoring_version integer,
  p_scores jsonb,
  p_awards jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_scores) <> 'array' or jsonb_typeof(p_awards) <> 'array' then
    raise exception 'scores and awards must be JSON arrays';
  end if;

  delete from public.gameweek_awards where gameweek_id = p_gameweek_id;
  delete from public.gameweek_scores where gameweek_id = p_gameweek_id;

  insert into public.gameweek_scores (
    gameweek_id,
    user_id,
    points,
    correct_predictions,
    predicted_fixtures,
    counted_fixtures,
    scoring_version
  )
  select
    p_gameweek_id,
    item.user_id,
    item.points,
    item.correct_predictions,
    item.predicted_fixtures,
    item.counted_fixtures,
    p_scoring_version
  from jsonb_to_recordset(p_scores) as item(
    user_id uuid,
    points integer,
    correct_predictions integer,
    predicted_fixtures integer,
    counted_fixtures integer
  );

  insert into public.gameweek_awards (
    gameweek_id,
    user_id,
    award,
    points,
    scoring_version
  )
  select
    p_gameweek_id,
    item.user_id,
    item.award,
    item.points,
    p_scoring_version
  from jsonb_to_recordset(p_awards) as item(
    user_id uuid,
    award text,
    points integer
  );

  update public.gameweeks
  set scoring_version = p_scoring_version,
      updated_at = now()
  where id = p_gameweek_id;
end;
$$;

revoke all on function public.replace_gameweek_scoring(uuid, integer, jsonb, jsonb) from public;
grant execute on function public.replace_gameweek_scoring(uuid, integer, jsonb, jsonb) to service_role;

do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'app_users',
    'seasons',
    'gameweeks',
    'teams',
    'fixtures',
    'fixture_source_records',
    'fixture_gameweek_history',
    'gameweek_participants',
    'predictions',
    'prediction_events',
    'gameweek_scores',
    'gameweek_awards',
    'job_runs'
  ] loop
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
    end loop;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      'server_only_' || table_name,
      table_name
    );
  end loop;
end;
$$;

commit;

;

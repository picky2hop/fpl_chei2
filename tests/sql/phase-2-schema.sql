-- Read-only live Supabase verification queries for Phase 2.
-- Run through Supabase MCP execute_sql; this file intentionally contains no DDL/DML.

select table_name, pg_class.relrowsecurity as rls_enabled
from information_schema.tables
join pg_class on pg_class.relname = information_schema.tables.table_name
             and pg_class.relnamespace = 'public'::regnamespace
where table_schema = 'public'
  and table_name in (
    'seasons', 'gameweeks', 'teams', 'fixtures', 'fixture_source_records',
    'fixture_gameweek_history', 'app_users', 'gameweek_participants',
    'predictions', 'prediction_events', 'gameweek_scores', 'gameweek_awards', 'job_runs'
  )
order by table_name;

select
  has_table_privilege('anon', 'public.predictions', 'select') as anon_can_select_predictions,
  has_table_privilege('authenticated', 'public.predictions', 'insert') as authenticated_can_insert_predictions,
  has_function_privilege('anon', 'public.replace_gameweek_scoring(uuid,integer,jsonb,jsonb)', 'execute') as anon_can_execute_scoring,
  has_function_privilege('service_role', 'public.replace_gameweek_scoring(uuid,integer,jsonb,jsonb)', 'execute') as service_role_can_execute_scoring,
  has_function_privilege('anon', 'public.save_prediction(uuid,uuid,text)', 'execute') as anon_can_execute_prediction_write,
  has_function_privilege('service_role', 'public.save_prediction(uuid,uuid,text)', 'execute') as service_role_can_execute_prediction_write,
  has_function_privilege('anon', 'public.apply_fpl_sync(uuid,timestamptz,jsonb,jsonb,jsonb)', 'execute') as anon_can_execute_atomic_sync,
  has_function_privilege('authenticated', 'public.apply_fpl_sync(uuid,timestamptz,jsonb,jsonb,jsonb)', 'execute') as authenticated_can_execute_atomic_sync,
  has_function_privilege('service_role', 'public.apply_fpl_sync(uuid,timestamptz,jsonb,jsonb,jsonb)', 'execute') as service_role_can_execute_atomic_sync;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'job_runs'
  and column_name in ('error_code', 'details')
order by column_name;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and (
    indexname like '%predictions_one_active%'
    or indexname like '%fixture_gameweek_history%'
    or indexname like '%prediction_events_prediction%'
  )
order by indexname;

select
  (select count(*) from public.app_users) as app_users,
  (select count(*) from public.fixtures) as fixtures,
  (select count(*) from public.predictions) as predictions,
  (select count(*) from public.prediction_events) as prediction_events,
  (select count(*) from public.gameweek_scores) as gameweek_scores,
  (select count(*) from public.gameweek_awards) as gameweek_awards,
  (select count(*) from public.job_runs) as job_runs;

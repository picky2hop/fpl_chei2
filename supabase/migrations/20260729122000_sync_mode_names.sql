alter table public.job_runs
  drop constraint if exists job_runs_phase2_mode_check;

alter table public.job_runs
  add constraint job_runs_phase2_mode_check
  check (mode in ('results', 'schedule', 'manual_results', 'manual_schedule', 'recalculate', 'scheduled', 'manual'));

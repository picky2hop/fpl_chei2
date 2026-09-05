alter table public.fantasy_entry_gameweek_scores
  drop constraint if exists fantasy_entry_gameweek_scores_calculation_method_check;

alter table public.fantasy_entry_gameweek_scores
  add constraint fantasy_entry_gameweek_scores_calculation_method_check
  check (calculation_method in ('legacy_fpl_history', 'starting_xi_captain_v1', 'starting_xi_captain_v2'));

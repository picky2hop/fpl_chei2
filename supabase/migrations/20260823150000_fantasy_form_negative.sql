alter table public.fantasy_player_gameweek_stats
  drop constraint if exists fantasy_player_gameweek_stats_form_check;

comment on column public.fantasy_player_gameweek_stats.form is
  'FPL player form metric; negative values are valid when supplied by FPL.';

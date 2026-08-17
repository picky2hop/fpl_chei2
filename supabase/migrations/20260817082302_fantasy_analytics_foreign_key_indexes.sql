create index fantasy_entry_mappings_app_user_idx
  on public.fantasy_entry_mappings (app_user_id);

create index fantasy_gameweek_scores_gameweek_idx
  on public.fantasy_gameweek_scores (gameweek_id);

create index fantasy_player_stats_gameweek_idx
  on public.fantasy_player_gameweek_stats (gameweek_id);

create index fantasy_awards_gameweek_idx
  on public.fantasy_awards (gameweek_id);

create index fantasy_awards_mapping_idx
  on public.fantasy_awards (mapping_id);

create index fantasy_awards_selected_by_idx
  on public.fantasy_awards (selected_by);

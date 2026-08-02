create index fixture_gameweek_history_old_gameweek_idx
  on public.fixture_gameweek_history (old_gameweek_id);

create index fixture_gameweek_history_new_gameweek_idx
  on public.fixture_gameweek_history (new_gameweek_id);

create index prediction_events_prediction_idx
  on public.prediction_events (prediction_id);

;

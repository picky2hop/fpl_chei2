-- Manual UI test seed for the isolated Supabase test project only.
-- Never run this script against production.

begin;

-- Remove only the deterministic manual-test namespace so the seed is repeatable.
delete from public.gameweek_awards where gameweek_id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);
delete from public.gameweek_scores where gameweek_id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);
delete from public.prediction_events where fixture_id in (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid,
  '30000000-0000-4000-8000-000000000003'::uuid,
  '30000000-0000-4000-8000-000000000004'::uuid,
  '30000000-0000-4000-8000-000000000005'::uuid
);
delete from public.predictions where fixture_id in (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid,
  '30000000-0000-4000-8000-000000000003'::uuid,
  '30000000-0000-4000-8000-000000000004'::uuid,
  '30000000-0000-4000-8000-000000000005'::uuid
);
delete from public.fixture_gameweek_history where fixture_id in (
  '30000000-0000-4000-8000-000000000005'::uuid
);
delete from public.fixture_source_records where fixture_id in (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid,
  '30000000-0000-4000-8000-000000000003'::uuid,
  '30000000-0000-4000-8000-000000000004'::uuid,
  '30000000-0000-4000-8000-000000000005'::uuid
);
delete from public.fixtures where id in (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid,
  '30000000-0000-4000-8000-000000000003'::uuid,
  '30000000-0000-4000-8000-000000000004'::uuid,
  '30000000-0000-4000-8000-000000000005'::uuid
);
delete from public.gameweek_participants where gameweek_id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);
delete from public.gameweeks where id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);
delete from public.app_users where line_user_id like 'manual-test-%';
delete from public.teams where external_team_id between 200001 and 200004;
delete from public.seasons where external_season_id = 29001;

insert into public.seasons (id, external_season_id, name, starts_on, ends_on, is_current, status)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 29001,
  'Manual Test Season 2026/27', '2026-08-01', '2027-06-01', true, 'active'
);

insert into public.gameweeks (id, season_id, external_gameweek_id, number, name, is_current, status, scoring_version)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 29001, 1, 'Manual GW1 — States and Lock', true, 'open', 2),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 29002, 2, 'Manual GW2 — Move and Recalculation', false, 'closed', 3);

insert into public.teams (id, external_team_id, name, short_name, code)
values
  ('40000000-0000-4000-8000-000000000001', 200001, 'Manual North FC', 'NFC', '901'),
  ('40000000-0000-4000-8000-000000000002', 200002, 'Manual South FC', 'SFC', '902'),
  ('40000000-0000-4000-8000-000000000003', 200003, 'Manual East FC', 'EFC', '903'),
  ('40000000-0000-4000-8000-000000000004', 200004, 'Manual West FC', 'WFC', '904');

insert into public.app_users (id, line_user_id, display_name, status, role)
values
  ('50000000-0000-4000-8000-000000000001', 'manual-test-player-a', 'Manual Player A', 'active', 'player'),
  ('50000000-0000-4000-8000-000000000002', 'manual-test-player-b', 'Manual Player B', 'active', 'player'),
  ('50000000-0000-4000-8000-000000000003', 'manual-test-excluded', 'Manual Excluded Player', 'active', 'player'),
  ('50000000-0000-4000-8000-000000000004', 'manual-test-observer', 'Manual Observer', 'active', 'player');

insert into public.gameweek_participants (gameweek_id, user_id, status, reason)
select gw.id, u.id, case when u.line_user_id = 'manual-test-excluded' and gw.number = 1 then 'excluded' else 'active' end, 'manual_test_seed'
from public.gameweeks gw
cross join public.app_users u
where gw.season_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;

insert into public.fixtures (id, external_fixture_id, season_id, gameweek_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, last_synced_at)
values
  ('30000000-0000-4000-8000-000000000001', 29001001, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '2026-09-01T12:00:00Z', 'scheduled', null, null, now()),
  ('30000000-0000-4000-8000-000000000002', 29001002, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', '2026-08-02T10:00:00Z', 'live', null, null, now()),
  ('30000000-0000-4000-8000-000000000003', 29001003, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', '2026-08-01T10:00:00Z', 'finished', 2, 1, now()),
  ('30000000-0000-4000-8000-000000000004', 29001004, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', '2026-08-03T10:00:00Z', 'postponed', null, null, now()),
  ('30000000-0000-4000-8000-000000000005', 29001005, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', '2026-09-08T12:00:00Z', 'scheduled', null, null, now());

insert into public.fixture_source_records (fixture_id, status, kickoff_at, home_score, away_score, source_updated_at, raw_payload)
select f.id, f.status, f.kickoff_at, f.home_score, f.away_score, now(), jsonb_build_object('manual_test', true, 'external_fixture_id', f.external_fixture_id)
from public.fixtures f
where f.id in (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid,
  '30000000-0000-4000-8000-000000000003'::uuid,
  '30000000-0000-4000-8000-000000000004'::uuid,
  '30000000-0000-4000-8000-000000000005'::uuid
);

insert into public.predictions (id, user_id, fixture_id, outcome, status, void_reason, voided_at)
values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'home', 'active', null, null),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'draw', 'active', null, null),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'draw', 'active', null, null),
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'home', 'active', null, null),
  ('60000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'home', 'active', null, null),
  ('60000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'home', 'active', null, null),
  ('60000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'away', 'active', null, null),
  ('60000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', 'home', 'voided', 'fixture_moved', '2026-08-02T12:00:00Z');

insert into public.fixture_gameweek_history (fixture_id, old_gameweek_id, new_gameweek_id, source, provider_payload)
values (
  '30000000-0000-4000-8000-000000000005',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'fpl_api', jsonb_build_object('manual_test', true, 'reason', 'fixture_gameweek_changed')
);

insert into public.prediction_events (id, prediction_id, user_id, fixture_id, event_type, choice, previous_choice, reason)
values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'created', 'home', null, 'manual_test_seed'),
  ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'created', 'draw', null, 'manual_test_seed'),
  ('70000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'created', 'draw', null, 'manual_test_seed'),
  ('70000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'created', 'home', null, 'manual_test_seed'),
  ('70000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'created', 'home', null, 'manual_test_seed'),
  ('70000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'created', 'home', null, 'manual_test_seed'),
  ('70000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'created', 'away', null, 'manual_test_seed'),
  ('70000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', 'voided', null, 'home', 'fixture_moved');

insert into public.gameweek_scores (gameweek_id, user_id, points, correct_predictions, predicted_fixtures, counted_fixtures, scoring_version)
values
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-000000000001', 3, 1, 1, 1, 2),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-000000000002', 3, 1, 1, 1, 2),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-000000000004', 0, 0, 0, 1, 2),
  ('22222222-2222-4222-8222-222222222222', '50000000-0000-4000-8000-000000000001', 3, 1, 1, 1, 3),
  ('22222222-2222-4222-8222-222222222222', '50000000-0000-4000-8000-000000000002', 0, 0, 1, 1, 3);

insert into public.gameweek_awards (gameweek_id, user_id, award, points, scoring_version)
values
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-000000000001', 'champion', 3, 2),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-000000000002', 'champion', 3, 2),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-000000000001', 'wooden_spoon', 3, 2),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-000000000002', 'wooden_spoon', 3, 2);

commit;

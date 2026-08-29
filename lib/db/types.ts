export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          joined_at: string
          last_seen_at: string | null
          line_user_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          joined_at?: string
          last_seen_at?: string | null
          line_user_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          joined_at?: string
          last_seen_at?: string | null
          line_user_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fixture_gameweek_history: {
        Row: {
          changed_at: string
          fixture_id: string
          id: string
          new_gameweek_id: string | null
          old_gameweek_id: string | null
          provider_payload: Json | null
          source: string
        }
        Insert: {
          changed_at?: string
          fixture_id: string
          id?: string
          new_gameweek_id?: string | null
          old_gameweek_id?: string | null
          provider_payload?: Json | null
          source?: string
        }
        Update: {
          changed_at?: string
          fixture_id?: string
          id?: string
          new_gameweek_id?: string | null
          old_gameweek_id?: string | null
          provider_payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_gameweek_history_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_gameweek_history_new_gameweek_id_fkey"
            columns: ["new_gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_gameweek_history_old_gameweek_id_fkey"
            columns: ["old_gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_source_records: {
        Row: {
          away_score: number | null
          created_at: string
          fetched_at: string
          fixture_id: string
          home_score: number | null
          id: string
          kickoff_at: string | null
          raw_payload: Json | null
          source_name: string
          source_updated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          created_at?: string
          fetched_at?: string
          fixture_id: string
          home_score?: number | null
          id?: string
          kickoff_at?: string | null
          raw_payload?: Json | null
          source_name?: string
          source_updated_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          created_at?: string
          fetched_at?: string
          fixture_id?: string
          home_score?: number | null
          id?: string
          kickoff_at?: string | null
          raw_payload?: Json | null
          source_name?: string
          source_updated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_source_records_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          away_score: number | null
          away_team_id: string
          created_at: string
          external_fixture_id: number
          gameweek_id: string | null
          home_score: number | null
          home_team_id: string
          id: string
          kickoff_at: string
          last_synced_at: string | null
          season_id: string
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          created_at?: string
          external_fixture_id: number
          gameweek_id?: string | null
          home_score?: number | null
          home_team_id: string
          id?: string
          kickoff_at: string
          last_synced_at?: string | null
          season_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          created_at?: string
          external_fixture_id?: number
          gameweek_id?: string | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          kickoff_at?: string
          last_synced_at?: string | null
          season_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      gameweek_awards: {
        Row: {
          award: string
          created_at: string
          gameweek_id: string
          id: string
          points: number
          scoring_version: number
          user_id: string
        }
        Insert: {
          award: string
          created_at?: string
          gameweek_id: string
          id?: string
          points: number
          scoring_version: number
          user_id: string
        }
        Update: {
          award?: string
          created_at?: string
          gameweek_id?: string
          id?: string
          points?: number
          scoring_version?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameweek_awards_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gameweek_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      gameweek_participants: {
        Row: {
          changed_at: string
          gameweek_id: string
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          gameweek_id: string
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          changed_at?: string
          gameweek_id?: string
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameweek_participants_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gameweek_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      gameweek_scores: {
        Row: {
          correct_predictions: number
          counted_fixtures: number
          created_at: string
          gameweek_id: string
          id: string
          points: number
          predicted_fixtures: number
          scoring_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_predictions?: number
          counted_fixtures?: number
          created_at?: string
          gameweek_id: string
          id?: string
          points?: number
          predicted_fixtures?: number
          scoring_version: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_predictions?: number
          counted_fixtures?: number
          created_at?: string
          gameweek_id?: string
          id?: string
          points?: number
          predicted_fixtures?: number
          scoring_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameweek_scores_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gameweek_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      gameweeks: {
        Row: {
          close_at: string | null
          created_at: string
          external_gameweek_id: number
          id: string
          is_current: boolean
          name: string | null
          number: number
          scoring_version: number
          season_id: string
          status: string
          updated_at: string
        }
        Insert: {
          close_at?: string | null
          created_at?: string
          external_gameweek_id: number
          id?: string
          is_current?: boolean
          name?: string | null
          number: number
          scoring_version?: number
          season_id: string
          status: string
          updated_at?: string
        }
        Update: {
          close_at?: string | null
          created_at?: string
          external_gameweek_id?: number
          id?: string
          is_current?: boolean
          name?: string | null
          number?: number
          scoring_version?: number
          season_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameweeks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          affected_gameweek_ids: Json
          created_at: string
          details: Json
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          mode: string
          records_upserted: number
          scope: string
          source: string
          source_name: string
          started_at: string
          status: string
        }
        Insert: {
          affected_gameweek_ids?: Json
          created_at?: string
          details?: Json
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          job_type?: string
          mode?: string
          records_upserted?: number
          scope: string
          source?: string
          source_name: string
          started_at?: string
          status: string
        }
        Update: {
          affected_gameweek_ids?: Json
          created_at?: string
          details?: Json
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          mode?: string
          records_upserted?: number
          scope?: string
          source?: string
          source_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      prediction_events: {
        Row: {
          choice: string | null
          created_at: string
          event_type: string
          fixture_id: string
          id: string
          prediction_id: string | null
          previous_choice: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          choice?: string | null
          created_at?: string
          event_type: string
          fixture_id: string
          id?: string
          prediction_id?: string | null
          previous_choice?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          choice?: string | null
          created_at?: string
          event_type?: string
          fixture_id?: string
          id?: string
          prediction_id?: string | null
          previous_choice?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_events_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          outcome: string
          status: string
          updated_at: string
          user_id: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          outcome: string
          status?: string
          updated_at?: string
          user_id: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          outcome?: string
          status?: string
          updated_at?: string
          user_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_on: string | null
          external_season_id: number | null
          id: string
          is_current: boolean
          name: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          external_season_id?: number | null
          id?: string
          is_current?: boolean
          name: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          external_season_id?: number | null
          id?: string
          is_current?: boolean
          name?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          code: string | null
          created_at: string
          external_team_id: number
          id: string
          logo_url: string | null
          name: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          external_team_id: number
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          external_team_id?: number
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fantasy_leagues: {
        Row: {
          archived_at: string | null
          created_at: string
          fpl_league_id: number
          id: string
          last_error_message: string | null
          last_sync_status: string
          last_synced_at: string | null
          official_name: string
          season_id: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          fpl_league_id: number
          id?: string
          last_error_message?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          official_name: string
          season_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          fpl_league_id?: number
          id?: string
          last_error_message?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          official_name?: string
          season_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_leagues_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ]
      }
      fantasy_league_membership_snapshots: {
        Row: {
          created_at: string
          fpl_entry_id: number
          fpl_manager_name: string
          fpl_team_name: string
          gameweek_id: string
          id: string
          league_id: string
          season_id: string
          source_synced_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fpl_entry_id: number
          fpl_manager_name: string
          fpl_team_name: string
          gameweek_id: string
          id?: string
          league_id: string
          season_id: string
          source_synced_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fpl_entry_id?: number
          fpl_manager_name?: string
          fpl_team_name?: string
          gameweek_id?: string
          id?: string
          league_id?: string
          season_id?: string
          source_synced_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_league_membership_snapshots_gameweek_id_fkey"; columns: ["gameweek_id"]; isOneToOne: false; referencedRelation: "gameweeks"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_league_membership_snapshots_league_id_fkey"; columns: ["league_id"]; isOneToOne: false; referencedRelation: "fantasy_leagues"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_league_membership_snapshots_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ]
      }
      fantasy_entry_gameweek_scores: {
        Row: {
          created_at: string
          calculation_method: string
          event_transfers: number
          event_transfers_cost: number
          fpl_entry_id: number
          fpl_manager_name: string
          fpl_team_name: string
          gameweek_id: string
          id: string
          points: number
          points_on_bench: number
          season_id: string
          source_synced_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          calculation_method?: string
          event_transfers?: number
          event_transfers_cost?: number
          fpl_entry_id: number
          fpl_manager_name: string
          fpl_team_name: string
          gameweek_id: string
          id?: string
          points: number
          points_on_bench?: number
          season_id: string
          source_synced_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          calculation_method?: string
          event_transfers?: number
          event_transfers_cost?: number
          fpl_entry_id?: number
          fpl_manager_name?: string
          fpl_team_name?: string
          gameweek_id?: string
          id?: string
          points?: number
          points_on_bench?: number
          season_id?: string
          source_synced_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_entry_gameweek_scores_gameweek_id_fkey"; columns: ["gameweek_id"]; isOneToOne: false; referencedRelation: "gameweeks"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_entry_gameweek_scores_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ]
      }
      fantasy_entry_current_squads: {
        Row: {
          created_at: string
          fpl_entry_id: number
          gameweek_id: string
          gameweek_number: number
          id: string
          season_id: string
          source_synced_at: string
          squad: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          fpl_entry_id: number
          gameweek_id: string
          gameweek_number: number
          id?: string
          season_id: string
          source_synced_at: string
          squad: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          fpl_entry_id?: number
          gameweek_id?: string
          gameweek_number?: number
          id?: string
          season_id?: string
          source_synced_at?: string
          squad?: Json
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_entry_current_squads_gameweek_id_fkey"; columns: ["gameweek_id"]; isOneToOne: false; referencedRelation: "gameweeks"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_entry_current_squads_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ]
      }
      fantasy_league_awards: {
        Row: {
          award: string
          created_at: string
          fpl_entry_id: number
          gameweek_id: string
          id: string
          league_id: string
          season_id: string
          selected_by: string
          updated_at: string
        }
        Insert: {
          award: string
          created_at?: string
          fpl_entry_id: number
          gameweek_id: string
          id?: string
          league_id: string
          season_id: string
          selected_by: string
          updated_at?: string
        }
        Update: {
          award?: string
          created_at?: string
          fpl_entry_id?: number
          gameweek_id?: string
          id?: string
          league_id?: string
          season_id?: string
          selected_by?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_league_awards_gameweek_id_fkey"; columns: ["gameweek_id"]; isOneToOne: false; referencedRelation: "gameweeks"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_league_awards_league_id_fkey"; columns: ["league_id"]; isOneToOne: false; referencedRelation: "fantasy_leagues"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_league_awards_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_league_awards_selected_by_fkey"; columns: ["selected_by"]; isOneToOne: false; referencedRelation: "app_users"; referencedColumns: ["id"] },
        ]
      }
      fantasy_entry_mappings: {
        Row: {
          app_user_id: string
          archived_at: string | null
          created_at: string
          fpl_entry_id: number
          fpl_manager_name: string
          fpl_team_name: string
          id: string
          last_error_message: string | null
          last_validation_status: string
          linked_at: string
          mapping_status: string
          season_id: string
          updated_at: string
        }
        Insert: {
          app_user_id: string
          archived_at?: string | null
          created_at?: string
          fpl_entry_id: number
          fpl_manager_name: string
          fpl_team_name: string
          id?: string
          last_error_message?: string | null
          last_validation_status?: string
          linked_at?: string
          mapping_status?: string
          season_id: string
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          archived_at?: string | null
          created_at?: string
          fpl_entry_id?: number
          fpl_manager_name?: string
          fpl_team_name?: string
          id?: string
          last_error_message?: string | null
          last_validation_status?: string
          linked_at?: string
          mapping_status?: string
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_entry_mappings_app_user_id_fkey"; columns: ["app_user_id"]; isOneToOne: false; referencedRelation: "app_users"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_entry_mappings_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ]
      }
      fantasy_gameweek_scores: {
        Row: {
          created_at: string
          event_transfers: number
          event_transfers_cost: number
          gameweek_id: string
          id: string
          mapping_id: string
          points: number
          points_on_bench: number
          season_id: string
          source_synced_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_transfers?: number
          event_transfers_cost?: number
          gameweek_id: string
          id?: string
          mapping_id: string
          points: number
          points_on_bench?: number
          season_id: string
          source_synced_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_transfers?: number
          event_transfers_cost?: number
          gameweek_id?: string
          id?: string
          mapping_id?: string
          points?: number
          points_on_bench?: number
          season_id?: string
          source_synced_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_gameweek_scores_gameweek_id_fkey"; columns: ["gameweek_id"]; isOneToOne: false; referencedRelation: "gameweeks"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_gameweek_scores_mapping_id_fkey"; columns: ["mapping_id"]; isOneToOne: false; referencedRelation: "fantasy_entry_mappings"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_gameweek_scores_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ]
      }
      fantasy_player_gameweek_stats: {
        Row: {
          club_id: number
          club_name: string
          created_at: string
          defensive_contribution: number
          fpl_player_id: number
          form: number
          gameweek_id: string
          id: string
          bps: number
          expected_goal_involvements_per_90: number
          latest_finished_gameweek_points: number | null
          latest_finished_gameweek_defensive_contribution: number | null
          latest_finished_gameweek_bps: number | null
          latest_finished_gameweek_number: number | null
          photo_key: string | null
          player_name: string
          position: string
          season_id: string
          selected_by_percent: number
          source_synced_at: string
          status: string
          transfers_in_event: number
          transfers_out_event: number
          is_global_captain: boolean
          is_global_vice_captain: boolean
          updated_at: string
          points_per_game: number
        }
        Insert: {
          club_id: number
          club_name: string
          created_at?: string
          defensive_contribution?: number
          fpl_player_id: number
          form?: number
          gameweek_id: string
          id?: string
          bps?: number
          expected_goal_involvements_per_90?: number
          latest_finished_gameweek_points?: number | null
          latest_finished_gameweek_defensive_contribution?: number | null
          latest_finished_gameweek_bps?: number | null
          latest_finished_gameweek_number?: number | null
          photo_key?: string | null
          player_name: string
          position: string
          season_id: string
          selected_by_percent?: number
          source_synced_at: string
          status: string
          transfers_in_event?: number
          transfers_out_event?: number
          is_global_captain?: boolean
          is_global_vice_captain?: boolean
          updated_at?: string
          points_per_game?: number
        }
        Update: {
          club_id?: number
          club_name?: string
          created_at?: string
          defensive_contribution?: number
          fpl_player_id?: number
          form?: number
          gameweek_id?: string
          id?: string
          bps?: number
          expected_goal_involvements_per_90?: number
          latest_finished_gameweek_points?: number | null
          latest_finished_gameweek_defensive_contribution?: number | null
          latest_finished_gameweek_bps?: number | null
          latest_finished_gameweek_number?: number | null
          photo_key?: string | null
          player_name?: string
          position?: string
          season_id?: string
          selected_by_percent?: number
          source_synced_at?: string
          status?: string
          transfers_in_event?: number
          transfers_out_event?: number
          is_global_captain?: boolean
          is_global_vice_captain?: boolean
          updated_at?: string
          points_per_game?: number
        }
        Relationships: [
          { foreignKeyName: "fantasy_player_gameweek_stats_gameweek_id_fkey"; columns: ["gameweek_id"]; isOneToOne: false; referencedRelation: "gameweeks"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_player_gameweek_stats_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ]
      }
      fantasy_awards: {
        Row: {
          award: string
          created_at: string
          gameweek_id: string
          id: string
          mapping_id: string
          season_id: string
          selected_by: string
          updated_at: string
        }
        Insert: {
          award: string
          created_at?: string
          gameweek_id: string
          id?: string
          mapping_id: string
          season_id: string
          selected_by: string
          updated_at?: string
        }
        Update: {
          award?: string
          created_at?: string
          gameweek_id?: string
          id?: string
          mapping_id?: string
          season_id?: string
          selected_by?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "fantasy_awards_gameweek_id_fkey"; columns: ["gameweek_id"]; isOneToOne: false; referencedRelation: "gameweeks"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_awards_mapping_id_fkey"; columns: ["mapping_id"]; isOneToOne: false; referencedRelation: "fantasy_entry_mappings"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_awards_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
          { foreignKeyName: "fantasy_awards_selected_by_fkey"; columns: ["selected_by"]; isOneToOne: false; referencedRelation: "app_users"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_fantasy_league_sync: {
        Args: {
          p_job_run_id: string
          p_leagues: Json
          p_memberships: Json
          p_players: Json
          p_scores: Json
          p_synced_at: string
        }
        Returns: Json
      }
      apply_fantasy_score_recalculation: {
        Args: {
          p_job_run_id: string
          p_memberships: Json
          p_scores: Json
        }
        Returns: Json
      }
      apply_fantasy_player_stats_sync: {
        Args: {
          p_job_run_id: string
          p_players: Json
          p_synced_at: string
        }
        Returns: Json
      }
      replace_fantasy_league_awards: {
        Args: {
          p_awards: Json
          p_gameweek_id: string
          p_league_id: string
          p_season_id: string
          p_selected_by: string
        }
        Returns: undefined
      }
      apply_fpl_sync: {
        Args: {
          p_fixtures: Json
          p_gameweeks: Json
          p_job_run_id: string
          p_synced_at: string
          p_teams: Json
        }
        Returns: Json
      }
      replace_gameweek_scoring: {
        Args: {
          p_awards: Json
          p_gameweek_id: string
          p_scores: Json
          p_scoring_version: number
        }
        Returns: undefined
      }
      save_prediction: {
        Args: { p_choice: string; p_fixture_id: string; p_user_id: string }
        Returns: Json
      }
      save_predictions: {
        Args: { p_predictions: Json; p_user_id: string }
        Returns: Json
      }
      apply_fantasy_sync: {
        Args: {
          p_job_run_id: string
          p_mapping_results: Json
          p_players: Json
          p_scores: Json
          p_synced_at: string
        }
        Returns: Json
      }
      replace_fantasy_awards: {
        Args: {
          p_awards: Json
          p_gameweek_id: string
          p_season_id: string
          p_selected_by: string
        }
        Returns: undefined
      }
      replace_fantasy_mapping: {
        Args: {
          p_app_user_id: string
          p_archived_at: string
          p_fpl_entry_id: number
          p_fpl_manager_name: string
          p_fpl_team_name: string
          p_mapping_id: string
          p_season_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

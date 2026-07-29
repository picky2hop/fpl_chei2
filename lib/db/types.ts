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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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


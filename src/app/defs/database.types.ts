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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alliances: {
        Row: {
          created_at: string
          name: string | null
          tag: string
          theme: string | null
        }
        Insert: {
          created_at?: string
          name?: string | null
          tag: string
          theme?: string | null
        }
        Update: {
          created_at?: string
          name?: string | null
          tag?: string
          theme?: string | null
        }
        Relationships: []
      }
      bear_times: {
        Row: {
          created_at: string
          id: number
          label: string
        }
        Insert: {
          created_at?: string
          id?: number
          label: string
        }
        Update: {
          created_at?: string
          id?: number
          label?: string
        }
        Relationships: []
      }
      calendar_event_checkpoints: {
        Row: {
          created_at: string
          day_offset: number
          event_id: number
          id: number
          notes: string | null
          task_id: number | null
          time: string | null
          title: string
        }
        Insert: {
          created_at?: string
          day_offset?: number
          event_id: number
          id?: number
          notes?: string | null
          task_id?: number | null
          time?: string | null
          title: string
        }
        Update: {
          created_at?: string
          day_offset?: number
          event_id?: number
          id?: number
          notes?: string | null
          task_id?: number | null
          time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_checkpoints_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_checkpoints_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_skips: {
        Row: {
          event_id: number
          occurrence_date: string
        }
        Insert: {
          event_id: number
          occurrence_date: string
        }
        Update: {
          event_id?: number
          occurrence_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_skips_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color: string
          created_at: string
          end_date: string
          end_time: string | null
          id: number
          notes: string | null
          repeat_every: number | null
          repeat_unit: string
          repeat_until: string | null
          shift_if_same_day_as: number[]
          shift_minutes: number | null
          start_date: string
          start_time: string | null
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          end_date: string
          end_time?: string | null
          id?: number
          notes?: string | null
          repeat_every?: number | null
          repeat_unit?: string
          repeat_until?: string | null
          shift_if_same_day_as?: number[]
          shift_minutes?: number | null
          start_date: string
          start_time?: string | null
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          end_date?: string
          end_time?: string | null
          id?: number
          notes?: string | null
          repeat_every?: number | null
          repeat_unit?: string
          repeat_until?: string | null
          shift_if_same_day_as?: number[]
          shift_minutes?: number | null
          start_date?: string
          start_time?: string | null
          title?: string
        }
        Relationships: []
      }
      canyon_clash_participants: {
        Row: {
          clash_id: number
          created_at: string
          id: number
          is_substitute: boolean
          member_id: number
          notes: string | null
          power: number | null
          registered: boolean
          score: number | null
          showed_up: boolean | null
        }
        Insert: {
          clash_id: number
          created_at?: string
          id?: number
          is_substitute?: boolean
          member_id: number
          notes?: string | null
          power?: number | null
          registered?: boolean
          score?: number | null
          showed_up?: boolean | null
        }
        Update: {
          clash_id?: number
          created_at?: string
          id?: number
          is_substitute?: boolean
          member_id?: number
          notes?: string | null
          power?: number | null
          registered?: boolean
          score?: number | null
          showed_up?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "canyon_clash_participants_clash_id_fkey"
            columns: ["clash_id"]
            isOneToOne: false
            referencedRelation: "canyon_clashes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canyon_clash_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      canyon_clashes: {
        Row: {
          created_at: string
          date: string
          id: number
          legion: number
          notes: string | null
          opponent: string | null
          opponent_2: string | null
          opponent_2_score: number | null
          opponent_score: number | null
          our_score: number | null
          time: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          legion?: number
          notes?: string | null
          opponent?: string | null
          opponent_2?: string | null
          opponent_2_score?: number | null
          opponent_score?: number | null
          our_score?: number | null
          time: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          legion?: number
          notes?: string | null
          opponent?: string | null
          opponent_2?: string | null
          opponent_2_score?: number | null
          opponent_score?: number | null
          our_score?: number | null
          time?: string
        }
        Relationships: []
      }
      foundries: {
        Row: {
          created_at: string
          date: string
          id: number
          legion: number
          notes: string | null
          opponent: string | null
          opponent_score: number | null
          our_score: number | null
          status: string | null
          time: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          legion: number
          notes?: string | null
          opponent?: string | null
          opponent_score?: number | null
          our_score?: number | null
          status?: string | null
          time: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          legion?: number
          notes?: string | null
          opponent?: string | null
          opponent_score?: number | null
          our_score?: number | null
          status?: string | null
          time?: string
        }
        Relationships: []
      }
      foundry_participants: {
        Row: {
          created_at: string
          foundry_id: number
          id: number
          is_substitute: boolean | null
          member_id: number
          notes: string | null
          power: number | null
          registered: boolean
          score: number | null
          showed_up: boolean | null
        }
        Insert: {
          created_at?: string
          foundry_id: number
          id?: number
          is_substitute?: boolean | null
          member_id: number
          notes?: string | null
          power?: number | null
          registered?: boolean
          score?: number | null
          showed_up?: boolean | null
        }
        Update: {
          created_at?: string
          foundry_id?: number
          id?: number
          is_substitute?: boolean | null
          member_id?: number
          notes?: string | null
          power?: number | null
          registered?: boolean
          score?: number | null
          showed_up?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "foundry_participants_foundry_id_fkey"
            columns: ["foundry_id"]
            isOneToOne: false
            referencedRelation: "foundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foundry_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_log: {
        Row: {
          created_at: string
          id: number
          member_id: number
          new_value_num: number | null
          new_value_text: string | null
          previous_value_num: number | null
          previous_value_text: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: number
          member_id: number
          new_value_num?: number | null
          new_value_text?: string | null
          previous_value_num?: number | null
          previous_value_text?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: number
          member_id?: number
          new_value_num?: number | null
          new_value_text?: string | null
          previous_value_num?: number | null
          previous_value_text?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          bear: number | null
          created_at: string
          furnace_level: number | null
          gameId: number | null
          id: number
          infantry_fc_level: number | null
          infantry_tier: number | null
          joined: string
          lancer_fc_level: number | null
          lancer_tier: number | null
          marksman_fc_level: number | null
          marksman_tier: number | null
          name: string
          notes: string | null
          power: number | null
          rank: string
          status: number
        }
        Insert: {
          bear?: number | null
          created_at?: string
          furnace_level?: number | null
          gameId?: number | null
          id?: number
          infantry_fc_level?: number | null
          infantry_tier?: number | null
          joined: string
          lancer_fc_level?: number | null
          lancer_tier?: number | null
          marksman_fc_level?: number | null
          marksman_tier?: number | null
          name: string
          notes?: string | null
          power?: number | null
          rank: string
          status: number
        }
        Update: {
          bear?: number | null
          created_at?: string
          furnace_level?: number | null
          gameId?: number | null
          id?: number
          infantry_fc_level?: number | null
          infantry_tier?: number | null
          joined?: string
          lancer_fc_level?: number | null
          lancer_tier?: number | null
          marksman_fc_level?: number | null
          marksman_tier?: number | null
          name?: string
          notes?: string | null
          power?: number | null
          rank?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "members_bear_fkey"
            columns: ["bear"]
            isOneToOne: false
            referencedRelation: "bear_times"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          color: string
          created_at: string
          id: number
          is_active: boolean
          is_transferred_out: boolean
          status: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: number
          is_active: boolean
          is_transferred_out?: boolean
          status: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: number
          is_active?: boolean
          is_transferred_out?: boolean
          status?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          created_at: string
          id: number
          member_id: number
          notes: string | null
          role: string
          task_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          member_id: number
          notes?: string | null
          role?: string
          task_id: number
        }
        Update: {
          created_at?: string
          id?: number
          member_id?: number
          notes?: string | null
          role?: string
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          id: number
          notes: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: number
          notes?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: number
          notes?: string | null
          title?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          display_name: string | null
          id: string
          is_admin: boolean | null
          is_approved: boolean | null
          member_id: number | null
        }
        Insert: {
          display_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_approved?: boolean | null
          member_id?: number | null
        }
        Update: {
          display_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_approved?: boolean | null
          member_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_user: { Args: never; Returns: boolean }
      is_approved_user: { Args: never; Returns: boolean }
      link_my_member: { Args: { p_member_id: number }; Returns: undefined }
      save_calendar_event: {
        Args: { p_checkpoints: Json; p_event: Json }
        Returns: number
      }
      save_event_day: {
        Args: { p_date: string; p_events: Json; p_kind: string }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

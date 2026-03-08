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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bot_commands: {
        Row: {
          bot_id: string
          command: string
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          bot_id: string
          command: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          bot_id?: string
          command?: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_commands_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_commands_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_events: {
        Row: {
          bot_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
        }
        Insert: {
          bot_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
        }
        Update: {
          bot_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bot_events_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_events_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          bot_token: string
          created_at: string
          description: string | null
          id: string
          owner_id: string
          permissions: Json
          profile_id: string
          status: Database["public"]["Enums"]["bot_status"]
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          bot_token: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          permissions?: Json
          profile_id: string
          status?: Database["public"]["Enums"]["bot_status"]
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          bot_token?: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          permissions?: Json
          profile_id?: string
          status?: Database["public"]["Enums"]["bot_status"]
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          muted: boolean | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          muted?: boolean | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          muted?: boolean | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string | null
          pinned: boolean | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          pinned?: boolean | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          pinned?: boolean | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Relationships: []
      }
      inline_queries: {
        Row: {
          bot_id: string
          chat_id: string | null
          created_at: string
          id: string
          query_text: string
          user_id: string
        }
        Insert: {
          bot_id: string
          chat_id?: string | null
          created_at?: string
          id?: string
          query_text?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          chat_id?: string | null
          created_at?: string
          id?: string
          query_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inline_queries_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inline_queries_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      inline_results: {
        Row: {
          bot_id: string
          content: string | null
          created_at: string
          description: string | null
          expires_at: string
          id: string
          reply_markup: Json | null
          result_id: string
          result_type: string
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          bot_id: string
          content?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          reply_markup?: Json | null
          result_id: string
          result_type?: string
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          bot_id?: string
          content?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          reply_markup?: Json | null
          result_id?: string
          result_type?: string
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "inline_results_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inline_results_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted: boolean | null
          deleted_for: string[] | null
          edited: boolean | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          message_type: string
          pinned: boolean | null
          reply_to: string | null
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted?: boolean | null
          deleted_for?: string[] | null
          edited?: boolean | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_type?: string
          pinned?: boolean | null
          reply_to?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["message_status"]
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted?: boolean | null
          deleted_for?: string[] | null
          edited?: boolean | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_type?: string
          pinned?: boolean | null
          reply_to?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["message_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          blocked_users: string[] | null
          created_at: string
          display_name: string
          id: string
          is_bot: boolean
          last_seen: string | null
          online: boolean | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          blocked_users?: string[] | null
          created_at?: string
          display_name: string
          id: string
          is_bot?: boolean
          last_seen?: string | null
          online?: boolean | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          blocked_users?: string[] | null
          created_at?: string
          display_name?: string
          id?: string
          is_bot?: boolean
          last_seen?: string | null
          online?: boolean | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bots_public: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          owner_id: string | null
          permissions: Json | null
          profile_id: string | null
          status: Database["public"]["Enums"]["bot_status"] | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          owner_id?: string | null
          permissions?: Json | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["bot_status"] | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          owner_id?: string | null
          permissions?: Json | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["bot_status"] | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
      bot_status: "active" | "disabled"
      conversation_type: "private" | "group" | "channel"
      member_role: "owner" | "admin" | "member"
      message_status: "sent" | "delivered" | "read"
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
    Enums: {
      app_role: ["super_admin", "admin", "user"],
      bot_status: ["active", "disabled"],
      conversation_type: ["private", "group", "channel"],
      member_role: ["owner", "admin", "member"],
      message_status: ["sent", "delivered", "read"],
    },
  },
} as const

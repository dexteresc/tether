Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      attribute_definitions: {
        Row: {
          applies_to: string[]
          data_type: string
          key: string
          label: string
        }
        Insert: {
          applies_to?: string[]
          data_type?: string
          key: string
          label: string
        }
        Update: {
          applies_to?: string[]
          data_type?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          deleted_at: string | null
          geom: unknown
          id: string
          sensitivity: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          deleted_at?: string | null
          geom?: unknown
          id?: string
          sensitivity?: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          deleted_at?: string | null
          geom?: unknown
          id?: string
          sensitivity?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_sensitivity_fkey"
            columns: ["sensitivity"]
            isOneToOne: false
            referencedRelation: "sensitivity_levels"
            referencedColumns: ["level"]
          },
        ]
      }
      entity_attributes: {
        Row: {
          confidence: string
          created_at: string
          deleted_at: string | null
          entity_id: string
          id: string
          key: string
          notes: string | null
          source_id: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          value: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          id?: string
          key: string
          notes?: string | null
          source_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          value: string
        }
        Update: {
          confidence?: string
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          id?: string
          key?: string
          notes?: string | null
          source_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_attributes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_attributes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_connection_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_attributes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      identifiers: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string
          id: string
          metadata: Json | null
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          id?: string
          metadata?: Json | null
          type: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          id?: string
          metadata?: Json | null
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "identifiers_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identifiers_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_connection_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      intel: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          data: Json
          deleted_at: string | null
          geom: unknown
          id: string
          occurred_at: string
          search_vector: unknown
          sensitivity: string
          source_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          data: Json
          deleted_at?: string | null
          geom?: unknown
          id?: string
          occurred_at: string
          search_vector?: unknown
          sensitivity?: string
          source_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          deleted_at?: string | null
          geom?: unknown
          id?: string
          occurred_at?: string
          search_vector?: unknown
          sensitivity?: string
          source_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_sensitivity_fkey"
            columns: ["sensitivity"]
            isOneToOne: false
            referencedRelation: "sensitivity_levels"
            referencedColumns: ["level"]
          },
          {
            foreignKeyName: "intel_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_entities: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string
          id: string
          intel_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          id?: string
          intel_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          id?: string
          intel_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity_connection_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_entities_intel_id_fkey"
            columns: ["intel_id"]
            isOneToOne: false
            referencedRelation: "intel"
            referencedColumns: ["id"]
          },
        ]
      }
      record_tags: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          record_id: string
          record_table: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          record_id: string
          record_table: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          record_id?: string
          record_table?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      relations: {
        Row: {
          created_at: string
          data: Json | null
          deleted_at: string | null
          id: string
          sensitivity: string
          source_id: string
          strength: number | null
          target_id: string
          type: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          sensitivity?: string
          source_id: string
          strength?: number | null
          target_id: string
          type: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          sensitivity?: string
          source_id?: string
          strength?: number | null
          target_id?: string
          type?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relations_sensitivity_fkey"
            columns: ["sensitivity"]
            isOneToOne: false
            referencedRelation: "sensitivity_levels"
            referencedColumns: ["level"]
          },
          {
            foreignKeyName: "relations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "entity_connection_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "entity_connection_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitivity_levels: {
        Row: {
          label: string
          level: string
          rank: number
        }
        Insert: {
          label: string
          level: string
          rank: number
        }
        Update: {
          label?: string
          level?: string
          rank?: number
        }
        Relationships: []
      }
      sources: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          data: Json | null
          deleted_at: string | null
          id: string
          reliability: string
          sensitivity: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          reliability: string
          sensitivity?: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          reliability?: string
          sensitivity?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_sensitivity_fkey"
            columns: ["sensitivity"]
            isOneToOne: false
            referencedRelation: "sensitivity_levels"
            referencedColumns: ["level"]
          },
        ]
      }
      sync_log: {
        Row: {
          created_at: string
          operation: string
          record_id: string
          row_data: Json | null
          seq: number
          table_name: string
        }
        Insert: {
          created_at?: string
          operation: string
          record_id: string
          row_data?: Json | null
          seq?: number
          table_name: string
        }
        Update: {
          created_at?: string
          operation?: string
          record_id?: string
          row_data?: Json | null
          seq?: number
          table_name?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          category: string
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_access_levels: {
        Row: {
          granted_at: string
          max_level: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          max_level: string
          user_id: string
        }
        Update: {
          granted_at?: string
          max_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_levels_max_level_fkey"
            columns: ["max_level"]
            isOneToOne: false
            referencedRelation: "sensitivity_levels"
            referencedColumns: ["level"]
          },
        ]
      }
    }
    Views: {
      entity_connection_counts: {
        Row: {
          connections: number | null
          id: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_user_entity: {
        Args: { p_email: string; p_name: string; p_user_id?: string }
        Returns: string
      }
      find_entities_near: {
        Args: {
          p_entity_type?: string
          p_lat: number
          p_lon: number
          p_radius_m?: number
        }
        Returns: {
          distance_m: number
          entity_data: Json
          entity_id: string
          entity_type: string
        }[]
      }
      find_intel_near: {
        Args: {
          p_from_date?: string
          p_lat: number
          p_lon: number
          p_radius_m?: number
          p_to_date?: string
        }
        Returns: {
          distance_m: number
          intel_data: Json
          intel_id: string
          intel_type: string
          occurred_at: string
        }[]
      }
      find_shortest_path: {
        Args: { p_max_depth?: number; p_source_id: string; p_target_id: string }
        Returns: {
          depth: number
          path: string[]
          relation_types: string[]
        }[]
      }
      get_entity_graph: {
        Args: { p_depth?: number; p_entity_id: string }
        Returns: {
          depth: number
          entity_data: Json
          entity_id: string
          entity_type: string
          relation_id: string
          relation_source_id: string
          relation_strength: number
          relation_target_id: string
          relation_type: string
        }[]
      }
      get_entity_graph_v2: {
        Args: {
          p_depth?: number
          p_entity_id: string
          p_min_strength?: number
          p_relation_types?: string[]
        }
        Returns: {
          depth: number
          entity_data: Json
          entity_id: string
          entity_type: string
          path: string[]
          relation_id: string
          relation_source_id: string
          relation_strength: number
          relation_target_id: string
          relation_type: string
        }[]
      }
      get_entity_with_details: { Args: { p_entity_id: string }; Returns: Json }
      search_entities_by_identifier: {
        Args: { p_identifier_type?: string; p_search_value: string }
        Returns: {
          entity_data: Json
          entity_id: string
          entity_type: string
          identifier_id: string
          identifier_type: string
          identifier_value: string
        }[]
      }
      user_can_see: { Args: { p_sensitivity: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


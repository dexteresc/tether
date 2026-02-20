// Database types generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string
          code: string
          type: string
          reliability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
          data: Json
          active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          code: string
          type: string
          reliability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
          data?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          type?: string
          reliability?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
          data?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      entities: {
        Row: {
          id: string
          type: 'person' | 'organization' | 'group' | 'vehicle' | 'location' | 'event'
          data: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          type: 'person' | 'organization' | 'group' | 'vehicle' | 'location' | 'event'
          data?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          type?: 'person' | 'organization' | 'group' | 'vehicle' | 'location' | 'event'
          data?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      identifiers: {
        Row: {
          id: string
          entity_id: string
          type: 'name' | 'document' | 'biometric' | 'phone' | 'email' | 'handle' | 'address' | 'registration' | 'domain'
          value: string
          metadata: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          entity_id: string
          type: 'name' | 'document' | 'biometric' | 'phone' | 'email' | 'handle' | 'address' | 'registration' | 'domain'
          value: string
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          entity_id?: string
          type?: 'name' | 'document' | 'biometric' | 'phone' | 'email' | 'handle' | 'address' | 'registration' | 'domain'
          value?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      relations: {
        Row: {
          id: string
          source_id: string
          target_id: string
          type:
            | 'parent'
            | 'child'
            | 'sibling'
            | 'spouse'
            | 'colleague'
            | 'associate'
            | 'friend'
            | 'member'
            | 'owner'
            | 'founder'
            | 'co-founder'
            | 'visited'
            | 'employee'
          strength: number | null
          valid_from: string | null
          valid_to: string | null
          data: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          source_id: string
          target_id: string
          type:
            | 'parent'
            | 'child'
            | 'sibling'
            | 'spouse'
            | 'colleague'
            | 'associate'
            | 'friend'
            | 'member'
            | 'owner'
            | 'founder'
            | 'co-founder'
            | 'visited'
            | 'employee'
          strength?: number | null
          valid_from?: string | null
          valid_to?: string | null
          data?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          target_id?: string
          type?:
            | 'parent'
            | 'child'
            | 'sibling'
            | 'spouse'
            | 'colleague'
            | 'associate'
            | 'friend'
            | 'member'
            | 'owner'
            | 'founder'
            | 'co-founder'
            | 'visited'
            | 'employee'
          strength?: number | null
          valid_from?: string | null
          valid_to?: string | null
          data?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      intel: {
        Row: {
          id: string
          type: 'event' | 'communication' | 'sighting' | 'report' | 'document' | 'media' | 'financial'
          occurred_at: string
          data: Json
          source_id: string | null
          confidence: 'confirmed' | 'high' | 'medium' | 'low' | 'unconfirmed'
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          type: 'event' | 'communication' | 'sighting' | 'report' | 'document' | 'media' | 'financial'
          occurred_at: string
          data: Json
          source_id?: string | null
          confidence?: 'confirmed' | 'high' | 'medium' | 'low' | 'unconfirmed'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          type?: 'event' | 'communication' | 'sighting' | 'report' | 'document' | 'media' | 'financial'
          occurred_at?: string
          data?: Json
          source_id?: string | null
          confidence?: 'confirmed' | 'high' | 'medium' | 'low' | 'unconfirmed'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      intel_entities: {
        Row: {
          id: string
          intel_id: string
          entity_id: string
          role: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          intel_id: string
          entity_id: string
          role?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          intel_id?: string
          entity_id?: string
          role?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
    }
    Functions: {
      create_user_entity: {
        Args: {
          p_email: string
          p_name: string
          p_user_id?: string
        }
        Returns: string
      }
      get_entity_graph: {
        Args: {
          p_entity_id: string
          p_depth?: number
        }
        Returns: {
          entity_id: string
          entity_type: string
          entity_data: Json
          relation_id: string | null
          relation_type: string | null
          relation_source_id: string | null
          relation_target_id: string | null
          relation_strength: number | null
          depth: number
        }[]
      }
      get_entity_with_details: {
        Args: {
          p_entity_id: string
        }
        Returns: Json
      }
      search_entities_by_identifier: {
        Args: {
          p_search_value: string
          p_identifier_type?: string
        }
        Returns: {
          entity_id: string
          entity_type: string
          entity_data: Json
          identifier_type: string
          identifier_value: string
          identifier_id: string
        }[]
      }
    }
  }
}

// Convenience types
export type Entity = Database['public']['Tables']['entities']['Row']
export type Identifier = Database['public']['Tables']['identifiers']['Row']
export type Relation = Database['public']['Tables']['relations']['Row']
export type Intel = Database['public']['Tables']['intel']['Row']
export type Source = Database['public']['Tables']['sources']['Row']
export type IntelEntity = Database['public']['Tables']['intel_entities']['Row']

export type EntityType = Entity['type']
export type IdentifierType = Identifier['type']
export type RelationType = Relation['type']
export type IntelType = Intel['type']
export type ConfidenceLevel = Intel['confidence']
export type Reliability = Source['reliability']

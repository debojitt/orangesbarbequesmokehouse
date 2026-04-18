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
      ai_cravings_log: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          query: string
          suggestions: Json | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          query: string
          suggestions?: Json | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          query?: string
          suggestions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_cravings_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_visible: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_visible?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_visible?: boolean
          name?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order?: number
          used_count?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          last_visit: string | null
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_visit?: string | null
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          last_visit?: string | null
          name?: string
          phone?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          applies_to: Database["public"]["Enums"]["discount_target"]
          created_at: string
          end_time: string | null
          id: string
          is_active: boolean
          name: string
          start_time: string | null
          target_id: string | null
          type: Database["public"]["Enums"]["discount_type"]
          value: number
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["discount_target"]
          created_at?: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_time?: string | null
          target_id?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          value?: number
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["discount_target"]
          created_at?: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_time?: string | null
          target_id?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          value?: number
        }
        Relationships: []
      }
      feedback: {
        Row: {
          ai_response: string | null
          created_at: string
          customer_id: string | null
          id: string
          message: string | null
          rating: number
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          message?: string | null
          rating: number
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          message?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          menu_item_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          menu_item_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          menu_item_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      item_selections: {
        Row: {
          id: string
          menu_item_id: string
          selected_at: string
        }
        Insert: {
          id?: string
          menu_item_id: string
          selected_at?: string
        }
        Update: {
          id?: string
          menu_item_id?: string
          selected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_selections_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_variants: {
        Row: {
          id: string
          menu_item_id: string
          name: string
          price: number
          serves_count: number | null
        }
        Insert: {
          id?: string
          menu_item_id: string
          name: string
          price: number
          serves_count?: number | null
        }
        Update: {
          id?: string
          menu_item_id?: string
          name?: string
          price?: number
          serves_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_variants_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          is_active: boolean
          is_redeemed: boolean
          qr_code: string | null
          visit_count: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string
          id?: string
          is_active?: boolean
          is_redeemed?: boolean
          qr_code?: string | null
          visit_count?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          is_redeemed?: boolean
          qr_code?: string | null
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards_config: {
        Row: {
          id: string
          max_discount_value: number | null
          reward_description: string | null
          reward_type: Database["public"]["Enums"]["reward_type"]
          rigged_result: string
          visit_number: number
        }
        Insert: {
          id?: string
          max_discount_value?: number | null
          reward_description?: string | null
          reward_type: Database["public"]["Enums"]["reward_type"]
          rigged_result: string
          visit_number: number
        }
        Update: {
          id?: string
          max_discount_value?: number | null
          reward_description?: string | null
          reward_type?: Database["public"]["Enums"]["reward_type"]
          rigged_result?: string
          visit_number?: number
        }
        Relationships: []
      }
      loyalty_visits: {
        Row: {
          claimed_at: string | null
          id: string
          loyalty_card_id: string
          recorded_by: string | null
          reward_result: string | null
          reward_type: Database["public"]["Enums"]["reward_type"] | null
          visit_number: number
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          loyalty_card_id: string
          recorded_by?: string | null
          reward_result?: string | null
          reward_type?: Database["public"]["Enums"]["reward_type"] | null
          visit_number: number
        }
        Update: {
          claimed_at?: string | null
          id?: string
          loyalty_card_id?: string
          recorded_by?: string | null
          reward_result?: string | null
          reward_type?: Database["public"]["Enums"]["reward_type"] | null
          visit_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_visits_loyalty_card_id_fkey"
            columns: ["loyalty_card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_visits_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          is_bestseller: boolean
          is_chef_special: boolean
          is_daily_special: boolean
          is_veg: boolean
          name: string
          serving_info: string | null
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          is_bestseller?: boolean
          is_chef_special?: boolean
          is_daily_special?: boolean
          is_veg?: boolean
          name: string
          serving_info?: string | null
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          is_bestseller?: boolean
          is_chef_special?: boolean
          is_daily_special?: boolean
          is_veg?: boolean
          name?: string
          serving_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          id: string
          name: string
          pin: string
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pin: string
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pin?: string
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      discount_target: "item" | "category" | "all"
      discount_type: "percentage" | "combo" | "time_based"
      reward_type: "roulette" | "guaranteed"
      staff_role: "admin" | "staff"
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
      discount_target: ["item", "category", "all"],
      discount_type: ["percentage", "combo", "time_based"],
      reward_type: ["roulette", "guaranteed"],
      staff_role: ["admin", "staff"],
    },
  },
} as const

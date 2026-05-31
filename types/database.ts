/**
 * Hand-written Supabase `Database` type, modelled from the SQL migrations in
 * `supabase/migrations/` (0001 schema + 0005/0008/0011 column additions).
 *
 * This is the authoritative type until the schema is regenerated from the live
 * project. To switch to generated types later:
 *   1. `supabase login && supabase link --project-ref <ref>`
 *   2. `npm run db:types`            # writes types/supabase.ts
 *   3. replace this file's body with: export type { Database } from "./supabase";
 *
 * Keep this in sync by hand when you add a migration that alters a table.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          avatar_url: string | null;
          locale: string | null;
          is_active: boolean;
          is_stub: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          avatar_url?: string | null;
          locale?: string | null;
          is_active?: boolean;
          is_stub?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          avatar_url?: string | null;
          locale?: string | null;
          is_active?: boolean;
          is_stub?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_types: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          base_price: number;
          max_guests: number;
          amenities: string[];
          images: string[];
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          base_price: number;
          max_guests: number;
          amenities?: string[];
          images?: string[];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          base_price?: number;
          max_guests?: number;
          amenities?: string[];
          images?: string[];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          room_number: string;
          type_id: string;
          floor: number | null;
          status: Database["public"]["Enums"]["room_status"];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_number: string;
          type_id: string;
          floor?: number | null;
          status?: Database["public"]["Enums"]["room_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_number?: string;
          type_id?: string;
          floor?: number | null;
          status?: Database["public"]["Enums"]["room_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "room_types";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          booking_code: string;
          guest_id: string | null;
          guest_name: string;
          guest_email: string;
          guest_phone: string;
          room_id: string;
          check_in: string;
          check_out: string;
          guests_count: number;
          nights: number;
          subtotal: number;
          tax_amount: number;
          service_amount: number;
          total_amount: number;
          paid_amount: number;
          status: Database["public"]["Enums"]["booking_status"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          payment_method: Database["public"]["Enums"]["payment_method"];
          verification_method: Database["public"]["Enums"]["verification_method"];
          verified_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          refund_amount_due: number | null;
          refunded_amount: number | null;
          refund_reference: string | null;
          refunded_at: string | null;
          checked_in_at: string | null;
          checked_out_at: string | null;
          special_requests: string | null;
          access_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_code?: string;
          guest_id?: string | null;
          guest_name: string;
          guest_email: string;
          guest_phone: string;
          room_id: string;
          check_in: string;
          check_out: string;
          guests_count: number;
          nights?: number;
          subtotal: number;
          tax_amount?: number;
          service_amount?: number;
          total_amount: number;
          paid_amount?: number;
          status?: Database["public"]["Enums"]["booking_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          payment_method: Database["public"]["Enums"]["payment_method"];
          verification_method: Database["public"]["Enums"]["verification_method"];
          verified_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          refund_amount_due?: number | null;
          refunded_amount?: number | null;
          refund_reference?: string | null;
          refunded_at?: string | null;
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          special_requests?: string | null;
          access_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_code?: string;
          guest_id?: string | null;
          guest_name?: string;
          guest_email?: string;
          guest_phone?: string;
          room_id?: string;
          check_in?: string;
          check_out?: string;
          guests_count?: number;
          nights?: number;
          subtotal?: number;
          tax_amount?: number;
          service_amount?: number;
          total_amount?: number;
          paid_amount?: number;
          status?: Database["public"]["Enums"]["booking_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          payment_method?: Database["public"]["Enums"]["payment_method"];
          verification_method?: Database["public"]["Enums"]["verification_method"];
          verified_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          refund_amount_due?: number | null;
          refunded_amount?: number | null;
          refund_reference?: string | null;
          refunded_at?: string | null;
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          special_requests?: string | null;
          access_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          amount: number;
          method: Database["public"]["Enums"]["payment_method"];
          provider: Database["public"]["Enums"]["payment_provider"];
          transaction_id: string | null;
          provider_payload: Json | null;
          status: Database["public"]["Enums"]["payment_status"];
          initiated_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          amount: number;
          method: Database["public"]["Enums"]["payment_method"];
          provider: Database["public"]["Enums"]["payment_provider"];
          transaction_id?: string | null;
          provider_payload?: Json | null;
          status?: Database["public"]["Enums"]["payment_status"];
          initiated_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          amount?: number;
          method?: Database["public"]["Enums"]["payment_method"];
          provider?: Database["public"]["Enums"]["payment_provider"];
          transaction_id?: string | null;
          provider_payload?: Json | null;
          status?: Database["public"]["Enums"]["payment_status"];
          initiated_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      otp_verifications: {
        Row: {
          id: string;
          email: string;
          code_hash: string;
          purpose: Database["public"]["Enums"]["otp_purpose"];
          expires_at: string;
          attempts: number;
          consumed_at: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          code_hash: string;
          purpose: Database["public"]["Enums"]["otp_purpose"];
          expires_at: string;
          attempts?: number;
          consumed_at?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          code_hash?: string;
          purpose?: Database["public"]["Enums"]["otp_purpose"];
          expires_at?: string;
          attempts?: number;
          consumed_at?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      food_items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          category: string;
          image_url: string | null;
          is_available: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price: number;
          category: string;
          image_url?: string | null;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          category?: string;
          image_url?: string | null;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: Database["public"]["Enums"]["service_category"];
          price: number | null;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: Database["public"]["Enums"]["service_category"];
          price?: number | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: Database["public"]["Enums"]["service_category"];
          price?: number | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_requests: {
        Row: {
          id: string;
          booking_id: string;
          service_id: string;
          scheduled_at: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["service_request_status"];
          handled_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          service_id: string;
          scheduled_at?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["service_request_status"];
          handled_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          service_id?: string;
          scheduled_at?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["service_request_status"];
          handled_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_requests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_requests_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_requests_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      google_reviews_cache: {
        Row: {
          id: string;
          external_id: string | null;
          author_name: string;
          author_photo_url: string | null;
          rating: number;
          comment: string | null;
          published_at: string;
          fetched_at: string;
          raw: Json | null;
        };
        Insert: {
          id?: string;
          external_id?: string | null;
          author_name: string;
          author_photo_url?: string | null;
          rating: number;
          comment?: string | null;
          published_at: string;
          fetched_at?: string;
          raw?: Json | null;
        };
        Update: {
          id?: string;
          external_id?: string | null;
          author_name?: string;
          author_photo_url?: string | null;
          rating?: number;
          comment?: string | null;
          published_at?: string;
          fetched_at?: string;
          raw?: Json | null;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          guest_id: string;
          status: Database["public"]["Enums"]["conversation_status"];
          last_message_at: string | null;
          guest_unread_count: number;
          staff_unread_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          guest_id: string;
          status?: Database["public"]["Enums"]["conversation_status"];
          last_message_at?: string | null;
          guest_unread_count?: number;
          staff_unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          guest_id?: string;
          status?: Database["public"]["Enums"]["conversation_status"];
          last_message_at?: string | null;
          guest_unread_count?: number;
          staff_unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          sender_role: Database["public"]["Enums"]["user_role"];
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string | null;
          sender_role: Database["public"]["Enums"]["user_role"];
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string | null;
          sender_role?: Database["public"]["Enums"]["user_role"];
          body?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          link: string | null;
          type: string;
          data: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string | null;
          link?: string | null;
          type: string;
          data?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          type?: string;
          data?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: {
          id: boolean;
          hotel_name: string;
          tagline: string | null;
          logo_url: string | null;
          favicon_url: string | null;
          address: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          social_links: Json;
          business_hours: Json;
          currency: string;
          currency_symbol: string;
          timezone: string;
          tax_rate: number;
          service_charge_rate: number;
          google_place_id: string | null;
          google_place_name: string | null;
          google_place_rating: number | null;
          google_place_rating_count: number | null;
          google_place_uri: string | null;
          google_place_fetched_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          hotel_name?: string;
          tagline?: string | null;
          logo_url?: string | null;
          favicon_url?: string | null;
          address?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          social_links?: Json;
          business_hours?: Json;
          currency?: string;
          currency_symbol?: string;
          timezone?: string;
          tax_rate?: number;
          service_charge_rate?: number;
          google_place_id?: string | null;
          google_place_name?: string | null;
          google_place_rating?: number | null;
          google_place_rating_count?: number | null;
          google_place_uri?: string | null;
          google_place_fetched_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          hotel_name?: string;
          tagline?: string | null;
          logo_url?: string | null;
          favicon_url?: string | null;
          address?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          social_links?: Json;
          business_hours?: Json;
          currency?: string;
          currency_symbol?: string;
          timezone?: string;
          tax_rate?: number;
          service_charge_rate?: number;
          google_place_id?: string | null;
          google_place_name?: string | null;
          google_place_rating?: number | null;
          google_place_rating_count?: number | null;
          google_place_uri?: string | null;
          google_place_fetched_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      branding: {
        Row: {
          id: boolean;
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          font_family: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          font_family?: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          font_family?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          id: string;
          slug: string;
          title: string;
          meta_title: string | null;
          meta_description: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          meta_title?: string | null;
          meta_description?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          meta_title?: string | null;
          meta_description?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_sections: {
        Row: {
          id: string;
          page_id: string;
          section_type: Database["public"]["Enums"]["section_type"];
          sort_order: number;
          is_visible: boolean;
          content: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          page_id: string;
          section_type: Database["public"]["Enums"]["section_type"];
          sort_order?: number;
          is_visible?: boolean;
          content?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          page_id?: string;
          section_type?: Database["public"]["Enums"]["section_type"];
          sort_order?: number;
          is_visible?: boolean;
          content?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_sections_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      gallery_images: {
        Row: {
          id: string;
          image_url: string;
          caption: string | null;
          category: string | null;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          image_url: string;
          caption?: string | null;
          category?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          image_url?: string;
          caption?: string | null;
          category?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      amenities: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          description: string | null;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string | null;
          description?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string | null;
          description?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          category: string | null;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          category?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question?: string;
          answer?: string;
          category?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      testimonials: {
        Row: {
          id: string;
          author_name: string;
          author_role: string | null;
          body: string;
          rating: number | null;
          image_url: string | null;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_name: string;
          author_role?: string | null;
          body: string;
          rating?: number | null;
          image_url?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_name?: string;
          author_role?: string | null;
          body?: string;
          rating?: number | null;
          image_url?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cancellation_policy: {
        Row: {
          id: string;
          hours_before_checkin: number;
          refund_percentage: number;
          label: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hours_before_checkin: number;
          refund_percentage: number;
          label?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          hours_before_checkin?: number;
          refund_percentage?: number;
          label?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_templates: {
        Row: {
          id: string;
          key: string;
          subject: string;
          body_html: string;
          body_text: string | null;
          variables: string[];
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          subject: string;
          body_html: string;
          body_text?: string | null;
          variables?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          subject?: string;
          body_html?: string;
          body_text?: string | null;
          variables?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_templates: {
        Row: {
          id: string;
          key: string;
          title: string;
          body: string;
          variables: string[];
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          title: string;
          body: string;
          variables?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          title?: string;
          body?: string;
          variables?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_config: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "guest" | "receptionist" | "manager" | "super_admin";
      room_status: "available" | "occupied" | "maintenance" | "cleaning";
      booking_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled";
      payment_status:
        | "unpaid"
        | "paid"
        | "partially_refunded"
        | "refunded"
        | "failed";
      payment_method: "online" | "pay_at_hotel";
      payment_provider: "khalti" | "esewa" | "cash";
      verification_method: "otp" | "staff_call";
      otp_purpose: "booking" | "staff_login";
      section_type: "hero" | "text" | "gallery" | "cta" | "faq";
      service_category: "spa" | "laundry" | "transport" | "food" | "other";
      service_request_status:
        | "requested"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled";
      conversation_status: "open" | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

/** Row type for a public table, e.g. `Tables<"bookings">`. */
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
/** Insert payload type for a public table, e.g. `TablesInsert<"bookings">`. */
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
/** Update payload type for a public table, e.g. `TablesUpdate<"bookings">`. */
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
/** Enum union for a public enum, e.g. `Enums<"booking_status">`. */
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

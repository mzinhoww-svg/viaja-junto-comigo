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
      access_code_attempts: {
        Row: {
          at: string
          attempted_code: string | null
          email: string
          id: string
          ip: string | null
          request_id: string | null
          success: boolean
        }
        Insert: {
          at?: string
          attempted_code?: string | null
          email: string
          id?: string
          ip?: string | null
          request_id?: string | null
          success?: boolean
        }
        Update: {
          at?: string
          attempted_code?: string | null
          email?: string
          id?: string
          ip?: string | null
          request_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "access_code_attempts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          created_at: string
          emergency_contacts: Json
          id: string
          name: string
          pix_key: string | null
          pix_key_type: string | null
          pix_merchant_city: string | null
          pix_merchant_name: string | null
        }
        Insert: {
          created_at?: string
          emergency_contacts?: Json
          id?: string
          name: string
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
        }
        Update: {
          created_at?: string
          emergency_contacts?: Json
          id?: string
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
        }
        Relationships: []
      }
      atendimentos: {
        Row: {
          agency_id: string
          channel: string | null
          created_at: string
          date: string | null
          id: string
          origin: string | null
          who: string | null
        }
        Insert: {
          agency_id: string
          channel?: string | null
          created_at?: string
          date?: string | null
          id?: string
          origin?: string | null
          who?: string | null
        }
        Update: {
          agency_id?: string
          channel?: string | null
          created_at?: string
          date?: string | null
          id?: string
          origin?: string | null
          who?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          at: string
          id: string
          payload: Json | null
          target: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          body_html: string | null
          client: string | null
          created_at: string
          id: string
          pdf_url: string | null
          product: string | null
          request_id: string
          signed_at: string | null
          signed_ip: string | null
          signed_name: string | null
          status: Database["public"]["Enums"]["contract_status_t"]
          template: string | null
        }
        Insert: {
          body_html?: string | null
          client?: string | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          product?: string | null
          request_id: string
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["contract_status_t"]
          template?: string | null
        }
        Update: {
          body_html?: string | null
          client?: string | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          product?: string | null
          request_id?: string
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["contract_status_t"]
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          kind: Database["public"]["Enums"]["doc_kind_t"]
          name: string
          reject_reason: string | null
          required: boolean
          reviewed_by: string | null
          status: Database["public"]["Enums"]["doc_status_t"]
          traveler_id: string
          uploaded_at: string | null
          version: number
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          kind: Database["public"]["Enums"]["doc_kind_t"]
          name: string
          reject_reason?: string | null
          required?: boolean
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["doc_status_t"]
          traveler_id: string
          uploaded_at?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["doc_kind_t"]
          name?: string
          reject_reason?: string | null
          required?: boolean
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["doc_status_t"]
          traveler_id?: string
          uploaded_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      ds160_submission: {
        Row: {
          completion_pct: number
          form: Json
          package: Json | null
          status: Database["public"]["Enums"]["ds160_status_t"]
          submitted_at: string | null
          traveler_id: string
          updated_at: string
        }
        Insert: {
          completion_pct?: number
          form?: Json
          package?: Json | null
          status?: Database["public"]["Enums"]["ds160_status_t"]
          submitted_at?: string | null
          traveler_id: string
          updated_at?: string
        }
        Update: {
          completion_pct?: number
          form?: Json
          package?: Json | null
          status?: Database["public"]["Enums"]["ds160_status_t"]
          submitted_at?: string | null
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ds160_submission_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: true
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          created_at: string
          from: Database["public"]["Enums"]["msg_from_t"]
          id: string
          internal: boolean
          read_at: string | null
          request_id: string
          text: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          from: Database["public"]["Enums"]["msg_from_t"]
          id?: string
          internal?: boolean
          read_at?: string | null
          request_id: string
          text: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          from?: Database["public"]["Enums"]["msg_from_t"]
          id?: string
          internal?: boolean
          read_at?: string | null
          request_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      milhas_consult: {
        Row: {
          alertas: Json | null
          anexos: Json | null
          cabine: string | null
          created_at: string
          destino: string | null
          id: string
          obs: string | null
          plano: string | null
          programa: string | null
          published_at: string | null
          request_id: string
          saida: string | null
          saldo: string | null
          status: string | null
        }
        Insert: {
          alertas?: Json | null
          anexos?: Json | null
          cabine?: string | null
          created_at?: string
          destino?: string | null
          id?: string
          obs?: string | null
          plano?: string | null
          programa?: string | null
          published_at?: string | null
          request_id: string
          saida?: string | null
          saldo?: string | null
          status?: string | null
        }
        Update: {
          alertas?: Json | null
          anexos?: Json | null
          cabine?: string | null
          created_at?: string
          destino?: string | null
          id?: string
          obs?: string | null
          plano?: string | null
          programa?: string | null
          published_at?: string | null
          request_id?: string
          saida?: string | null
          saldo?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milhas_consult_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          id: string
          kind: string
          read: boolean
          read_at: string | null
          request_id: string
          title: string
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read?: boolean
          read_at?: string | null
          request_id: string
          title: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          read_at?: string | null
          request_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      product_briefings: {
        Row: {
          created_at: string
          id: string
          payload: Json
          product_key: string
          request_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          product_key: string
          request_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          product_key?: string
          request_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_briefings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      products_catalog: {
        Row: {
          active: boolean
          color: string | null
          descr: string | null
          key: Database["public"]["Enums"]["product_key_t"]
          name: string
          per: Database["public"]["Enums"]["per_t"]
          price: number
          sort_order: number
          tagline: string | null
          tier: string | null
          tint: string | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          descr?: string | null
          key: Database["public"]["Enums"]["product_key_t"]
          name: string
          per: Database["public"]["Enums"]["per_t"]
          price: number
          sort_order?: number
          tagline?: string | null
          tier?: string | null
          tint?: string | null
        }
        Update: {
          active?: boolean
          color?: string | null
          descr?: string | null
          key?: Database["public"]["Enums"]["product_key_t"]
          name?: string
          per?: Database["public"]["Enums"]["per_t"]
          price?: number
          sort_order?: number
          tagline?: string | null
          tier?: string | null
          tint?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          discount_cents: number
          id: string
          kind: string
          label: string
          product_key: Database["public"]["Enums"]["product_key_t"] | null
          qty: number
          request_id: string
          sort: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string
          label: string
          product_key?: Database["public"]["Enums"]["product_key_t"] | null
          qty?: number
          request_id: string
          sort?: number
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string
          label?: string
          product_key?: Database["public"]["Enums"]["product_key_t"] | null
          qty?: number
          request_id?: string
          sort?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_product_key_fkey"
            columns: ["product_key"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "proposal_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_group: {
        Row: {
          has_mil: boolean
          has_rot: boolean
          request_id: string
        }
        Insert: {
          has_mil?: boolean
          has_rot?: boolean
          request_id: string
        }
        Update: {
          has_mil?: boolean
          has_rot?: boolean
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_group_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          access_code: string
          access_code_expires_at: string
          agency_id: string
          archived_at: string | null
          client_feedback: string | null
          client_rating: number | null
          client_signature_ip: string | null
          combo_pct: number
          contract_signed: boolean
          created_at: string
          created_by: string | null
          id: string
          lead_email: string
          lead_name: string
          lead_phone: string | null
          passport_notes: string | null
          passport_status: string
          payment_amount_cents: number
          payment_confirmed_by: string | null
          payment_method: Database["public"]["Enums"]["payment_method_t"] | null
          payment_paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status_t"]
          proposal_accepted_at: string | null
          proposal_decline_reason: string | null
          proposal_discount_cents: number
          proposal_sent_at: string | null
          proposal_status: Database["public"]["Enums"]["proposal_status_t"]
          proposal_subtotal_cents: number
          proposal_total_cents: number
          sched_window_open: boolean
          sign_name: string | null
          signed_at: string | null
          tax_status: Database["public"]["Enums"]["tax_status_t"]
          travel_checklist: Json
          usd_as_of: string | null
          usd_rate: number | null
          usd_source: string | null
          visa_decision_at: string | null
          visa_outcome: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until: string | null
          whatsapp_e164: string | null
        }
        Insert: {
          access_code: string
          access_code_expires_at?: string
          agency_id: string
          archived_at?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          client_signature_ip?: string | null
          combo_pct?: number
          contract_signed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lead_email: string
          lead_name: string
          lead_phone?: string | null
          passport_notes?: string | null
          passport_status?: string
          payment_amount_cents?: number
          payment_confirmed_by?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_t"]
            | null
          payment_paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_t"]
          proposal_accepted_at?: string | null
          proposal_decline_reason?: string | null
          proposal_discount_cents?: number
          proposal_sent_at?: string | null
          proposal_status?: Database["public"]["Enums"]["proposal_status_t"]
          proposal_subtotal_cents?: number
          proposal_total_cents?: number
          sched_window_open?: boolean
          sign_name?: string | null
          signed_at?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status_t"]
          travel_checklist?: Json
          usd_as_of?: string | null
          usd_rate?: number | null
          usd_source?: string | null
          visa_decision_at?: string | null
          visa_outcome?: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until?: string | null
          whatsapp_e164?: string | null
        }
        Update: {
          access_code?: string
          access_code_expires_at?: string
          agency_id?: string
          archived_at?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          client_signature_ip?: string | null
          combo_pct?: number
          contract_signed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lead_email?: string
          lead_name?: string
          lead_phone?: string | null
          passport_notes?: string | null
          passport_status?: string
          payment_amount_cents?: number
          payment_confirmed_by?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_t"]
            | null
          payment_paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_t"]
          proposal_accepted_at?: string | null
          proposal_decline_reason?: string | null
          proposal_discount_cents?: number
          proposal_sent_at?: string | null
          proposal_status?: Database["public"]["Enums"]["proposal_status_t"]
          proposal_subtotal_cents?: number
          proposal_total_cents?: number
          sched_window_open?: boolean
          sign_name?: string | null
          signed_at?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status_t"]
          travel_checklist?: Json
          usd_as_of?: string | null
          usd_rate?: number | null
          usd_source?: string | null
          visa_decision_at?: string | null
          visa_outcome?: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until?: string | null
          whatsapp_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      roteiros: {
        Row: {
          anexos: Json | null
          created_at: string
          id: string
          nota: string | null
          published_at: string | null
          release_notes: string | null
          request_id: string
          share_url: string | null
          status: string
          trip: string | null
          version: number
        }
        Insert: {
          anexos?: Json | null
          created_at?: string
          id?: string
          nota?: string | null
          published_at?: string | null
          release_notes?: string | null
          request_id: string
          share_url?: string | null
          status?: string
          trip?: string | null
          version?: number
        }
        Update: {
          anexos?: Json | null
          created_at?: string
          id?: string
          nota?: string | null
          published_at?: string | null
          release_notes?: string | null
          request_id?: string
          share_url?: string | null
          status?: string
          trip?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "roteiros_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_intents: {
        Row: {
          confirmed_by: string | null
          confirmed_date: string | null
          consulate: string | null
          created_at: string
          id: string
          notes: string | null
          service: Database["public"]["Enums"]["sched_service_t"]
          status: Database["public"]["Enums"]["sched_status_t"]
          traveler_id: string
          updated_at: string
          wish: string | null
          wish_dates: string[]
          wish_period: string | null
        }
        Insert: {
          confirmed_by?: string | null
          confirmed_date?: string | null
          consulate?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          service: Database["public"]["Enums"]["sched_service_t"]
          status?: Database["public"]["Enums"]["sched_status_t"]
          traveler_id: string
          updated_at?: string
          wish?: string | null
          wish_dates?: string[]
          wish_period?: string | null
        }
        Update: {
          confirmed_by?: string | null
          confirmed_date?: string | null
          consulate?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          service?: Database["public"]["Enums"]["sched_service_t"]
          status?: Database["public"]["Enums"]["sched_status_t"]
          traveler_id?: string
          updated_at?: string
          wish?: string | null
          wish_dates?: string[]
          wish_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_intents_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_window: {
        Row: {
          agency_id: string
          released_quinzenas: Json
          slots: Json
        }
        Insert: {
          agency_id: string
          released_quinzenas?: Json
          slots?: Json
        }
        Update: {
          agency_id?: string
          released_quinzenas?: Json
          slots?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_window_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          receipt_url: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["tax_payment_status_t"]
          traveler_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tax_payment_status_t"]
          traveler_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tax_payment_status_t"]
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_payments_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: true
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      travelers: {
        Row: {
          created_at: string
          has_pass: boolean
          has_vistos: boolean
          id: string
          is_lead: boolean
          name: string
          request_id: string
        }
        Insert: {
          created_at?: string
          has_pass?: boolean
          has_vistos?: boolean
          id?: string
          is_lead?: boolean
          name: string
          request_id: string
        }
        Update: {
          created_at?: string
          has_pass?: boolean
          has_vistos?: boolean
          id?: string
          is_lead?: boolean
          name?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travelers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      visto_plans: {
        Row: {
          descr: string | null
          key: Database["public"]["Enums"]["visto_plan_t"]
          label: string
          price: number
        }
        Insert: {
          descr?: string | null
          key: Database["public"]["Enums"]["visto_plan_t"]
          label: string
          price: number
        }
        Update: {
          descr?: string | null
          key?: Database["public"]["Enums"]["visto_plan_t"]
          label?: string
          price?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_tax_status: {
        Args: {
          _notes: string
          _status: Database["public"]["Enums"]["tax_payment_status_t"]
          _traveler_id: string
        }
        Returns: undefined
      }
      archive_request: {
        Args: { _archive: boolean; _request_id: string }
        Returns: undefined
      }
      complete_briefing: {
        Args: { _product_key: string; _request_id: string }
        Returns: undefined
      }
      compute_journey_steps: {
        Args: { _request_id: string }
        Returns: {
          idx: number
          key: string
          label: string
          status: Database["public"]["Enums"]["journey_step_status_t"]
        }[]
      }
      confirm_intent: {
        Args: {
          _confirmed_date: string
          _consulate: string
          _intent_id: string
        }
        Returns: undefined
      }
      confirm_payment: {
        Args: { _paid: boolean; _request_id: string }
        Returns: undefined
      }
      create_request_with_travelers: { Args: { payload: Json }; Returns: Json }
      current_agency_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_request_member: { Args: { _request_id: string }; Returns: boolean }
      mark_briefing_reviewed: {
        Args: { _briefing_id: string }
        Returns: undefined
      }
      mark_messages_read: { Args: { _request_id: string }; Returns: undefined }
      mark_notification_read: {
        Args: { _notification_id: string }
        Returns: undefined
      }
      publish_milhas: { Args: { _request_id: string }; Returns: undefined }
      publish_roteiro: { Args: { _roteiro_id: string }; Returns: undefined }
      refresh_request_tax_status: {
        Args: { _request_id: string }
        Returns: undefined
      }
      regenerate_access_code: { Args: { _request_id: string }; Returns: Json }
      register_tax_payment: {
        Args: { _method: string; _receipt_url: string; _traveler_id: string }
        Returns: undefined
      }
      reopen_case: { Args: { _request_id: string }; Returns: undefined }
      reopen_intent: { Args: { _intent_id: string }; Returns: undefined }
      request_code_resend: { Args: { _request_id: string }; Returns: undefined }
      review_document: {
        Args: { _approve: boolean; _doc_id: string; _reason: string }
        Returns: undefined
      }
      save_briefing: {
        Args: { _payload: Json; _product_key: string; _request_id: string }
        Returns: Json
      }
      save_ds160_draft: {
        Args: { _completion_pct: number; _form: Json; _traveler_id: string }
        Returns: undefined
      }
      save_intent_wish: {
        Args: {
          _consulate: string
          _intent_id: string
          _notes: string
          _wish_dates: string[]
          _wish_period: string
        }
        Returns: undefined
      }
      save_travel_checklist: {
        Args: { _items: Json; _request_id: string }
        Returns: undefined
      }
      send_message: {
        Args: {
          _attachments: Json
          _body: string
          _internal: boolean
          _request_id: string
        }
        Returns: Json
      }
      set_passport_status: {
        Args: { _notes: string; _request_id: string; _status: string }
        Returns: undefined
      }
      set_visa_outcome: {
        Args: {
          _outcome: Database["public"]["Enums"]["visa_outcome_t"]
          _request_id: string
          _validity_until: string
        }
        Returns: undefined
      }
      sign_contract: {
        Args: {
          _body_html: string
          _ip: string
          _name: string
          _request_id: string
        }
        Returns: Json
      }
      submit_briefing: {
        Args: { _product_key: string; _request_id: string }
        Returns: undefined
      }
      submit_document: {
        Args: { _doc_id: string; _file_url: string }
        Returns: undefined
      }
      submit_ds160: { Args: { _traveler_id: string }; Returns: undefined }
      submit_feedback: {
        Args: { _feedback: string; _rating: number; _request_id: string }
        Returns: undefined
      }
      update_request_with_items: {
        Args: { _request_id: string; payload: Json }
        Returns: Json
      }
      upsert_emergency_contacts: {
        Args: { _contacts: Json }
        Returns: undefined
      }
      upsert_milhas: {
        Args: { _request_id: string; payload: Json }
        Returns: Json
      }
      upsert_roteiro: {
        Args: { _request_id: string; payload: Json }
        Returns: Json
      }
      upsert_schedule_window: {
        Args: { _released: Json; _slots: Json }
        Returns: undefined
      }
      validate_ds160: {
        Args: { _approve: boolean; _reason: string; _traveler_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "client"
      contract_status_t: "draft" | "sent" | "signed"
      doc_kind_t: "pass" | "foto" | "renda" | "vinc" | "ds160" | "outro"
      doc_status_t: "locked" | "pending" | "received" | "approved" | "rejected"
      ds160_status_t: "draft" | "received" | "validated"
      journey_step_status_t: "done" | "active" | "locked"
      msg_from_t: "client" | "consultant"
      payment_method_t: "pix" | "card"
      payment_status_t: "pending" | "processing" | "declined" | "paid"
      per_t: "person" | "group"
      product_key_t: "vistos" | "pass" | "rot" | "mil"
      proposal_status_t: "draft" | "sent" | "accepted" | "viewed" | "declined"
      sched_service_t: "casv" | "entrevista" | "pf"
      sched_status_t: "open" | "sent" | "confirmed"
      tax_payment_status_t: "pending" | "paid" | "waived"
      tax_status_t: "pending" | "paid"
      visa_outcome_t: "aprovado" | "recusado" | "admin_processing" | "cancelado"
      visto_plan_t: "start" | "pro" | "prem"
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
      app_role: ["admin", "client"],
      contract_status_t: ["draft", "sent", "signed"],
      doc_kind_t: ["pass", "foto", "renda", "vinc", "ds160", "outro"],
      doc_status_t: ["locked", "pending", "received", "approved", "rejected"],
      ds160_status_t: ["draft", "received", "validated"],
      journey_step_status_t: ["done", "active", "locked"],
      msg_from_t: ["client", "consultant"],
      payment_method_t: ["pix", "card"],
      payment_status_t: ["pending", "processing", "declined", "paid"],
      per_t: ["person", "group"],
      product_key_t: ["vistos", "pass", "rot", "mil"],
      proposal_status_t: ["draft", "sent", "accepted", "viewed", "declined"],
      sched_service_t: ["casv", "entrevista", "pf"],
      sched_status_t: ["open", "sent", "confirmed"],
      tax_payment_status_t: ["pending", "paid", "waived"],
      tax_status_t: ["pending", "paid"],
      visa_outcome_t: ["aprovado", "recusado", "admin_processing", "cancelado"],
      visto_plan_t: ["start", "pro", "prem"],
    },
  },
} as const

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
          {
            foreignKeyName: "access_code_attempts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          bio: string | null
          created_at: string
          emergency_contacts: Json
          endereco: string | null
          id: string
          instagram: string | null
          logo_path: string | null
          name: string
          pix_key: string | null
          pix_key_type: string | null
          pix_merchant_city: string | null
          pix_merchant_name: string | null
          primary_color: string
          public_email: string | null
          public_whatsapp: string | null
          usd_reference_at: string | null
          usd_reference_rate: number | null
          visa_disclaimer: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          emergency_contacts?: Json
          endereco?: string | null
          id?: string
          instagram?: string | null
          logo_path?: string | null
          name: string
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          primary_color?: string
          public_email?: string | null
          public_whatsapp?: string | null
          usd_reference_at?: string | null
          usd_reference_rate?: number | null
          visa_disclaimer?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          emergency_contacts?: Json
          endereco?: string | null
          id?: string
          instagram?: string | null
          logo_path?: string | null
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          primary_color?: string
          public_email?: string | null
          public_whatsapp?: string | null
          usd_reference_at?: string | null
          usd_reference_rate?: number | null
          visa_disclaimer?: string
        }
        Relationships: []
      }
      agency_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agency_id: string
          email: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id: string
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id?: string
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_invites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          mes_ano: string
          msgs_count: number
          user_id: string
        }
        Insert: {
          mes_ano: string
          msgs_count?: number
          user_id: string
        }
        Update: {
          mes_ano?: string
          msgs_count?: number
          user_id?: string
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
      budget_categories: {
        Row: {
          cor: string
          id: string
          is_default: boolean
          nome: string
          ordem: number
          trip_id: string
        }
        Insert: {
          cor?: string
          id?: string
          is_default?: boolean
          nome: string
          ordem?: number
          trip_id: string
        }
        Update: {
          cor?: string
          id?: string
          is_default?: boolean
          nome?: string
          ordem?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          category_id: string
          created_at: string
          id: string
          nome: string
          nota: string | null
          trip_id: string
          valor_estimado_brl_cents: number | null
          valor_estimado_destino_cents: number | null
          valor_pago_brl_cents: number
          valor_pago_destino_cents: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          nome: string
          nota?: string | null
          trip_id: string
          valor_estimado_brl_cents?: number | null
          valor_estimado_destino_cents?: number | null
          valor_pago_brl_cents?: number
          valor_pago_destino_cents?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          nome?: string
          nota?: string | null
          trip_id?: string
          valor_estimado_brl_cents?: number | null
          valor_estimado_destino_cents?: number | null
          valor_pago_brl_cents?: number
          valor_pago_destino_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          done: boolean
          id: string
          marco: number | null
          nota: string | null
          ordem: number
          prazo_dias_antes: number | null
          titulo: string
        }
        Insert: {
          checklist_id: string
          done?: boolean
          id?: string
          marco?: number | null
          nota?: string | null
          ordem?: number
          prazo_dias_antes?: number | null
          titulo: string
        }
        Update: {
          checklist_id?: string
          done?: boolean
          id?: string
          marco?: number | null
          nota?: string | null
          ordem?: number
          prazo_dias_antes?: number | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          clima: string | null
          com_crianca: boolean | null
          destino_pack: string | null
          id: string
          marco: number | null
          min_duracao: number | null
          ordem: number
          prazo_dias_antes: number | null
          regiao: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
          tipo: Database["public"]["Enums"]["checklist_type"]
          titulo: string
        }
        Insert: {
          clima?: string | null
          com_crianca?: boolean | null
          destino_pack?: string | null
          id?: string
          marco?: number | null
          min_duracao?: number | null
          ordem?: number
          prazo_dias_antes?: number | null
          regiao?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          tipo: Database["public"]["Enums"]["checklist_type"]
          titulo: string
        }
        Update: {
          clima?: string | null
          com_crianca?: boolean | null
          destino_pack?: string | null
          id?: string
          marco?: number | null
          min_duracao?: number | null
          ordem?: number
          prazo_dias_antes?: number | null
          regiao?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          tipo?: Database["public"]["Enums"]["checklist_type"]
          titulo?: string
        }
        Relationships: []
      }
      checklists: {
        Row: {
          id: string
          nome: string
          ordem: number
          tipo: Database["public"]["Enums"]["checklist_type"]
          trip_id: string
        }
        Insert: {
          id?: string
          nome: string
          ordem?: number
          tipo: Database["public"]["Enums"]["checklist_type"]
          trip_id: string
        }
        Update: {
          id?: string
          nome?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["checklist_type"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          agency_id: string
          body_html: string
          id: string
          scope: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          body_html: string
          id?: string
          scope?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          body_html?: string
          id?: string
          scope?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          accepted_terms_at: string | null
          body_html: string | null
          body_sha256: string | null
          client: string | null
          created_at: string
          id: string
          pdf_path: string | null
          pdf_url: string | null
          product: string | null
          request_id: string
          signed_at: string | null
          signed_cpf: string | null
          signed_ip: string | null
          signed_name: string | null
          signed_user_agent: string | null
          status: Database["public"]["Enums"]["contract_status_t"]
          template: string | null
        }
        Insert: {
          accepted_terms_at?: string | null
          body_html?: string | null
          body_sha256?: string | null
          client?: string | null
          created_at?: string
          id?: string
          pdf_path?: string | null
          pdf_url?: string | null
          product?: string | null
          request_id: string
          signed_at?: string | null
          signed_cpf?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_user_agent?: string | null
          status?: Database["public"]["Enums"]["contract_status_t"]
          template?: string | null
        }
        Update: {
          accepted_terms_at?: string | null
          body_html?: string | null
          body_sha256?: string | null
          client?: string | null
          created_at?: string
          id?: string
          pdf_path?: string | null
          pdf_url?: string | null
          product?: string | null
          request_id?: string
          signed_at?: string | null
          signed_cpf?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_user_agent?: string | null
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
          {
            foreignKeyName: "contracts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
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
          requires_human_review: boolean
          review_flags: Json
          review_notes: string | null
          status: Database["public"]["Enums"]["ds160_status_t"]
          submitted_at: string | null
          traveler_id: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          completion_pct?: number
          form?: Json
          package?: Json | null
          requires_human_review?: boolean
          review_flags?: Json
          review_notes?: string | null
          status?: Database["public"]["Enums"]["ds160_status_t"]
          submitted_at?: string | null
          traveler_id: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          completion_pct?: number
          form?: Json
          package?: Json | null
          requires_human_review?: boolean
          review_flags?: Json
          review_notes?: string | null
          status?: Database["public"]["Enums"]["ds160_status_t"]
          submitted_at?: string | null
          traveler_id?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
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
      entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          origem: Database["public"]["Enums"]["entitlement_origin"] | null
          plano: Database["public"]["Enums"]["plan_tier"]
          stripe_payment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          origem?: Database["public"]["Enums"]["entitlement_origin"] | null
          plano?: Database["public"]["Enums"]["plan_tier"]
          stripe_payment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          origem?: Database["public"]["Enums"]["entitlement_origin"] | null
          plano?: Database["public"]["Enums"]["plan_tier"]
          stripe_payment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      itinerary_days: {
        Row: {
          data: string | null
          dia_numero: number
          id: string
          ordem: number
          trip_id: string
        }
        Insert: {
          data?: string | null
          dia_numero: number
          id?: string
          ordem?: number
          trip_id: string
        }
        Update: {
          data?: string | null
          dia_numero?: number
          id?: string
          ordem?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_slots: {
        Row: {
          day_id: string
          id: string
          observacoes: string | null
          onde_comer: string | null
          onde_ir: string | null
          periodo: Database["public"]["Enums"]["slot_period"]
        }
        Insert: {
          day_id: string
          id?: string
          observacoes?: string | null
          onde_comer?: string | null
          onde_ir?: string | null
          periodo: Database["public"]["Enums"]["slot_period"]
        }
        Update: {
          day_id?: string
          id?: string
          observacoes?: string | null
          onde_comer?: string | null
          onde_ir?: string | null
          periodo?: Database["public"]["Enums"]["slot_period"]
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_slots_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "itinerary_days"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_submissions_log: {
        Row: {
          agency_id: string | null
          created_at: string
          email: string | null
          id: string
          ip: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_submissions_log_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          agency_id: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
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
          {
            foreignKeyName: "milhas_consult_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
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
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      paises_visto: {
        Row: {
          exige_visto_br: boolean
          link_consultoria: string | null
          pais_iso: string
          pais_nome: string
          tipo_visto: string | null
        }
        Insert: {
          exige_visto_br: boolean
          link_consultoria?: string | null
          pais_iso: string
          pais_nome: string
          tipo_visto?: string | null
        }
        Update: {
          exige_visto_br?: boolean
          link_consultoria?: string | null
          pais_iso?: string
          pais_nome?: string
          tipo_visto?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "product_briefings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
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
          billed_at: string | null
          created_at: string
          discount_cents: number
          id: string
          kind: string
          label: string
          origin: string | null
          product_key: Database["public"]["Enums"]["product_key_t"] | null
          qty: number
          request_id: string
          sort: number
          unit_price_cents: number
        }
        Insert: {
          billed_at?: string | null
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string
          label: string
          origin?: string | null
          product_key?: Database["public"]["Enums"]["product_key_t"] | null
          qty?: number
          request_id: string
          sort?: number
          unit_price_cents?: number
        }
        Update: {
          billed_at?: string | null
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string
          label?: string
          origin?: string | null
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
          {
            foreignKeyName: "proposal_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
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
          {
            foreignKeyName: "request_group_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests_safe"
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
          assigned_to: string | null
          client_feedback: string | null
          client_rating: number | null
          client_signature_ip: string | null
          combo_discount_cents: number
          combo_pct: number
          contract_signed: boolean
          created_at: string
          created_by: string | null
          id: string
          lead_consent_at: string | null
          lead_consent_text: string | null
          lead_email: string
          lead_message: string | null
          lead_name: string
          lead_phone: string | null
          lead_source: string
          manual_discount_cents: number
          passport_notes: string | null
          passport_status: string
          payment_amount_cents: number
          payment_attempts: number
          payment_card_last4: string | null
          payment_confirmed_by: string | null
          payment_installments: number | null
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
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tax_status: Database["public"]["Enums"]["tax_status_t"]
          travel_checklist: Json
          usd_as_of: string | null
          usd_rate: number | null
          usd_source: string | null
          visa_decision_at: string | null
          visa_outcome: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until: string | null
          visto_plan: Database["public"]["Enums"]["visto_plan_t"] | null
          whatsapp_e164: string | null
        }
        Insert: {
          access_code: string
          access_code_expires_at?: string
          agency_id: string
          archived_at?: string | null
          assigned_to?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          client_signature_ip?: string | null
          combo_discount_cents?: number
          combo_pct?: number
          contract_signed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lead_consent_at?: string | null
          lead_consent_text?: string | null
          lead_email: string
          lead_message?: string | null
          lead_name: string
          lead_phone?: string | null
          lead_source?: string
          manual_discount_cents?: number
          passport_notes?: string | null
          passport_status?: string
          payment_amount_cents?: number
          payment_attempts?: number
          payment_card_last4?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
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
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status_t"]
          travel_checklist?: Json
          usd_as_of?: string | null
          usd_rate?: number | null
          usd_source?: string | null
          visa_decision_at?: string | null
          visa_outcome?: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until?: string | null
          visto_plan?: Database["public"]["Enums"]["visto_plan_t"] | null
          whatsapp_e164?: string | null
        }
        Update: {
          access_code?: string
          access_code_expires_at?: string
          agency_id?: string
          archived_at?: string | null
          assigned_to?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          client_signature_ip?: string | null
          combo_discount_cents?: number
          combo_pct?: number
          contract_signed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lead_consent_at?: string | null
          lead_consent_text?: string | null
          lead_email?: string
          lead_message?: string | null
          lead_name?: string
          lead_phone?: string | null
          lead_source?: string
          manual_discount_cents?: number
          passport_notes?: string | null
          passport_status?: string
          payment_amount_cents?: number
          payment_attempts?: number
          payment_card_last4?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
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
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status_t"]
          travel_checklist?: Json
          usd_as_of?: string | null
          usd_rate?: number | null
          usd_source?: string | null
          visa_decision_at?: string | null
          visa_outcome?: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until?: string | null
          visto_plan?: Database["public"]["Enums"]["visto_plan_t"] | null
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
          {
            foreignKeyName: "roteiros_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_entries: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mes_ano: string
          trip_id: string
          valor_brl_cents: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mes_ano: string
          trip_id: string
          valor_brl_cents: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mes_ano?: string
          trip_id?: string
          valor_brl_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "savings_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
      stripe_webhook_events: {
        Row: {
          id: string
          payload: Json | null
          processed_at: string
          request_id: string | null
          type: string
        }
        Insert: {
          id: string
          payload?: Json | null
          processed_at?: string
          request_id?: string | null
          type: string
        }
        Update: {
          id?: string
          payload?: Json | null
          processed_at?: string
          request_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_webhook_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_payments: {
        Row: {
          amount_brl_cents: number
          amount_usd_cents: number | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["tax_kind_t"]
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          pix_txid: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["tax_payment_status_t"]
          traveler_id: string
          updated_at: string
        }
        Insert: {
          amount_brl_cents?: number
          amount_usd_cents?: number | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["tax_kind_t"]
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          pix_txid?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tax_payment_status_t"]
          traveler_id: string
          updated_at?: string
        }
        Update: {
          amount_brl_cents?: number
          amount_usd_cents?: number | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["tax_kind_t"]
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          pix_txid?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["tax_payment_status_t"]
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_payments_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
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
          {
            foreignKeyName: "travelers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token: string
          trip_id: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          token?: string
          trip_id: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_nps_responses: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          nota: number
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_nps_responses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cambio_atualizado_em: string | null
          cambio_manual: number | null
          created_at: string
          data_viagem: string | null
          destino_cidade: string | null
          destino_pais: string
          id: string
          moeda_destino: string | null
          nome: string
          num_criancas: number
          num_pessoas: number
          owner_id: string
          status: Database["public"]["Enums"]["trip_status"]
        }
        Insert: {
          cambio_atualizado_em?: string | null
          cambio_manual?: number | null
          created_at?: string
          data_viagem?: string | null
          destino_cidade?: string | null
          destino_pais: string
          id?: string
          moeda_destino?: string | null
          nome?: string
          num_criancas?: number
          num_pessoas?: number
          owner_id: string
          status?: Database["public"]["Enums"]["trip_status"]
        }
        Update: {
          cambio_atualizado_em?: string | null
          cambio_manual?: number | null
          created_at?: string
          data_viagem?: string | null
          destino_cidade?: string | null
          destino_pais?: string
          id?: string
          moeda_destino?: string | null
          nome?: string
          num_criancas?: number
          num_pessoas?: number
          owner_id?: string
          status?: Database["public"]["Enums"]["trip_status"]
        }
        Relationships: []
      }
      user_lgpd_consents: {
        Row: {
          aceito_em: string
          id: string
          user_id: string
          versao_termos: string
        }
        Insert: {
          aceito_em?: string
          id?: string
          user_id: string
          versao_termos: string
        }
        Update: {
          aceito_em?: string
          id?: string
          user_id?: string
          versao_termos?: string
        }
        Relationships: []
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
      requests_safe: {
        Row: {
          access_code_expires_at: string | null
          agency_id: string | null
          archived_at: string | null
          assigned_to: string | null
          client_feedback: string | null
          client_rating: number | null
          combo_discount_cents: number | null
          combo_pct: number | null
          contract_signed: boolean | null
          created_at: string | null
          created_by: string | null
          id: string | null
          lead_consent_at: string | null
          lead_consent_text: string | null
          lead_email: string | null
          lead_message: string | null
          lead_name: string | null
          lead_phone: string | null
          lead_source: string | null
          manual_discount_cents: number | null
          passport_notes: string | null
          passport_status: string | null
          payment_amount_cents: number | null
          payment_attempts: number | null
          payment_card_last4: string | null
          payment_confirmed_by: string | null
          payment_installments: number | null
          payment_method: Database["public"]["Enums"]["payment_method_t"] | null
          payment_paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status_t"] | null
          proposal_accepted_at: string | null
          proposal_decline_reason: string | null
          proposal_discount_cents: number | null
          proposal_sent_at: string | null
          proposal_status:
            | Database["public"]["Enums"]["proposal_status_t"]
            | null
          proposal_subtotal_cents: number | null
          proposal_total_cents: number | null
          sched_window_open: boolean | null
          sign_name: string | null
          signed_at: string | null
          tax_status: Database["public"]["Enums"]["tax_status_t"] | null
          travel_checklist: Json | null
          usd_as_of: string | null
          usd_rate: number | null
          usd_source: string | null
          visa_decision_at: string | null
          visa_outcome: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until: string | null
          visto_plan: Database["public"]["Enums"]["visto_plan_t"] | null
          whatsapp_e164: string | null
        }
        Insert: {
          access_code_expires_at?: string | null
          agency_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          combo_discount_cents?: number | null
          combo_pct?: number | null
          contract_signed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          lead_consent_at?: string | null
          lead_consent_text?: string | null
          lead_email?: string | null
          lead_message?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          manual_discount_cents?: number | null
          passport_notes?: string | null
          passport_status?: string | null
          payment_amount_cents?: number | null
          payment_attempts?: number | null
          payment_card_last4?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_t"]
            | null
          payment_paid_at?: string | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_t"]
            | null
          proposal_accepted_at?: string | null
          proposal_decline_reason?: string | null
          proposal_discount_cents?: number | null
          proposal_sent_at?: string | null
          proposal_status?:
            | Database["public"]["Enums"]["proposal_status_t"]
            | null
          proposal_subtotal_cents?: number | null
          proposal_total_cents?: number | null
          sched_window_open?: boolean | null
          sign_name?: string | null
          signed_at?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status_t"] | null
          travel_checklist?: Json | null
          usd_as_of?: string | null
          usd_rate?: number | null
          usd_source?: string | null
          visa_decision_at?: string | null
          visa_outcome?: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until?: string | null
          visto_plan?: Database["public"]["Enums"]["visto_plan_t"] | null
          whatsapp_e164?: string | null
        }
        Update: {
          access_code_expires_at?: string | null
          agency_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          client_feedback?: string | null
          client_rating?: number | null
          combo_discount_cents?: number | null
          combo_pct?: number | null
          contract_signed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          lead_consent_at?: string | null
          lead_consent_text?: string | null
          lead_email?: string | null
          lead_message?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          manual_discount_cents?: number | null
          passport_notes?: string | null
          passport_status?: string | null
          payment_amount_cents?: number | null
          payment_attempts?: number | null
          payment_card_last4?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_t"]
            | null
          payment_paid_at?: string | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_t"]
            | null
          proposal_accepted_at?: string | null
          proposal_decline_reason?: string | null
          proposal_discount_cents?: number | null
          proposal_sent_at?: string | null
          proposal_status?:
            | Database["public"]["Enums"]["proposal_status_t"]
            | null
          proposal_subtotal_cents?: number | null
          proposal_total_cents?: number | null
          sched_window_open?: boolean | null
          sign_name?: string | null
          signed_at?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status_t"] | null
          travel_checklist?: Json | null
          usd_as_of?: string | null
          usd_rate?: number | null
          usd_source?: string | null
          visa_decision_at?: string | null
          visa_outcome?: Database["public"]["Enums"]["visa_outcome_t"] | null
          visa_validity_until?: string | null
          visto_plan?: Database["public"]["Enums"]["visto_plan_t"] | null
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
    }
    Functions: {
      accept_invite: { Args: { _token: string }; Returns: Json }
      accept_trip_invite: { Args: { p_token: string }; Returns: string }
      add_product_to_request: {
        Args: {
          _origin?: string
          _product_key: Database["public"]["Enums"]["product_key_t"]
          _request_id: string
          _traveler_id: string
        }
        Returns: Json
      }
      admin_set_tax_status: {
        Args: {
          _kind: Database["public"]["Enums"]["tax_kind_t"]
          _notes: string
          _status: Database["public"]["Enums"]["tax_payment_status_t"]
          _traveler_id: string
        }
        Returns: undefined
      }
      ai_daily_message_count: { Args: never; Returns: number }
      apply_usd_rate: {
        Args: {
          _as_of: string
          _force?: boolean
          _rate: number
          _request_id: string
          _source: string
        }
        Returns: Json
      }
      archive_request: {
        Args: { _archive: boolean; _request_id: string }
        Returns: undefined
      }
      assign_request: {
        Args: { _assignee: string; _request_id: string }
        Returns: Json
      }
      attach_stripe_session: {
        Args: { _request_id: string; _session_id: string }
        Returns: undefined
      }
      client_set_proposal_status: {
        Args: { _reason?: string; _request_id: string; _status: string }
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
      confirm_tax_payment: {
        Args: { _paid: boolean; _request_id: string }
        Returns: undefined
      }
      create_request_with_travelers: { Args: { payload: Json }; Returns: Json }
      current_agency_id: { Args: never; Returns: string }
      get_agency_billing: {
        Args: never
        Returns: {
          pix_key: string
          pix_key_type: string
          pix_merchant_city: string
          pix_merchant_name: string
        }[]
      }
      get_usd_rate: { Args: { _request_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_usage: { Args: never; Returns: number }
      invite_member: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      is_request_member: { Args: { _request_id: string }; Returns: boolean }
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean }
      is_trip_owner: { Args: { p_trip_id: string }; Returns: boolean }
      list_contract_templates_for_request: {
        Args: { _request_id: string }
        Returns: {
          body_html: string
          scope: string
        }[]
      }
      log_audit: {
        Args: { _action: string; _payload?: Json; _target: string }
        Returns: undefined
      }
      mark_briefing_reviewed: {
        Args: { _briefing_id: string }
        Returns: undefined
      }
      mark_messages_read: { Args: { _request_id: string }; Returns: undefined }
      mark_notification_read: {
        Args: { _notification_id: string }
        Returns: undefined
      }
      mark_paid_from_stripe: {
        Args: {
          _amount_cents: number
          _payment_intent_id: string
          _payment_method: string
          _session_id: string
        }
        Returns: Json
      }
      mark_taxes_paid_from_stripe: {
        Args: {
          _amount_cents: number
          _payment_intent_id: string
          _payment_method: string
          _request_id: string
          _session_id: string
        }
        Returns: Json
      }
      pay_taxes: {
        Args: { _method?: string; _request_id: string }
        Returns: Json
      }
      publish_milhas: { Args: { _request_id: string }; Returns: undefined }
      publish_roteiro: { Args: { _roteiro_id: string }; Returns: undefined }
      recompute_request_totals: { Args: { _req: string }; Returns: undefined }
      refresh_request_tax_status: {
        Args: { _request_id: string }
        Returns: undefined
      }
      regenerate_access_code: { Args: { _request_id: string }; Returns: Json }
      render_template: {
        Args: { _request_id: string; _template_id: string }
        Returns: string
      }
      reopen_case: { Args: { _request_id: string }; Returns: undefined }
      reopen_intent: { Args: { _intent_id: string }; Returns: undefined }
      request_code_resend: { Args: { _request_id: string }; Returns: undefined }
      review_document: {
        Args: { _approve: boolean; _doc_id: string; _reason: string }
        Returns: undefined
      }
      revoke_invite: { Args: { _id: string }; Returns: Json }
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
      set_contract_pdf_path: {
        Args: { _contract_id: string; _path: string }
        Returns: undefined
      }
      set_passport_status: {
        Args: { _notes: string; _request_id: string; _status: string }
        Returns: undefined
      }
      set_proposal_adjustments: {
        Args: {
          _combo_pct: number
          _manual_discount_cents: number
          _request_id: string
        }
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
      sign_contract_v2: {
        Args: {
          _accepted: boolean
          _body_html: string
          _body_sha256: string
          _cpf: string
          _ip: string
          _name: string
          _request_id: string
          _user_agent: string
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
      submit_lead: {
        Args: { _client_ip: string; _payload: Json }
        Returns: Json
      }
      trip_owner_id: { Args: { p_trip_id: string }; Returns: string }
      update_agency_billing: { Args: { _payload: Json }; Returns: undefined }
      update_agency_profile: { Args: { _payload: Json }; Returns: undefined }
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
        Args: { _approve: boolean; _notes: string; _traveler_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "client" | "consultor"
      checklist_type:
        | "documentos"
        | "preparativos"
        | "mala"
        | "compras"
        | "custom"
      contract_status_t: "draft" | "sent" | "signed"
      doc_kind_t: "pass" | "foto" | "renda" | "vinc" | "ds160" | "outro"
      doc_status_t: "locked" | "pending" | "received" | "approved" | "rejected"
      ds160_status_t: "draft" | "received" | "validated" | "pending_review"
      entitlement_origin: "stripe" | "pacote_visto" | "manual"
      journey_step_status_t: "done" | "active" | "locked"
      member_role: "owner" | "editor"
      msg_from_t: "client" | "consultant"
      payment_method_t: "pix" | "card"
      payment_status_t: "pending" | "processing" | "declined" | "paid"
      per_t: "person" | "group"
      plan_tier: "free" | "premium"
      product_key_t: "vistos" | "pass" | "rot" | "mil"
      proposal_status_t: "draft" | "sent" | "accepted" | "viewed" | "declined"
      sched_service_t: "casv" | "entrevista" | "pf"
      sched_status_t: "open" | "sent" | "confirmed"
      slot_period: "manha" | "tarde" | "noite"
      tax_kind_t: "consular_mrv" | "passaporte_pf"
      tax_payment_status_t: "pending" | "paid" | "waived"
      tax_status_t: "pending" | "paid"
      trip_status: "sonho" | "planejando" | "concluida"
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
      app_role: ["admin", "client", "consultor"],
      checklist_type: [
        "documentos",
        "preparativos",
        "mala",
        "compras",
        "custom",
      ],
      contract_status_t: ["draft", "sent", "signed"],
      doc_kind_t: ["pass", "foto", "renda", "vinc", "ds160", "outro"],
      doc_status_t: ["locked", "pending", "received", "approved", "rejected"],
      ds160_status_t: ["draft", "received", "validated", "pending_review"],
      entitlement_origin: ["stripe", "pacote_visto", "manual"],
      journey_step_status_t: ["done", "active", "locked"],
      member_role: ["owner", "editor"],
      msg_from_t: ["client", "consultant"],
      payment_method_t: ["pix", "card"],
      payment_status_t: ["pending", "processing", "declined", "paid"],
      per_t: ["person", "group"],
      plan_tier: ["free", "premium"],
      product_key_t: ["vistos", "pass", "rot", "mil"],
      proposal_status_t: ["draft", "sent", "accepted", "viewed", "declined"],
      sched_service_t: ["casv", "entrevista", "pf"],
      sched_status_t: ["open", "sent", "confirmed"],
      slot_period: ["manha", "tarde", "noite"],
      tax_kind_t: ["consular_mrv", "passaporte_pf"],
      tax_payment_status_t: ["pending", "paid", "waived"],
      tax_status_t: ["pending", "paid"],
      trip_status: ["sonho", "planejando", "concluida"],
      visa_outcome_t: ["aprovado", "recusado", "admin_processing", "cancelado"],
      visto_plan_t: ["start", "pro", "prem"],
    },
  },
} as const

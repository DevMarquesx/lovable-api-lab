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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string
          actor_id: string | null
          created_at: string
          detalhes: Json
          entidade: string
          entidade_id: string | null
          id: string
        }
        Insert: {
          acao: string
          actor_id?: string | null
          created_at?: string
          detalhes?: Json
          entidade: string
          entidade_id?: string | null
          id?: string
        }
        Update: {
          acao?: string
          actor_id?: string | null
          created_at?: string
          detalhes?: Json
          entidade?: string
          entidade_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      autorizacoes_criancas: {
        Row: {
          ativo: boolean
          crianca_id: string
          data: string
          id: string
          responsavel_id: string
        }
        Insert: {
          ativo?: boolean
          crianca_id: string
          data?: string
          id?: string
          responsavel_id: string
        }
        Update: {
          ativo?: boolean
          crianca_id?: string
          data?: string
          id?: string
          responsavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autorizacoes_criancas_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "criancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizacoes_criancas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certidoes: {
        Row: {
          created_at: string
          data_emissao: string
          id: string
          idoso_id: string
          solicitado_por: string
          status: string
          validade: string | null
        }
        Insert: {
          created_at?: string
          data_emissao?: string
          id?: string
          idoso_id: string
          solicitado_por: string
          status: string
          validade?: string | null
        }
        Update: {
          created_at?: string
          data_emissao?: string
          id?: string
          idoso_id?: string
          solicitado_por?: string
          status?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certidoes_idoso_id_fkey"
            columns: ["idoso_id"]
            isOneToOne: true
            referencedRelation: "idosos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certidoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consentimentos_saude: {
        Row: {
          fim: string | null
          id: string
          idoso_id: string
          inicio: string
          provision_type: string
          status: string
          updated_at: string
        }
        Insert: {
          fim?: string | null
          id?: string
          idoso_id: string
          inicio?: string
          provision_type: string
          status: string
          updated_at?: string
        }
        Update: {
          fim?: string | null
          id?: string
          idoso_id?: string
          inicio?: string
          provision_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimentos_saude_idoso_id_fkey"
            columns: ["idoso_id"]
            isOneToOne: true
            referencedRelation: "idosos"
            referencedColumns: ["id"]
          },
        ]
      }
      criancas: {
        Row: {
          cadastrado_por: string
          co_entidade: string
          created_at: string
          data_nascimento: string
          id: string
          nome: string
        }
        Insert: {
          cadastrado_por: string
          co_entidade: string
          created_at?: string
          data_nascimento: string
          id?: string
          nome: string
        }
        Update: {
          cadastrado_por?: string
          co_entidade?: string
          created_at?: string
          data_nascimento?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "criancas_cadastrado_por_fkey"
            columns: ["cadastrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      encontros: {
        Row: {
          created_at: string
          criado_por: string
          crianca_id: string
          data: string
          id: string
          local: string
          pareamento_id: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          crianca_id: string
          data: string
          id?: string
          local: string
          pareamento_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          crianca_id?: string
          data?: string
          id?: string
          local?: string
          pareamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encontros_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontros_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "criancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontros_pareamento_id_fkey"
            columns: ["pareamento_id"]
            isOneToOne: false
            referencedRelation: "pareamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      escola_usuarios: {
        Row: {
          ativo: boolean
          co_entidade: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          co_entidade: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          co_entidade?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escola_usuarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      idosos: {
        Row: {
          ativo: boolean
          cadastrado_por: string
          cpf_hash: string
          created_at: string
          data_nascimento: string
          distancia_max_km: number
          horarios: string[]
          id: string
          municipio_codigo: string
          nome: string
          saberes: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cadastrado_por: string
          cpf_hash: string
          created_at?: string
          data_nascimento: string
          distancia_max_km?: number
          horarios?: string[]
          id?: string
          municipio_codigo: string
          nome: string
          saberes?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cadastrado_por?: string
          cpf_hash?: string
          created_at?: string
          data_nascimento?: string
          distancia_max_km?: number
          horarios?: string[]
          id?: string
          municipio_codigo?: string
          nome?: string
          saberes?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idosos_cadastrado_por_fkey"
            columns: ["cadastrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idosos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pareamentos: {
        Row: {
          chance_continuidade: number
          created_at: string
          distancia_km: number | null
          id: string
          idoso_id: string
          motivo_decisao: string | null
          pedido_id: string
          status: string
          updated_at: string
        }
        Insert: {
          chance_continuidade: number
          created_at?: string
          distancia_km?: number | null
          id?: string
          idoso_id: string
          motivo_decisao?: string | null
          pedido_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          chance_continuidade?: number
          created_at?: string
          distancia_km?: number | null
          id?: string
          idoso_id?: string
          motivo_decisao?: string | null
          pedido_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pareamentos_idoso_id_fkey"
            columns: ["idoso_id"]
            isOneToOne: false
            referencedRelation: "idosos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_escola"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_escola: {
        Row: {
          co_entidade: string
          created_at: string
          criado_por: string
          decidido_por: string | null
          id: string
          motivo_decisao: string | null
          periodo: string
          status: string
          tema: string
          turma: string | null
          updated_at: string
        }
        Insert: {
          co_entidade: string
          created_at?: string
          criado_por: string
          decidido_por?: string | null
          id?: string
          motivo_decisao?: string | null
          periodo: string
          status?: string
          tema: string
          turma?: string | null
          updated_at?: string
        }
        Update: {
          co_entidade?: string
          created_at?: string
          criado_por?: string
          decidido_por?: string | null
          id?: string
          motivo_decisao?: string | null
          periodo?: string
          status?: string
          tema?: string
          turma?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_escola_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_escola_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          created_at: string
          encontro_id: string
          id: string
          pessoa_id: string
          presente: boolean
          registrado_por: string
        }
        Insert: {
          created_at?: string
          encontro_id: string
          id?: string
          pessoa_id: string
          presente: boolean
          registrado_por: string
        }
        Update: {
          created_at?: string
          encontro_id?: string
          id?: string
          pessoa_id?: string
          presente?: boolean
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: false
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vinculos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          idoso_id: string
          responsavel_id: string
          revogado_em: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          idoso_id: string
          responsavel_id: string
          revogado_em?: string | null
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          idoso_id?: string
          responsavel_id?: string
          revogado_em?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_idoso_id_fkey"
            columns: ["idoso_id"]
            isOneToOne: false
            referencedRelation: "idosos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_encontro: { Args: { _encontro_id: string }; Returns: boolean }
      can_access_idoso: { Args: { _idoso_id: string }; Returns: boolean }
      can_access_pedido: { Args: { _pedido_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenacao"
        | "escola"
        | "idoso"
        | "familiar"
        | "profissional_cras"
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
    Enums: {
      app_role: [
        "admin",
        "coordenacao",
        "escola",
        "idoso",
        "familiar",
        "profissional_cras",
      ],
    },
  },
} as const

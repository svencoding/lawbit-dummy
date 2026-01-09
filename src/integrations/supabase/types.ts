export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      asuntos: {
        Row: {
          Código: string | null;
          Título: string | null;
          Cliente: string | null;
          "Código Secundario": string | null;
          Descripción: string | null;
          Activo: string | null;
          "Horas Trabajadas": string | null;
          "Horas a cobrar": string | null;
          "Encargado Comercial": string | null;
          "Encargado Secundario": string | null;
          Encargado: string | null;
          Tarifa: string | null;
          Descuento: string | null;
          Moneda: string | null;
          "Forma Cobro": string | null;
          "Monto(FF/R/C)": string | null;
          "Tipo de Proyecto": string | null;
          "Area de Práctica": string | null;
          "Moneda FF/R/C/H": string | null;
          "Moneda Total": string | null;
          "Fecha Creación": string | null;
          Cobrable: string | null;
          "Fecha Inactivo": string | null;
          "Cobro Independiente": string | null;
          Compañía: string | null;
          "Horas Bofill Mir?": string | null;
        };
        Insert: {
          Código?: string | null;
          Título?: string | null;
          Cliente?: string | null;
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      liquidaciones: {
        Row: {
          "N° Cobro": number;
          "Nota Cobro": string | null;
          Factura: string | null;
          "Fecha Emisión": string | null;
          "Grupo Cliente": string | null;
          Cliente: string | null;
          "Cliente Facturable": string | null;
          "Codigos Asuntos": string | null;
          Asuntos: string | null;
          "Encargado Comercial": string | null;
          "Encargado Secundario": string | null;
          "Fecha primer trabajo": string | null;
          "Fecha ultimo trabajo": string | null;
          "Hrs. Trabajadas": string | null;
          "Hrs. Cobradas": string | null;
          "Monto Subtotal": string | null;
          Descuento: string | null;
          "Monto Honorarios Total": string | null;
          "Moneda Cobro": string | null;
          "Total facturado": number | null;
          Honorarios: string | null;
          Gastos: string | null;
          IVA: string | null;
          "Honorarios pagados": string | null;
          "Gastos pagados": string | null;
          Estado: string | null;
          "Fecha Creación": string | null;
          "Fecha Revisión": string | null;
          "Fecha Corte": string | null;
          "Fecha Facturación": string | null;
          "Fecha Envío al Cliente": string | null;
          "Fecha Pago": string | null;
          Compañía: string | null;
          Fecha: string | null;
          Var: string | null;
        };
        Insert: {
          "N° Cobro": number;
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      horas_valor_cobrado: {
        Row: {
          "N° Cobro": number | null;
          Profesional: string | null;
          "Área Profesional": string | null;
          "Encargado comercial": string | null;
          Cliente: string | null;
          "Código Asunto": string | null;
          Asunto: string | null;
          "Trabajo (día)": string | null;
          "Horas Trabajadas": number | null;
          "Horas Cobradas": string | null;
          "Valor Cobrado Final": string | null;
          "Fecha Facturación": string | null;
          "Fecha Pago": string | null;
          "Usuario Facturación": string | null;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      meta_facturacion: {
        Row: {
          "Área Profesional": string;
          Meta: number | null;
          Mes: string | null;
        };
        Insert: {
          "Área Profesional": string;
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          firm_logo: string | null;
          firm_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          firm_logo?: string | null;
          firm_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          firm_logo?: string | null;
          firm_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

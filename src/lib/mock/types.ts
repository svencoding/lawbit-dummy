export interface Usuario {
  id: number; // int8 (primary key)
  created_at: string; // timestamptz
  name: string; // text
  category: string; // text
  rate: number; // int8
  daily_goal: number; // float8
  practice_area:
    | "Asuntos Internos"
    | "Consultoría"
    | "Corporativo"
    | "Laboral"
    | "Litigios"
    | "Penal"
    | "Procesal"; // text
  hourly_cost: number; // int8
  code: string; // text
}

export interface Cliente {
  id: number; // int8 (primary key)
  created_at: string; // timestamptz
  name: string | null; // text (nullable)
  client_manager: string | null; // text (nullable)
  fee_type: "FLAT FEE" | "RETAINER" | "HITOS" | "TASA" | null; // text (nullable)
  industry: string | null; // text (nullable)
}

export interface Asunto {
  id: number; // int8 (primary key)
  created_at: string; // timestamptz
  title: string | null; // text
  cliente_id: number | null; // int8
  usuario_id: number | null; // int8
  charge_type: string | null; // text
  amount: number | null; // float4
  project_type:
    | "Contrato"
    | "Informe"
    | "Juicio"
    | "Proyecto"
    | "Arbitraje"
    | "Asesoría"
    | null; // text
  practice_area:
    | "Asuntos Internos"
    | "Consultoría"
    | "Corporativo"
    | "Laboral"
    | "Litigios"
    | "Penal"
    | "Procesal"
    | null; // text
  created_date: string | null; // date
  billable: string | null; // text
  independent_charge: string | null; // text
  user_code: string | null; // text
}

export interface Payment {
  id: number; // int8 (primary key)
  created_at: string; // timestamptz
  cliente_id: number | null; // int8 (nullable)
  asunto_id: number | null; // int8 (nullable)
  month: string | null; // date (nullable)
  amount_charged: number | null; // int8 (nullable)
}

export interface TimeEntry {
  date: string; // date
  cliente_id: string; // string (with leading zeros)
  asunto_id: string; // string (with leading zeros)
  user_name: string; // string
  input_date: string; // date
  hours: number; // number
  billable_hours: number | null; // number (nullable, can be "-")
  non_billable_hours: number | null; // number (nullable, can be "-")
  hourly_cost: number; // number
  total_cost: number | null; // number (nullable, can be "-")
  rate: number; // number
  production: number | null; // number (nullable, can be "-")
}

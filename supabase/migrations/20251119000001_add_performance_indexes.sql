-- Add indexes to improve query performance for dashboard and clientes pages
-- These indexes target the most frequently filtered and joined columns

-- Index for horas_valor_cobrado table
CREATE INDEX IF NOT EXISTS idx_horas_trabajo_dia 
  ON horas_valor_cobrado ("Trabajo (día)");

CREATE INDEX IF NOT EXISTS idx_horas_n_cobro 
  ON horas_valor_cobrado ("N° Cobro");

CREATE INDEX IF NOT EXISTS idx_horas_codigo_asunto 
  ON horas_valor_cobrado ("Código Asunto");

CREATE INDEX IF NOT EXISTS idx_horas_area_profesional 
  ON horas_valor_cobrado ("Área Profesional");

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_horas_trabajo_dia_cobro 
  ON horas_valor_cobrado ("Trabajo (día)", "N° Cobro");

-- Index for liquidaciones table
CREATE INDEX IF NOT EXISTS idx_liquidaciones_n_cobro 
  ON liquidaciones ("N° Cobro");

CREATE INDEX IF NOT EXISTS idx_liquidaciones_cliente 
  ON liquidaciones ("Cliente");

CREATE INDEX IF NOT EXISTS idx_liquidaciones_fecha_creacion 
  ON liquidaciones ("Fecha Creación");

CREATE INDEX IF NOT EXISTS idx_liquidaciones_estado 
  ON liquidaciones ("Estado");

-- Index for asuntos table
CREATE INDEX IF NOT EXISTS idx_asuntos_codigo 
  ON asuntos ("Código");

CREATE INDEX IF NOT EXISTS idx_asuntos_area_practica 
  ON asuntos ("Area de Práctica");

CREATE INDEX IF NOT EXISTS idx_asuntos_cliente 
  ON asuntos ("Cliente");

CREATE INDEX IF NOT EXISTS idx_asuntos_forma_cobro 
  ON asuntos ("Forma Cobro");

-- Index for meta_facturacion table
CREATE INDEX IF NOT EXISTS idx_meta_facturacion_mes 
  ON meta_facturacion ("Mes");

CREATE INDEX IF NOT EXISTS idx_meta_facturacion_area 
  ON meta_facturacion ("Área Profesional");

-- Composite index for date range queries
CREATE INDEX IF NOT EXISTS idx_meta_facturacion_mes_area 
  ON meta_facturacion ("Mes", "Área Profesional");

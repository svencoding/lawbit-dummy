-- Enable RLS on all data tables
ALTER TABLE public.asuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horas_valor_cobrado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_facturacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar ENABLE ROW LEVEL SECURITY;

-- Create policies for asuntos - allow authenticated users to see all data
CREATE POLICY "Authenticated users can view all asuntos"
  ON public.asuntos
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert asuntos"
  ON public.asuntos
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update asuntos"
  ON public.asuntos
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete asuntos"
  ON public.asuntos
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create policies for liquidaciones
CREATE POLICY "Authenticated users can view all liquidaciones"
  ON public.liquidaciones
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert liquidaciones"
  ON public.liquidaciones
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update liquidaciones"
  ON public.liquidaciones
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete liquidaciones"
  ON public.liquidaciones
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create policies for horas_valor_cobrado
CREATE POLICY "Authenticated users can view all horas_valor_cobrado"
  ON public.horas_valor_cobrado
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert horas_valor_cobrado"
  ON public.horas_valor_cobrado
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update horas_valor_cobrado"
  ON public.horas_valor_cobrado
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete horas_valor_cobrado"
  ON public.horas_valor_cobrado
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create policies for meta_facturacion
CREATE POLICY "Authenticated users can view all meta_facturacion"
  ON public.meta_facturacion
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert meta_facturacion"
  ON public.meta_facturacion
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update meta_facturacion"
  ON public.meta_facturacion
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete meta_facturacion"
  ON public.meta_facturacion
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create policies for calendar (read-only for most users)
CREATE POLICY "Authenticated users can view calendar"
  ON public.calendar
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert calendar"
  ON public.calendar
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update calendar"
  ON public.calendar
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete calendar"
  ON public.calendar
  FOR DELETE
  USING (auth.role() = 'authenticated');

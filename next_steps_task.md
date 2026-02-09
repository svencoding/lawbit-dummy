# Reportes PDF — Next Steps & Decisiones Pendientes

## Estado Actual

### Fase 1 — UI Demostrativa ✅
- **Dos tabs**: Reporte Gerencial + Reporte Individual
- **Gerencial**: KPIs firma (Total Facturado, Horas Facturables, Clientes Activos, Meta), Top Clientes, Top Profesionales, Desglose por Área, comparación periodo anterior
- **Individual**: Selector de profesional, KPIs personales, desglose por cliente y proyecto, comparación periodo anterior
- **PDF**: Descarga con logo de la organización (constrainedo a 30×16mm para evitar overlap), diseño navy+gold, tablas, KPIs con deltas
- **Vista previa**: Botón "Vista Previa" abre Dialog modal con preview del reporte (no inline en la página)
- **Scheduling UI**: Siempre visible — frecuencia (semanal/quincenal/mensual), día de envío, hora de envío (06:00–18:00) — **solo UI, no funcional**
- **Destinatarios**: Input de email + lista de badges con opción de eliminar, siempre visible debajo del scheduling
- **Data**: Mock data con `USE_MOCK_DATA = true`

### Fase 2 — Hacer funcional el Scheduling (Pendiente)
### Fase 3 — Data real de Supabase (Pendiente)

---

## Fase 2: Hacer Funcional el Scheduling

### Decisiones Necesarias

#### 1. Servicio de Email
- [ ] ¿Servicio preferido? (Resend, SendGrid, Mailgun, Supabase Edge Functions)
- [ ] ¿Dirección/dominio de envío? (ej. `reportes@sufirma.com`)

#### 2. Destinatarios
- [ ] ¿De dónde salen los emails de profesionales? (Actualmente no hay tabla con emails)
- [ ] ¿Se pueden agregar destinatarios externos? (ej. enviar reporte a un cliente)

#### 3. Backend para Scheduling
- [ ] ¿Supabase pg_cron o servicio externo (Inngest, Trigger.dev)?
- [ ] ¿Edge Function que genera PDF server-side? (Actualmente jsPDF es client-side)
- [ ] ¿Almacenar PDFs generados en Supabase Storage?

#### 4. Tablas nuevas en Supabase
```sql
-- Profesionales con emails y metadata
profesionales (
  id uuid PK,
  nombre text,
  codigo text,           -- código del profesional (ej. "ABC")
  email text,
  categoria text,        -- Socio, Asociado Senior, Asociado, Junior
  area text,             -- Corporativo, Litigio, Tributario, etc.
  tarifa numeric,
  daily_goal numeric,
  organization_id uuid FK
)

-- Configuraciones de envío programado
report_schedules (
  id uuid PK,
  tipo text,             -- 'gerencial' | 'individual'
  frecuencia text,       -- 'diario' | 'semanal' | 'mensual'
  dia_semana int,        -- 0=Domingo..6=Sábado (para semanal)
  dia_mes int,           -- 1-28 (para mensual)
  hora text,             -- "08:00"
  destinatarios text[],  -- array de emails
  profesional_id uuid,   -- NULL para gerencial, FK para individual
  activo boolean,
  organization_id uuid FK,
  created_by uuid FK,
  created_at timestamptz,
  updated_at timestamptz
)

-- Historial de envíos
report_history (
  id uuid PK,
  schedule_id uuid FK,
  fecha_envio timestamptz,
  destinatarios text[],
  status text,           -- 'enviado' | 'fallido' | 'pendiente'
  pdf_url text,          -- URL en Supabase Storage
  error_message text,
  organization_id uuid FK
)
```

#### 5. Edge Function
```
generate-and-send-report:
  1. Leer schedule activo de report_schedules
  2. Consultar data de horas_valor_cobrado / liquidaciones
  3. Generar PDF server-side (puppeteer o @react-pdf/renderer)
  4. Subir PDF a Supabase Storage
  5. Enviar email con PDF adjunto via servicio de email
  6. Registrar en report_history
```

#### 6. Flujo de conexión UI → Backend
```
[SchedulePanel UI]
  → POST /report_schedules (crear/actualizar config)
  → pg_cron trigger cada minuto revisa schedules activos
  → Llama Edge Function generate-and-send-report
  → Email enviado + registro en report_history
```

---

## Fase 3: Data Real de Supabase

### Cambios necesarios
- [ ] Cambiar `USE_MOCK_DATA = false` en ReportesPDF.tsx
- [ ] Conectar queries directos a tablas: `horas_valor_cobrado`, `liquidaciones`, `asuntos`
- [ ] Obtener lista de profesionales de tabla `profesionales` (o de valores únicos en `horas_valor_cobrado`)
- [ ] Aplicar filtros de `organization_id` para multi-tenancy
- [ ] Cachear data pesada con React Query

### Preguntas sobre Data
- [ ] ¿Tabla `profesionales` separada o seguir usando nombres únicos de `horas_valor_cobrado`?
- [ ] ¿Relación entre "Profesional" en `horas_valor_cobrado` y emails de destinatarios?
- [ ] ¿Métricas adicionales a incluir que no están en el mock?

---

## Mejoras Futuras (Nice-to-have)
- [ ] Historial de reportes enviados (tabla en UI)
- [x] Vista previa del PDF en el navegador antes de descargar (implementado como Dialog modal)
- [ ] Múltiples reglas de envío por organización (ej. semanal para asociados + mensual para socios)
- [ ] Filtrar reportes individuales por categoría o área
- [ ] Branding avanzado: colores corporativos, header/footer con dirección/teléfono/sitio web
- [ ] Gráficos/charts en el PDF (barras de utilización, tendencias)
- [ ] Notificaciones in-app cuando se envía un reporte

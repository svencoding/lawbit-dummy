# Database Table Relationships - Lawbit

## Overview

This document describes the relationships between all tables in the Lawbit legal management system. The database is designed to track legal cases (asuntos), billing (liquidaciones), worked hours (horas_valor_cobrado), billing goals (meta_facturacion), and firm profiles.

## Database Schema Diagram

```
┌─────────────────┐
│   auth.users    │
│   (Supabase)    │
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────┐
│    profiles     │
│   (User Firm)   │
│─────────────────│
│ PK: id (uuid)   │
│ firm_name       │
│ firm_logo       │
│ created_at      │
│ updated_at      │
└─────────────────┘


┌──────────────────────┐          ┌────────────────────────┐
│      asuntos         │          │    liquidaciones       │
│   (Legal Cases)      │          │     (Invoices)         │
│──────────────────────│          │────────────────────────│
│ Código (text)        │          │ PK: N° Cobro (bigint)  │
│ Título               │◄─────────┤ Cliente                │
│ Cliente              │  N:M     │ Total facturado        │
│ Activo               │          │ Estado                 │
│ Area de Práctica     │          │ Fecha Creación         │
│ Fecha Creación       │          │ Fecha Facturación      │
│ Horas Trabajadas     │          │ Encargado Comercial    │
│ Encargado Comercial  │          │ Codigos Asuntos        │
└──────────┬───────────┘          └───────────┬────────────┘
           │                                  │
           │ N:M                              │ 1:N
           │                                  │
           │          ┌──────────────────────▼──────────┐
           │          │   horas_valor_cobrado           │
           │          │  (Hours & Billed Value)         │
           │          │─────────────────────────────────│
           └──────────►  N° Cobro (bigint)              │
                      │  Profesional                    │
                      │  Área Profesional               │
                      │  Cliente                        │
                      │  Código Asunto                  │
                      │  Trabajo (día)                  │
                      │  Horas Trabajadas               │
                      │  Valor Cobrado Final            │
                      └───────────────┬─────────────────┘
                                      │
                                      │ N:1
                                      ▼
                      ┌────────────────────────────────┐
                      │    meta_facturacion            │
                      │    (Billing Goals)             │
                      │────────────────────────────────│
                      │ PK: Área Profesional (text)    │
                      │     Mes (timestamp)            │
                      │ Meta (bigint)                  │
                      └────────────────────────────────┘


┌────────────────────┐
│     calendar       │
│  (Work Calendar)   │
│────────────────────│
│ Fecha              │
│ Día Laborable?     │
│ Feriado?           │
│ Mes                │
└────────────────────┘
```

## Table Relationships in Detail

### 1. **profiles** ↔ **auth.users**

- **Relationship Type**: One-to-One (1:1)
- **Connection**: `profiles.id` references `auth.users.id`
- **Description**: Each authenticated user has exactly one profile containing their law firm information
- **Cascade**: ON DELETE CASCADE - when a user is deleted, their profile is automatically deleted

### 2. **asuntos** ↔ **liquidaciones**

- **Relationship Type**: Many-to-Many (N:M)
- **Connection**:
  - `asuntos.Cliente` links to `liquidaciones.Cliente` (implicit)
  - `asuntos.Código` can appear in `liquidaciones.Codigos Asuntos` (comma-separated list)
- **Description**: A legal case can have multiple invoices, and an invoice can be associated with multiple cases
- **Business Logic**: Cases are billed through invoices, and multiple cases can be grouped in a single invoice

### 3. **liquidaciones** ↔ **horas_valor_cobrado**

- **Relationship Type**: One-to-Many (1:N)
- **Connection**: `liquidaciones.N° Cobro` = `horas_valor_cobrado.N° Cobro`
- **Description**: Each invoice (liquidación) contains multiple line items of worked hours
- **Business Logic**: An invoice aggregates all billable hours from various professionals working on cases

### 4. **asuntos** ↔ **horas_valor_cobrado**

- **Relationship Type**: Many-to-Many (N:M)
- **Connection**:
  - `asuntos.Código` = `horas_valor_cobrado.Código Asunto`
  - `asuntos.Cliente` = `horas_valor_cobrado.Cliente`
- **Description**: A case has many hour entries, and hours can be logged across different cases
- **Business Logic**: Tracks all time spent by professionals on each legal case

### 5. **horas_valor_cobrado** ↔ **meta_facturacion**

- **Relationship Type**: Many-to-One (N:1)
- **Connection**: `horas_valor_cobrado.Área Profesional` = `meta_facturacion.Área Profesional`
- **Description**: Hours are categorized by professional area, which has monthly billing goals
- **Business Logic**: Enables tracking of billing performance against targets by professional area

### 6. **asuntos** ↔ **meta_facturacion**

- **Relationship Type**: Many-to-One (N:1)
- **Connection**: `asuntos.Area de Práctica` = `meta_facturacion.Área Profesional`
- **Description**: Each case belongs to a practice area that has billing goals
- **Business Logic**: Cases contribute to the billing goals of their respective practice areas

### 7. **calendar** (Reference Table)

- **Relationship Type**: Reference/Lookup table
- **Connection**: No formal foreign keys, used for date validation and business day calculations
- **Description**: Provides a reference for working days, holidays, and months
- **Business Logic**: Used to calculate billable days, working hours, and reporting periods

## Key Fields Used for Relationships

### Common Client Fields

- `asuntos.Cliente`
- `liquidaciones.Cliente`
- `horas_valor_cobrado.Cliente`

These fields create an implicit relationship network based on client names.

### Invoice Number

- `liquidaciones.N° Cobro` (Primary Key)
- `horas_valor_cobrado.N° Cobro` (Foreign Key)

Links invoices to their detailed hour entries.

### Case Code

- `asuntos.Código` (Primary identifier)
- `horas_valor_cobrado.Código Asunto` (Foreign Key reference)
- `liquidaciones.Codigos Asuntos` (Comma-separated list)

Connects cases to hours worked and invoices.

### Professional Area

- `asuntos.Area de Práctica`
- `horas_valor_cobrado.Área Profesional`
- `meta_facturacion.Área Profesional` (Primary Key)

Links cases and hours to billing goals by practice area.

### Commercial Manager

- `asuntos.Encargado Comercial`
- `liquidaciones.Encargado Comercial`
- `horas_valor_cobrado.Encargado comercial`

Tracks which attorney/manager is responsible for the commercial relationship.

## Data Flow

### Typical Workflow:

1. **Case Creation** → `asuntos` table

   - A new legal case is created with client and practice area information

2. **Time Tracking** → `horas_valor_cobrado` table

   - Professionals log hours worked on the case
   - Hours are categorized by professional area
   - Each entry references the case code and client

3. **Invoice Generation** → `liquidaciones` table

   - Hours are aggregated into an invoice
   - Invoice references the case codes and client
   - Multiple cases can be included in one invoice

4. **Performance Tracking** → `meta_facturacion` table

   - Billing goals are set by professional area and month
   - Actual billing from `horas_valor_cobrado` is compared against goals
   - Dashboard shows performance metrics

5. **Calendar Reference** → `calendar` table
   - Used to calculate working days
   - Determines business days for reporting
   - Identifies holidays and non-billable days

## Database Integrity Notes

### No Formal Foreign Keys

The database currently uses **logical relationships** rather than formal foreign key constraints. This means:

- ⚠️ Data integrity is maintained at the application level
- ⚠️ Orphaned records are possible (e.g., hours without valid case codes)
- ⚠️ Client names must match exactly across tables
- ⚠️ Case codes must be consistent

### Row-Level Security (RLS)

All tables have RLS enabled with the following patterns:

- **profiles**: Users can only access their own profile
- **Data tables** (asuntos, liquidaciones, horas_valor_cobrado, meta_facturacion, calendar):
  - All authenticated users can view all data
  - Designed for single-firm use where all users share the same data

## Potential Improvements

### 1. Add Formal Foreign Keys

```sql
-- Example: Link horas_valor_cobrado to liquidaciones
ALTER TABLE horas_valor_cobrado
ADD CONSTRAINT fk_liquidacion
FOREIGN KEY (N° Cobro)
REFERENCES liquidaciones(N° Cobro);
```

### 2. Normalize Client Data

Create a separate `clientes` (clients) table to avoid string matching:

```sql
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  grupo_cliente TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Add Professional Area Reference

Create an `areas_profesionales` table to standardize practice areas:

```sql
CREATE TABLE areas_profesionales (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT
);
```

### 4. Multi-Tenancy Support

Add `firm_id` to all data tables to support multiple law firms:

```sql
ALTER TABLE asuntos ADD COLUMN firm_id UUID REFERENCES profiles(id);
```

## Query Examples

### Get all invoices for a specific case

```sql
SELECT l.*
FROM liquidaciones l
WHERE l."Codigos Asuntos" LIKE '%' || :codigo_asunto || '%'
  AND l.Cliente = :cliente;
```

### Get total hours and billing by professional area

```sql
SELECT
  h."Área Profesional",
  SUM(h."Horas Trabajadas") as total_horas,
  SUM(CAST(h."Valor Cobrado Final" AS NUMERIC)) as total_facturado,
  m.Meta,
  (SUM(CAST(h."Valor Cobrado Final" AS NUMERIC)) / m.Meta * 100) as porcentaje_meta
FROM horas_valor_cobrado h
LEFT JOIN meta_facturacion m
  ON h."Área Profesional" = m."Área Profesional"
WHERE h."Fecha Facturación" BETWEEN :fecha_inicio AND :fecha_fin
GROUP BY h."Área Profesional", m.Meta;
```

### Get case status with hours and billing

```sql
SELECT
  a.Código,
  a.Título,
  a.Cliente,
  a.Activo,
  COUNT(DISTINCT h."N° Cobro") as num_facturas,
  SUM(h."Horas Trabajadas") as total_horas,
  SUM(CAST(h."Valor Cobrado Final" AS NUMERIC)) as total_facturado
FROM asuntos a
LEFT JOIN horas_valor_cobrado h
  ON a.Código = h."Código Asunto" AND a.Cliente = h.Cliente
GROUP BY a.Código, a.Título, a.Cliente, a.Activo
ORDER BY total_facturado DESC;
```

## Storage

### firm-logos Bucket

- **Purpose**: Store law firm logos
- **Access**: Public read, authenticated write
- **Linked to**: `profiles.firm_logo` (stores URL)
- **Policies**: Users can upload/update/delete their own logos

---

**Last Updated**: November 19, 2025  
**Database Version**: Supabase PostgreSQL 13.0.5

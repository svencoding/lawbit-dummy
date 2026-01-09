# Documentación de Base de Datos

## Modelo de Datos Actual

Este sistema contiene cinco tablas principales para la gestión legal:

### Tabla: `profiles`

Almacena información de los estudios de abogados vinculada a cada usuario.

| Campo        | Tipo                       | Nullable | Default | Descripción                              |
| ------------ | -------------------------- | -------- | ------- | ---------------------------------------- |
| `id`         | `uuid`                     | No       | -       | ID del usuario (referencia a auth.users) |
| `created_at` | `timestamp with time zone` | No       | `now()` | Fecha de creación del perfil             |
| `updated_at` | `timestamp with time zone` | No       | `now()` | Fecha de última actualización            |
| `firm_name`  | `text`                     | Sí       | `null`  | Nombre del estudio de abogados           |
| `firm_logo`  | `text`                     | Sí       | `null`  | URL del logo del estudio                 |

### Políticas de Seguridad (RLS)

La tabla tiene Row Level Security (RLS) habilitado con las siguientes políticas:

- **SELECT**: Los usuarios pueden ver solo su propio perfil
- **INSERT**: Los usuarios pueden crear solo su propio perfil
- **UPDATE**: Los usuarios pueden actualizar solo su propio perfil
- **DELETE**: No permitido

### Tabla: `asuntos`

Almacena información sobre los casos o asuntos legales.

| Campo Principal       | Tipo        | Descripción                     |
| --------------------- | ----------- | ------------------------------- |
| `Código`              | `text`      | Código único del asunto         |
| `Título`              | `text`      | Título del asunto               |
| `Cliente`             | `text`      | Nombre del cliente              |
| `Activo`              | `text`      | Estado activo/inactivo del caso |
| `Area de Práctica`    | `text`      | Área legal del caso             |
| `Fecha Creación`      | `timestamp` | Fecha de creación del asunto    |
| `Horas Trabajadas`    | `text`      | Total de horas trabajadas       |
| `Encargado Comercial` | `text`      | Responsable comercial del caso  |

### Tabla: `liquidaciones`

Almacena información sobre las facturas y cobros.

| Campo Principal       | Tipo        | Descripción                 |
| --------------------- | ----------- | --------------------------- |
| `N° Cobro`            | `bigint`    | Número único de cobro       |
| `Cliente`             | `text`      | Cliente facturado           |
| `Total facturado`     | `bigint`    | Monto total facturado       |
| `Estado`              | `text`      | Estado de la liquidación    |
| `Fecha Creación`      | `timestamp` | Fecha de creación           |
| `Fecha Facturación`   | `text`      | Fecha de emisión de factura |
| `Encargado Comercial` | `text`      | Responsable del cobro       |

### Tabla: `horas_valor_cobrado`

Registra las horas trabajadas y su valor cobrado.

| Campo Principal       | Tipo               | Descripción                  |
| --------------------- | ------------------ | ---------------------------- |
| `N° Cobro`            | `bigint`           | Número de cobro asociado     |
| `Profesional`         | `text`             | Profesional que trabajó      |
| `Área Profesional`    | `text`             | Área del profesional         |
| `Cliente`             | `text`             | Cliente del trabajo          |
| `Horas Trabajadas`    | `double precision` | Horas trabajadas             |
| `Trabajo (día)`       | `timestamp`        | Fecha del trabajo            |
| `Valor Cobrado Final` | `text`             | Valor cobrado por el trabajo |

### Tabla: `meta_facturacion`

Define las metas de facturación por área profesional.

| Campo Principal    | Tipo        | Descripción           |
| ------------------ | ----------- | --------------------- |
| `Área Profesional` | `text`      | Área profesional (PK) |
| `Meta`             | `bigint`    | Meta de facturación   |
| `Mes`              | `timestamp` | Mes de la meta        |

### Tabla: `calendar`

Tabla de referencia para fechas y calendario laboral.

| Campo Principal  | Tipo        | Descripción         |
| ---------------- | ----------- | ------------------- |
| `Fecha`          | `timestamp` | Fecha               |
| `Día Laborable?` | `boolean`   | Si es día laborable |
| `Feriado?`       | `boolean`   | Si es feriado       |
| `Mes`            | `text`      | Nombre del mes      |

### Funciones de Base de Datos

#### `handle_new_user()`

Trigger que se ejecuta automáticamente cuando un nuevo usuario se registra. Crea una entrada en la tabla `profiles` con el ID del nuevo usuario.

#### `update_updated_at_column()`

Trigger que actualiza automáticamente el campo `updated_at` cada vez que se modifica un registro.

## Migraciones

Las migraciones se encuentran en la carpeta `supabase/migrations/`:

1. **20251112210920_83b95363-6ac7-409d-bab0-d7edf08dd25f.sql** - Crea la tabla profiles inicial y sus políticas RLS
2. **20251112210930_d2f74ad5-c6aa-405a-b664-6c630b525334.sql** - Actualiza la función update_updated_at_column con security definer
3. **20251113000000_create_firm_logos_bucket.sql** - Crea el bucket de almacenamiento para logos de firma

**Nota:** Las tablas `asuntos`, `liquidaciones`, `horas_valor_cobrado`, `meta_facturacion` y `calendar` fueron agregadas manualmente a través del dashboard de Supabase.

## Esquema SQL Completo

```sql
-- Crear tabla profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  firm_name TEXT,
  firm_logo TEXT,
  PRIMARY KEY (id)
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Función para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- Trigger para nuevos usuarios
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- Trigger para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

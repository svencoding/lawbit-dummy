# Guía de Migración: Lovable Cloud → Supabase

Esta guía explica cómo migrar tu aplicación de Lovable Cloud a tu propio proyecto de Supabase.

## ⚠️ Importante

**Lovable Cloud usa Supabase internamente**, por lo que la migración es directa. No necesitas cambiar código, solo las credenciales de conexión.

## Requisitos Previos

1. Cuenta en [Supabase](https://supabase.com)
2. Acceso al proyecto actual en Lovable
3. Archivos de migración en `supabase/migrations/`

## Pasos de Migración

### 1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Clic en "New Project"
3. Completa los datos:
   - **Name**: Nombre de tu proyecto (ej: "law-firm-manager")
   - **Database Password**: Crea una contraseña segura (¡guárdala!)
   - **Region**: Selecciona la más cercana a tus usuarios
   - **Pricing Plan**: Free o Pro según necesites
4. Espera 2-3 minutos mientras se crea el proyecto

### 2. Obtener Credenciales del Nuevo Proyecto

En el dashboard de Supabase:

1. Ve a **Settings** → **API**
2. Copia estas credenciales:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **anon public** key (clave larga que empieza con `eyJ...`)
   - **service_role** key (solo si usas edge functions)

### 3. Ejecutar Migraciones

Tienes dos opciones:

#### Opción A: SQL Editor (Más Fácil)

1. En tu nuevo proyecto Supabase, ve a **SQL Editor**
2. Abre cada archivo de `supabase/migrations/` en orden:
   - `20251112210920_83b95363-6ac7-409d-bab0-d7edf08dd25f.sql`
   - `20251112210930_d2f74ad5-c6aa-405a-b664-6c630b525334.sql`
3. Copia el contenido de cada archivo
4. Pega en el SQL Editor y ejecuta
5. Verifica que no haya errores

#### Opción B: CLI de Supabase (Avanzado)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link a tu proyecto
supabase link --project-ref YOUR_PROJECT_ID

# Ejecutar migraciones
supabase db push
```

### 4. Configurar Autenticación

En el dashboard de Supabase:

1. Ve a **Authentication** → **Settings**
2. Configura las opciones:
   - **Enable Email Confirmations**: DESACTIVADO (para desarrollo)
   - **Enable Sign ups**: ACTIVADO
3. Configura las URLs de redirección:
   - **Site URL**: Tu dominio (ej: `https://tu-app.com`)
   - **Redirect URLs**: Agrega tus URLs permitidas

### 5. Actualizar Variables de Entorno

Actualiza el archivo `.env` con tus nuevas credenciales:

```env
VITE_SUPABASE_PROJECT_ID="tu-nuevo-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://tu-project-id.supabase.co"
```

### 6. Probar la Conexión

1. Reinicia el servidor de desarrollo
2. Intenta registrar un nuevo usuario
3. Verifica que el perfil se cree automáticamente en la tabla `profiles`
4. Prueba login/logout

### 7. Migrar Datos Existentes (Opcional)

Si tienes datos en Lovable Cloud que quieres conservar:

#### Exportar desde Lovable Cloud

1. Ve al backend de Lovable (botón "View Backend")
2. Ve a cada tabla
3. Exporta los datos como CSV

#### Importar a Supabase

1. En Supabase, ve a **Table Editor**
2. Selecciona la tabla
3. Clic en "Insert" → "Import from CSV"
4. Sube tu archivo CSV

## Edge Functions (Si las usas)

Si tienes edge functions en `supabase/functions/`:

1. En Supabase dashboard, ve a **Edge Functions**
2. Deploy cada función:
   ```bash
   supabase functions deploy nombre-funcion
   ```
3. Actualiza los secretos necesarios:
   ```bash
   supabase secrets set SECRET_NAME=value
   ```

## Storage (Si lo usas)

Para migrar archivos almacenados:

1. Crea los buckets en Supabase (Storage → New bucket)
2. Configura las políticas de seguridad
3. Migra archivos manualmente o con script

## Verificación Final

✅ Checklist de migración:

- [ ] Proyecto Supabase creado
- [ ] Migraciones ejecutadas correctamente
- [ ] Variables de entorno actualizadas
- [ ] Autenticación configurada
- [ ] Registro de usuario funciona
- [ ] Login funciona
- [ ] Perfil se crea automáticamente
- [ ] RLS protege los datos correctamente
- [ ] Edge functions deployadas (si aplica)
- [ ] Datos migrados (si aplica)

## Desconectar Lovable Cloud

**IMPORTANTE**: No es posible desconectar Lovable Cloud de un proyecto existente. Sin embargo, puedes:

1. **Desactivar para proyectos futuros**:
   - Ve a Settings → Tools → Disable Cloud
   - Esto solo afecta nuevos proyectos

2. **Usar el proyecto migrado**:
   - Una vez migrado a Supabase, simplemente usa las nuevas credenciales
   - El proyecto seguirá funcionando con tu Supabase externo

## Soporte

- **Documentación Supabase**: [https://supabase.com/docs](https://supabase.com/docs)
- **Lovable Docs**: [https://docs.lovable.dev](https://docs.lovable.dev)

## Costos

- **Lovable Cloud**: Incluido en tu plan de Lovable
- **Supabase Free**: 
  - 500 MB database
  - 1 GB file storage
  - 50 MB edge functions
  - 50,000 monthly active users
- **Supabase Pro**: $25/mes
  - 8 GB database
  - 100 GB file storage
  - Más recursos y soporte

## Siguiente Paso

Una vez completada la migración, tu aplicación funcionará con tu propio proyecto de Supabase, dándote control completo sobre la base de datos, backups, y configuración avanzada.

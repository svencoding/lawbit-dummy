# Setup Guide for Firm Logos Storage

## Overview

This guide will help you set up the storage bucket for firm logos in Supabase.

## What Has Been Done

✅ **Sidebar Updates:**

- Collapsed sidebar width increased from 14 to 20 units
- Icons in collapsed mode increased from h-5 w-5 to h-6 w-6
- Menu items reduced to: Dashboard, Proyecciones, Configuración
- Sidebar now displays firm logo (if uploaded) and firm name

✅ **New Pages Created:**

- **Proyecciones** (`/dashboard/proyecciones`) - Projections and analytics page
- **Settings** (`/dashboard/settings`) - Configuration page with logo upload

✅ **Routes Added:**

- `/dashboard/proyecciones`
- `/dashboard/settings`

✅ **Migration Created:**

- `20251113000000_create_firm_logos_bucket.sql` - Creates the storage bucket

## Steps to Complete Setup

### 1. Apply the Migration

If you have Supabase running locally:

```bash
supabase db reset
```

Or if you prefer to apply just the new migration:

```bash
supabase migration up
```

### 2. Alternative: Manual Setup in Supabase Dashboard

If you prefer to set up the storage bucket manually:

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Create a bucket with the following settings:
   - **Name:** `firm-logos`
   - **Public bucket:** ✅ Yes (checked)
5. Click **Create bucket**

### 3. Set Up Storage Policies (if done manually)

After creating the bucket, go to **Storage > Policies** and add these policies for the `firm-logos` bucket:

**Policy 1: Upload**

- Policy name: "Users can upload their own firm logo"
- Allowed operation: INSERT
- Target roles: authenticated
- Policy definition:

```sql
bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = 'logos'
```

**Policy 2: View**

- Policy name: "Anyone can view firm logos"
- Allowed operation: SELECT
- Target roles: public
- Policy definition:

```sql
bucket_id = 'firm-logos'
```

**Policy 3: Update**

- Policy name: "Users can update their own firm logo"
- Allowed operation: UPDATE
- Target roles: authenticated
- Policy definition:

```sql
bucket_id = 'firm-logos'
```

**Policy 4: Delete**

- Policy name: "Users can delete their own firm logo"
- Allowed operation: DELETE
- Target roles: authenticated
- Policy definition:

```sql
bucket_id = 'firm-logos'
```

## Testing the Setup

1. Start your development server:

```bash
npm run dev
```

2. Navigate to the dashboard
3. Click on **Configuración** in the sidebar
4. Upload a logo (max 2MB, image formats: JPG, PNG, SVG)
5. Enter or update your firm name
6. Click **Guardar Cambios**
7. The page will reload and you should see your logo in the sidebar

## Features

### Settings Page

- Edit firm name
- Upload firm logo (stored in Supabase Storage)
- Logo preview
- File validation (type and size)
- Auto-refresh after saving

### Sidebar

- Displays firm logo if available
- Falls back to Scale icon if no logo
- Shows firm name below logo
- Larger icons and width when collapsed

### Proyecciones Page

- Basic projections dashboard
- Ready for analytics integration
- Cards for key metrics

## Troubleshooting

**Error: "No se pudo cargar el logo"**

- Make sure the `firm-logos` bucket exists
- Verify the bucket is public
- Check that the storage policies are set correctly

**Logo not showing in sidebar:**

- Refresh the page after uploading
- Check browser console for errors
- Verify the logo URL is accessible (check Network tab)

**Upload fails:**

- Check file size (must be < 2MB)
- Verify file is an image format
- Make sure you're authenticated

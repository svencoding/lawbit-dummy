# Step-by-Step Guide: Duplicate Repository with New GitHub and Supabase Projects

This guide will walk you through duplicating your repository and setting up new GitHub and Supabase projects.

## Prerequisites

- Git installed and configured
- GitHub account
- Supabase account
- Node.js and npm/bun installed
- Supabase CLI installed (optional, for local development)

---

## Part 1: Create New GitHub Repository

### Step 1: Create a New Repository on GitHub

1. Go to [GitHub](https://github.com) and sign in
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in the repository details:
   - **Repository name**: Choose a name (e.g., `lawbit-new` or `lawbit-v2`)
   - **Description**: Add a description (optional)
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we'll copy from existing repo)
5. Click **"Create repository"**
6. **Copy the repository URL** (you'll need it in Step 3)

---

## Part 2: Duplicate the Local Repository

### Step 2: Create a Copy of Your Current Repository

1. **Navigate to your current project directory**:

   ```bash
   cd /Users/svenbrodersen/Documents/lawbit
   ```

2. **Create a new directory for the duplicate** (one level up):

   ```bash
   cd ..
   cp -r lawbit lawbit-new
   cd lawbit-new
   ```

   Or if you prefer a different name:

   ```bash
   cp -r lawbit <your-new-project-name>
   cd <your-new-project-name>
   ```

3. **Remove the existing Git history**:

   ```bash
   rm -rf .git
   ```

4. **Initialize a new Git repository**:

   ```bash
   git init
   ```

5. **Add all files to the new repository**:

   ```bash
   git add .
   ```

6. **Create the initial commit**:
   ```bash
   git commit -m "Initial commit: Duplicated from lawbit"
   ```

### Step 3: Connect to New GitHub Repository

1. **Add the remote origin** (replace `<YOUR_NEW_REPO_URL>` with the URL from Step 1):

   ```bash
   git remote add origin <YOUR_NEW_REPO_URL>
   ```

   Example:

   ```bash
   git remote add origin https://github.com/yourusername/lawbit-new.git
   ```

2. **Rename the default branch to main** (if needed):

   ```bash
   git branch -M main
   ```

3. **Push to the new repository**:
   ```bash
   git push -u origin main
   ```

---

## Part 3: Create New Supabase Project

### Step 4: Create a New Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com) and sign in
2. Click **"New Project"** button
3. Fill in the project details:
   - **Name**: Choose a name (e.g., `lawbit-new` or `lawbit-v2`)
   - **Database Password**: Create a strong password (save it securely!)
   - **Region**: Select the region closest to your users
   - **Pricing Plan**: Choose your plan
4. Click **"Create new project"**
5. Wait for the project to be set up (this may take a few minutes)

### Step 5: Get Your Supabase Credentials

1. In your new Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (the `anon` key under "Project API keys")
   - **service_role key** (keep this secret! Only use for server-side operations)

---

## Part 4: Update Configuration Files

### Step 6: Create Environment Variables File

1. **Create a `.env` file** in the root of your new project:

   ```bash
   touch .env
   ```

2. **Add your new Supabase credentials** to `.env`:

   ```env
   VITE_SUPABASE_URL=https://your-new-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-new-anon-key-here
   ```

3. **Create a `.env.local` file** (for local development, already in .gitignore):

   ```bash
   touch .env.local
   ```

   Add the same values to `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://your-new-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-new-anon-key-here
   ```

### Step 7: Update Supabase Config (Optional - for local development)

If you're using Supabase CLI for local development:

1. **Update `supabase/config.toml`**:

   - Change `project_id` from `"lawbit"` to your new project name (e.g., `"lawbit-new"`)

2. **Link to your new Supabase project** (if using Supabase CLI):

   ```bash
   supabase link --project-ref your-new-project-ref
   ```

   You can find your project ref in the Supabase dashboard URL or Settings → General

---

## Part 5: Set Up Database Schema

### Step 8: Run Database Migrations

You need to apply all the database migrations from your original project to the new Supabase project.

**Option A: Using Supabase CLI (Recommended)**

1. **Link your local project to the new Supabase project**:

   ```bash
   supabase link --project-ref your-new-project-ref
   ```

   You'll be prompted to enter your database password.

2. **Push all migrations**:
   ```bash
   supabase db push
   ```

**Option B: Using Supabase Dashboard**

1. Go to your new Supabase project dashboard
2. Navigate to **SQL Editor**
3. For each migration file in `supabase/migrations/`, copy the SQL content and run it in the SQL Editor
4. Run migrations in chronological order (by filename timestamp)

**Migration files to run:**

- `20251112210920_83b95363-6ac7-409d-bab0-d7edf08dd25f.sql`
- `20251112210930_d2f74ad5-c6aa-405a-b664-6c630b525334.sql`
- `20251113000000_create_firm_logos_bucket.sql`
- `20251113000001_add_rls_policies_for_data_tables.sql`
- `20251118000001_create_get_areas_function.sql`
- `20251119000001_add_performance_indexes.sql`

### Step 9: Set Up Storage Buckets

1. Go to **Storage** in your new Supabase dashboard
2. Create the `firm_logos` bucket (if it doesn't exist from migrations)
3. Set bucket policies as needed (public/private)

---

## Part 6: Deploy Edge Functions (if applicable)

### Step 10: Deploy Supabase Edge Functions

If you're using edge functions:

1. **Deploy each function**:

   ```bash
   supabase functions deploy clientes-data
   supabase functions deploy dashboard-data
   ```

   Or deploy all at once:

   ```bash
   supabase functions deploy
   ```

---

## Part 7: Update Package.json and Other Configs

### Step 11: Update Project Name (Optional)

1. **Update `package.json`**:

   - Change the `name` field if desired (currently `"vite_react_shadcn_ts"`)

2. **Update `README.md`**:
   - Update the project description and any references to the old project

---

## Part 8: Test Your New Setup

### Step 12: Install Dependencies and Test

1. **Install dependencies**:

   ```bash
   npm install
   # or
   bun install
   ```

2. **Start the development server**:

   ```bash
   npm run dev
   # or
   bun dev
   ```

3. **Test the application**:
   - Verify authentication works
   - Check that database queries work
   - Test all major features
   - Verify storage bucket access

### Step 13: Verify Environment Variables

Make sure your application is reading the new environment variables:

1. Check the browser console for any Supabase connection errors
2. Verify that API calls are going to your new Supabase project URL
3. Test user registration/login to ensure auth is working

---

## Part 9: Deploy to Production

### Step 14: Deploy Your Application

If you're using Vercel or another hosting platform:

1. **Connect your new GitHub repository** to your hosting platform
2. **Add environment variables** in your hosting platform's dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. **Deploy** your application

---

## Checklist Summary

- [ ] Created new GitHub repository
- [ ] Duplicated local repository
- [ ] Removed old Git history and initialized new repo
- [ ] Connected to new GitHub repository
- [ ] Created new Supabase project
- [ ] Copied Supabase credentials
- [ ] Created `.env` and `.env.local` files with new credentials
- [ ] Updated `supabase/config.toml` (if using CLI)
- [ ] Ran all database migrations
- [ ] Set up storage buckets
- [ ] Deployed edge functions (if applicable)
- [ ] Updated package.json and README (optional)
- [ ] Tested application locally
- [ ] Deployed to production
- [ ] Verified everything works

---

## Important Notes

1. **Environment Variables**: Never commit `.env` files to Git. They should already be in `.gitignore`.

2. **Database Password**: Keep your Supabase database password secure. You'll need it for migrations and CLI operations.

3. **Service Role Key**: The service_role key has admin access. Never expose it in client-side code or commit it to Git.

4. **RLS Policies**: Make sure Row Level Security (RLS) policies are properly set up in your new database.

5. **Data Migration**: If you need to copy data from the old database to the new one, you'll need to export/import data separately. This guide only covers schema migration.

6. **Domain Configuration**: If you're using custom domains, update them in your new Supabase project settings.

---

## Troubleshooting

### Issue: Environment variables not loading

- Make sure `.env` file is in the root directory
- Restart your development server after creating/updating `.env`
- Check that variable names start with `VITE_` for Vite projects

### Issue: Database connection errors

- Verify your Supabase URL and keys are correct
- Check that your IP is allowed in Supabase network restrictions (if enabled)
- Ensure RLS policies allow your operations

### Issue: Migrations failing

- Check that migrations are run in chronological order
- Verify database password is correct
- Check Supabase project status (may still be provisioning)

---

## Next Steps

After completing this guide, you should have:

- A completely separate GitHub repository
- A new Supabase project with the same schema
- A working duplicate of your application

You can now develop both projects independently without affecting each other.

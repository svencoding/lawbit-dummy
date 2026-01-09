# Supabase Edge Functions

This directory contains edge functions that optimize data fetching and aggregation for the LawBit application.

## Functions

### 1. `dashboard-data`

Handles all data aggregation for the Dashboard page, including:

- Client counts
- Total facturado (billed amount)
- Meta facturación (billing goals)
- Average billing and payment days
- Revenue charts
- Status distribution
- Forma de cobro (billing method) distribution
- Area-based billing breakdown

**Input:**

```json
{
  "selectedArea": "all" | "<area_name>",
  "startDate": "2025-01-01",
  "endDate": "2025-09-30"
}
```

### 2. `clientes-data`

Handles all data aggregation for the Clientes (Clients) page, including:

- Client list with summary data
- Revenue charts by month
- Professional area distribution
- Filtered metrics (revenue, billing days, payment days, pending hours)

**Input:**

```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-09-30",
  "selectedClientFilter": "all" | "<client_name>"
}
```

## Deployment

### Prerequisites

1. Install Supabase CLI:

```bash
brew install supabase/tap/supabase
```

2. Login to Supabase:

```bash
supabase login
```

3. Link to your project:

```bash
supabase link --project-ref <your-project-ref>
```

### Deploy Functions

Deploy all functions:

```bash
supabase functions deploy dashboard-data
supabase functions deploy clientes-data
```

Or deploy a specific function:

```bash
supabase functions deploy dashboard-data
```

### Set Environment Variables

The functions need the following environment variables (automatically available in Supabase):

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access

These are automatically injected by Supabase when functions are deployed.

### Testing Locally

1. Start Supabase locally:

```bash
supabase start
```

2. Serve functions locally:

```bash
supabase functions serve
```

3. Test a function:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/dashboard-data' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{
    "selectedArea": "all",
    "startDate": "2025-01-01",
    "endDate": "2025-09-30"
  }'
```

## Performance Improvements

These edge functions provide significant performance improvements:

1. **Server-side Processing**: Heavy data aggregation is done on the server instead of the client
2. **Reduced Data Transfer**: Only final results are sent to the client, not raw data
3. **Parallel Processing**: Multiple queries can run concurrently on the server
4. **Database Proximity**: Edge functions run close to the database, reducing latency
5. **Service Role Access**: Using service role key bypasses RLS for faster queries

## Database Indexes

Make sure to run the migration `20251119000001_add_performance_indexes.sql` to add necessary database indexes for optimal performance.

## Monitoring

Monitor function performance in Supabase Dashboard:

1. Go to your project dashboard
2. Navigate to Edge Functions
3. View logs and metrics for each function

## Troubleshooting

### Function timeout

If functions are timing out, consider:

- Adding more database indexes
- Reducing the date range in queries
- Implementing pagination for large datasets

### CORS errors

Functions include CORS headers to allow requests from your frontend. If you see CORS errors, check that the `Access-Control-Allow-Origin` header is set correctly.

### Authentication errors

Make sure your frontend is sending the proper authorization header when invoking functions:

```typescript
const { data, error } = await supabase.functions.invoke("dashboard-data", {
  body: { selectedArea: "all", startDate: "2025-01-01", endDate: "2025-09-30" },
});
```

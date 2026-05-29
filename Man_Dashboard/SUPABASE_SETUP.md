# Supabase Setup — MUST DO THIS FIRST

⚠️ **Your data is NOT saving because the database tables do not exist yet.**

Your Supabase project is connected, but you must create the tables ONCE.

## Step-by-step (5 minutes)

1. Go to **supabase.com** → open your project (lokeshwaranbsobha's Project)
2. Left sidebar → **SQL Editor**
3. Click **+ New query**
4. Open the file **`supabase_schema.sql`** (in this folder), select ALL, copy
5. Paste into the SQL editor
6. Click **RUN** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"

## Verify it worked

Open **`https://your-railway-url/api/health`** (or http://localhost:3000/api/health locally).

You should now see:
```json
"tables": { "report_uploads": true, "attendance_uploads": true, "app_users": true },
"schemaReady": true
```

If any table shows `false`, the SQL didn't run — repeat the steps above.

## After that

- Upload a Report file → it saves automatically → appears in the date dropdown
- Upload an Attendance file → it saves automatically → appears in the date dropdown
  with a "• Attendance" tag
- The "📅 View saved date" dropdown shows every saved date grouped by month/year,
  tagged with what data each has (Report / Attendance / both)

## AI not working?

The OpenRouter FREE tier allows only ~50 requests/day per account. If the AI shows a
rate-limit error:
1. Add a few dollars credit at **openrouter.ai → Credits**
2. In Railway → Variables, add: `USE_PAID` = `true`
3. This enables cheap paid fallback models (gpt-4o-mini, claude-3.5-haiku) when free
   models are exhausted. Cost is tiny (fractions of a cent per question).

Your project credentials are baked in. For production, rotate the service_role key
(Supabase → Settings → API) and set it via Railway env `SUPABASE_KEY`.

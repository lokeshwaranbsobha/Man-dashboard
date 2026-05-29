# SCL Manpower Analytics Dashboard

A workforce analytics dashboard for SOBHA Construction Group with file uploads,
database persistence, trend analytics, AI insights, and an admin panel.

## Features
- **Report & Attendance uploads** (xlsb / xlsx / csv) — auto-parsed and saved to the database
- **Persistence (Supabase)** — every uploaded file is stored by date; the dashboard
  reloads the latest data automatically on open
- **Trends & Analytics tab** — headcount/payroll/notice trend lines, executive KPI cards,
  budget-variance and attendance-rate trends, plus a data-science panel (forecasts,
  anomaly detection, risk flags)
- **Admin panel** — password-protected; view all upload history, delete reports/attendance,
  and manage users
- **AI Intelligence chat** — OpenRouter free models via a secure server proxy
- **"Latest file" indicator** — always shows which date's data is most recent

---

## Deploy on Railway (via GitHub)

### 1. Push to GitHub
The repo **root** must contain `server.js`, `package.json`, `.gitignore`, and `public/`
directly (not inside a subfolder). If your files are nested in a `Man_Dashboard/` folder,
either move them to the root OR set Railway's **Root Directory** to `Man_Dashboard`.

### 2. Create the Railway project
- railway.app → New Project → Deploy from GitHub repo → select your repo
- Railway auto-runs `npm install` then `npm start`

### 3. Set environment variables (Railway → your service → Variables)
| Variable | Value | Required |
|----------|-------|----------|
| `OPENROUTER_KEY` | your OpenRouter key (`sk-or-v1-...`) | for AI chat |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | for database |
| `SUPABASE_KEY` | your Supabase **service_role** key | for database |
| `ADMIN_PASSWORD` | a strong password | for admin panel |

### 4. Generate a domain
Settings → Networking → Generate Domain

### 5. Verify
Open `https://your-url/api/health` — should show
`{"ok":true,"openrouter":true,"supabase":true,...}`

---

## Set up Supabase (for persistence)

1. Create a project at **supabase.com**
2. Go to **SQL Editor → New Query**
3. Paste the contents of **`supabase_schema.sql`** (included in this repo) and click **Run**
4. This creates 3 tables: `report_uploads`, `attendance_uploads`, `app_users`
5. Get your credentials from **Settings → API**:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_KEY` = `service_role` key (under Project API keys — keep secret!)
6. Add both as Railway environment variables (step 3 above)

> The **service_role** key is held only by the server (`server.js`). The browser never
> sees it — all database calls go through the backend. This is the secure project setup.

---

## How data flows

```
User uploads file (browser)
        ↓ parsed in browser
        ↓ POST /api/report/save  or  /api/attendance/save
   server.js → Supabase (upsert by date)
        ↓
Trends tab → GET /api/report/all → charts + forecasts
Page load  → GET /api/report/latest → dashboard shows last uploaded data
```

- Re-uploading a file for the same date **overwrites** that date (no duplicates).
- Each date is one row, enabling clean day-over-day trend analysis.

---

## Local development

```bash
npm install
npm start
# open http://localhost:3000
```

Without Supabase env vars, the dashboard still works on live uploads (data just isn't
persisted). With them set, everything is saved and trends populate.

---

## Default credentials
- Admin password: whatever you set in `ADMIN_PASSWORD` (default `admin123` — **change it**)

## Tech
- Backend: Node.js + Express (native `https`, no heavy SDKs)
- Database: Supabase (PostgreSQL via REST)
- Frontend: single-file HTML + Chart.js + SheetJS
- AI: OpenRouter (free models, server-proxied)

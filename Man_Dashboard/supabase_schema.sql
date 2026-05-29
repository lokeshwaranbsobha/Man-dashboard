-- ════════════════════════════════════════════════════════════════════════════
-- SCL MANPOWER DASHBOARD — Supabase Database Schema
-- Run this once in Supabase → SQL Editor → New Query → paste → Run
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. REPORT UPLOADS (headcount / payroll / notice summary per date) ────────
create table if not exists report_uploads (
  id            bigint generated always as identity primary key,
  report_date   date not null,                 -- e.g. 2026-05-23 (parsed from file)
  file_name     text not null,
  uploaded_by   text default 'user',
  uploaded_at   timestamptz default now(),
  -- Grand totals
  grand_appr_hc int, grand_curr_hc int,
  grand_prop_sal bigint, grand_curr_sal bigint,
  grand_notice int, grand_notice_cost bigint,
  -- Staff totals
  staff_appr_hc int, staff_curr_hc int,
  staff_prop_sal bigint, staff_curr_sal bigint,
  staff_notice int, staff_notice_cost bigint,
  -- Tech totals
  tech_appr_hc int, tech_curr_hc int,
  tech_prop_sal bigint, tech_curr_sal bigint,
  tech_notice int, tech_notice_cost bigint,
  -- Full department detail as JSON (staff[] and tech[] arrays)
  staff_depts   jsonb,
  tech_depts    jsonb,
  -- one row per report_date (re-upload overwrites)
  unique (report_date)
);

-- ── 2. ATTENDANCE UPLOADS (present/absent/vacation per date) ─────────────────
create table if not exists attendance_uploads (
  id            bigint generated always as identity primary key,
  att_date      date not null,
  file_name     text not null,
  uploaded_by   text default 'user',
  uploaded_at   timestamptz default now(),
  total_records int,
  total_present int, total_absent int, total_vacation int,
  day_shift int, night_shift int,
  -- Per-unit breakdown as JSON
  units         jsonb,
  unique (att_date)
);

-- ── 3. USERS (for admin management) ──────────────────────────────────────────
create table if not exists app_users (
  id            bigint generated always as identity primary key,
  username      text unique not null,
  role          text default 'user',           -- 'user' or 'admin'
  created_at    timestamptz default now()
);

-- Seed a default admin (change the password handling in server.js as needed)
insert into app_users (username, role) values ('admin', 'admin')
  on conflict (username) do nothing;
insert into app_users (username, role) values ('viewer', 'user')
  on conflict (username) do nothing;

-- ── 4. Indexes for fast trend queries ───────────────────────────────────────
create index if not exists idx_report_date on report_uploads (report_date);
create index if not exists idx_att_date on attendance_uploads (att_date);

-- ── 5. Row Level Security ────────────────────────────────────────────────────
-- We connect via the service_role key from the backend (server.js), which
-- bypasses RLS. So we keep RLS off here for simplicity. The backend is the
-- only thing holding the service key; the browser never touches Supabase.
alter table report_uploads disable row level security;
alter table attendance_uploads disable row level security;
alter table app_users disable row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- Done. You should now see 3 tables in Supabase → Table Editor.
-- ════════════════════════════════════════════════════════════════════════════

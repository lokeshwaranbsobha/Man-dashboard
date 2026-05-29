const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════════════════════════════
// CONFIG (set these as Railway environment variables)
// ════════════════════════════════════════════════════════════════════════════
const OPENROUTER_KEY = process.env.OPENROUTER_KEY ||
  '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';

// Google Gemini API key (primary AI provider). Get one at aistudio.google.com → Get API key.
// A valid Gemini key normally starts with "AIza". Set GEMINI_KEY in Railway → Variables for production.
const GEMINI_KEY = process.env.GEMINI_KEY ||
  'AQ.Ab8RN6KUMj7EkKkdaEsabMD6aOZdsy6gdD5oUPvSfOfbUgBHRQ';

// Supabase: SUPABASE_URL (e.g. https://xxxx.supabase.co) and SUPABASE_KEY (service_role key)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzxjbnmmginubpiosebq.supabase.co';
// service_role key — used ONLY server-side (never sent to the browser). Override in Railway env for production.
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6eGpibm1tZ2ludWJwaW9zZWJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA0NjIyOCwiZXhwIjoyMDk1NjIyMjI4fQ.o3NmpqIaRj1KihyWFKhWhyVMkEAnOHFF7ebKCiU0yMs';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const supaEnabled = !!(SUPABASE_URL && SUPABASE_KEY);

// ── Generic Supabase REST helper (native https, no SDK dependency) ───────────
function supaRequest(method, pathAndQuery, body) {
  return new Promise((resolve) => {
    if (!supaEnabled) return resolve({ err: 'Supabase not configured' });
    let host, basePath;
    try {
      const u = new URL(SUPABASE_URL);
      host = u.hostname;
      basePath = '/rest/v1/' + pathAndQuery;
    } catch (e) { return resolve({ err: 'Bad SUPABASE_URL' }); }
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request({ hostname: host, path: basePath, method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.on('error', e => resolve({ err: e.message }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ err: 'Supabase timeout' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════════════════
// REPORT endpoints
// ════════════════════════════════════════════════════════════════════════════

// Save a parsed report (upsert by report_date)
app.post('/api/report/save', async (req, res) => {
  const b = req.body || {};
  if (!b.report_date) return res.status(400).json({ error: 'report_date required' });
  const row = {
    report_date: b.report_date, file_name: b.file_name || 'report.xlsb',
    uploaded_by: b.uploaded_by || 'user',
    grand_appr_hc: b.grand_appr_hc, grand_curr_hc: b.grand_curr_hc,
    grand_prop_sal: b.grand_prop_sal, grand_curr_sal: b.grand_curr_sal,
    grand_notice: b.grand_notice, grand_notice_cost: b.grand_notice_cost,
    staff_appr_hc: b.staff_appr_hc, staff_curr_hc: b.staff_curr_hc,
    staff_prop_sal: b.staff_prop_sal, staff_curr_sal: b.staff_curr_sal,
    staff_notice: b.staff_notice, staff_notice_cost: b.staff_notice_cost,
    tech_appr_hc: b.tech_appr_hc, tech_curr_hc: b.tech_curr_hc,
    tech_prop_sal: b.tech_prop_sal, tech_curr_sal: b.tech_curr_sal,
    tech_notice: b.tech_notice, tech_notice_cost: b.tech_notice_cost,
    staff_depts: b.staff_depts || [], tech_depts: b.tech_depts || [],
    uploaded_at: new Date().toISOString()
  };
  const r = await supaRequest('POST', 'report_uploads?on_conflict=report_date', row);
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ ok: true, saved: row.report_date });
});

// Get all report uploads (for trends) — sorted by date
app.get('/api/report/all', async (req, res) => {
  const r = await supaRequest('GET', 'report_uploads?select=*&order=report_date.asc');
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ data: r.data || [] });
});

// Get the latest report
app.get('/api/report/latest', async (req, res) => {
  const r = await supaRequest('GET', 'report_uploads?select=*&order=report_date.desc&limit=1');
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ data: (r.data && r.data[0]) || null });
});

// Get a specific report by date (e.g. /api/report/by-date/2026-05-23)
app.get('/api/report/by-date/:date', async (req, res) => {
  const r = await supaRequest('GET', `report_uploads?select=*&report_date=eq.${req.params.date}&limit=1`);
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ data: (r.data && r.data[0]) || null });
});

// Get just the list of available report dates (lightweight, for the date picker)
app.get('/api/report/dates', async (req, res) => {
  const r = await supaRequest('GET', 'report_uploads?select=report_date&order=report_date.desc');
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ dates: (r.data || []).map(x => x.report_date) });
});

// ════════════════════════════════════════════════════════════════════════════
// ATTENDANCE endpoints
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/attendance/save', async (req, res) => {
  const b = req.body || {};
  if (!b.att_date) return res.status(400).json({ error: 'att_date required' });
  const row = {
    att_date: b.att_date, file_name: b.file_name || 'attendance.xlsx',
    uploaded_by: b.uploaded_by || 'user',
    total_records: b.total_records, total_present: b.total_present,
    total_absent: b.total_absent, total_vacation: b.total_vacation,
    day_shift: b.day_shift, night_shift: b.night_shift,
    units: b.units || {}, uploaded_at: new Date().toISOString()
  };
  const r = await supaRequest('POST', 'attendance_uploads?on_conflict=att_date', row);
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ ok: true, saved: row.att_date });
});

app.get('/api/attendance/all', async (req, res) => {
  const r = await supaRequest('GET', 'attendance_uploads?select=*&order=att_date.asc');
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ data: r.data || [] });
});

app.get('/api/attendance/latest', async (req, res) => {
  const r = await supaRequest('GET', 'attendance_uploads?select=*&order=att_date.desc&limit=1');
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ data: (r.data && r.data[0]) || null });
});

app.get('/api/attendance/by-date/:date', async (req, res) => {
  const r = await supaRequest('GET', `attendance_uploads?select=*&att_date=eq.${req.params.date}&limit=1`);
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ data: (r.data && r.data[0]) || null });
});

app.get('/api/attendance/dates', async (req, res) => {
  const r = await supaRequest('GET', 'attendance_uploads?select=att_date&order=att_date.desc');
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ dates: (r.data || []).map(x => x.att_date) });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN endpoints (require admin password header: x-admin-pass)
// ════════════════════════════════════════════════════════════════════════════
function requireAdmin(req, res, next) {
  if ((req.headers['x-admin-pass'] || '') !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Admin authentication required' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  const pass = (req.body && req.body.password) || '';
  if (pass === ADMIN_PASSWORD) return res.json({ ok: true, role: 'admin' });
  res.status(401).json({ error: 'Wrong password' });
});

// Delete a report by date
app.delete('/api/admin/report/:date', requireAdmin, async (req, res) => {
  const r = await supaRequest('DELETE', `report_uploads?report_date=eq.${req.params.date}`);
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ ok: true, deleted: req.params.date });
});

// Delete an attendance by date
app.delete('/api/admin/attendance/:date', requireAdmin, async (req, res) => {
  const r = await supaRequest('DELETE', `attendance_uploads?att_date=eq.${req.params.date}`);
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ ok: true, deleted: req.params.date });
});

// List users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const r = await supaRequest('GET', 'app_users?select=*&order=created_at.asc');
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ data: r.data || [] });
});

// Add a user
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.username) return res.status(400).json({ error: 'username required' });
  const r = await supaRequest('POST', 'app_users', { username: b.username, role: b.role || 'user' });
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ ok: true });
});

// Delete a user
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const r = await supaRequest('DELETE', `app_users?id=eq.${req.params.id}`);
  if (r.err) return res.status(502).json({ error: r.err });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// AI CHAT (OpenRouter proxy)
// ════════════════════════════════════════════════════════════════════════════
// Free models first (verified IDs). If FREE keeps hitting 429/limits, set
// USE_PAID=true in env to append a cheap reliable paid model as final fallback.
const FREE_MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-small-3.2-24b-instruct:free'
];
// Cheap, reliable paid fallbacks (only used if USE_PAID=true and you have credit)
const PAID_MODELS = [
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
  'google/gemini-2.0-flash-001'
];
const USE_PAID = String(process.env.USE_PAID || 'false').toLowerCase() === 'true';
const MODELS = USE_PAID ? [...FREE_MODELS, ...PAID_MODELS] : FREE_MODELS;
// ── Google Gemini (primary provider) ─────────────────────────────────────────
// Current models (Gemini 2.0 Flash is being retired June 2026, so we use 2.5).
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

// Convert OpenAI-style messages -> Gemini format.
// system -> systemInstruction; assistant -> "model"; everything else -> "user".
function toGemini(messages) {
  let sys = '';
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') { sys += (sys ? '\n' : '') + (m.content || ''); continue; }
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] });
  }
  return { sys, contents };
}

function callGemini(model, messages) {
  return new Promise((resolve) => {
    if (!GEMINI_KEY) return resolve({ err: 'No Gemini key' });
    const { sys, contents } = toGemini(messages);
    const bodyObj = { contents, generationConfig: { temperature: 0.3, maxOutputTokens: 700 } };
    if (sys) bodyObj.systemInstruction = { parts: [{ text: sys }] };
    const payload = JSON.stringify(bodyObj);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-goog-api-key': GEMINI_KEY
      }
    }, (res) => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) return resolve({ err: data.error.message || JSON.stringify(data.error) });
          const cand = data.candidates && data.candidates[0];
          const txt = cand && cand.content && cand.content.parts &&
                      cand.content.parts.map(p => p.text || '').join('').trim();
          if (txt) return resolve({ reply: txt });
          const fr = cand && cand.finishReason;
          return resolve({ err: 'Empty Gemini response' + (fr ? ' (' + fr + ')' : '') });
        } catch (e) { return resolve({ err: 'Gemini parse error (' + res.statusCode + '): ' + body.slice(0, 140) }); }
      });
    });
    req.on('error', e => resolve({ err: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ err: 'Gemini timeout' }); });
    req.write(payload); req.end();
  });
}

function callOpenRouter(model, messages) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ model, max_tokens: 700, temperature: 0.3, messages });
    const req = https.request({
      hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + OPENROUTER_KEY,
        'HTTP-Referer': 'https://scl-dashboard.up.railway.app', 'X-Title': 'SCL Manpower Dashboard'
      }
    }, (res) => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) return resolve({ err: data.error.message || JSON.stringify(data.error) });
          const txt = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (txt && txt.trim()) return resolve({ reply: txt.trim() });
          return resolve({ err: 'Empty response from ' + model });
        } catch (e) { return resolve({ err: 'Parse error (' + res.statusCode + '): ' + body.slice(0, 120) }); }
      });
    });
    req.on('error', e => resolve({ err: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ err: 'Timeout' }); });
    req.write(payload); req.end();
  });
}
app.post('/api/chat', async (req, res) => {
  const messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'No messages provided' });
  let lastErr = '';
  let rateLimited = false;

  // 1) Gemini — primary provider
  if (GEMINI_KEY) {
    for (const model of GEMINI_MODELS) {
      const r = await callGemini(model, messages);
      if (r.reply) { console.log('[AI] ✓ gemini:' + model); return res.json({ reply: r.reply, model: 'gemini:' + model }); }
      if (r.err && /rate|limit|429|quota|exhaust/i.test(r.err)) rateLimited = true;
      lastErr = r.err; console.log('[AI] ✗ gemini:' + model + ' → ' + lastErr);
    }
  }

  // 2) OpenRouter — fallback
  for (const model of MODELS) {
    const result = await callOpenRouter(model, messages);
    if (result.reply) { console.log('[AI] ✓ ' + model); return res.json({ reply: result.reply, model }); }
    if (result.err && /rate|limit|429|quota/i.test(result.err)) rateLimited = true;
    lastErr = result.err; console.log('[AI] ✗ ' + model + ' → ' + lastErr);
  }
  const hint = rateLimited
    ? 'All models are rate-limited right now — wait a moment and retry (or add credit).'
    : 'Check the Gemini key (create one at aistudio.google.com → Get API key; it should start with "AIza") and the OpenRouter key.';
  return res.status(502).json({ error: (lastErr || 'All models unavailable'), hint, rateLimited });
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  // Probe whether the tables actually exist
  let tables = { report_uploads: false, attendance_uploads: false, app_users: false };
  if (supaEnabled) {
    for (const t of Object.keys(tables)) {
      const r = await supaRequest('GET', t + '?select=*&limit=1');
      // If table exists, status is 200 and data is an array (even if empty)
      tables[t] = !r.err && Array.isArray(r.data);
    }
  }
  const allTables = tables.report_uploads && tables.attendance_uploads && tables.app_users;
  res.json({
    ok: true,
    gemini: !!GEMINI_KEY,
    openrouter: !!OPENROUTER_KEY,
    paidFallback: USE_PAID,
    supabase: supaEnabled,
    supabaseUrl: SUPABASE_URL ? SUPABASE_URL.replace(/https?:\/\//, '').slice(0, 20) + '...' : 'NOT SET',
    tables,
    schemaReady: allTables,
    note: allTables ? 'All tables present.' : 'Run supabase_schema.sql in Supabase SQL Editor to create missing tables.'
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`SCL Dashboard running on http://localhost:${PORT}  | Supabase: ${supaEnabled ? 'ON' : 'OFF'}`));

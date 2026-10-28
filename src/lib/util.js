// أدوات مشتركة: الردود، الأخطاء، التحقق من المدخلات، التشفير، الوقت.

export const enc = new TextEncoder();

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, message, code) => { throw new HttpError(status, message, code); };

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export const now = () => Math.floor(Date.now() / 1000);

// يوم الرياض (UTC+3 طوال السنة) كنص YYYY-MM-DD، وبداية اليوم بثواني Unix.
export const riyadhDay = (sec) => new Date((sec + 10800) * 1000).toISOString().slice(0, 10);
export const riyadhDayStart = (sec) => Math.floor((sec + 10800) / 86400) * 86400 - 10800;
// تعبير SQL يحوّل عموداً بثواني Unix إلى يوم الرياض
export const sqlDay = (col) => `date(${col} + 10800, 'unixepoch')`;

export const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
export const randomHex = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)));

export async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// مقارنة بزمن ثابت لنصين بنفس الطول
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function readJson(req, maxBytes = 50000) {
  if (!(req.headers.get('Content-Type') || '').includes('application/json')) fail(415, 'الطلب يجب أن يكون JSON');
  const text = await req.text();
  if (enc.encode(text).length > maxBytes) fail(413, 'حجم الطلب كبير');
  let v;
  try { v = JSON.parse(text); } catch { fail(400, 'البيانات غير صالحة'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(400, 'البيانات غير صالحة');
  return v;
}

export function str(v, label, { min = 1, max = 200, optional = false } = {}) {
  if (v == null || v === '') {
    if (optional) return null;
    fail(400, 'أدخل ' + label);
  }
  if (typeof v !== 'string') fail(400, 'تحقق من ' + label);
  const t = v.trim();
  if (t.length < min || t.length > max) fail(400, 'تحقق من ' + label);
  return t;
}

export function int(v, label, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if (v == null || v === '') {
    if (optional) return null;
    fail(400, 'أدخل ' + label);
  }
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  if (!Number.isInteger(n) || n < min || n > max) fail(400, 'تحقق من ' + label);
  return n;
}

export function url(v, label, { optional = true } = {}) {
  const t = str(v, label, { max: 500, optional });
  if (t == null) return null;
  let u;
  try { u = new URL(t); } catch { fail(400, 'رابط ' + label + ' غير صحيح'); }
  if (u.protocol !== 'https:') fail(400, 'رابط ' + label + ' يجب أن يبدأ بـ https');
  return u.toString();
}

// جوال سعودي بصيغة 9665XXXXXXXX، ويقبل الأرقام العربية والهندية
export function saPhone(v, { optional = false } = {}) {
  if ((v == null || v === '') && optional) return null;
  let p = String(v ?? '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[\s()+-]/g, '');
  if (p.startsWith('00966')) p = p.slice(2);
  if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1);
  if (/^5\d{8}$/.test(p)) p = '966' + p;
  if (!/^9665\d{8}$/.test(p)) fail(400, 'رقم الجوال غير صحيح');
  return p;
}

export function csvCell(v) {
  let t = String(v ?? '');
  if (/^\s*[=+@\-\t\r]/.test(t)) t = "'" + t; // يمنع تنفيذ الصيغ في Excel
  return '"' + t.replace(/"/g, '""') + '"';
}
export function csvResponse(rows, cols, filename) {
  const body = '﻿' + [cols.map(csvCell).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const ipOf = (req) => req.headers.get('CF-Connecting-IP') || 'local';
export const ipHash = (req) => sha256('ip:' + ipOf(req));
export const geo = (req) => ({ country: req.cf?.country || null, city: req.cf?.city || null });

// حد طلبات بنافذة زمنية ثابتة. يرمي 429 عند التجاوز.
export async function rateLimit(db, key, limit, windowSec) {
  const t = now();
  const win = Math.floor(t / windowSec);
  const row = await db
    .prepare('INSERT INTO rate_limits(key,win,count,expires_at) VALUES(?,?,1,?) ON CONFLICT(key,win) DO UPDATE SET count=count+1 RETURNING count')
    .bind(key, win, (win + 1) * windowSec)
    .first();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(t).run();
  if (row.count > limit) fail(429, 'محاولات كثيرة، حاول بعد قليل', 'rate_limited');
}

export async function audit(db, user, action, detail, merchantId = null) {
  await db
    .prepare('INSERT INTO audit_log(user_id,merchant_id,action,detail,created_at) VALUES(?,?,?,?,?)')
    .bind(user?.id ?? null, merchantId ?? user?.merchant_id ?? null, action, detail ? JSON.stringify(detail) : null, now())
    .run();
}

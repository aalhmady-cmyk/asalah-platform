// روابط العلامات وأرقامها والمخزون.
//
// رابط العلامة: <origin>/v?t=<batch36>.<serial36>.<sig>
//   sig = أول 16 حرف base64url من HMAC-SHA256(TAG_SECRET, "batch:serial:salt")
// يعني الرابط ما يتخمّن (96 بت)، ونقدر نعيد توليد ملف المصنع في أي وقت بدون ما نخزّن الأكواد.
import { b64url, enc, fail, safeEqual } from './util.js';

export const TOKEN_RE = /^([0-9a-z]{1,7})\.([0-9a-z]{1,5})\.([A-Za-z0-9_-]{16})$/;
const keyCache = new Map();

async function hmacKey(env) {
  const secret = env.TAG_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) fail(503, 'أضف TAG_SECRET بطول 32 حرفاً على الأقل في إعدادات Worker');
  let k = keyCache.get(secret);
  if (!k) {
    k = await crypto.subtle.importKey('raw', enc.encode('asalah-tag:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    keyCache.set(secret, k);
  }
  return k;
}

export async function signTag(env, batch, serial) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(`${batch.id}:${serial}:${batch.salt}`));
  return b64url(sig).slice(0, 16);
}

export async function tokenFor(env, batch, serial) {
  return `${batch.id.toString(36)}.${serial.toString(36)}.${await signTag(env, batch, serial)}`;
}

// يرجع {batchId, serial, sig} أو null إذا الصيغة غلط
export function parseToken(raw) {
  if (typeof raw !== 'string') return null;
  const m = TOKEN_RE.exec(raw.trim());
  if (!m) return null;
  return { batchId: parseInt(m[1], 36), serial: parseInt(m[2], 36), sig: m[3] };
}

export async function checkSignature(env, batch, parsed) {
  if (parsed.serial < 1 || parsed.serial > batch.size) return false;
  return safeEqual(await signTag(env, batch, parsed.serial), parsed.sig);
}

export const serialWidth = (size) => Math.max(6, String(size).length);
export const publicId = (batch, serial) => `${batch.code}-${String(serial).padStart(serialWidth(batch.size), '0')}`;

// يقبل "GK2610-000123" أو رابط العلامة كامل أو الكود وحده
export function parseLookup(q) {
  q = String(q ?? '').trim();
  if (!q) fail(400, 'اكتب رقم العلامة أو الصق رابطها');
  try {
    const u = new URL(q);
    const t = u.searchParams.get('t') || new URLSearchParams(u.hash.slice(1)).get('t');
    if (t) q = t;
  } catch {}
  const tok = parseToken(q);
  if (tok) return { kind: 'token', ...tok };
  const m = /^([A-Za-z0-9]{2,16})-(\d{1,7})$/.exec(q);
  if (m) return { kind: 'public', code: m[1].toUpperCase(), serial: Number(m[2]) };
  fail(400, 'صيغة رقم العلامة غير صحيحة، مثال: GK2610-000123');
}

// المخزون: العلامات المفعّلة اللي ما انمسحت أبداً. العلامة تُحسب مباعة من أول مسح.
export async function stockFor(db, merchantId) {
  const [b, s, w] = await db.batch([
    db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN status='active' THEN size END),0) AS active_size,
              COALESCE(SUM(CASE WHEN status='pending' THEN size END),0) AS pending_size,
              COALESCE(SUM(size),0) AS issued
       FROM batches WHERE merchant_id=? AND is_test=0`
    ).bind(merchantId),
    db.prepare(
      `SELECT COUNT(*) AS n FROM tags t JOIN batches b ON b.id=t.batch_id
       WHERE t.merchant_id=? AND b.status='active' AND b.is_test=0 AND t.first_checked_at IS NOT NULL`
    ).bind(merchantId),
    db.prepare(
      `SELECT COUNT(*) AS n FROM tags t JOIN batches b ON b.id=t.batch_id
       WHERE t.merchant_id=? AND b.is_test=0 AND t.first_checked_at>=?`
    ).bind(merchantId, Math.floor(Date.now() / 1000) - 7 * 86400),
  ]);
  const active = b.results[0].active_size;
  const sold = s.results[0].n;
  const remaining = Math.max(0, active - sold);
  const perDay = w.results[0].n / 7;
  return {
    issued: b.results[0].issued,
    active,
    pending: b.results[0].pending_size,
    sold,
    remaining,
    per_day: Math.round(perDay),
    days_left: perDay > 0 ? Math.floor(remaining / perDay) : null,
  };
}

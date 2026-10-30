// الحسابات والجلسات. كلمات المرور بـ PBKDF2-SHA256، والجلسة كوكي عشوائي نحفظ الـ hash حقه فقط.
import { enc, fail, hex, now, randomHex, sha256, safeEqual } from './util.js';

const COOKIE = '__Host-asalah_session';
const SESSION_TTL = 12 * 3600;
const PBKDF2_ITERATIONS = 100000; // أعلى قيمة يقبلها Workers

export async function hashPassword(password, saltHex = randomHex(16)) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/../g), (h) => parseInt(h, 16));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: hex(bits), salt: saltHex };
}

export async function checkPassword(password, user) {
  const { hash } = await hashPassword(password, user.password_salt);
  return safeEqual(hash, user.password_hash);
}

export function validPassword(p) {
  if (typeof p !== 'string' || p.length < 10 || p.length > 200) fail(400, 'كلمة المرور لازم تكون 10 أحرف على الأقل');
  return p;
}

export async function createSession(db, userId, meta = {}) {
  const token = randomHex(32);
  const t = now();
  await db.batch([
    db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,device_kind,city) VALUES(?,?,?,?,?,?)').bind(await sha256(token), userId, t, t + SESSION_TTL, meta.kind || null, meta.city || null),
    db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(t),
    db.prepare('UPDATE users SET last_login_at=? WHERE id=?').bind(t, userId),
  ]);
  return cookieHeader(token, SESSION_TTL);
}

export function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function currentTokenHash(req) {
  const token = tokenFrom(req);
  return token ? sha256(token) : null;
}

function tokenFrom(req) {
  const c = (req.headers.get('Cookie') || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  const v = c ? c.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(v) ? v : null;
}

export async function destroySession(db, req) {
  const token = tokenFrom(req);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
  return cookieHeader('', 0);
}

// الطلبات اللي تغيّر بيانات لازم تجي من نفس الموقع (حماية CSRF مع SameSite)
export function sameOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('Origin');
  if (!origin || origin !== new URL(req.url).origin) fail(403, 'مصدر الطلب غير مسموح');
}

export async function currentUser(db, req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const u = await db
    .prepare(
      `SELECT u.id,u.email,u.name,u.role,u.merchant_id,u.merchant_role,u.status,m.status AS merchant_status
       FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN merchants m ON m.id=u.merchant_id
       WHERE s.token_hash=? AND s.expires_at>?`
    )
    .bind(await sha256(token), now())
    .first();
  if (!u || u.status !== 'active') return null;
  if (u.role === 'merchant' && u.merchant_status !== 'active') return null;
  return u;
}

export async function requireUser(db, req, role) {
  sameOrigin(req);
  const u = await currentUser(db, req);
  if (!u) fail(401, 'سجّل الدخول أولاً', 'unauthenticated');
  if (role && u.role !== role) fail(403, 'ما عندك صلاحية لهذي الصفحة');
  return u;
}

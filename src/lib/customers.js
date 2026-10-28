// دخول العملاء بحساب Google (OAuth بالتحويل، بدون سكربت خارجي في الصفحة).
// يحتاج GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في إعدادات Cloudflare. بدونهم التعليق يكون بالاسم فقط.
import { fail, json, now, randomHex, sha256 } from './util.js';

const COOKIE = '__Host-asalah_c';
const STATE = '__Host-asalah_cs';
const TTL = 60 * 86400;

export const googleEnabled = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const cookie = (name, v, age) => `${name}=${v}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const readCookie = (req, name) => {
  const c = (req.headers.get('Cookie') || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return c ? c.slice(name.length + 1) : '';
};
const redirectUri = (req) => new URL(req.url).origin + '/api/c/google/callback';
// نرجّعه بس لصفحة داخل نفس الموقع
const safeNext = (v) => (typeof v === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(v) ? v : '/stores/');

export async function currentCustomer(db, req) {
  const v = readCookie(req, COOKIE);
  if (!/^[a-f0-9]{64}$/.test(v)) return null;
  return db
    .prepare('SELECT c.id,c.email,c.name,c.picture FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>?')
    .bind(await sha256(v), now())
    .first();
}

export async function handleCustomer(req, env, path) {
  const db = env.DB;
  const url = new URL(req.url);
  if (path === '/api/c/me' && req.method === 'GET') {
    const c = await currentCustomer(db, req);
    return json({ ok: true, login: googleEnabled(env), customer: c ? { name: c.name, email: c.email, picture: c.picture } : null });
  }
  if (path === '/api/c/logout' && req.method === 'POST') {
    const v = readCookie(req, COOKIE);
    if (/^[a-f0-9]{64}$/.test(v)) await db.prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(await sha256(v)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(COOKIE, '', 0) });
  }
  if (path === '/api/c/google/start' && req.method === 'GET') {
    if (!googleEnabled(env)) fail(503, 'الدخول بحساب Google غير مفعّل حالياً');
    const state = randomHex(16);
    const next = safeNext(url.searchParams.get('next'));
    const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(req), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    return new Response(null, { status: 302, headers: { Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + q, 'Set-Cookie': cookie(STATE, `${state}.${encodeURIComponent(next)}`, 600) } });
  }
  if (path === '/api/c/google/callback' && req.method === 'GET') {
    if (!googleEnabled(env)) fail(503, 'الدخول بحساب Google غير مفعّل حالياً');
    const [state, nextEnc] = readCookie(req, STATE).split('.');
    const next = safeNext(decodeURIComponent(nextEnc || ''));
    const back = (msg) => new Response(null, { status: 302, headers: { Location: next + (next.includes('?') ? '&' : '?') + 'login=' + msg, 'Set-Cookie': cookie(STATE, '', 0) } });
    if (!state || url.searchParams.get('state') !== state || !url.searchParams.get('code')) return back('failed');
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(req), grant_type: 'authorization_code' }),
    }).then((r) => r.json()).catch(() => null);
    if (!tok?.access_token) return back('failed');
    // نسأل Google مباشرة عن صاحب الحساب (اتصال TLS مع Google نفسه)
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } }).then((r) => r.json()).catch(() => null);
    if (!info?.email || info.email_verified === false) return back('failed');
    const email = String(info.email).toLowerCase().slice(0, 200);
    const name = String(info.name || email.split('@')[0]).trim().slice(0, 40);
    const picture = /^https:\/\/[^\s"']+$/.test(info.picture || '') ? info.picture.slice(0, 500) : null;
    const t = now();
    const c = await db
      .prepare('INSERT INTO customers(email,name,picture,created_at,last_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,picture=excluded.picture,last_at=excluded.last_at RETURNING id')
      .bind(email, name, picture, t, t)
      .first();
    const token = randomHex(32);
    await db.batch([
      db.prepare('INSERT INTO customer_sessions(token_hash,customer_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha256(token), c.id, t, t + TTL),
      db.prepare('DELETE FROM customer_sessions WHERE expires_at<?').bind(t),
    ]);
    const h = new Headers({ Location: next + (next.includes('?') ? '&' : '?') + 'login=ok' });
    h.append('Set-Cookie', cookie(COOKIE, token, TTL));
    h.append('Set-Cookie', cookie(STATE, '', 0));
    return new Response(null, { status: 302, headers: h });
  }
  fail(404, 'المسار غير موجود');
}

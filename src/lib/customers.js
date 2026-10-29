// دخول العملاء بحساب Google (OAuth بالتحويل، بدون سكربت خارجي في الصفحة).
// يحتاج GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في إعدادات Cloudflare. بدونهم التعليق يكون بالاسم فقط.
import { imageUrl } from './images.js';
import { pushToCustomers } from './push.js';
import { fail, int, json, now, randomHex, readJson, sha256 } from './util.js';

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

// تنبيه داخل حساب الزبون (جرس في المتاجر)
// ويوصله إشعار على جواله لو مفعّل الإشعارات
export async function addNote(db, customerId, message, link, productId = null) {
  await db.prepare('INSERT INTO customer_notes(customer_id,product_id,link,message,created_at) VALUES(?,?,?,?,?)').bind(customerId, productId, link, message.slice(0, 200), now()).run();
  await pushToCustomers(db, [customerId], { title: 'متاجر أصالة', body: message.slice(0, 180), url: link || '/stores/?v=account', tag: 'note' });
}

const sarText = (h) => (h / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

// السعر نزل: كل من يتابع المنتج وسعره وقت المتابعة أعلى من الجديد يوصله تنبيه
export async function notifyPriceDrop(db, product, oldPrice) {
  const watchers = (await db.prepare('SELECT customer_id FROM price_watch WHERE product_id=? AND (price_at IS NULL OR price_at>?)').bind(product.id, product.price).all()).results;
  if (!watchers.length) return 0;
  const t = now();
  const msg = `🔔 نزل سعر «${String(product.title).slice(0, 60)}» من ${sarText(oldPrice)} إلى ${sarText(product.price)} ر.س`;
  await db.batch([
    ...watchers.map((w) => db.prepare('INSERT INTO customer_notes(customer_id,product_id,link,message,created_at) VALUES(?,?,?,?,?)').bind(w.customer_id, product.id, '/stores/?p=' + product.id, msg, t)),
    db.prepare('UPDATE price_watch SET price_at=? WHERE product_id=?').bind(product.price, product.id),
  ]);
  await pushToCustomers(db, watchers.map((w) => w.customer_id), { title: '🔔 نزل السعر', body: msg.replace('🔔 ', ''), url: '/stores/?p=' + product.id, tag: 'price' + product.id });
  return watchers.length;
}

const sar = (h) => (h == null ? null : h / 100);

async function account(db, c) {
  const [watch, notes, pc, rc] = await Promise.all([
    db
      .prepare(
        `SELECT p.id,p.title,p.price,p.old_price,p.image_key,w.price_at,w.created_at AS watched_at,m.name AS merchant_name,
                (p.status='active' AND p.admin_blocked=0 AND m.store_enabled=1 AND m.status='active') AS live
         FROM price_watch w JOIN store_products p ON p.id=w.product_id JOIN merchants m ON m.id=p.merchant_id WHERE w.customer_id=? ORDER BY w.created_at DESC LIMIT 100`
      )
      .bind(c.id)
      .all(),
    db.prepare('SELECT id,message,link,created_at,read_at FROM customer_notes WHERE customer_id=? ORDER BY id DESC LIMIT 50').bind(c.id).all(),
    db
      .prepare('SELECT c.id,c.body,c.rating,c.reply,c.created_at,p.id AS item_id,p.title FROM product_comments c JOIN store_products p ON p.id=c.product_id WHERE c.customer_id=? ORDER BY c.id DESC LIMIT 30')
      .bind(c.id)
      .all(),
    db.prepare('SELECT c.id,c.body,c.rating,c.reply,c.created_at,r.id AS item_id,r.title FROM reel_comments c JOIN reels r ON r.id=c.reel_id WHERE c.customer_id=? ORDER BY c.id DESC LIMIT 30').bind(c.id).all(),
  ]);
  return {
    customer: { name: c.name, email: c.email, picture: c.picture },
    watch: watch.results.map(({ image_key, price, old_price, price_at, live, ...x }) => ({ ...x, live: !!live, price: sar(price), old_price: sar(old_price), price_at: sar(price_at), image_url: imageUrl(image_key) })),
    notes: notes.results,
    comments: [...pc.results.map((x) => ({ ...x, kind: 'products' })), ...rc.results.map((x) => ({ ...x, kind: 'reels' }))].sort((a, b) => b.created_at - a.created_at).slice(0, 30),
  };
}

export async function handleCustomer(req, env, path) {
  const db = env.DB;
  const url = new URL(req.url);
  if (path === '/api/c/me' && req.method === 'GET') {
    const c = await currentCustomer(db, req);
    const unread = c ? (await db.prepare('SELECT COUNT(*) AS n FROM customer_notes WHERE customer_id=? AND read_at IS NULL').bind(c.id).first()).n : 0;
    const watching = c ? (await db.prepare('SELECT product_id FROM price_watch WHERE customer_id=?').bind(c.id).all()).results.map((r) => r.product_id) : [];
    return json({ ok: true, login: googleEnabled(env), customer: c ? { name: c.name, email: c.email, picture: c.picture } : null, unread, watching });
  }
  // حساب الزبون: المتابعات والتنبيهات وتعليقاته
  if (path.startsWith('/api/c/') && !path.startsWith('/api/c/google/') && path !== '/api/c/logout') {
    const c = await currentCustomer(db, req);
    if (!c) fail(401, 'سجّل دخولك بحساب Google أول', 'login_required');
    if (req.method !== 'GET') {
      const origin = req.headers.get('Origin');
      if (!origin || origin !== url.origin) fail(403, 'مصدر الطلب غير مسموح');
    }
    if (path === '/api/c/account' && req.method === 'GET') return json({ ok: true, ...(await account(db, c)) });
    if (path === '/api/c/notes/read' && req.method === 'POST') {
      await db.prepare('UPDATE customer_notes SET read_at=? WHERE customer_id=? AND read_at IS NULL').bind(now(), c.id).run();
      return json({ ok: true });
    }
    if (path === '/api/c/watch' && (req.method === 'POST' || req.method === 'DELETE')) {
      const b = await readJson(req);
      const pid = int(b.product_id, 'المنتج', { min: 1 });
      if (req.method === 'DELETE') {
        await db.prepare('DELETE FROM price_watch WHERE customer_id=? AND product_id=?').bind(c.id, pid).run();
        return json({ ok: true, watching: false });
      }
      const p = await db
        .prepare("SELECT p.id,p.price FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=? AND p.status='active' AND p.admin_blocked=0 AND m.store_enabled=1 AND m.status='active'")
        .bind(pid)
        .first();
      if (!p) fail(404, 'المنتج غير متاح');
      const n = await db.prepare('SELECT COUNT(*) AS n FROM price_watch WHERE customer_id=?').bind(c.id).first();
      if (n.n >= 100) fail(400, 'وصلت حد المتابعة (100 منتج)');
      await db.prepare('INSERT INTO price_watch(customer_id,product_id,price_at,created_at) VALUES(?,?,?,?) ON CONFLICT(customer_id,product_id) DO UPDATE SET price_at=excluded.price_at').bind(c.id, pid, p.price, now()).run();
      return json({ ok: true, watching: true });
    }
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

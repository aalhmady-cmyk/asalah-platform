// إشعارات الجوال (Web Push): تشفير RFC 8291 وتوقيع VAPID RFC 8292 بـ WebCrypto بدون مكتبات.
// مفاتيح VAPID تتولد تلقائياً أول مرة وتنحفظ في جدول settings، فما يحتاج المالك يضيف أي سر.
import { now } from './util.js';

const enc = new TextEncoder();
export const b64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s) => {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

// خدمات الإشعارات المعروفة بس، عشان ما ينستخدم الإرسال لطلب أي رابط ثاني
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
export function validEndpoint(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && v.length <= 1000 && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

let cached = null;
export async function vapidKeys(db) {
  if (cached) return cached;
  let row = await db.prepare("SELECT value FROM settings WHERE key='vapid'").first();
  if (!row) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const value = JSON.stringify({ pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) });
    await db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('vapid',?)").bind(value).run();
    row = await db.prepare("SELECT value FROM settings WHERE key='vapid'").first();
  }
  const v = JSON.parse(row.value);
  cached = { pub: v.pub, key: await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
  return cached;
}

async function vapidAuth(keys, endpoint) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: now() + 12 * 3600, sub: 'mailto:info@alsalah-sa.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.key, enc.encode(head + '.' + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.pub}`;
}

const hkdf = async (salt, ikm, info, bytes) =>
  new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));

// يشفّر الرسالة لمشترك واحد (aes128gcm، سجل واحد)
export async function encryptPayload(p256dh, auth, text) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// يرسل لمشترك واحد. يرجع 'ok' أو 'gone' (الاشتراك انتهى وينحذف) أو 'fail'
export async function sendPush(keys, sub, payload) {
  if (!validEndpoint(sub.endpoint)) return 'gone';
  try {
    const body = await encryptPayload(sub.p256dh, sub.auth, JSON.stringify(payload));
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: await vapidAuth(keys, sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' },
      body,
    });
    if (r.status === 404 || r.status === 410) return 'gone';
    return r.ok ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

// يرسل لمجموعة مشتركين بالتوازي (دفعات صغيرة) ويحذف المنتهية
export async function sendMany(db, subs, payloadFor, table = 'push_subs') {
  if (!subs.length) return { sent: 0, failed: 0 };
  const keys = await vapidKeys(db);
  let sent = 0, failed = 0;
  const gone = [], ok = [];
  for (let i = 0; i < subs.length; i += 10) {
    const part = subs.slice(i, i + 10);
    const res = await Promise.all(part.map((s) => sendPush(keys, s, payloadFor(s))));
    res.forEach((r, k) => {
      if (r === 'ok') { sent++; ok.push(part[k].id); }
      else { failed++; if (r === 'gone') gone.push(part[k].id); }
    });
  }
  const t = now();
  const stmts = [];
  if (gone.length) stmts.push(db.prepare(`DELETE FROM ${table} WHERE id IN (${gone.map(() => '?').join(',')})`).bind(...gone));
  if (ok.length) stmts.push(db.prepare(`UPDATE ${table} SET last_at=? WHERE id IN (${ok.map(() => '?').join(',')})`).bind(t, ...ok));
  if (stmts.length) await db.batch(stmts);
  return { sent, failed };
}

// إشعار شخصي لزبائن معيّنين (نزول سعر، رد التاجر). الخطأ ما يوقف العملية الأصلية
export async function pushToCustomers(db, customerIds, payload) {
  const ids = [...new Set(customerIds)].slice(0, 200);
  if (!ids.length) return;
  try {
    const subs = (await db.prepare(`SELECT id,endpoint,p256dh,auth,lang FROM push_subs WHERE customer_id IN (${ids.map(() => '?').join(',')}) LIMIT 40`).bind(...ids).all()).results;
    await sendMany(db, subs, () => payload);
  } catch (e) {
    console.error('ASALAH_PUSH', e?.stack || e);
  }
}

// تنبيهات اللوحات توصل جوال التاجر والمدير. التاجر ما يشوف طلباته للإدارة، والمدير ما يشوف رسائل التاجر الخاصة
const MERCHANT_SKIP = ['tag_request', 'store_request', 'credit_request'];
const ADMIN_SKIP = ['store_blocked', 'staff_password', 'weekly_summary', 'monthly_report', 'new_order', 'credits_added'];
export async function pushAlert(db, merchantId, kind, message) {
  try {
    const parts = [];
    if (merchantId && !MERCHANT_SKIP.includes(kind)) {
      const ownerOnly = kind === 'staff_password' ? " AND u.merchant_role='owner'" : '';
      parts.push(['/merchant/', (await db.prepare(`SELECT p.id,p.endpoint,p.p256dh,p.auth FROM user_push p JOIN users u ON u.id=p.user_id WHERE u.role='merchant' AND u.merchant_id=? AND u.status='active'${ownerOnly} LIMIT 10`).bind(merchantId).all()).results]);
    }
    // دخول حساب تاجر يخص التاجر بس
    if (!ADMIN_SKIP.includes(kind) && !(kind === 'new_login' && merchantId)) {
      parts.push(['/admin/', (await db.prepare("SELECT p.id,p.endpoint,p.p256dh,p.auth FROM user_push p JOIN users u ON u.id=p.user_id WHERE u.role='admin' AND u.status='active' LIMIT 10").all()).results]);
    }
    for (const [url, subs] of parts) {
      await sendMany(db, subs, () => ({ title: url === '/admin/' ? 'اللوحة الأم · أصالة' : 'لوحة التاجر · أصالة', body: String(message).slice(0, 180), url, tag: 'a-' + kind }), 'user_push');
    }
  } catch (e) {
    console.error('ASALAH_PUSH_ALERT', e?.stack || e);
  }
}

// حملة من اللوحة الأم: ترسل دفعة (بحدود طلبات العامل) وتحفظ وين وقفت
export const BATCH = 30;
export async function continueCampaign(db, id) {
  const c = await db.prepare('SELECT * FROM push_campaigns WHERE id=?').bind(id).first();
  if (!c || c.status !== 'sending') return c;
  const where = c.audience === 'accounts' ? 'AND customer_id IS NOT NULL' : c.audience === 'ar' || c.audience === 'en' ? `AND lang='${c.audience}'` : '';
  const subs = (await db.prepare(`SELECT id,endpoint,p256dh,auth,lang FROM push_subs WHERE id>? ${where} ORDER BY id LIMIT ?`).bind(c.cursor, BATCH).all()).results;
  const payload = { title: c.title, body: c.body, url: c.url || '/stores/', image: c.image || undefined, c: c.id, tag: 'c' + c.id };
  const r = await sendMany(db, subs, () => payload);
  const cursor = subs.length ? subs[subs.length - 1].id : c.cursor;
  const done = subs.length < BATCH;
  await db
    .prepare('UPDATE push_campaigns SET cursor=?,sent=sent+?,failed=failed+?,status=?,done_at=? WHERE id=?')
    .bind(cursor, r.sent, r.failed, done ? 'done' : 'sending', done ? now() : null, id)
    .run();
  return db.prepare('SELECT * FROM push_campaigns WHERE id=?').bind(id).first();
}

// الجدولة: تكمل أي حملة ما خلصت (لو المالك قفل الصفحة)
export async function runCampaigns(db) {
  // دفعة وحدة لكل تشغيل: الخطة المجانية تسمح بـ 50 طلب خارجي بس
  const c = await db.prepare("SELECT id FROM push_campaigns WHERE status='sending' ORDER BY id LIMIT 1").first();
  if (c) await continueCampaign(db, c.id);
}

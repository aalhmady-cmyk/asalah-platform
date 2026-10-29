// إشعارات الجوال: اشتراك الأجهزة (عام) وحملات اللوحة الأم (الإدارة)
import { currentCustomer } from '../lib/customers.js';
import { imageUrl } from '../lib/images.js';
import { continueCampaign, sendMany, unb64u, validEndpoint, vapidKeys } from '../lib/push.js';
import { audit, fail, int, ipHash, json, now, rateLimit, readJson, str } from '../lib/util.js';

const sameSite = (req) => {
  const o = req.headers.get('Origin');
  if (!o || o !== new URL(req.url).origin) fail(403, 'مصدر الطلب غير مسموح');
};
const keyLen = (v, n) => {
  try { return typeof v === 'string' && v.length < 200 && unb64u(v).length === n; } catch { return false; }
};
// الرابط لازم يكون صفحة داخل الموقع
const safePath = (v) => (typeof v === 'string' && /^\/(?!\/)[\w\-./?=&%#]{0,300}$/.test(v) ? v : null);

export async function handlePublicPush(req, env, path) {
  const db = env.DB, m = req.method;
  if (path === '/api/public/push/key' && m === 'GET') return json({ ok: true, key: (await vapidKeys(db)).pub });
  // صندوق إشعارات التطبيق: كل إشعار انرسل من اللوحة الأم ينحفظ هنا للكل، مسجل أو لا
  if (path === '/api/public/push/inbox' && m === 'GET') {
    const lang = new URL(req.url).searchParams.get('lang') === 'en' ? 'en' : 'ar';
    const c = await currentCustomer(db, req);
    const aud = c ? "('all','accounts',?)" : "('all',?)";
    const rows = (await db.prepare(`SELECT id,title,body,url,image,created_at FROM push_campaigns WHERE status!='stopped' AND audience IN ${aud} ORDER BY id DESC LIMIT 50`).bind(lang).all()).results;
    return json({ ok: true, items: rows });
  }
  if (m !== 'POST') fail(404, 'المسار غير موجود');
  sameSite(req);
  const b = await readJson(req, 4000);
  if (path === '/api/public/push/subscribe') {
    await rateLimit(db, 'pushsub:' + (await ipHash(req)), 30, 3600);
    if (!validEndpoint(b.endpoint) || !keyLen(b.p256dh, 65) || !keyLen(b.auth, 16)) fail(400, 'اشتراك غير صالح');
    const c = await currentCustomer(db, req);
    const t = now();
    await db
      .prepare(
        `INSERT INTO push_subs(endpoint,p256dh,auth,customer_id,lang,created_at,last_at) VALUES(?,?,?,?,?,?,?)
         ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,lang=excluded.lang,last_at=excluded.last_at,customer_id=COALESCE(excluded.customer_id,push_subs.customer_id)`
      )
      .bind(b.endpoint, b.p256dh, b.auth, c?.id ?? null, b.lang === 'en' ? 'en' : 'ar', t, t)
      .run();
    return json({ ok: true });
  }
  if (path === '/api/public/push/unsubscribe') {
    if (typeof b.endpoint === 'string') await db.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(b.endpoint).run();
    return json({ ok: true });
  }
  // إشعار تجربة لنفس الجهاز بس (يتأكد العميل إن الإشعار والصوت يوصلون)
  if (path === '/api/public/push/test') {
    await rateLimit(db, 'pushtest:' + (await ipHash(req)), 5, 3600);
    if (!validEndpoint(b.endpoint)) fail(400, 'اشتراك غير صالح');
    const sub = await db.prepare('SELECT id,endpoint,p256dh,auth,lang FROM push_subs WHERE endpoint=?').bind(b.endpoint).first();
    if (!sub) return json({ ok: true, sent: 0 });
    const en = sub.lang === 'en';
    const r = await sendMany(db, [sub], () => ({ title: en ? 'Asalah Stores 🔔' : 'متاجر أصالة 🔔', body: en ? 'Notifications are working on your phone ✅' : 'الإشعارات شغالة على جوالك ✅', url: '/stores/', tag: 'test' }));
    return json({ ok: true, sent: r.sent });
  }
  if (path === '/api/public/push/click') {
    const id = int(b.c, 'الحملة', { min: 1 });
    // ضغطة وحدة لكل جهاز لكل حملة
    try { await rateLimit(db, `pushclk:${id}:` + (await ipHash(req)), 1, 30 * 86400); } catch { return json({ ok: true }); }
    await db.prepare('UPDATE push_campaigns SET clicks=clicks+1 WHERE id=?').bind(id).run();
    return json({ ok: true });
  }
  fail(404, 'المسار غير موجود');
}

const AUD = {
  all: '',
  accounts: 'WHERE customer_id IS NOT NULL',
  ar: "WHERE lang='ar'",
  en: "WHERE lang='en'",
};

export async function adminPush(req, db, path, user) {
  const m = req.method;
  if (path === '/api/admin/push' && m === 'GET') {
    const week = now() - 7 * 86400;
    const [s, list] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS total, SUM(customer_id IS NOT NULL) AS accounts, SUM(lang='ar') AS ar, SUM(lang='en') AS en, SUM(created_at>?) AS week FROM push_subs`
        )
        .bind(week)
        .first(),
      db.prepare('SELECT c.*,u.name AS by_name FROM push_campaigns c LEFT JOIN users u ON u.id=c.created_by ORDER BY c.id DESC LIMIT 30').all(),
    ]);
    return json({ ok: true, stats: { total: s.total || 0, accounts: s.accounts || 0, ar: s.ar || 0, en: s.en || 0, week: s.week || 0 }, campaigns: list.results });
  }
  if (path === '/api/admin/push' && m === 'POST') {
    const b = await readJson(req, 4000);
    const title = str(b.title, 'عنوان الإشعار', { max: 60 });
    const body = str(b.body, 'نص الإشعار', { max: 180 });
    const audience = Object.hasOwn(AUD, b.audience) ? b.audience : 'all';
    let url = '/stores/', image = null;
    if (b.product_id) {
      const p = await db.prepare("SELECT id,image_key FROM store_products WHERE id=? AND status='active' AND admin_blocked=0").bind(int(b.product_id, 'رقم المنتج', { min: 1 })).first();
      if (!p) fail(404, 'المنتج غير موجود أو غير منشور');
      url = '/stores/?p=' + p.id;
      if (p.image_key) image = new URL(req.url).origin + imageUrl(p.image_key);
    } else if (b.url) {
      url = safePath(b.url);
      if (!url) fail(400, 'الرابط لازم يكون صفحة داخل الموقع، يبدأ بـ /');
    }
    const total = (await db.prepare(`SELECT COUNT(*) AS n FROM push_subs ${AUD[audience]}`).first()).n;
    if (!total) fail(400, 'ما فيه مشتركين بالإشعارات لهذي الفئة للحين');
    const row = await db
      .prepare('INSERT INTO push_campaigns(title,body,url,image,audience,total,created_by,created_at) VALUES(?,?,?,?,?,?,?,?) RETURNING id')
      .bind(title, body, url, image, audience, total, user.id, now())
      .first();
    await audit(db, user, 'push_sent', { title, audience, total });
    return json({ ok: true, campaign: await continueCampaign(db, row.id) });
  }
  let mm = path.match(/^\/api\/admin\/push\/(\d+)\/(continue|stop)$/);
  if (mm && m === 'POST') {
    const id = Number(mm[1]);
    if (mm[2] === 'stop') await db.prepare("UPDATE push_campaigns SET status='stopped',done_at=? WHERE id=? AND status='sending'").bind(now(), id).run();
    const c = mm[2] === 'continue' ? await continueCampaign(db, id) : await db.prepare('SELECT * FROM push_campaigns WHERE id=?').bind(id).first();
    if (!c) fail(404, 'الحملة غير موجودة');
    return json({ ok: true, campaign: c });
  }
  return null;
}

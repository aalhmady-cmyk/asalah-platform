// نمو المنصة: باقات صفحة التجار وقصة النجاح، طلبات التجار الجدد، صحة المنصة، خطوات البداية للتاجر، والتقرير الشهري
import { pushAlert } from './push.js';
import { stockFor } from './tags.js';
import { imageUrl } from './images.js';
import { fakesMap } from './trust.js';
import { fail, now, str } from './util.js';

const getSetting = async (db, k) => (await db.prepare('SELECT value FROM settings WHERE key=?').bind(k).first())?.value;
const setSetting = (db, k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, v).run();
const parse = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };

// ---------- الباقات وقصة النجاح (يعدّلها المدير) ----------
export const DEFAULT_PLANS = [
  { name: 'الانطلاق', price: 'مجاناً فترة الإطلاق', note: 'للمشاريع الصغيرة', items: ['ملصقات QR بسعر رمزي', 'صفحة تحقق باسم علامتك', 'لوحة تحكم وتنبيهات التقليد'], featured: false },
  { name: 'الاحترافي', price: 'حسب الكمية', note: 'الأكثر طلباً', items: ['شرائح NFC أو QR', 'كل مزايا الحماية والضمان', 'نقاط وكاش باك ومسابقات', 'متجرك في متاجر أصالة'], featured: true },
  { name: 'المؤسسات', price: 'عرض سعر خاص', note: 'للمصانع والوكلاء', items: ['كميات كبيرة وطباعة بالمصنع', 'حسابات موظفين وفروع', 'تقارير ودعم مخصص'], featured: false },
];

function cleanPlans(list) {
  if (!Array.isArray(list) || !list.length || list.length > 4) fail(400, 'لازم من باقة لين 4 باقات');
  return list.map((p, i) => ({
    name: str(p?.name, `اسم الباقة ${i + 1}`, { max: 40 }),
    price: str(p?.price, `سعر الباقة ${i + 1}`, { max: 40 }),
    note: str(p?.note, 'وصف قصير', { max: 60, optional: true }),
    items: (Array.isArray(p?.items) ? p.items : String(p?.items || '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 80)),
    featured: Boolean(p?.featured),
  }));
}

export async function siteConfig(db) {
  return {
    plans: parse(await getSetting(db, 'site_plans'), DEFAULT_PLANS),
    story: parse(await getSetting(db, 'site_story'), null),
  };
}

export async function saveSiteConfig(db, b) {
  if ('plans' in b) await setSetting(db, 'site_plans', JSON.stringify(b.plans == null ? DEFAULT_PLANS : cleanPlans(b.plans)));
  if ('story' in b) {
    if (!b.story || !b.story.merchant_id) await db.prepare("DELETE FROM settings WHERE key='site_story'").run();
    else {
      const id = Number(b.story.merchant_id);
      if (!(await db.prepare('SELECT id FROM merchants WHERE id=?').bind(id).first())) fail(404, 'ما لقينا التاجر');
      const story = {
        merchant_id: id,
        quote: str(b.story.quote, 'كلمة صاحب العلامة', { max: 400 }),
        author: str(b.story.author, 'اسم قائل الكلمة', { max: 80 }),
        headline: str(b.story.headline, 'العنوان', { max: 100, optional: true }),
      };
      await setSetting(db, 'site_story', JSON.stringify(story));
    }
  }
  return siteConfig(db);
}

// قصة النجاح بأرقام حقيقية من قاعدة البيانات
async function storyWithStats(db, story) {
  if (!story) return null;
  const m = await db.prepare("SELECT id,name,slug,logo_key,logo_url,brand_color,created_at FROM merchants WHERE id=? AND status='active'").bind(story.merchant_id).first();
  if (!m) return null;
  const s = await db
    .prepare("SELECT SUM(result='original') AS original, SUM(result IN ('unknown','blocked','locked')) AS fakes, COUNT(DISTINCT city) AS cities FROM scans WHERE merchant_id=?")
    .bind(m.id)
    .first();
  const reports = (await db.prepare('SELECT COUNT(*) AS n FROM reports WHERE merchant_id=?').bind(m.id).first()).n;
  return {
    headline: story.headline || null,
    quote: story.quote,
    author: story.author,
    merchant: { name: m.name, slug: m.slug, logo_url: imageUrl(m.logo_key) || m.logo_url, brand_color: m.brand_color },
    stats: { original: s?.original || 0, fakes: (s?.fakes || 0) + reports, cities: s?.cities || 0, days: Math.max(1, Math.round((now() - m.created_at) / 86400)) },
  };
}

export async function merchantsPage(db) {
  const c = await siteConfig(db);
  return { plans: c.plans, story: await storyWithStats(db, c.story) };
}

// ---------- طلبات التجار الجدد ----------
export const LEAD_STATUS = ['new', 'contacted', 'subscribed', 'rejected'];

export async function addLead(db, f, source = 'guide') {
  const t = now();
  return db
    .prepare('INSERT INTO leads(name,brand,phone,product,qty,source,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id')
    .bind(f.name, f.brand, f.phone || null, f.product || null, f.qty || null, source, 'new', t, t)
    .first();
}

export async function listLeads(db) {
  const rows = (await db.prepare('SELECT l.*,m.name AS merchant_name FROM leads l LEFT JOIN merchants m ON m.id=l.merchant_id ORDER BY l.id DESC LIMIT 500').all()).results;
  const counts = Object.fromEntries(LEAD_STATUS.map((s) => [s, rows.filter((r) => r.status === s).length]));
  return { leads: rows, counts };
}

export async function updateLead(db, id, b) {
  const row = await db.prepare('SELECT id FROM leads WHERE id=?').bind(id).first();
  if (!row) fail(404, 'ما لقينا الطلب');
  const f = {};
  if ('status' in b) {
    if (!LEAD_STATUS.includes(b.status)) fail(400, 'المرحلة غير معروفة');
    f.status = b.status;
  }
  if ('note' in b) f.note = str(b.note, 'الملاحظة', { max: 500, optional: true });
  if ('merchant_id' in b) f.merchant_id = b.merchant_id ? Number(b.merchant_id) : null;
  const keys = Object.keys(f);
  if (!keys.length) fail(400, 'ما فيه تغييرات');
  await db.prepare(`UPDATE leads SET ${keys.map((k) => k + '=?').join(',')},updated_at=? WHERE id=?`).bind(...keys.map((k) => f[k]), now(), id).run();
  return db.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
}

// ---------- صحة المنصة ----------
export async function platformHealth(db) {
  const t = now();
  const merchants = (await db.prepare("SELECT id,name,slug,low_stock_threshold,created_at FROM merchants WHERE status='active' ORDER BY id").all()).results;
  const [scans14, pending, leads] = await db.batch([
    db.prepare('SELECT merchant_id,COUNT(*) AS n,MAX(created_at) AS last FROM scans WHERE merchant_id IS NOT NULL AND created_at>=? GROUP BY merchant_id').bind(t - 14 * 86400),
    db.prepare("SELECT merchant_id,COUNT(*) AS n,MIN(created_at) AS since FROM batches WHERE status='pending' AND is_test=0 GROUP BY merchant_id"),
    db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status='new'"),
  ]);
  const scanBy = new Map(scans14.results.map((r) => [r.merchant_id, r]));
  const pendBy = new Map(pending.results.map((r) => [r.merchant_id, r]));
  const lowStock = [], quiet = [], notActivated = [], noBatch = [];
  for (const m of merchants) {
    const s = await stockFor(db, m.id);
    if (!s.issued) { noBatch.push({ id: m.id, name: m.name, days: Math.round((t - m.created_at) / 86400) }); continue; }
    if (s.active > 0 && s.remaining <= m.low_stock_threshold) lowStock.push({ id: m.id, name: m.name, remaining: s.remaining, days_left: s.days_left });
    if (s.active > 0 && !scanBy.has(m.id)) quiet.push({ id: m.id, name: m.name });
    const p = pendBy.get(m.id);
    if (p && t - p.since > 7 * 86400) notActivated.push({ id: m.id, name: m.name, batches: p.n, days: Math.round((t - p.since) / 86400) });
  }
  const map = await fakesMap(db, null, 720);
  return {
    merchants: merchants.length,
    new_leads: leads.results[0].n,
    low_stock: lowStock,
    quiet,
    not_activated: notActivated,
    no_batch: noBatch,
    fake_cities: map.points.slice(0, 5).map((p) => ({ city: p.city, n: p.fakes + p.reports })),
    fake_total: map.totals.fake + (map.totals.reports || 0),
    original_total: map.totals.original,
  };
}

// ---------- خطوات البداية للتاجر ----------
export async function onboarding(db, mid) {
  const m = await db.prepare('SELECT logo_key,logo_url,voice_key,guarantee_enabled,loyalty_enabled,contest_enabled,whatsapp FROM merchants WHERE id=?').bind(mid).first();
  const [sellers, imgs, scans, push] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM sellers WHERE merchant_id=?').bind(mid),
    db.prepare("SELECT COUNT(*) AS n FROM batches WHERE merchant_id=? AND image_key IS NOT NULL").bind(mid),
    db.prepare("SELECT COUNT(*) AS n FROM scans WHERE merchant_id=? AND result='original'").bind(mid),
    db.prepare('SELECT COUNT(*) AS n FROM user_push p JOIN users u ON u.id=p.user_id WHERE u.merchant_id=?').bind(mid),
  ]);
  const steps = [
    { key: 'logo', done: Boolean(m.logo_key || m.logo_url), title: 'ارفع شعار علامتك', hint: 'يطلع لعميلك في صفحة التحقق', tab: 'account' },
    { key: 'image', done: imgs.results[0].n > 0, title: 'ارفع صورة منتجك للدفعة', hint: 'يشوفها العميل، ويقارن فيها الذكاء الصناعي صور البلاغات', tab: 'tags' },
    { key: 'sellers', done: sellers.results[0].n > 0, title: 'أضف نقاط البيع', hint: 'عشان يعرف العميل وين يلقى الأصلي، وتطبع لهم شهادة', tab: 'sellers' },
    { key: 'voice', done: Boolean(m.voice_key), title: 'سجّل رسالتك الصوتية', hint: 'العميل يسمع شكرك بعد ما يتحقق', tab: 'trust' },
    { key: 'reward', done: Boolean(m.guarantee_enabled || m.loyalty_enabled || m.contest_enabled), title: 'فعّل ميزة تشد العميل', hint: 'ضمان أصالة، أو نقاط وكاش باك، أو مسابقة', tab: 'trust' },
    { key: 'push', done: push.results[0].n > 0, title: 'فعّل تنبيهات الجوال', hint: 'يوصلك إشعار أول ما ينكشف تقليد', tab: 'home' },
    { key: 'first', done: scans.results[0].n > 0, title: 'أول عميل يتحقق من منتجك', hint: 'جرّب بنفسك: امسح علامة من أول دفعة', tab: 'home' },
  ];
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}

// ---------- تنبيه التقرير الشهري (أول يوم بالشهر الصبح) ----------
export async function runMonthly(env, t = now()) {
  const db = env.DB;
  const local = new Date((t + 10800) * 1000);
  if (local.getUTCDate() !== 1 || local.getUTCHours() < 9) return 0;
  const prev = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 15)).toISOString().slice(0, 7);
  if ((await getSetting(db, 'monthly_done')) === prev) return 0;
  await setSetting(db, 'monthly_done', prev);
  const name = new Date(prev + '-15T12:00:00Z').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });
  const msg = `📄 تقريرك الشهري لـ ${name} جاهز. افتحه من تبويب «التقرير الشهري» واحفظه PDF.`;
  const ms = (await db.prepare("SELECT id FROM merchants WHERE status='active'").all()).results;
  for (const m of ms) {
    await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'monthly_report',?,?)").bind(m.id, msg, now()).run();
    await pushAlert(db, m.id, 'monthly_report', msg).catch(() => {});
  }
  return ms.length;
}

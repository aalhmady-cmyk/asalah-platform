// متجر التاجر الخاص: إعدادات المتجر (مسودة ومنشور وتراجع)، نقاط المساعد، المساعد بالذكاء الاصطناعي،
// صفحات الهبوط، وطلبات العملاء والسلات المتروكة.
import Anthropic from '@anthropic-ai/sdk';
import { assistantEnabled } from './assistant.js';
import { imageUrl } from './images.js';
import { CATEGORIES } from './store.js';
import { pushAlert } from './push.js';
import { fail, now, saPhone } from './util.js';

const MODEL = 'claude-sonnet-5-5';

export const THEMES = { perfume: 'عطور وبخور', fashion: 'أزياء وعبايات', food: 'مطعم وأغذية', tech: 'إلكترونيات وإكسسوارات', general: 'عام' };
export const FONTS = { plex: 'IBM Plex Sans Arabic', tajawal: 'Tajawal', cairo: 'Cairo', amiri: 'Amiri', almarai: 'Almarai' };
const CARDS = ['soft', 'sharp', 'glass'];
const ABANDON_AFTER = 30 * 60;
const UNDO_MAX = 10;

// ---------- تنظيف إعدادات المتجر ----------
const txt = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const color = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : d);

export function defaultConfig(merchant) {
  return {
    name: merchant.name,
    tagline: 'منتجات أصلية موثّقة من أصالة',
    about: null,
    announcement: '✅ كل منتجاتنا أصلية وموثّقة بعلامة أصالة',
    theme: 'general',
    colors: { primary: '#0e6b4e', accent: '#d9b45a', bg: '#0f2a21' },
    font: 'plex',
    card: 'soft',
    slides: [{ title: merchant.name, sub: 'منتجات أصلية بضمان أصالة', cta: 'تسوّق الحين' }],
    sections: [],
    checkout: merchant.store_url ? 'salla' : 'whatsapp',
    whatsapp: merchant.whatsapp || null,
    shipping: null,
    payment: null,
    coupon: null,
    view: '3d',
  };
}

export function cleanConfig(c, base) {
  const src = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  const out = { ...base };
  const set = (k, v) => { if (k in src) out[k] = v; };
  set('name', txt(src.name, 60) || base.name);
  set('tagline', txt(src.tagline, 140));
  set('about', txt(src.about, 1200));
  set('announcement', txt(src.announcement, 140));
  set('theme', THEMES[src.theme] ? src.theme : base.theme);
  set('font', FONTS[src.font] ? src.font : base.font);
  set('card', CARDS.includes(src.card) ? src.card : base.card);
  if (src.colors && typeof src.colors === 'object') {
    out.colors = { primary: color(src.colors.primary, base.colors.primary), accent: color(src.colors.accent, base.colors.accent), bg: color(src.colors.bg, base.colors.bg) };
  }
  if (Array.isArray(src.slides)) {
    out.slides = src.slides.slice(0, 4).map((s) => ({ title: txt(s?.title, 70), sub: txt(s?.sub, 140), cta: txt(s?.cta, 30) })).filter((s) => s.title);
  }
  if (Array.isArray(src.sections)) {
    out.sections = src.sections.slice(0, 8).map((s) => ({ title: txt(s?.title, 40), category: CATEGORIES[s?.category] ? s.category : null })).filter((s) => s.title);
  }
  set('checkout', src.checkout === 'salla' ? 'salla' : 'whatsapp');
  if ('whatsapp' in src) {
    try { out.whatsapp = saPhone(src.whatsapp, { optional: true }); } catch { fail(400, 'رقم واتساب المتجر غير صحيح'); }
  }
  set('shipping', txt(src.shipping, 300));
  set('payment', txt(src.payment, 300));
  if ('coupon' in src) {
    const cp = src.coupon;
    const code = txt(cp?.code, 20)?.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const percent = Math.round(Number(cp?.percent));
    out.coupon = code && percent >= 1 && percent <= 90 ? { code, percent, note: txt(cp?.note, 80) } : null;
  }
  set('view', src.view === 'grid' ? 'grid' : '3d');
  return out;
}

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

export async function siteRow(db, merchant) {
  let row = await db.prepare('SELECT * FROM merchant_sites WHERE merchant_id=?').bind(merchant.id).first();
  if (!row) {
    const t = now();
    const d = JSON.stringify(defaultConfig(merchant));
    await db.prepare('INSERT OR IGNORE INTO merchant_sites(merchant_id,draft,created_at,updated_at) VALUES(?,?,?,?)').bind(merchant.id, d, t, t).run();
    row = await db.prepare('SELECT * FROM merchant_sites WHERE merchant_id=?').bind(merchant.id).first();
  }
  const base = defaultConfig(merchant);
  return { ...row, draft: cleanConfig(parse(row.draft), base), config: row.config ? cleanConfig(parse(row.config), base) : null, undo: parse(row.undo) || [] };
}

// يحفظ المسودة ويحط النسخة القديمة في سجل التراجع
export async function saveDraft(db, merchant, patch) {
  const row = await siteRow(db, merchant);
  const next = cleanConfig({ ...row.draft, ...patch }, row.draft);
  if (JSON.stringify(next) === JSON.stringify(row.draft)) return { draft: row.draft, can_undo: row.undo.length > 0 };
  const undo = [...row.undo, row.draft].slice(-UNDO_MAX);
  await db.prepare('UPDATE merchant_sites SET draft=?,undo=?,updated_at=? WHERE merchant_id=?').bind(JSON.stringify(next), JSON.stringify(undo), now(), merchant.id).run();
  return { draft: next, can_undo: true };
}

export async function undoDraft(db, merchant) {
  const row = await siteRow(db, merchant);
  if (!row.undo.length) fail(400, 'ما فيه تعديل نتراجع عنه');
  const undo = row.undo.slice(0, -1);
  const prev = row.undo[row.undo.length - 1];
  await db.prepare('UPDATE merchant_sites SET draft=?,undo=?,updated_at=? WHERE merchant_id=?').bind(JSON.stringify(prev), JSON.stringify(undo), now(), merchant.id).run();
  return { draft: cleanConfig(prev, defaultConfig(merchant)), can_undo: undo.length > 0 };
}

// ---------- نقاط المساعد ----------
const DEFAULT_PLAN = { free: 20, cost: 0.1, packs: [{ points: 50, price: 29 }, { points: 150, price: 69 }, { points: 400, price: 149 }] };

export async function aiPlan(db) {
  const row = await db.prepare("SELECT value FROM settings WHERE key='ai_plan'").first();
  const p = parse(row?.value) || {};
  return { ...DEFAULT_PLAN, ...p, packs: Array.isArray(p.packs) && p.packs.length ? p.packs : DEFAULT_PLAN.packs };
}

export async function saveAiPlan(db, b) {
  const free = Math.round(Number(b.free));
  const cost = Number(b.cost);
  if (!(free >= 0 && free <= 1000)) fail(400, 'تحقق من النقاط المجانية');
  if (!(cost >= 0 && cost <= 10)) fail(400, 'تحقق من التكلفة التقديرية');
  if (!Array.isArray(b.packs) || b.packs.length > 6) fail(400, 'تحقق من الباقات');
  const packs = b.packs.map((k) => ({ points: Math.round(Number(k.points)), price: Math.round(Number(k.price) * 100) / 100 }));
  if (packs.some((k) => !(k.points >= 1 && k.points <= 100000) || !(k.price >= 0 && k.price <= 100000))) fail(400, 'تحقق من أرقام الباقات');
  const plan = { free, cost, packs };
  await db.prepare("INSERT INTO settings(key,value) VALUES('ai_plan',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(plan)).run();
  return plan;
}

// يعطي التاجر النقاط المجانية أول مرة، ويرجع رصيده
export async function credits(db, mid) {
  const m = await db.prepare('SELECT ai_credits,ai_used,ai_free_given FROM merchants WHERE id=?').bind(mid).first();
  if (!m.ai_free_given) {
    const { free } = await aiPlan(db);
    const r = await db.prepare('UPDATE merchants SET ai_credits=ai_credits+?,ai_free_given=1 WHERE id=? AND ai_free_given=0 RETURNING ai_credits,ai_used').bind(free, mid).first();
    if (r) {
      if (free) await db.prepare("INSERT INTO ai_credit_log(merchant_id,delta,reason,created_at) VALUES(?,?,'نقاط مجانية للتجربة',?)").bind(mid, free, now()).run();
      return { balance: r.ai_credits, used: r.ai_used };
    }
    return credits(db, mid);
  }
  return { balance: m.ai_credits, used: m.ai_used };
}

export async function addCredits(db, mid, delta, reason) {
  const r = await db.prepare('UPDATE merchants SET ai_credits=MAX(0,ai_credits+?) WHERE id=? RETURNING ai_credits').bind(delta, mid).first();
  if (!r) fail(404, 'التاجر غير موجود');
  await db.prepare('INSERT INTO ai_credit_log(merchant_id,delta,reason,created_at) VALUES(?,?,?,?)').bind(mid, delta, reason, now()).run();
  return r.ai_credits;
}

async function needCredit(env, mid) {
  if (!assistantEnabled(env)) fail(503, 'المساعد الذكي غير مفعّل حالياً، تواصل مع إدارة أصالة', 'assistant_disabled');
  const c = await credits(env.DB, mid);
  if (c.balance < 1) fail(402, 'خلصت نقاط المساعد. اشحن نقاط عشان تكمل', 'no_credits');
}
// النقطة تنخصم بعد ما ينجح الرد، فلو تعطل المساعد ما يخسر التاجر شي
async function spendCredit(db, mid, reason) {
  const r = await db.prepare('UPDATE merchants SET ai_credits=ai_credits-1,ai_used=ai_used+1 WHERE id=? AND ai_credits>0 RETURNING ai_credits').bind(mid).first();
  await db.prepare('INSERT INTO ai_credit_log(merchant_id,delta,reason,created_at) VALUES(?,-1,?,?)').bind(mid, reason, now()).run();
  return r ? r.ai_credits : 0;
}

// ---------- المساعد بالذكاء الاصطناعي ----------
const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'اسم المتجر، حتى 60 حرف' },
    tagline: { type: 'string', description: 'جملة قصيرة تحت الاسم' },
    about: { type: 'string', description: 'نبذة عن المتجر، 2 إلى 4 أسطر' },
    announcement: { type: 'string', description: 'شريط إعلان قصير أعلى المتجر' },
    theme: { type: 'string', enum: Object.keys(THEMES), description: 'شكل المعرض ثلاثي الأبعاد حسب النشاط' },
    colors: { type: 'object', properties: { primary: { type: 'string' }, accent: { type: 'string' }, bg: { type: 'string' } }, description: 'ألوان hex مثل #0e6b4e. bg لون خلفية المعرض والهيدر (غامق غالباً)' },
    font: { type: 'string', enum: Object.keys(FONTS) },
    card: { type: 'string', enum: CARDS, description: 'شكل بطاقات المنتجات' },
    slides: { type: 'array', maxItems: 4, items: { type: 'object', properties: { title: { type: 'string' }, sub: { type: 'string' }, cta: { type: 'string' } } } },
    sections: { type: 'array', maxItems: 8, items: { type: 'object', properties: { title: { type: 'string' }, category: { type: 'string', enum: Object.keys(CATEGORIES) } } } },
    shipping: { type: 'string', description: 'معلومات الشحن والتوصيل' },
    payment: { type: 'string', description: 'طرق الدفع عند تأكيد الطلب مع التاجر' },
    coupon: { type: 'object', properties: { code: { type: 'string' }, percent: { type: 'integer' }, note: { type: 'string' } } },
    view: { type: 'string', enum: ['3d', 'grid'] },
  },
};

const cleanHistory = (h) =>
  (Array.isArray(h) ? h : [])
    .slice(-8)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

async function callClaude(env, body) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    return await client.beta.messages.create({ model: MODEL, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low' }, ...body });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) fail(429, 'المساعد مشغول، جرّب بعد دقيقة');
    if (e instanceof Anthropic.AuthenticationError) fail(503, 'مفتاح المساعد غير صحيح، تواصل مع إدارة أصالة');
    if (e instanceof Anthropic.APIError) fail(502, 'تعذر الوصول للمساعد، حاول مرة ثانية');
    throw e;
  }
}

export async function siteAi(env, merchant, message, history) {
  const q = String(message ?? '').trim();
  if (q.length < 2) fail(400, 'اكتب طلبك');
  if (q.length > 800) fail(400, 'الرسالة طويلة، اختصرها');
  await needCredit(env, merchant.id);
  const db = env.DB;
  const row = await siteRow(db, merchant);
  const products = (await db.prepare("SELECT title,category,price FROM store_products WHERE merchant_id=? AND status='active' ORDER BY id DESC LIMIT 40").bind(merchant.id).all()).results;
  const messages = [...cleanHistory(history), { role: 'user', content: q }];
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const res = await callClaude(env, {
    max_tokens: 2500,
    system: `أنت "مساعد بناء المتجر" في منصة "أصالة المنتجات الأصلية". تساعد التاجر يبني متجره الخاص (رابط مستقل فيه معرض ثلاثي الأبعاد وعرض عادي) ومنتجاته الأصلية تظهر أيضاً في متاجر أصالة.
- تكلم بلهجة سعودية بسيطة ومهذبة وباختصار (سطرين إلى 5 أسطر).
- إذا طلب التاجر تغيير في المتجر (اسم، ألوان، نبذة، أقسام، سلايدر، شحن، كود خصم، شكل)، استدعِ الأداة update_store بالحقول اللي تتغير بس، وبعدها قل له باختصار وش غيّرت وإنه يقدر يشوف المعاينة ويضغط "تراجع" لو ما عجبه.
- الألوان لازم تكون متناسقة وواضحة القراءة: bg غامق مع accent فاتح أو ذهبي غالباً.
- الأقسام تربط بفئات المنتجات المتوفرة إذا أمكن.
- لا تخترع أرقام مبيعات ولا وعود قانونية. الدفع الإلكتروني داخل أصالة غير متوفر حالياً: الطلب يتأكد مع التاجر عبر واتساب أو يكمل في سلة.
- إذا سأل عن شي خارج بناء المتجر وتسويقه، جاوبه باختصار ورجّعه لمتجره.`,
    tools: [{ name: 'update_store', description: 'يحدّث مسودة متجر التاجر. أرسل الحقول اللي تتغير بس.', input_schema: CONFIG_SCHEMA }],
    messages: [{ role: 'user', content: 'إعدادات المتجر الحالية (مسودة):\n' + JSON.stringify(row.draft) + '\n\nمنتجات التاجر (السعر بالهللة):\n' + JSON.stringify(products) + '\n\nفئات المنتجات: ' + JSON.stringify(CATEGORIES) }, { role: 'assistant', content: 'تمام، فهمت متجرك. وش تبي؟' }, ...messages],
  });
  if (res.stop_reason === 'refusal') return { reply: 'ما أقدر أساعد في هذا الطلب. خلّنا نكمل على متجرك.', draft: row.draft, balance: (await credits(db, merchant.id)).balance };
  const call = res.content.find((b) => b.type === 'tool_use' && b.name === 'update_store');
  let draft = row.draft;
  let can_undo = row.undo.length > 0;
  if (call?.input && typeof call.input === 'object') ({ draft, can_undo } = await saveDraft(db, merchant, call.input));
  let reply = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!reply) reply = call ? 'تم التعديل ✅ شوف المعاينة، ولو ما عجبك اضغط "تراجع".' : 'ما فهمت طلبك تماماً، وضّح لي وش تبي أغيّر في متجرك؟';
  const balance = await spendCredit(db, merchant.id, 'رد المساعد');
  return { reply, draft, can_undo, changed: Boolean(call), balance };
}

// ---------- صفحة الهبوط ----------
export function cleanLanding(l) {
  if (!l || typeof l !== 'object') return null;
  const arr = (a, n, max) => (Array.isArray(a) ? a.map((x) => txt(x, max)).filter(Boolean).slice(0, n) : []);
  const faq = Array.isArray(l.faq) ? l.faq.slice(0, 5).map((f) => ({ q: txt(f?.q, 120), a: txt(f?.a, 400) })).filter((f) => f.q && f.a) : [];
  const out = { headline: txt(l.headline, 90), sub: txt(l.sub, 220), bullets: arr(l.bullets, 6, 120), faq, cta: txt(l.cta, 30), urgency: txt(l.urgency, 80) };
  return out.headline ? out : null;
}

export async function landingAi(env, merchant, product) {
  await needCredit(env, merchant.id);
  const res = await callClaude(env, {
    max_tokens: 1800,
    system: 'أنت كاتب إعلانات سعودي محترف. اكتب صفحة هبوط قصيرة ومقنعة لمنتج أصلي يباع في متجر التاجر الخاص على منصة أصالة (كل منتج موثّق بعلامة أصالة ضد التقليد). لهجة سعودية بيضاء، جمل قصيرة، بدون مبالغات كاذبة ولا أرقام مخترعة ولا وعود طبية. استدعِ الأداة save_landing.',
    tools: [{
      name: 'save_landing',
      description: 'يحفظ صفحة الهبوط',
      input_schema: {
        type: 'object',
        required: ['headline', 'sub', 'bullets', 'faq', 'cta'],
        properties: {
          headline: { type: 'string', description: 'عنوان جذاب حتى 70 حرف' },
          sub: { type: 'string', description: 'سطر يشرح القيمة حتى 180 حرف' },
          bullets: { type: 'array', maxItems: 5, items: { type: 'string' }, description: 'مزايا قصيرة، كل وحدة تبدأ بإيموجي مناسب' },
          faq: { type: 'array', maxItems: 4, items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } } } },
          cta: { type: 'string', description: 'نص زر الشراء حتى 20 حرف' },
          urgency: { type: 'string', description: 'سطر تحفيز لطيف وصادق (اختياري)' },
        },
      },
    }],
    tool_choice: { type: 'tool', name: 'save_landing' },
    messages: [{ role: 'user', content: JSON.stringify({ store: merchant.name, title: product.title, description: product.description, category: CATEGORIES[product.category], price_sar: product.price / 100, old_price_sar: product.old_price ? product.old_price / 100 : null }) }],
  });
  const call = res.content.find((b) => b.type === 'tool_use');
  const landing = cleanLanding(call?.input);
  if (!landing) fail(502, 'ما قدر المساعد يكتب الصفحة، جرّب مرة ثانية');
  await env.DB.prepare('UPDATE store_products SET landing=?,updated_at=? WHERE id=? AND merchant_id=?').bind(JSON.stringify(landing), now(), product.id, merchant.id).run();
  const balance = await spendCredit(env.DB, merchant.id, 'صفحة هبوط: ' + product.title.slice(0, 40));
  return { landing, balance };
}

// ---------- المتجر العام ----------
const sar = (h) => (h == null ? null : h / 100);
export const siteUrl = (env, slug) => `${env.PUBLIC_ORIGIN || ''}/s/${slug}`;

export async function siteProducts(db, mid) {
  const rows = (await db.prepare("SELECT id,title,description,category,price,old_price,buy_url,image_key,landing,rating_sum,rating_n FROM store_products WHERE merchant_id=? AND status='active' AND admin_blocked=0 ORDER BY id DESC LIMIT 300").bind(mid).all()).results;
  return rows.map(({ image_key, landing, price, old_price, rating_sum, rating_n, ...p }) => ({
    ...p,
    price: sar(price),
    old_price: sar(old_price),
    image_url: imageUrl(image_key),
    landing: parse(landing),
    rating: rating_n ? { avg: Math.round((rating_sum / rating_n) * 10) / 10, n: rating_n } : null,
  }));
}

export async function publicSite(env, slug, { preview = null } = {}) {
  const db = env.DB;
  const merchant = await db.prepare("SELECT id,name,slug,logo_key,whatsapp,store_url,store_enabled,status FROM merchants WHERE slug=?").bind(slug).first();
  if (!merchant || merchant.status !== 'active' || !merchant.store_enabled) return null;
  const row = await siteRow(db, merchant);
  let config = row.config;
  if (preview && preview === merchant.id) config = row.draft;
  else if (!config) return null;
  else await db.prepare('UPDATE merchant_sites SET views=views+1 WHERE merchant_id=?').bind(merchant.id).run();
  const { whatsapp, ...c } = config;
  return {
    merchant: { name: merchant.name, slug: merchant.slug, logo_url: imageUrl(merchant.logo_key) },
    config: { ...c, has_whatsapp: Boolean(whatsapp || merchant.whatsapp) },
    categories: CATEGORIES,
    products: await siteProducts(db, merchant.id),
    preview: Boolean(preview && preview === merchant.id),
  };
}

// ---------- السلة والطلبات ----------
async function pricedItems(db, mid, items) {
  if (!Array.isArray(items) || items.length > 30) fail(400, 'السلة غير صالحة');
  const want = new Map();
  for (const it of items) {
    const id = Number(it?.id);
    const qty = Math.round(Number(it?.qty));
    if (!Number.isInteger(id) || id < 1 || !(qty >= 1 && qty <= 50)) fail(400, 'السلة غير صالحة');
    want.set(id, Math.min(50, (want.get(id) || 0) + qty));
  }
  if (!want.size) return [];
  const ids = [...want.keys()];
  const rows = (await db.prepare(`SELECT id,title,price,buy_url FROM store_products WHERE merchant_id=? AND status='active' AND admin_blocked=0 AND id IN (${ids.map(() => '?').join(',')})`).bind(mid, ...ids).all()).results;
  return rows.map((p) => ({ id: p.id, title: p.title, price: p.price, qty: want.get(p.id), buy_url: p.buy_url || null }));
}

function totals(items, coupon) {
  const sub = items.reduce((n, it) => n + it.price * it.qty, 0);
  const off = coupon ? Math.round((sub * coupon.percent) / 100) : 0;
  return { sub, off, total: sub - off };
}

function customer(b, { need }) {
  const name = txt(b.name, 80);
  const city = txt(b.city, 60);
  const note = txt(b.note, 300);
  let phone = null;
  if (b.phone) phone = saPhone(b.phone);
  if (need) {
    if (!name) fail(400, 'اكتب اسمك');
    if (!phone) fail(400, 'اكتب رقم جوالك');
    if (!b.consent) fail(400, 'وافق على تواصل المتجر معك بخصوص الطلب');
  }
  return { name, phone, city, note, consent: b.consent ? 1 : 0 };
}

const token = (v) => (typeof v === 'string' && /^[a-zA-Z0-9_-]{16,64}$/.test(v) ? v : fail(400, 'السلة غير صالحة'));

async function siteForOrder(db, slug) {
  const merchant = await db.prepare("SELECT id,name,slug,whatsapp,store_url,store_enabled,status FROM merchants WHERE slug=?").bind(slug).first();
  if (!merchant || merchant.status !== 'active' || !merchant.store_enabled) fail(404, 'المتجر غير متاح');
  const row = await siteRow(db, merchant);
  if (!row.config) fail(404, 'المتجر غير منشور');
  return { merchant, config: row.config };
}

// تتحدث مع كل تغيير في سلة العميل، عشان التاجر يشوف السلات المتروكة
export async function saveCart(db, slug, b) {
  const { merchant } = await siteForOrder(db, slug);
  const tk = token(b.token);
  const items = await pricedItems(db, merchant.id, b.items);
  if (!items.length) {
    await db.prepare("DELETE FROM orders WHERE merchant_id=? AND token=? AND status='cart'").bind(merchant.id, tk).run();
    return { saved: false };
  }
  const c = customer(b, { need: false });
  const t = now();
  const total = items.reduce((n, it) => n + it.price * it.qty, 0);
  await db
    .prepare(`INSERT INTO orders(merchant_id,token,status,items,total,name,phone,city,consent,created_at,updated_at) VALUES(?,?,'cart',?,?,?,?,?,?,?,?)
      ON CONFLICT(merchant_id,token) WHERE status='cart' DO UPDATE SET items=excluded.items,total=excluded.total,name=COALESCE(excluded.name,name),phone=COALESCE(excluded.phone,phone),city=COALESCE(excluded.city,city),consent=MAX(consent,excluded.consent),updated_at=excluded.updated_at`)
    .bind(merchant.id, tk, JSON.stringify(items), total, c.name, c.phone, c.city, c.consent, t, t)
    .run();
  return { saved: true };
}

const money = (h) => (h / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س';

export async function placeOrder(db, slug, b) {
  const { merchant, config } = await siteForOrder(db, slug);
  const tk = token(b.token);
  const items = await pricedItems(db, merchant.id, b.items);
  if (!items.length) fail(400, 'السلة فاضية');
  const c = customer(b, { need: true });
  const coupon = config.coupon && b.coupon && String(b.coupon).toUpperCase() === config.coupon.code ? config.coupon : null;
  const { sub, off, total } = totals(items, coupon);
  const wa = config.whatsapp || merchant.whatsapp;
  const sallaReady = items.every((it) => it.buy_url);
  const channel = config.checkout === 'salla' && sallaReady ? 'salla' : wa ? 'whatsapp' : sallaReady ? 'salla' : null;
  if (!channel) fail(400, 'المتجر ما جهّز طريقة تأكيد الطلب. تواصل مع المتجر');
  const t = now();
  const cart = await db.prepare("SELECT id FROM orders WHERE merchant_id=? AND token=? AND status='cart'").bind(merchant.id, tk).first();
  let id;
  const vals = [JSON.stringify(items), total, c.name, c.phone, c.city, c.note, c.consent, channel, coupon?.code || null, t, t];
  if (cart) {
    await db.prepare("UPDATE orders SET status='new',items=?,total=?,name=?,phone=?,city=?,note=?,consent=?,channel=?,coupon=?,updated_at=?,ordered_at=? WHERE id=?").bind(...vals, cart.id).run();
    id = cart.id;
  } else {
    id = (await db.prepare("INSERT INTO orders(merchant_id,token,status,items,total,name,phone,city,note,consent,channel,coupon,updated_at,ordered_at,created_at) VALUES(?,?,'new',?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id").bind(merchant.id, tk, ...vals, t).first()).id;
  }
  const number = 'A-' + (10000 + id);
  await db.prepare('UPDATE orders SET number=? WHERE id=?').bind(number, id).run();
  const msg = `طلب جديد ${number} في متجرك الخاص: ${items.length} منتج بـ ${money(total)} من ${c.name}${c.city ? ' (' + c.city + ')' : ''}`;
  await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'new_order',?,?)").bind(merchant.id, msg, t).run();
  await pushAlert(db, merchant.id, 'new_order', msg);

  const out = { number, channel, total: sar(total), discount: sar(off) };
  if (channel === 'whatsapp') {
    const lines = [`السلام عليكم، أريد تأكيد طلبي رقم ${number}`, '', ...items.map((it) => `• ${it.title} × ${it.qty} = ${money(it.price * it.qty)}`)];
    if (off) lines.push(`كود الخصم ${coupon.code}: -${money(off)}`);
    lines.push(`المجموع: ${money(total)}`, '', `الاسم: ${c.name}`);
    if (c.city) lines.push(`المدينة: ${c.city}`);
    if (c.note) lines.push(`ملاحظة: ${c.note}`);
    out.whatsapp_url = `https://wa.me/${wa}?text=${encodeURIComponent(lines.join('\n'))}`;
  } else {
    out.links = items.map((it) => ({ title: it.title, qty: it.qty, url: it.buy_url }));
  }
  if (sub !== total) out.subtotal = sar(sub);
  return out;
}

export const ORDER_STATUS = { new: 'جديد', confirmed: 'مؤكد', shipped: 'تم الشحن', cancelled: 'ملغي' };

export async function listOrders(db, mid, view) {
  const t = now();
  const where = view === 'carts' ? "status='cart' AND updated_at<?" : "status<>'cart'";
  const args = view === 'carts' ? [mid, t - ABANDON_AFTER] : [mid];
  const rows = (await db.prepare(`SELECT id,number,status,items,total,name,phone,city,note,consent,channel,coupon,merchant_note,created_at,updated_at,ordered_at FROM orders WHERE merchant_id=? AND ${where} ORDER BY COALESCE(ordered_at,updated_at) DESC LIMIT 300`).bind(...args).all()).results;
  const stats = await db
    .prepare(`SELECT SUM(status<>'cart') AS orders,SUM(status='new') AS new,SUM(status IN ('confirmed','shipped')) AS done,COALESCE(SUM(CASE WHEN status IN ('new','confirmed','shipped') THEN total END),0) AS revenue,SUM(status='cart' AND updated_at<?) AS abandoned,COALESCE(SUM(CASE WHEN status='cart' AND updated_at<? THEN total END),0) AS abandoned_value FROM orders WHERE merchant_id=?`)
    .bind(t - ABANDON_AFTER, t - ABANDON_AFTER, mid)
    .first();
  return {
    orders: rows.map((o) => ({
      ...o,
      total: sar(o.total),
      items: (parse(o.items) || []).map((it) => ({ ...it, price: sar(it.price) })),
      // للسلات: رقم الجوال يظهر بس لو العميل وافق على التواصل
      phone: o.status === 'cart' && !o.consent ? null : o.phone,
    })),
    stats: { orders: stats.orders || 0, new: stats.new || 0, done: stats.done || 0, revenue: sar(stats.revenue), abandoned: stats.abandoned || 0, abandoned_value: sar(stats.abandoned_value) },
  };
}

export async function updateOrder(db, mid, id, b) {
  const o = await db.prepare("SELECT id,status FROM orders WHERE id=? AND merchant_id=?").bind(id, mid).first();
  if (!o) fail(404, 'الطلب غير موجود');
  const f = {};
  if ('status' in b) {
    if (o.status === 'cart' || !ORDER_STATUS[b.status]) fail(400, 'الحالة غير معروفة');
    f.status = b.status;
  }
  if ('merchant_note' in b) f.merchant_note = txt(b.merchant_note, 300);
  const keys = Object.keys(f);
  if (!keys.length) fail(400, 'ما فيه تعديل');
  await db.prepare(`UPDATE orders SET ${keys.map((k) => k + '=?').join(',')},updated_at=? WHERE id=?`).bind(...keys.map((k) => f[k]), now(), id).run();
}

export async function deleteCart(db, mid, id) {
  const r = await db.prepare("DELETE FROM orders WHERE id=? AND merchant_id=? AND status='cart'").bind(id, mid).run();
  if (!r.meta.changes) fail(404, 'السلة غير موجودة');
}

export async function siteStats(db, mid) {
  const t = now();
  const [s, o] = await Promise.all([
    db.prepare('SELECT views FROM merchant_sites WHERE merchant_id=?').bind(mid).first(),
    db.prepare("SELECT SUM(status<>'cart') AS orders,SUM(status='new') AS new,SUM(status='cart' AND updated_at<?) AS abandoned FROM orders WHERE merchant_id=?").bind(t - ABANDON_AFTER, mid).first(),
  ]);
  return { views: s?.views || 0, orders: o.orders || 0, new: o.new || 0, abandoned: o.abandoned || 0 };
}

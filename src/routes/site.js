// متجر التاجر الخاص: مسارات لوحة التاجر (البناء والطلبات)، واللوحة الأم (النقاط)، والواجهة العامة /s/
import { assistantEnabled } from '../lib/assistant.js';
import { imageUrl } from '../lib/images.js';
import { currentUser } from '../lib/auth.js';
import { pushAlert } from '../lib/push.js';
import {
  addCredits, aiPlan, cleanLanding, credits, deleteCart, FONTS, landingAi, listOrders, ORDER_STATUS, placeOrder, publicSite,
  saveAiPlan, saveCart, saveDraft, siteAi, siteProducts, siteRow, siteStats, siteUrl, THEMES, undoDraft, updateOrder,
} from '../lib/site.js';
import { audit, fail, int, ipHash, json, now, rateLimit, readJson, str } from '../lib/util.js';
import { requireHuman } from '../lib/human.js';

const MERCHANT_COLS = 'id,name,slug,logo_key,whatsapp,store_url,store_enabled';

async function sitePayload(env, merchant) {
  const db = env.DB;
  const row = await siteRow(db, merchant);
  const [c, plan, products, stats] = await Promise.all([credits(db, merchant.id), aiPlan(db), siteProducts(db, merchant.id), siteStats(db, merchant.id)]);
  return {
    ok: true,
    enabled: Boolean(merchant.store_enabled),
    merchant: { name: merchant.name, slug: merchant.slug, whatsapp: merchant.whatsapp, store_url: merchant.store_url, logo_url: imageUrl(merchant.logo_key) },
    url: siteUrl(env, merchant.slug),
    draft: row.draft,
    published: Boolean(row.config),
    published_at: row.published_at,
    dirty: JSON.stringify(row.draft) !== JSON.stringify(row.config),
    can_undo: row.undo.length > 0,
    credits: { ...c, packs: plan.packs },
    ai_enabled: assistantEnabled(env),
    products: products.map((p) => ({ id: p.id, title: p.title, price: p.price, image_url: p.image_url, category: p.category, buy_url: p.buy_url, landing: p.landing })),
    stats,
    themes: THEMES,
    fonts: FONTS,
  };
}

export async function handleMerchantSite(req, env, path, user) {
  if (!path.startsWith('/api/m/site') && !path.startsWith('/api/m/orders')) return null;
  const db = env.DB;
  const m = req.method;
  const mid = user.merchant_id;
  const merchant = await db.prepare(`SELECT ${MERCHANT_COLS} FROM merchants WHERE id=?`).bind(mid).first();
  if (path === '/api/m/site' && m === 'GET') return json(await sitePayload(env, merchant));
  if (!merchant.store_enabled) fail(403, 'متجرك غير مفعّل. اطلب تفعيل متاجر أصالة من تبويب "متجري" أولاً', 'store_disabled');

  if (path === '/api/m/site/preview' && m === 'GET') {
    const d = await publicSite(env, merchant.slug, { preview: mid });
    if (!d) fail(404, 'المتجر غير متاح');
    return json({ ok: true, ...d });
  }
  if (path === '/api/m/site/draft' && m === 'PUT') {
    const b = await readJson(req, 40000);
    return json({ ok: true, ...(await saveDraft(db, merchant, b.draft || {})) });
  }
  if (path === '/api/m/site/undo' && m === 'POST') return json({ ok: true, ...(await undoDraft(db, merchant)) });
  if (path === '/api/m/site/publish' && m === 'POST') {
    const row = await siteRow(db, merchant);
    await db.prepare('UPDATE merchant_sites SET config=?,published_at=?,updated_at=? WHERE merchant_id=?').bind(JSON.stringify(row.draft), now(), now(), mid).run();
    await audit(db, user, 'site_published');
    return json({ ok: true, url: siteUrl(env, merchant.slug), message: 'تم نشر متجرك 🎉' });
  }
  if (path === '/api/m/site/unpublish' && m === 'POST') {
    await db.prepare('UPDATE merchant_sites SET config=NULL,updated_at=? WHERE merchant_id=?').bind(now(), mid).run();
    await audit(db, user, 'site_unpublished');
    return json({ ok: true, message: 'تم إيقاف المتجر الخاص' });
  }
  if (path === '/api/m/site/ai' && m === 'POST') {
    await rateLimit(db, 'site-ai:' + mid, 30, 600);
    const b = await readJson(req, 30000);
    return json({ ok: true, ...(await siteAi(env, merchant, b.message, b.history)) });
  }
  if (path === '/api/m/site/credits/request' && m === 'POST') {
    if (user.merchant_role === 'staff') fail(403, 'شحن النقاط لصاحب الحساب بس', 'owner_only');
    const b = await readJson(req);
    const plan = await aiPlan(db);
    const pack = plan.packs[int(b.pack, 'الباقة', { min: 0, max: plan.packs.length - 1 })];
    await rateLimit(db, 'credit-req:' + mid, 3, 3600);
    const msg = `${merchant.name} يطلب شحن ${pack.points} نقطة للمساعد (${pack.price} ريال)`;
    await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'credit_request',?,?)").bind(mid, msg, now()).run();
    await pushAlert(db, mid, 'credit_request', msg);
    return json({ ok: true, message: 'وصل طلبك لإدارة أصالة، وبيتواصلون معك للدفع وإضافة النقاط' });
  }
  let match;
  if ((match = path.match(/^\/api\/m\/site\/landing\/(\d+)(\/ai)?$/))) {
    const p = await db.prepare('SELECT id,title,description,category,price,old_price FROM store_products WHERE id=? AND merchant_id=?').bind(Number(match[1]), mid).first();
    if (!p) fail(404, 'المنتج غير موجود');
    if (match[2] && m === 'POST') {
      await rateLimit(db, 'site-ai:' + mid, 30, 600);
      return json({ ok: true, ...(await landingAi(env, merchant, p)) });
    }
    if (!match[2] && m === 'PUT') {
      const b = await readJson(req, 20000);
      const landing = b.landing == null ? null : cleanLanding(b.landing);
      if (b.landing != null && !landing) fail(400, 'اكتب عنوان الصفحة');
      await db.prepare('UPDATE store_products SET landing=?,updated_at=? WHERE id=?').bind(landing ? JSON.stringify(landing) : null, now(), p.id).run();
      return json({ ok: true, landing });
    }
  }

  // ---------- طلبات العملاء ----------
  if (path.startsWith('/api/m/orders') && user.merchant_role === 'staff') fail(403, 'طلبات العملاء لصاحب الحساب بس', 'owner_only');
  if (path === '/api/m/orders' && m === 'GET') {
    const view = new URL(req.url).searchParams.get('view') === 'carts' ? 'carts' : 'orders';
    return json({ ok: true, view, status: ORDER_STATUS, ...(await listOrders(db, mid, view)) });
  }
  if ((match = path.match(/^\/api\/m\/orders\/(\d+)$/))) {
    if (m === 'PATCH') {
      await updateOrder(db, mid, Number(match[1]), await readJson(req));
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await deleteCart(db, mid, Number(match[1]));
      return json({ ok: true });
    }
  }
  fail(404, 'المسار غير موجود');
}

// ---------- اللوحة الأم: نقاط المساعد ----------
export async function handleAdminSite(req, env, path, user) {
  if (!path.startsWith('/api/admin/ai-credits')) return null;
  const db = env.DB;
  const m = req.method;
  if (path === '/api/admin/ai-credits' && m === 'GET') {
    const [plan, merchants, requests, totals] = await Promise.all([
      aiPlan(db),
      db.prepare("SELECT m.id,m.name,m.ai_credits,m.ai_used,m.ai_free_given,s.published_at,(SELECT COUNT(*) FROM orders o WHERE o.merchant_id=m.id AND o.status<>'cart') AS orders FROM merchants m LEFT JOIN merchant_sites s ON s.merchant_id=m.id WHERE m.store_enabled=1 ORDER BY m.ai_used DESC, m.id LIMIT 500").all(),
      db.prepare("SELECT a.id,a.message,a.created_at,a.read_at,a.merchant_id,m.name AS merchant_name FROM alerts a LEFT JOIN merchants m ON m.id=a.merchant_id WHERE a.kind='credit_request' ORDER BY a.id DESC LIMIT 30").all(),
      db.prepare("SELECT COALESCE(SUM(ai_used),0) AS used FROM merchants").first(),
    ]);
    return json({ ok: true, plan, merchants: merchants.results, requests: requests.results, used: totals.used, ai_enabled: assistantEnabled(env) });
  }
  if (path === '/api/admin/ai-credits/plan' && m === 'PUT') {
    const plan = await saveAiPlan(db, await readJson(req));
    await audit(db, user, 'ai_plan', plan);
    return json({ ok: true, plan });
  }
  const dm = path.match(/^\/api\/admin\/ai-credits\/requests\/(\d+)\/dismiss$/);
  if (dm && m === 'POST') {
    await db.prepare("UPDATE alerts SET read_at=? WHERE id=? AND kind='credit_request'").bind(now(), Number(dm[1])).run();
    return json({ ok: true });
  }
  const match = path.match(/^\/api\/admin\/ai-credits\/(\d+)$/);
  if (match && m === 'POST') {
    const b = await readJson(req);
    const delta = int(b.delta, 'عدد النقاط', { min: -100000, max: 100000 });
    if (!delta) fail(400, 'أدخل عدد النقاط');
    const mid = Number(match[1]);
    const reason = str(b.reason, 'السبب', { max: 120, optional: true }) || (delta > 0 ? 'شحن من إدارة أصالة' : 'خصم من إدارة أصالة');
    const balance = await addCredits(db, mid, delta, reason);
    if (b.request_id) await db.prepare("UPDATE alerts SET read_at=? WHERE id=? AND kind='credit_request'").bind(now(), Number(b.request_id)).run();
    if (delta > 0) await pushAlert(db, mid, 'credits_added', `تمت إضافة ${delta} نقطة لمساعد متجرك. رصيدك الحين ${balance}`);
    await audit(db, user, 'ai_credits', { delta, reason }, mid);
    return json({ ok: true, balance });
  }
  fail(404, 'المسار غير موجود');
}

// ---------- الواجهة العامة ----------
export async function handlePublicSite(req, env, path) {
  const db = env.DB;
  const m = req.method;
  const match = path.match(/^\/api\/public\/site\/([a-z0-9-]{2,40})(\/cart|\/order)?$/);
  if (!match) fail(404, 'المسار غير موجود');
  const slug = match[1];
  if (!match[2] && m === 'GET') {
    const u = new URL(req.url);
    let preview = null;
    if (u.searchParams.get('preview') === '1') {
      const user = await currentUser(db, req).catch(() => null);
      if (user?.role === 'merchant') preview = user.merchant_id;
    }
    const d = await publicSite(env, slug, { preview });
    if (!d) fail(404, 'المتجر غير موجود أو غير منشور');
    return json({ ok: true, ...d });
  }
  if (match[2] === '/cart' && m === 'POST') {
    await rateLimit(db, 'cart:' + (await ipHash(req)), 120, 600);
    return json({ ok: true, ...(await saveCart(db, slug, await readJson(req, 20000))) });
  }
  if (match[2] === '/order' && m === 'POST') {
    await rateLimit(db, 'order:' + (await ipHash(req)), 10, 600);
    const body = await readJson(req, 20000);
    await requireHuman(env, req, body.cf_token);
    return json({ ok: true, ...(await placeOrder(db, slug, body)) });
  }
  fail(404, 'المسار غير موجود');
}

// صفحة /s/slug: نفس الملف الثابت مع عنوان ووصف وصورة للمشاركة في واتساب وسناب
export async function serveSitePage(req, env, path) {
  const mm = path.match(/^\/s\/([a-z0-9-]{2,40})(?:\/p\/(\d+))?\/?$/);
  if (!mm) return null;
  const u = new URL(req.url);
  u.pathname = '/site/';
  u.search = '';
  const page = await env.ASSETS.fetch(new Request(u, { headers: req.headers }));
  if (!page.ok) return page;
  const merchant = await env.DB.prepare("SELECT m.id,m.name,m.logo_key,s.config FROM merchants m LEFT JOIN merchant_sites s ON s.merchant_id=m.id WHERE m.slug=? AND m.status='active' AND m.store_enabled=1").bind(mm[1]).first();
  // /s/demo: متجر تجريبي للتجار (لو ما فيه تاجر حقيقي بنفس الاسم)
  const demo = mm[1] === 'demo' && !merchant;
  let title = demo ? 'جرّب متجرك الخاص بمعرض ثلاثي الأبعاد · أصالة' : 'متجر غير متاح · أصالة';
  let desc = demo ? 'متجر تجريبي: معرض ثلاثي الأبعاد، طلبات على واتساب، ومنتجات أصلية موثّقة' : 'متاجر أصالة للمنتجات الأصلية';
  let image = null;
  let theme = '#0F2A21';
  if (merchant?.config) {
    let c = {};
    try { c = JSON.parse(merchant.config); } catch {}
    title = `${c.name || merchant.name} · منتجات أصلية موثّقة`;
    desc = c.tagline || desc;
    image = imageUrl(merchant.logo_key);
    if (/^#[0-9a-f]{6}$/i.test(c.colors?.bg || '')) theme = c.colors.bg;
    if (mm[2]) {
      const p = await env.DB.prepare("SELECT title,description,image_key,price,landing FROM store_products WHERE id=? AND merchant_id=? AND status='active' AND admin_blocked=0").bind(Number(mm[2]), merchant.id).first();
      if (p) {
        let l = null;
        try { l = JSON.parse(p.landing || 'null'); } catch {}
        title = `${l?.headline || p.title} · ${c.name || merchant.name}`;
        desc = (l?.sub || p.description || '').slice(0, 180) + ` · ${(p.price / 100).toLocaleString('en-US')} ر.س`;
        image = imageUrl(p.image_key) || image;
      }
    }
  }
  const origin = env.PUBLIC_ORIGIN || u.origin;
  const abs = (x) => (x && x.startsWith('/') ? origin + x : x);
  const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const head = `<title>${attr(title)}</title><meta name="description" content="${attr(desc)}"><meta property="og:type" content="website"><meta property="og:title" content="${attr(title)}"><meta property="og:description" content="${attr(desc)}"><meta property="og:url" content="${attr(origin + path)}">${image ? `<meta property="og:image" content="${attr(abs(image))}"><meta name="twitter:card" content="summary_large_image">` : ''}<meta name="theme-color" content="${theme}">`;
  return new HTMLRewriter()
    .on('title', { element: (el) => el.remove() })
    .on('meta[name="theme-color"]', { element: (el) => el.remove() })
    .on('head', { element: (el) => el.append(head, { html: true }) })
    .transform(new Response(page.body, { status: merchant?.config || demo ? 200 : 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }));
}

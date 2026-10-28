// متاجر أصالة: لوحة "متجري" للتاجر، والواجهة العامة للمنتجات والريلز.
import { assistantEnabled } from '../lib/assistant.js';
import { deleteImage, imageUrl, ownsImage, saveImage, saveImageBytes } from '../lib/images.js';
import { draftProduct, storeChat } from '../lib/shop.js';
import { CATEGORIES, REEL_MAX, REEL_MIN, VIDEO_MAX_BYTES, discoverProducts, importLink, productFields, proxyImage, videoType } from '../lib/store.js';
import { audit, fail, int, ipHash, json, now, randomHex, rateLimit, readJson, str, url } from '../lib/util.js';

const MAX_PRODUCTS = 500;
const MAX_REELS = 200;

const mediaUrl = (key) => (key ? '/media/' + key : null);
const sar = (h) => (h == null ? null : h / 100);

function productOut(p) {
  const { image_key, price, old_price, ...rest } = p;
  return { ...rest, price: sar(price), old_price: sar(old_price), image_url: imageUrl(image_key) };
}
function reelOut(r) {
  const { video_key, poster_key, ...rest } = r;
  return { ...rest, video_url: mediaUrl(video_key), poster_url: imageUrl(poster_key) };
}

function b64bytes(s) {
  if (typeof s !== 'string' || s.length > 1_500_000 || !/^[A-Za-z0-9+/=]+$/.test(s)) fail(400, 'الصورة غير صالحة');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deleteReelFiles(env, reel) {
  if (reel.video_key && env.MEDIA) await env.MEDIA.delete(reel.video_key);
  await deleteImage(env, reel.poster_key);
}

// ================= لوحة التاجر =================
export async function handleMerchantStore(req, env, path, user) {
  const db = env.DB;
  const mid = user.merchant_id;
  const m = req.method;
  const merchant = await db.prepare('SELECT id,name,slug,store_url,store_enabled,store_since,store_coupon,store_coupon_note,coupon_copies,store_auto_sync FROM merchants WHERE id=?').bind(mid).first();

  if (path === '/api/m/store' && m === 'GET') {
    const [products, reels, totals] = await Promise.all([
      db.prepare('SELECT * FROM store_products WHERE merchant_id=? ORDER BY id DESC').bind(mid).all(),
      db.prepare('SELECT * FROM reels WHERE merchant_id=? ORDER BY id DESC').bind(mid).all(),
      db.prepare('SELECT COALESCE(SUM(views),0) AS views, COALESCE(SUM(clicks),0) AS clicks FROM store_products WHERE merchant_id=?').bind(mid).first(),
    ]);
    const reelStats = reels.results.reduce((a, r) => ({ views: a.views + r.views, clicks: a.clicks + r.clicks }), { views: 0, clicks: 0 });
    return json({
      ok: true,
      enabled: !!merchant.store_enabled,
      store_url: merchant.store_url,
      slug: merchant.slug,
      coupon: { code: merchant.store_coupon, note: merchant.store_coupon_note, copies: merchant.coupon_copies },
      auto_sync: !!merchant.store_auto_sync,
      categories: CATEGORIES,
      ai: assistantEnabled(env),
      media: !!env.MEDIA,
      reel_limits: { min: REEL_MIN, max: REEL_MAX, bytes: VIDEO_MAX_BYTES },
      stats: { products: products.results.length, views: totals.views, clicks: totals.clicks, reel_views: reelStats.views, reel_clicks: reelStats.clicks },
      products: products.results.map(productOut),
      reels: reels.results.map(reelOut),
    });
  }

  // طلب الاشتراك يوصل للمدير العام كتنبيه، وهو يفعّله من اللوحة الأم
  if (path === '/api/m/store/request' && m === 'POST') {
    if (merchant.store_enabled) return json({ ok: true, message: 'متجرك مفعّل' });
    await rateLimit(db, 'storereq:' + mid, 3, 86400);
    await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'store_request',?,?)").bind(mid, `🛍️ ${merchant.name} يطلب الاشتراك في متاجر أصالة`, now()).run();
    await audit(db, user, 'store_requested');
    return json({ ok: true, message: 'وصل طلبك لإدارة أصالة، وبنفعّل متجرك قريب' });
  }

  if (!merchant.store_enabled) fail(403, 'المتجر غير مفعّل لحسابك. تواصل مع أصالة لتفعيله', 'store_disabled');

  if (path === '/api/m/store' && m === 'PATCH') {
    const b = await readJson(req);
    const f = {};
    if ('store_url' in b) f.store_url = url(b.store_url, 'متجرك في سلة');
    if ('store_coupon' in b) {
      f.store_coupon = str(b.store_coupon, 'الكوبون', { min: 2, max: 30, optional: true });
      if (f.store_coupon && !/^[A-Za-z0-9_-]+$/.test(f.store_coupon)) fail(400, 'الكوبون: حروف إنجليزية وأرقام فقط');
      if (f.store_coupon) f.store_coupon = f.store_coupon.toUpperCase();
    }
    if ('store_coupon_note' in b) f.store_coupon_note = str(b.store_coupon_note, 'وصف الخصم', { max: 80, optional: true });
    if ('store_auto_sync' in b) f.store_auto_sync = b.store_auto_sync ? 1 : 0;
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    await db.prepare(`UPDATE merchants SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => f[k]), mid).run();
    await audit(db, user, 'store_settings_updated', f);
    return json({ ok: true, ...f });
  }

  // ---------- مزامنة سلة: نلقى روابط المنتجات من خريطة الموقع، والمتصفح يستوردها وحدة وحدة ----------
  if (path === '/api/m/store/discover' && m === 'POST') {
    await rateLimit(db, 'storedisc:' + mid, 20, 3600);
    const b = await readJson(req);
    const links = await discoverProducts(b.url || merchant.store_url);
    const have = new Set((await db.prepare('SELECT buy_url FROM store_products WHERE merchant_id=?').bind(mid).all()).results.map((r) => r.buy_url.replace(/\/$/, '')));
    const fresh = links.filter((l) => !have.has(l.replace(/\/$/, '')));
    return json({ ok: true, found: links.length, links: fresh.slice(0, 100) });
  }

  // ---------- الذكاء الاصطناعي والروابط ----------
  if (path === '/api/m/store/ai' && m === 'POST') {
    await rateLimit(db, 'storeai:' + mid, 120, 3600);
    const b = await readJson(req, 2_000_000);
    return json({ ok: true, draft: await draftProduct(env, b) });
  }
  if (path === '/api/m/store/import' && m === 'POST') {
    await rateLimit(db, 'storeimp:' + mid, 120, 3600);
    const b = await readJson(req);
    return json({ ok: true, product: await importLink(b.url) });
  }
  if (path === '/api/m/store/fetch-image' && m === 'GET') {
    await rateLimit(db, 'storeimg:' + mid, 200, 3600);
    return proxyImage(new URL(req.url).searchParams.get('u'));
  }
  if (path === '/api/m/store/image' && m === 'POST') {
    const key = await saveImage(env, req, 'products', mid);
    return json({ ok: true, image_key: key, image_url: imageUrl(key) });
  }

  // ---------- المنتجات ----------
  if (path === '/api/m/store/products' && m === 'POST') {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM store_products WHERE merchant_id=?').bind(mid).first();
    if (count.n >= MAX_PRODUCTS) fail(400, `وصلت الحد (${MAX_PRODUCTS} منتج)`);
    const b = await readJson(req);
    const f = productFields(b, false);
    const image_key = b.image_key == null ? null : ownsImage(b.image_key, mid) ? b.image_key : fail(400, 'الصورة غير صالحة');
    const t = now();
    const row = await db
      .prepare('INSERT INTO store_products(merchant_id,title,description,category,price,old_price,buy_url,image_key,status,created_at,updated_at,synced_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *')
      .bind(mid, f.title, f.description, f.category, f.price, f.old_price, f.buy_url, image_key, f.status, t, t, b.imported ? t : null)
      .first();
    await audit(db, user, 'store_product_created', { id: row.id, title: row.title });
    return json({ ok: true, product: productOut(row) }, 201);
  }
  let match;
  if ((match = path.match(/^\/api\/m\/store\/products\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const cur = await db.prepare('SELECT * FROM store_products WHERE id=? AND merchant_id=?').bind(Number(match[1]), mid).first();
    if (!cur) fail(404, 'ما لقينا المنتج');
    if (m === 'DELETE') {
      await db.batch([
        db.prepare('UPDATE reels SET product_id=NULL WHERE product_id=?').bind(cur.id),
        db.prepare('DELETE FROM store_products WHERE id=?').bind(cur.id),
      ]);
      await deleteImage(env, cur.image_key);
      await audit(db, user, 'store_product_deleted', { id: cur.id, title: cur.title });
      return json({ ok: true });
    }
    const b = await readJson(req);
    const f = productFields(b, true);
    if ('image_key' in b) {
      if (b.image_key != null && !ownsImage(b.image_key, mid)) fail(400, 'الصورة غير صالحة');
      f.image_key = b.image_key;
    }
    if ('price' in f && !('old_price' in f) && cur.old_price != null && cur.old_price <= f.price) f.old_price = null;
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db
      .prepare(`UPDATE store_products SET ${keys.map((k) => k + '=?').join(',')},updated_at=? WHERE id=? RETURNING *`)
      .bind(...keys.map((k) => f[k]), now(), cur.id)
      .first();
    if ('image_key' in f && cur.image_key && cur.image_key !== f.image_key) await deleteImage(env, cur.image_key);
    await audit(db, user, 'store_product_updated', { id: cur.id, fields: keys });
    return json({ ok: true, product: productOut(row) });
  }

  // ---------- الريلز ----------
  // الخطوة 1: بيانات الريل والغلاف. الخطوة 2: رفع الفيديو نفسه.
  if (path === '/api/m/store/reels' && m === 'POST') {
    if (!env.MEDIA) fail(503, 'رفع الريلز يحتاج تفعيل التخزين. أصالة تجهّزه قريب', 'media_disabled');
    const count = await db.prepare("SELECT COUNT(*) AS n FROM reels WHERE merchant_id=? AND status<>'uploading'").bind(mid).first();
    if (count.n >= MAX_REELS) fail(400, `وصلت الحد (${MAX_REELS} ريل)`);
    const b = await readJson(req, 1_600_000);
    const title = str(b.title, 'عنوان الريل', { min: 2, max: 90 });
    const duration = int(b.duration, 'مدة الفيديو', { min: REEL_MIN, max: REEL_MAX });
    const product_id = int(b.product_id, 'المنتج', { min: 1, optional: true });
    if (product_id && !(await db.prepare('SELECT 1 FROM store_products WHERE id=? AND merchant_id=?').bind(product_id, mid).first())) fail(404, 'ما لقينا المنتج');
    const poster_key = b.poster ? await saveImageBytes(env, b64bytes(b.poster), 'image/jpeg', 'posters', mid) : null;
    // ننظف الرفعات اللي ما كملت من أكثر من ساعة
    const stale = await db.prepare("SELECT * FROM reels WHERE merchant_id=? AND status='uploading' AND created_at<?").bind(mid, now() - 3600).all();
    for (const r of stale.results) {
      await deleteReelFiles(env, r);
      await db.prepare('DELETE FROM reels WHERE id=?').bind(r.id).run();
    }
    const row = await db
      .prepare("INSERT INTO reels(merchant_id,product_id,title,poster_key,duration,status,created_at) VALUES(?,?,?,?,?,'uploading',?) RETURNING id")
      .bind(mid, product_id, title, poster_key, duration, now())
      .first();
    return json({ ok: true, id: row.id }, 201);
  }
  if ((match = path.match(/^\/api\/m\/store\/reels\/(\d+)\/video$/)) && m === 'PUT') {
    if (!env.MEDIA) fail(503, 'رفع الريلز يحتاج تفعيل التخزين', 'media_disabled');
    const reel = await db.prepare("SELECT * FROM reels WHERE id=? AND merchant_id=? AND status='uploading'").bind(Number(match[1]), mid).first();
    if (!reel) fail(404, 'ما لقينا الريل');
    if (Number(req.headers.get('Content-Length') || 0) > VIDEO_MAX_BYTES) fail(413, 'الفيديو كبير، قصّره أو قلل جودته');
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > VIDEO_MAX_BYTES) fail(413, 'الفيديو كبير، قصّره أو قلل جودته');
    const vt = videoType(buf);
    if (!vt) fail(415, 'الملف مو فيديو MP4 أو WEBM');
    const key = `reels/${mid}/${randomHex(12)}.${vt.ext}`;
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: vt.type } });
    const row = await db
      .prepare("UPDATE reels SET video_key=?,video_type=?,video_bytes=?,status='active' WHERE id=? RETURNING *")
      .bind(key, vt.type, buf.length, reel.id)
      .first();
    await audit(db, user, 'reel_published', { id: reel.id, title: reel.title, bytes: buf.length });
    return json({ ok: true, reel: reelOut(row) });
  }
  if ((match = path.match(/^\/api\/m\/store\/reels\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const reel = await db.prepare('SELECT * FROM reels WHERE id=? AND merchant_id=?').bind(Number(match[1]), mid).first();
    if (!reel) fail(404, 'ما لقينا الريل');
    if (m === 'DELETE') {
      await deleteReelFiles(env, reel);
      await db.prepare('DELETE FROM reels WHERE id=?').bind(reel.id).run();
      await audit(db, user, 'reel_deleted', { id: reel.id, title: reel.title });
      return json({ ok: true });
    }
    const b = await readJson(req);
    const f = {};
    if ('title' in b) f.title = str(b.title, 'عنوان الريل', { min: 2, max: 90 });
    if ('product_id' in b) {
      f.product_id = int(b.product_id, 'المنتج', { min: 1, optional: true });
      if (f.product_id && !(await db.prepare('SELECT 1 FROM store_products WHERE id=? AND merchant_id=?').bind(f.product_id, mid).first())) fail(404, 'ما لقينا المنتج');
    }
    if ('status' in b) {
      if (!['active', 'hidden'].includes(b.status) || reel.status === 'uploading') fail(400, 'الحالة غير معروفة');
      f.status = b.status;
    }
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db.prepare(`UPDATE reels SET ${keys.map((k) => k + '=?').join(',')} WHERE id=? RETURNING *`).bind(...keys.map((k) => f[k]), reel.id).first();
    return json({ ok: true, reel: reelOut(row) });
  }

  fail(404, 'المسار غير موجود');
}

// ================= الواجهة العامة =================
const LIVE = "m.store_enabled=1 AND m.status='active'";
const PRODUCT_COLS = 'p.id,p.title,p.description,p.category,p.price,p.old_price,p.buy_url,p.image_key,p.created_at,p.merchant_id,m.name AS merchant_name,m.slug AS merchant_slug,m.logo_key AS merchant_logo,m.store_coupon,m.store_coupon_note';

function publicProduct(p) {
  const { merchant_logo, store_coupon, store_coupon_note, ...rest } = productOut(p);
  return { ...rest, merchant_logo: imageUrl(merchant_logo), coupon: store_coupon ? { code: store_coupon, note: store_coupon_note } : null };
}

async function listProducts(db, { cat, merchant, q, ids, limit = 60, offset = 0 }) {
  const where = [LIVE, "p.status='active'"];
  const args = [];
  if (ids?.length) { where.push(`p.id IN (${ids.map(() => '?').join(',')})`); args.push(...ids); }
  if (cat && CATEGORIES[cat]) { where.push('p.category=?'); args.push(cat); }
  if (merchant) { where.push('m.slug=?'); args.push(merchant); }
  if (q) {
    for (const w of q.split(/\s+/).filter((x) => x.length > 1).slice(0, 4)) {
      where.push('(p.title LIKE ? OR p.description LIKE ? OR m.name LIKE ?)');
      const like = '%' + w.replace(/[%_]/g, '') + '%';
      args.push(like, like, like);
    }
  }
  const r = await db
    .prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
    .bind(...args, limit, offset)
    .all();
  return r.results.map(publicProduct);
}

async function listReels(db, { merchant, product, sort, limit = 20, offset = 0 }) {
  const where = [LIVE, "r.status='active'"];
  const args = [];
  if (merchant) { where.push('m.slug=?'); args.push(merchant); }
  if (product) { where.push('r.product_id=?'); args.push(product); }
  const r = await db
    .prepare(
      `SELECT r.id,r.title,r.video_key,r.poster_key,r.duration,r.product_id,r.created_at,r.likes,r.views,m.name AS merchant_name,m.slug AS merchant_slug,m.logo_key AS merchant_logo,
              p.title AS product_title,p.price AS product_price,p.buy_url AS product_buy_url,p.image_key AS product_image
       FROM reels r JOIN merchants m ON m.id=r.merchant_id LEFT JOIN store_products p ON p.id=r.product_id AND p.status='active'
       WHERE ${where.join(' AND ')} ORDER BY ${sort === 'popular' ? 'r.views + r.likes * 5 DESC, r.id DESC' : 'r.id DESC'} LIMIT ? OFFSET ?`
    )
    .bind(...args, limit, offset)
    .all();
  return r.results.map(({ merchant_logo, product_price, product_image, ...x }) => ({
    ...reelOut(x),
    merchant_logo: imageUrl(merchant_logo),
    product_price: sar(product_price),
    product_image: imageUrl(product_image),
  }));
}

export async function handlePublicStore(req, env, path) {
  const db = env.DB;
  const m = req.method;
  const sp = new URL(req.url).searchParams;
  const offset = Math.max(0, Math.min(5000, Number(sp.get('offset')) || 0));
  const slug = /^[a-z0-9-]{2,40}$/.test(sp.get('m') || '') ? sp.get('m') : null;

  if (path === '/api/public/store' && m === 'GET') {
    const [merchants, counts, products, reels] = await Promise.all([
      db
        .prepare(
          `SELECT m.name,m.slug,m.logo_key,m.brand_color,(SELECT COUNT(*) FROM store_products p WHERE p.merchant_id=m.id AND p.status='active') AS products
           FROM merchants m WHERE ${LIVE} ORDER BY m.store_since DESC, m.id DESC`
        )
        .all(),
      db.prepare(`SELECT p.category,COUNT(*) AS n FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.status='active' GROUP BY p.category`).all(),
      listProducts(db, { merchant: slug, limit: 60 }),
      listReels(db, { merchant: slug, limit: 12 }),
    ]);
    const cats = Object.fromEntries(counts.results.map((c) => [c.category, c.n]));
    return json({
      ok: true,
      ai: assistantEnabled(env),
      categories: Object.entries(CATEGORIES).map(([key, label]) => ({ key, label, count: cats[key] || 0 })),
      merchants: merchants.results.filter((x) => x.products > 0).map(({ logo_key, ...x }) => ({ ...x, logo_url: imageUrl(logo_key) })),
      products,
      reels,
    });
  }
  if (path === '/api/public/store/products' && m === 'GET') {
    const q = (sp.get('q') || '').trim().slice(0, 80);
    const ids = (sp.get('ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60);
    return json({ ok: true, products: await listProducts(db, { cat: sp.get('cat'), merchant: slug, q, ids, offset, limit: ids.length ? 60 : 40 }) });
  }
  let match;
  if ((match = path.match(/^\/api\/public\/store\/products\/(\d+)$/)) && m === 'GET') {
    const p = await db.prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=? AND ${LIVE} AND p.status='active'`).bind(Number(match[1])).first();
    if (!p) fail(404, 'المنتج غير متاح');
    const [more, reels] = await Promise.all([
      db
        .prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.status='active' AND p.id<>? AND (p.merchant_id=? OR p.category=?) ORDER BY (p.merchant_id=?) DESC, p.id DESC LIMIT 8`)
        .bind(p.id, p.merchant_id, p.category, p.merchant_id)
        .all(),
      listReels(db, { product: p.id, limit: 6 }),
    ]);
    return json({ ok: true, product: publicProduct(p), more: more.results.map(publicProduct), reels });
  }
  if (path === '/api/public/store/reels' && m === 'GET') {
    const ids = (sp.get('ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60);
    if (ids.length) {
      const all = await listReels(db, { limit: 500 });
      return json({ ok: true, reels: ids.map((id) => all.find((r) => r.id === id)).filter(Boolean) });
    }
    return json({ ok: true, reels: await listReels(db, { merchant: slug, sort: sp.get('sort'), offset, limit: 20 }) });
  }
  // عدّاد المشاهدات والضغطات (تقريبي، بحد طلبات لكل جهاز)
  if (path === '/api/public/store/track' && m === 'POST') {
    const b = await readJson(req);
    const id = int(b.id, 'المعرّف', { min: 1 });
    const sql = {
      view: 'UPDATE store_products SET views=views+1 WHERE id=?',
      click: 'UPDATE store_products SET clicks=clicks+1 WHERE id=?',
      reel_view: 'UPDATE reels SET views=views+1 WHERE id=?',
      reel_click: 'UPDATE reels SET clicks=clicks+1 WHERE id=?',
      coupon: 'UPDATE merchants SET coupon_copies=coupon_copies+1 WHERE id=(SELECT merchant_id FROM store_products WHERE id=?)',
      like: 'UPDATE reels SET likes=likes+1 WHERE id=?',
      unlike: 'UPDATE reels SET likes=MAX(0,likes-1) WHERE id=?',
    }[b.type];
    if (!sql) fail(400, 'نوع غير معروف');
    try {
      await rateLimit(db, `trk:${b.type}:${id}:` + (await ipHash(req)), 3, 3600);
    } catch {
      return json({ ok: true });
    }
    await db.prepare(sql).bind(id).run();
    return json({ ok: true });
  }
  if (path === '/api/public/store/chat' && m === 'POST') {
    await rateLimit(db, 'storechat:' + (await ipHash(req)), 40, 3600);
    const b = await readJson(req, 20000);
    const catalog = (
      await db
        .prepare(`SELECT p.id,p.title,p.category,p.price,m.name AS merchant_name FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.status='active' ORDER BY p.clicks DESC, p.id DESC LIMIT 250`)
        .all()
    ).results;
    const r = await storeChat(env, b.messages, catalog, b.lang === 'en' ? 'en' : 'ar');
    let products = [];
    if (r.ids.length) {
      const rows = await db.prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id IN (${r.ids.map(() => '?').join(',')})`).bind(...r.ids).all();
      products = r.ids.map((id) => rows.results.find((x) => x.id === id)).filter(Boolean).map(publicProduct);
    }
    return json({ ok: true, reply: r.reply, products });
  }
  fail(404, 'المسار غير موجود');
}

// بعد التحقق من منتج أصلي: "اطلبه مرة ثانية" وريلز المنتج من متجر نفس التاجر
export async function shopForVerify(db, b) {
  const [linked, more] = await Promise.all([
    b.store_product_id
      ? db.prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=? AND p.merchant_id=? AND p.status='active'`).bind(b.store_product_id, b.merchant_id).first()
      : null,
    listProducts(db, { merchant: b.slug, limit: 6 }),
  ]);
  const product = linked ? publicProduct(linked) : null;
  let reels = product ? await listReels(db, { product: product.id, limit: 6 }) : [];
  if (!reels.length) reels = await listReels(db, { merchant: b.slug, sort: 'popular', limit: 6 });
  const others = more.filter((p) => p.id !== product?.id).slice(0, 4);
  if (!product && !others.length && !reels.length) return null;
  return { slug: b.slug, product, more: others, reels, coupon: b.store_coupon ? { code: b.store_coupon, note: b.store_coupon_note } : null };
}

// متاجر أصالة: لوحة "متجري" للتاجر، والواجهة العامة للمنتجات والريلز.
import { pushAlert } from '../lib/push.js';
import { assistantEnabled } from '../lib/assistant.js';
import { deleteImage, imageUrl, ownsImage, saveImage, saveImageBytes } from '../lib/images.js';
import { draftProduct, reelTitles, storeChat } from '../lib/shop.js';
import { CATEGORIES, ORIGINAL_MAX_BYTES, REEL_MAX, REEL_MIN, VIDEO_MAX_BYTES, discoverProducts, importLink, productFields, proxyImage, videoType } from '../lib/store.js';
import { addNote, currentCustomer, googleEnabled, notifyPriceDrop } from '../lib/customers.js';
import { audit, fail, int, ipHash, json, now, randomHex, rateLimit, readJson, riyadhDay, sha256, str, url } from '../lib/util.js';

const MAX_PRODUCTS = 500;
const MAX_REELS = 200;

const mediaUrl = (key) => (key ? '/media/' + key : null);
const sar = (h) => (h == null ? null : h / 100);

function productOut(p) {
  const { image_key, price, old_price, ...rest } = p;
  return { ...rest, price: sar(price), old_price: sar(old_price), image_url: imageUrl(image_key) };
}
function reelOut(r) {
  const { video_key, poster_key, clip_mode, clip_start, clip_zoom, clip_x, clip_y, ...rest } = r;
  // clip: الفيديو أصلي، والعرض يبدأ من start لمدة duration ويقص بـ zoom و x و y
  const clip = clip_mode ? { start: clip_start, zoom: clip_zoom, x: clip_x, y: clip_y } : null;
  const { rating_sum, rating_n, ...out } = rest;
  const rating = rating_n ? { avg: Math.round((rating_sum / rating_n) * 10) / 10, n: rating_n } : null;
  return { ...out, clip, rating, video_url: mediaUrl(video_key), poster_url: imageUrl(poster_key) };
}

const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);

function b64bytes(s) {
  if (typeof s !== 'string' || s.length > 1_500_000 || !/^[A-Za-z0-9+/=]+$/.test(s)) fail(400, 'الصورة غير صالحة');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// وقت نشر الريل: فاضي = الحين، وإلا وقت جاي خلال 60 يوم
function publishAt(v) {
  if (v == null || v === '') return null;
  const t = int(v, 'وقت النشر', { min: 0 });
  if (t <= now() + 60) return null;
  if (t > now() + 60 * 86400) fail(400, 'وقت النشر لازم يكون خلال 60 يوم');
  return t;
}

// نوع الحدث في العداد: [منتج أو ريل، مشاهدة، ضغطة] لتقرير الأيام
const DAILY = { view: ['p', 1, 0], click: ['p', 0, 1], reel_view: ['r', 1, 0], reel_click: ['r', 0, 1] };

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
      reel_limits: { min: REEL_MIN, max: REEL_MAX, bytes: VIDEO_MAX_BYTES, original_bytes: ORIGINAL_MAX_BYTES },
      stats: { products: products.results.length, views: totals.views, clicks: totals.clicks, reel_views: reelStats.views, reel_clicks: reelStats.clicks },
      products: products.results.map(productOut),
      reels: reels.results.map(reelOut),
    });
  }

  // طلب الاشتراك يوصل للمدير العام كتنبيه، وهو يفعّله من اللوحة الأم
  if (path === '/api/m/store/request' && m === 'POST') {
    if (merchant.store_enabled) return json({ ok: true, message: 'متجرك مفعّل' });
    await rateLimit(db, 'storereq:' + mid, 3, 86400);
    const sr = `🛍️ ${merchant.name} يطلب الاشتراك في متاجر أصالة`;
    await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'store_request',?,?)").bind(mid, sr, now()).run();
    await pushAlert(db, mid, 'store_request', sr);
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
    return json({ ok: true, found: links.length, links: fresh.slice(0, 300) });
  }

  // ---------- الذكاء الاصطناعي والروابط ----------
  if (path === '/api/m/store/ai' && m === 'POST') {
    await rateLimit(db, 'storeai:' + mid, 120, 3600);
    const b = await readJson(req, 2_000_000);
    if (b.mode === 'reel') return json({ ok: true, titles: await reelTitles(env, b.product) });
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

  // ---------- تقرير المتجر: مشاهدات وضغطات كل يوم، وأكثر المنتجات والريلز جلباً للزباين ----------
  if (path === '/api/m/store/stats' && m === 'GET') {
    const days = [7, 30, 90].includes(Number(new URL(req.url).searchParams.get('days'))) ? Number(new URL(req.url).searchParams.get('days')) : 30;
    const since = riyadhDay(now() - (days - 1) * 86400);
    const [daily, top, topReels] = await Promise.all([
      db.prepare('SELECT day,SUM(views) AS views,SUM(clicks) AS clicks FROM store_daily WHERE merchant_id=? AND day>=? GROUP BY day ORDER BY day').bind(mid, since).all(),
      db
        .prepare(
          `SELECT p.id,p.title,p.image_key,SUM(d.views) AS views,SUM(d.clicks) AS clicks FROM store_daily d JOIN store_products p ON p.id=d.item_id
           WHERE d.merchant_id=? AND d.kind='p' AND d.day>=? GROUP BY p.id ORDER BY clicks DESC, views DESC LIMIT 5`
        )
        .bind(mid, since)
        .all(),
      db
        .prepare(
          `SELECT r.id,r.title,r.poster_key,SUM(d.views) AS views,SUM(d.clicks) AS clicks FROM store_daily d JOIN reels r ON r.id=d.item_id
           WHERE d.merchant_id=? AND d.kind='r' AND d.day>=? GROUP BY r.id ORDER BY clicks DESC, views DESC LIMIT 5`
        )
        .bind(mid, since)
        .all(),
    ]);
    return json({
      ok: true,
      days,
      since,
      daily: daily.results,
      top: top.results.map(({ image_key, ...x }) => ({ ...x, image_url: imageUrl(image_key) })),
      top_reels: topReels.results.map(({ poster_key, ...x }) => ({ ...x, poster_url: imageUrl(poster_key) })),
    });
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
        db.prepare('DELETE FROM product_comments WHERE product_id=?').bind(cur.id),
        db.prepare('DELETE FROM price_watch WHERE product_id=?').bind(cur.id),
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
    if (row.price != null && cur.price != null && row.price < cur.price) await notifyPriceDrop(db, row, cur.price);
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
    const c = b.clip && typeof b.clip === 'object' ? b.clip : null;
    const publish_at = publishAt(b.publish_at);
    const row = await db
      .prepare(
        "INSERT INTO reels(merchant_id,product_id,title,poster_key,duration,status,created_at,clip_mode,clip_start,clip_zoom,clip_x,clip_y,publish_at) VALUES(?,?,?,?,?,'uploading',?,?,?,?,?,?,?) RETURNING id"
      )
      .bind(mid, product_id, title, poster_key, duration, now(), c ? 1 : 0, c ? clamp(c.start, 0, 3600, 0) : 0, c ? clamp(c.zoom, 1, 3, 1) : 1, c ? clamp(c.x, 0, 1, 0.5) : 0.5, c ? clamp(c.y, 0, 1, 0.5) : 0.5, publish_at)
      .first();
    return json({ ok: true, id: row.id }, 201);
  }
  if ((match = path.match(/^\/api\/m\/store\/reels\/(\d+)\/video$/)) && m === 'PUT') {
    if (!env.MEDIA) fail(503, 'رفع الريلز يحتاج تفعيل التخزين', 'media_disabled');
    const reel = await db.prepare("SELECT * FROM reels WHERE id=? AND merchant_id=? AND status='uploading'").bind(Number(match[1]), mid).first();
    if (!reel) fail(404, 'ما لقينا الريل');
    const max = reel.clip_mode ? ORIGINAL_MAX_BYTES : VIDEO_MAX_BYTES;
    const size = Number(req.headers.get('Content-Length') || 0);
    if (size > max) fail(413, 'الفيديو كبير، قصّره أو قلل جودته');
    if (!size || !req.body) fail(411, 'الفيديو ما وصل، حاول مرة ثانية');
    // نرسله لـ R2 مباشرة بدون ما نحمله كله في الذاكرة، وبعدها نتأكد من أوله إنه فيديو
    const key = `reels/${mid}/${randomHex(12)}.mp4`;
    await env.MEDIA.put(key, req.body, { httpMetadata: { contentType: 'video/mp4' } });
    const head = await env.MEDIA.get(key, { range: { offset: 0, length: 16 } });
    const vt = head && videoType(new Uint8Array(await head.arrayBuffer()));
    const stored = head?.size || 0;
    if (!vt || stored > max) {
      await env.MEDIA.delete(key);
      fail(vt ? 413 : 415, vt ? 'الفيديو كبير، قصّره أو قلل جودته' : 'الملف مو فيديو MP4 أو MOV أو WEBM');
    }
    let finalKey = key;
    if (vt.ext !== 'mp4') {
      // webm: ننسخه بالامتداد الصحيح عشان المتصفح يعرف نوعه
      finalKey = `reels/${mid}/${randomHex(12)}.${vt.ext}`;
      const obj = await env.MEDIA.get(key);
      await env.MEDIA.put(finalKey, await obj.arrayBuffer(), { httpMetadata: { contentType: vt.type } });
      await env.MEDIA.delete(key);
    }
    const row = await db
      .prepare("UPDATE reels SET video_key=?,video_type=?,video_bytes=?,status='active' WHERE id=? RETURNING *")
      .bind(finalKey, vt.type, stored, reel.id)
      .first();
    await audit(db, user, 'reel_published', { id: reel.id, title: reel.title, bytes: stored });
    return json({ ok: true, reel: reelOut(row) });
  }
  // التاجر يشوف تعليقات ريلزه ومنتجاته ويحذف المسيء منها
  if ((match = path.match(/^\/api\/m\/store\/(reels|products)\/(\d+)\/comments(?:\/(\d+))?$/))) {
    const K = COMMENT_KINDS[match[1]];
    const item = await db.prepare(`SELECT id FROM ${K.target} WHERE id=? AND merchant_id=?`).bind(Number(match[2]), mid).first();
    if (!item) fail(404, 'ما لقيناه');
    if (!match[3] && m === 'GET') {
      const r = await db.prepare(`SELECT id,name,body,rating,reply,reply_at,created_at FROM ${K.table} WHERE ${K.fk}=? ORDER BY id DESC LIMIT 200`).bind(item.id).all();
      return json({ ok: true, comments: r.results });
    }
    // رد التاجر يظهر تحت التعليق بشارة "التاجر"، وصاحب التعليق يوصله تنبيه في حسابه
    if (match[3] && m === 'PATCH') {
      const c = await db.prepare(`SELECT * FROM ${K.table} WHERE id=? AND ${K.fk}=?`).bind(Number(match[3]), item.id).first();
      if (!c) fail(404, 'ما لقينا التعليق');
      const b = await readJson(req);
      const reply = str(b.reply, 'الرد', { max: 300, optional: true });
      if (reply && /https?:\/\/|www\./i.test(reply)) fail(400, 'الروابط ممنوعة في الرد');
      await db.prepare(`UPDATE ${K.table} SET reply=?,reply_at=? WHERE id=?`).bind(reply, reply ? now() : null, c.id).run();
      if (reply && !c.reply && c.customer_id) {
        const link = match[1] === 'reels' ? `/stores/?v=reels&r=${item.id}&cm=reels:${item.id}` : `/stores/?p=${item.id}&cm=products:${item.id}`;
        await addNote(db, c.customer_id, `💬 ${merchant.name} رد على تعليقك: ${reply.slice(0, 80)}`, link, match[1] === 'products' ? item.id : null);
      }
      await audit(db, user, 'comment_replied', { kind: match[1], id: item.id, comment: c.id });
      return json({ ok: true, reply, reply_at: reply ? now() : null });
    }
    if (match[3] && m === 'DELETE') {
      const c = await db.prepare(`SELECT * FROM ${K.table} WHERE id=? AND ${K.fk}=?`).bind(Number(match[3]), item.id).first();
      if (!c) fail(404, 'ما لقينا التعليق');
      await db.batch([
        db.prepare(`DELETE FROM ${K.table} WHERE id=?`).bind(c.id),
        db.prepare(`UPDATE ${K.target} SET comments=MAX(0,comments-?),rating_sum=rating_sum-?,rating_n=MAX(0,rating_n-?) WHERE id=?`).bind(c.body ? 1 : 0, c.rating || 0, c.rating ? 1 : 0, item.id),
      ]);
      await audit(db, user, 'comment_deleted', { kind: match[1], id: item.id, name: c.name });
      return json({ ok: true });
    }
    fail(405, 'غير مسموح');
  }
  if ((match = path.match(/^\/api\/m\/store\/reels\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const reel = await db.prepare('SELECT * FROM reels WHERE id=? AND merchant_id=?').bind(Number(match[1]), mid).first();
    if (!reel) fail(404, 'ما لقينا الريل');
    if (m === 'DELETE') {
      await deleteReelFiles(env, reel);
      await db.batch([db.prepare('DELETE FROM reel_comments WHERE reel_id=?').bind(reel.id), db.prepare('DELETE FROM reels WHERE id=?').bind(reel.id)]);
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
    if ('publish_at' in b) f.publish_at = publishAt(b.publish_at);
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db.prepare(`UPDATE reels SET ${keys.map((k) => k + '=?').join(',')} WHERE id=? RETURNING *`).bind(...keys.map((k) => f[k]), reel.id).first();
    return json({ ok: true, reel: reelOut(row) });
  }

  fail(404, 'المسار غير موجود');
}

// ================= الواجهة العامة =================
const LIVE = "m.store_enabled=1 AND m.status='active'";
// الريل يظهر لو منشور، وما أوقفته الإدارة، وجا وقت نشره
const REEL_LIVE = "r.status='active' AND r.admin_blocked=0 AND (r.publish_at IS NULL OR r.publish_at<=CAST(strftime('%s','now') AS INTEGER))";
const PRODUCT_COLS = 'p.id,p.comments,p.rating_sum,p.rating_n,p.title,p.description,p.category,p.price,p.old_price,p.buy_url,p.image_key,p.created_at,p.merchant_id,m.name AS merchant_name,m.slug AS merchant_slug,m.logo_key AS merchant_logo,m.store_coupon,m.store_coupon_note';

function publicProduct(p) {
  const { merchant_logo, store_coupon, store_coupon_note, rating_sum, rating_n, ...rest } = productOut(p);
  const rating = rating_n ? { avg: Math.round((rating_sum / rating_n) * 10) / 10, n: rating_n } : null;
  // منتج بدون رابط سلة: الشراء من متجر التاجر الخاص في أصالة
  if (!rest.buy_url) rest.buy_url = `/s/${rest.merchant_slug}/p/${rest.id}`;
  return { ...rest, rating, merchant_logo: imageUrl(merchant_logo), coupon: store_coupon ? { code: store_coupon, note: store_coupon_note } : null };
}

const PRODUCT_SORT = {
  cheap: 'p.price IS NULL, p.price ASC, p.id DESC',
  popular: 'p.views + p.clicks * 4 DESC, p.id DESC',
  discount: '(p.old_price > p.price) DESC, (p.old_price - p.price) * 1.0 / p.old_price DESC, p.id DESC',
};

async function listProducts(db, { cat, merchant, q, ids, sort, max, limit = 60, offset = 0 }) {
  const where = [LIVE, "p.status='active' AND p.admin_blocked=0"];
  const args = [];
  if (ids?.length) { where.push(`p.id IN (${ids.map(() => '?').join(',')})`); args.push(...ids); }
  if (cat && CATEGORIES[cat]) { where.push('p.category=?'); args.push(cat); }
  if (merchant) { where.push('m.slug=?'); args.push(merchant); }
  if (max > 0) { where.push('p.price IS NOT NULL AND p.price<=?'); args.push(Math.round(max * 100)); }
  if (q) {
    for (const w of q.split(/\s+/).filter((x) => x.length > 1).slice(0, 4)) {
      where.push('(p.title LIKE ? OR p.description LIKE ? OR m.name LIKE ?)');
      const like = '%' + w.replace(/[%_]/g, '') + '%';
      args.push(like, like, like);
    }
  }
  const r = await db
    .prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${where.join(' AND ')} ORDER BY ${PRODUCT_SORT[sort] || 'p.id DESC'} LIMIT ? OFFSET ?`)
    .bind(...args, limit, offset)
    .all();
  return r.results.map(publicProduct);
}

async function reelComments(db, reelId) {
  const r = await db.prepare('SELECT id,name,body,rating,created_at FROM reel_comments WHERE reel_id=? ORDER BY id DESC LIMIT 100').bind(reelId).all();
  return r.results;
}

// تعليقات وتقييم الريلز والمنتجات. لو دخول Google مفعّل، التعليق لازم يكون من حساب مسجّل
const COMMENT_KINDS = {
  reels: { table: 'reel_comments', fk: 'reel_id', target: 'reels', alias: 'r', live: REEL_LIVE, voter: 'ip_hash' },
  products: { table: 'product_comments', fk: 'product_id', target: 'store_products', alias: 'p', live: "p.status='active' AND p.admin_blocked=0", voter: 'voter' },
};
async function publicComments(req, env, kind, id) {
  const db = env.DB;
  const K = COMMENT_KINDS[kind];
  const item = await db
    .prepare(`SELECT ${K.alias}.id,${K.alias}.rating_sum,${K.alias}.rating_n,${K.alias}.comments,m.name AS merchant_name FROM ${K.target} ${K.alias} JOIN merchants m ON m.id=${K.alias}.merchant_id WHERE ${K.alias}.id=? AND ${K.live} AND ${LIVE}`)
    .bind(id)
    .first();
  if (!item) fail(404, kind === 'reels' ? 'الريل غير متاح' : 'المنتج غير متاح');
  const login = googleEnabled(env);
  const me = await currentCustomer(db, req);
  if (req.method === 'GET') {
    const rating = item.rating_n ? { avg: Math.round((item.rating_sum / item.rating_n) * 10) / 10, n: item.rating_n } : null;
    const r = await db.prepare(`SELECT id,name,body,rating,reply,reply_at,created_at FROM ${K.table} WHERE ${K.fk}=? ORDER BY id DESC LIMIT 100`).bind(id).all();
    return json({ ok: true, comments: r.results, rating, count: item.comments, merchant: item.merchant_name, login, me: me ? { name: me.name, picture: me.picture } : null });
  }
  if (req.method !== 'POST') fail(405, 'غير مسموح');
  if (login && !me) fail(401, 'سجّل دخولك بحساب Google عشان تعلّق', 'login_required');
  const ip = await ipHash(req);
  await rateLimit(db, 'rc:' + (me ? 'c' + me.id : ip), 8, 600);
  const b = await readJson(req);
  const name = me ? me.name : str(b.name, 'اسمك', { min: 1, max: 30 });
  const body = str(b.body, 'التعليق', { min: 1, max: 300, optional: true });
  const rating = b.rating == null || b.rating === '' ? null : int(b.rating, 'التقييم', { min: 1, max: 5 });
  if (!body && !rating) fail(400, 'اكتب تعليق أو اختر تقييم');
  if (body && /https?:\/\/|www\.|\.com\b/i.test(body)) fail(400, 'الروابط ممنوعة في التعليقات');
  // تقييم واحد لكل حساب (أو لكل جهاز لو الدخول مو مفعّل)، لأن شبكات الجوال تشارك نفس الـ IP
  const who = me ? 'c' + me.id : typeof b.device === 'string' && /^[a-z0-9]{16,40}$/.test(b.device) ? await sha256('dev:' + b.device) : ip;
  if (rating && (await db.prepare(`SELECT 1 FROM ${K.table} WHERE ${K.fk}=? AND ${K.voter}=? AND rating IS NOT NULL`).bind(id, who).first())) fail(409, kind === 'reels' ? 'قيّمت هذا الريل من قبل' : 'قيّمت هذا المنتج من قبل');
  const t = now();
  const [ins] = await db.batch([
    db.prepare(`INSERT INTO ${K.table}(${K.fk},name,body,rating,${K.voter},customer_id,created_at) VALUES(?,?,?,?,?,?,?) RETURNING id`).bind(id, name, body, rating, who, me?.id ?? null, t),
    db.prepare(`UPDATE ${K.target} SET comments=comments+?,rating_sum=rating_sum+?,rating_n=rating_n+? WHERE id=?`).bind(body ? 1 : 0, rating || 0, rating ? 1 : 0, id),
  ]);
  return json({ ok: true, comment: { id: ins.results[0].id, name, body, rating, created_at: t } }, 201);
}

async function listReels(db, { merchant, product, sort, limit = 20, offset = 0 }) {
  const where = [LIVE, REEL_LIVE];
  const args = [];
  if (merchant) { where.push('m.slug=?'); args.push(merchant); }
  if (product) { where.push('r.product_id=?'); args.push(product); }
  const r = await db
    .prepare(
      `SELECT r.id,r.title,r.video_key,r.poster_key,r.duration,r.comments,r.rating_sum,r.rating_n,r.clip_mode,r.clip_start,r.clip_zoom,r.clip_x,r.clip_y,r.product_id,r.created_at,r.likes,r.views,m.name AS merchant_name,m.slug AS merchant_slug,m.logo_key AS merchant_logo,
              p.title AS product_title,p.price AS product_price,p.buy_url AS product_buy_url,p.image_key AS product_image
       FROM reels r JOIN merchants m ON m.id=r.merchant_id LEFT JOIN store_products p ON p.id=r.product_id AND p.status='active' AND p.admin_blocked=0
       WHERE ${where.join(' AND ')} ORDER BY ${sort === 'popular' ? 'r.views + r.likes * 5 DESC, r.id DESC' : 'r.id DESC'} LIMIT ? OFFSET ?`
    )
    .bind(...args, limit, offset)
    .all();
  return r.results.map(({ merchant_logo, product_price, product_image, ...x }) => ({
    ...reelOut(x),
    product_buy_url: x.product_id && !x.product_buy_url ? `/s/${x.merchant_slug}/p/${x.product_id}` : x.product_buy_url,
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
          `SELECT m.name,m.slug,m.logo_key,m.brand_color,(SELECT COUNT(*) FROM store_products p WHERE p.merchant_id=m.id AND p.status='active' AND p.admin_blocked=0) AS products
           FROM merchants m WHERE ${LIVE} ORDER BY m.store_since DESC, m.id DESC`
        )
        .all(),
      db.prepare(`SELECT p.category,COUNT(*) AS n FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.status='active' AND p.admin_blocked=0 GROUP BY p.category`).all(),
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
    // limit حتى 200 لصفحة التصفح واكتشف (الترتيب حسب الذوق يصير في الجهاز)
    const limit = ids.length ? 60 : Math.max(1, Math.min(200, Number(sp.get('limit')) || 40));
    const max = Math.min(1_000_000, Number(sp.get('max')) || 0);
    return json({ ok: true, products: await listProducts(db, { cat: sp.get('cat'), merchant: slug, q, ids, sort: sp.get('sort'), max, offset, limit }) });
  }
  // حالات التاجر: آخر منتجات نزلت عند كل متجر (آخر 14 يوم، أو آخر 4 لو ما نزّل جديد)
  if (path === '/api/public/store/stories' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id
         WHERE ${LIVE} AND p.status='active' AND p.admin_blocked=0 AND p.id IN (
           SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY id DESC) AS rn, created_at FROM store_products WHERE status='active')
           WHERE rn<=6 AND (rn<=4 OR created_at>?))
         ORDER BY p.created_at DESC`
      )
      .bind(now() - 14 * 86400)
      .all();
    const by = new Map();
    for (const row of r.results) {
      const x = publicProduct(row);
      if (!by.has(x.merchant_slug)) by.set(x.merchant_slug, { slug: x.merchant_slug, name: x.merchant_name, logo_url: x.merchant_logo, latest: x.created_at, items: [] });
      by.get(x.merchant_slug).items.push(x);
    }
    return json({ ok: true, stories: [...by.values()].slice(0, 30) });
  }
  if (path.startsWith('/api/public/store/family')) return handleFamily(req, db, path, m);
  let match;
  if ((match = path.match(/^\/api\/public\/store\/products\/(\d+)$/)) && m === 'GET') {
    const p = await db.prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=? AND ${LIVE} AND p.status='active' AND p.admin_blocked=0`).bind(Number(match[1])).first();
    if (!p) fail(404, 'المنتج غير متاح');
    const [more, reels] = await Promise.all([
      db
        .prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.status='active' AND p.admin_blocked=0 AND p.id<>? AND (p.merchant_id=? OR p.category=?) ORDER BY (p.merchant_id=?) DESC, p.id DESC LIMIT 8`)
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
  if ((match = path.match(/^\/api\/public\/store\/(reels|products)\/(\d+)\/comments$/))) return publicComments(req, env, match[1], Number(match[2]));
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
    const daily = DAILY[b.type];
    if (daily) {
      const [kind, v, c] = daily;
      await db.batch([
        db.prepare(sql).bind(id),
        db
          .prepare(
            `INSERT INTO store_daily(day,kind,item_id,merchant_id,views,clicks) SELECT ?,?,id,merchant_id,?,? FROM ${kind === 'p' ? 'store_products' : 'reels'} WHERE id=?
             ON CONFLICT(day,kind,item_id) DO UPDATE SET views=views+excluded.views,clicks=clicks+excluded.clicks`
          )
          .bind(riyadhDay(now()), kind, v, c, id),
      ]);
    } else await db.prepare(sql).bind(id).run();
    return json({ ok: true });
  }
  if (path === '/api/public/store/chat' && m === 'POST') {
    await rateLimit(db, 'storechat:' + (await ipHash(req)), 40, 3600);
    const b = await readJson(req, 1_500_000);
    const catalog = (
      await db
        .prepare(`SELECT p.id,p.title,p.category,p.price,p.old_price,p.rating_sum,p.rating_n,p.description,m.name AS merchant_name FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.status='active' AND p.admin_blocked=0 ORDER BY p.clicks DESC, p.id DESC LIMIT 250`)
        .all()
    ).results;
    const r = await storeChat(env, b.messages, catalog, b.lang === 'en' ? 'en' : 'ar', b.ctx || {}, b.image ?? null);
    let products = [];
    if (r.ids.length) {
      const rows = await db.prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id IN (${r.ids.map(() => '?').join(',')})`).bind(...r.ids).all();
      products = r.ids.map((id) => rows.results.find((x) => x.id === id)).filter(Boolean).map(publicProduct);
    }
    return json({ ok: true, reply: r.reply, products, why: r.why, chips: r.chips });
  }
  fail(404, 'المسار غير موجود');
}

// بعد التحقق من منتج أصلي: "اطلبه مرة ثانية" وريلز المنتج من متجر نفس التاجر
export async function shopForVerify(db, b) {
  const [linked, more] = await Promise.all([
    b.store_product_id
      ? db.prepare(`SELECT ${PRODUCT_COLS} FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=? AND p.merchant_id=? AND p.status='active' AND p.admin_blocked=0`).bind(b.store_product_id, b.merchant_id).first()
      : null,
    listProducts(db, { merchant: b.slug, sort: 'popular', limit: 12 }),
  ]);
  const product = linked ? publicProduct(linked) : null;
  let reels = product ? await listReels(db, { product: product.id, limit: 6 }) : [];
  if (!reels.length) reels = await listReels(db, { merchant: b.slug, sort: 'popular', limit: 6 });
  // منتجات ثانية من نفس التاجر: نفس فئة المنتج اللي معه أول، بعدها الأكثر طلباً
  const others = more
    .filter((p) => p.id !== product?.id)
    .sort((x, y) => (y.category === product?.category) - (x.category === product?.category))
    .slice(0, 8);
  if (!product && !others.length && !reels.length) return null;
  return { slug: b.slug, product, more: others, reels, coupon: b.store_coupon ? { code: b.store_coupon, note: b.store_coupon_note } : null };
}

// ================= سلة العائلة =================
// قائمة مشتركة برابط سري: كل واحد من العائلة يضيف اللي يبيه باسمه، واللي يشتري يعلّم عليه.
// الشراء نفسه من متجر التاجر (سلة)، فما فيه دفع هنا.
const FAMILY_MAX_ITEMS = 100;

async function familyOut(db, list) {
  const r = await db
    .prepare(
      `SELECT f.id AS item_id,f.who,f.qty,f.bought,f.created_at AS added_at,${PRODUCT_COLS}
       FROM family_items f JOIN store_products p ON p.id=f.product_id JOIN merchants m ON m.id=p.merchant_id
       WHERE f.list_id=? AND ${LIVE} AND p.status='active' AND p.admin_blocked=0 ORDER BY f.bought, f.id DESC`
    )
    .bind(list.id)
    .all();
  return {
    code: list.code,
    title: list.title,
    updated_at: list.updated_at,
    items: r.results.map(({ item_id, who, qty, bought, added_at, ...p }) => ({ id: item_id, who, qty, bought: !!bought, added_at, product: publicProduct(p) })),
  };
}

async function handleFamily(req, db, path, m) {
  if (path === '/api/public/store/family' && m === 'POST') {
    await rateLimit(db, 'famnew:' + (await ipHash(req)), 10, 3600);
    const b = await readJson(req);
    const title = str(b.title, 'اسم السلة', { max: 60, optional: true }) || 'سلة العائلة';
    const code = randomHex(6);
    const t = now();
    await db.prepare('INSERT INTO family_lists(code,title,created_at,updated_at) VALUES(?,?,?,?)').bind(code, title, t, t).run();
    return json({ ok: true, code }, 201);
  }
  const match = path.match(/^\/api\/public\/store\/family\/([a-f0-9]{12})(?:\/items(?:\/(\d+))?)?$/);
  if (!match) fail(404, 'المسار غير موجود');
  const list = await db.prepare('SELECT * FROM family_lists WHERE code=?').bind(match[1]).first();
  if (!list) fail(404, 'ما لقينا السلة، تأكد من الرابط');
  const items = path.includes('/items');
  const touch = () => db.prepare('UPDATE family_lists SET updated_at=? WHERE id=?').bind(now(), list.id).run();
  if (!items && m === 'GET') return json({ ok: true, list: await familyOut(db, list) });
  if (!items && m === 'PATCH') {
    const b = await readJson(req);
    const title = str(b.title, 'اسم السلة', { min: 1, max: 60 });
    await db.prepare('UPDATE family_lists SET title=?,updated_at=? WHERE id=?').bind(title, now(), list.id).run();
    return json({ ok: true, list: await familyOut(db, { ...list, title }) });
  }
  await rateLimit(db, 'famw:' + (await ipHash(req)), 120, 3600);
  if (items && !match[2] && m === 'POST') {
    const b = await readJson(req);
    const product_id = int(b.product_id, 'المنتج', { min: 1 });
    const who = str(b.who, 'اسمك', { min: 1, max: 30 });
    const qty = int(b.qty ?? 1, 'الكمية', { min: 1, max: 20 });
    const p = await db.prepare(`SELECT p.id FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=? AND ${LIVE} AND p.status='active' AND p.admin_blocked=0`).bind(product_id).first();
    if (!p) fail(404, 'المنتج غير متاح');
    const same = await db.prepare('SELECT id FROM family_items WHERE list_id=? AND product_id=? AND who=? AND bought=0').bind(list.id, product_id, who).first();
    if (same) await db.prepare('UPDATE family_items SET qty=MIN(20,qty+?) WHERE id=?').bind(qty, same.id).run();
    else {
      const n = await db.prepare('SELECT COUNT(*) AS n FROM family_items WHERE list_id=?').bind(list.id).first();
      if (n.n >= FAMILY_MAX_ITEMS) fail(400, 'السلة امتلت، احذف أغراض اشتريتوها');
      await db.prepare('INSERT INTO family_items(list_id,product_id,who,qty,created_at) VALUES(?,?,?,?,?)').bind(list.id, product_id, who, qty, now()).run();
    }
    await touch();
    return json({ ok: true, list: await familyOut(db, list) }, 201);
  }
  if (items && match[2] && (m === 'PATCH' || m === 'DELETE')) {
    const it = await db.prepare('SELECT id FROM family_items WHERE id=? AND list_id=?').bind(Number(match[2]), list.id).first();
    if (!it) fail(404, 'ما لقينا الغرض');
    if (m === 'DELETE') await db.prepare('DELETE FROM family_items WHERE id=?').bind(it.id).run();
    else {
      const b = await readJson(req);
      if ('bought' in b) await db.prepare('UPDATE family_items SET bought=? WHERE id=?').bind(b.bought ? 1 : 0, it.id).run();
      if ('qty' in b) await db.prepare('UPDATE family_items SET qty=? WHERE id=?').bind(int(b.qty, 'الكمية', { min: 1, max: 20 }), it.id).run();
    }
    await touch();
    return json({ ok: true, list: await familyOut(db, list) });
  }
  fail(404, 'المسار غير موجود');
}

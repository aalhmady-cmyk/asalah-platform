// اللوحة الأم: المدير العام يدير التجار والحسابات والدفعات وكل العلامات.
import { pushAlert } from '../lib/push.js';
import { handleAdminTrust } from './trust.js';
import { handleAdminGrowth } from './growth.js';
import { handleAdminSite } from './site.js';
import { hashPassword, requireUser, validPassword } from '../lib/auth.js';
import { createResetLink } from './auth.js';
import { adminPush } from './push.js';
import { deleteImage, imageUrl, saveImage } from '../lib/images.js';
import { hotspots, monthlyReport } from '../lib/insights.js';
import { lookupTag, overviewFor, setTagStatus } from '../lib/ops.js';
import { printLinks, publicId, stockFor, tokenFor } from '../lib/tags.js';
import { batchKeys, toHex } from '../lib/sun.js';
import { audit, csvResponse, fail, int, json, now, randomHex, readJson, str, url } from '../lib/util.js';
import { getBackup, listBackups, makeBackup } from '../lib/backup.js';

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const FACTORY_CHUNK = 10000;

function merchantFields(b, partial) {
  const f = {};
  const has = (k) => !partial || k in b;
  if (has('name')) f.name = str(b.name, 'اسم التاجر', { max: 100 });
  if (has('slug')) {
    f.slug = str(b.slug, 'الاسم المختصر', { min: 2, max: 40 }).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(f.slug)) fail(400, 'الاسم المختصر: أحرف إنجليزية صغيرة وأرقام و - فقط');
  }
  if (has('brand_color')) {
    f.brand_color = b.brand_color ?? '#0E6B4E';
    if (!COLOR_RE.test(f.brand_color)) fail(400, 'اللون لازم يكون بصيغة #RRGGBB');
  }
  if (has('logo_url')) f.logo_url = url(b.logo_url, 'الشعار');
  if (has('store_url')) f.store_url = url(b.store_url, 'المتجر');
  if (has('whatsapp')) f.whatsapp = str(b.whatsapp, 'الواتساب', { max: 20, optional: true });
  if (has('low_stock_threshold')) f.low_stock_threshold = int(b.low_stock_threshold ?? 5000, 'حد تنبيه المخزون', { max: 1000000 });
  if (has('max_checks')) f.max_checks = int(b.max_checks ?? 5, 'حد الفحوصات', { max: 100 });
  if (has('public_listed')) f.public_listed = b.public_listed ? 1 : 0;
  if (partial && 'store_enabled' in b) f.store_enabled = b.store_enabled ? 1 : 0;
  if (partial && 'verify_sound' in b) f.verify_sound = b.verify_sound ? 1 : 0;
  if (partial && 'status' in b) {
    if (!['active', 'suspended'].includes(b.status)) fail(400, 'الحالة غير معروفة');
    f.status = b.status;
  }
  return f;
}

async function listMerchants(db) {
  const rows = (await db.prepare('SELECT * FROM merchants ORDER BY id').all()).results;
  const since7 = now() - 7 * 86400;
  const scans = (await db.prepare('SELECT merchant_id,COUNT(*) AS n FROM scans WHERE created_at>=? AND merchant_id IS NOT NULL GROUP BY merchant_id').bind(since7).all()).results;
  const out = [];
  for (const m of rows) out.push({ ...m, stock: await stockFor(db, m.id), scans_7d: scans.find((s) => s.merchant_id === m.id)?.n ?? 0 });
  return out;
}

export async function handleAdmin(req, env, path) {
  const db = env.DB;
  const user = await requireUser(db, req, 'admin');
  const m = req.method;
  let match;
  const trust = (await handleAdminTrust(req, env, path, user)) || (await handleAdminGrowth(req, env, path, user)) || (await handleAdminSite(req, env, path, user));
  if (trust) return trust;
  if (path.startsWith('/api/admin/push')) {
    const r = await adminPush(req, db, path, user);
    if (r) return r;
  }

  if (path === '/api/admin/overview' && m === 'GET') {
    const [ov, merchants, alerts, unknown] = await Promise.all([
      overviewFor(db, null),
      listMerchants(db),
      db.prepare("SELECT a.*,m.name AS merchant_name FROM alerts a LEFT JOIN merchants m ON m.id=a.merchant_id WHERE a.kind NOT IN ('store_blocked','staff_password','weekly_summary','monthly_report','new_order','credits_added') AND NOT (a.kind='new_login' AND a.merchant_id IS NOT NULL) ORDER BY a.id DESC LIMIT 20").all(),
      db.prepare('SELECT u.preview,u.count,u.city,u.country,u.last_at,m.name AS merchant_name FROM unknown_codes u LEFT JOIN merchants m ON m.id=u.merchant_id ORDER BY u.last_at DESC LIMIT 20').all(),
    ]);
    const totals = merchants.reduce(
      (a, x) => ({ issued: a.issued + x.stock.issued, remaining: a.remaining + x.stock.remaining, active_merchants: a.active_merchants + (x.status === 'active' ? 1 : 0) }),
      { issued: 0, remaining: 0, active_merchants: 0 }
    );
    return json({ ok: true, overview: ov, totals, merchants, alerts: alerts.results, unknown: unknown.results });
  }

  // ---------- التقليد والتقارير ----------
  if (path === '/api/admin/hotspots' && m === 'GET') {
    const q = new URL(req.url).searchParams;
    const days = int(q.get('days') || 30, 'المدة', { min: 1, max: 365 });
    const mid = q.get('merchant') ? int(q.get('merchant'), 'التاجر') : null;
    return json({ ok: true, days, hotspots: await hotspots(db, mid, days) });
  }
  if (path === '/api/admin/report' && m === 'GET') {
    const q = new URL(req.url).searchParams;
    return json({ ok: true, report: await monthlyReport(db, int(q.get('merchant'), 'التاجر'), q.get('month')) });
  }

  // ---------- التجار ----------
  if (path === '/api/admin/merchants' && m === 'GET') return json({ ok: true, merchants: await listMerchants(db) });
  if (path === '/api/admin/merchants' && m === 'POST') {
    const f = merchantFields(await readJson(req), false);
    const dup = await db.prepare('SELECT id FROM merchants WHERE slug=?').bind(f.slug).first();
    if (dup) fail(409, 'الاسم المختصر مستخدم لتاجر ثاني');
    const row = await db
      .prepare('INSERT INTO merchants(slug,name,logo_url,brand_color,store_url,whatsapp,low_stock_threshold,max_checks,public_listed,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING *')
      .bind(f.slug, f.name, f.logo_url, f.brand_color, f.store_url, f.whatsapp, f.low_stock_threshold, f.max_checks, f.public_listed, now())
      .first();
    await audit(db, user, 'merchant_created', { slug: f.slug }, row.id);
    return json({ ok: true, merchant: row }, 201);
  }
  if ((match = path.match(/^\/api\/admin\/merchants\/(\d+)$/)) && m === 'PATCH') {
    const id = Number(match[1]);
    const f = merchantFields(await readJson(req), true);
    // أول تفعيل للمتجر يسجّل تاريخ الاشتراك
    if (f.store_enabled) f.store_since = (await db.prepare('SELECT store_since FROM merchants WHERE id=?').bind(id).first())?.store_since || now();
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db.prepare(`UPDATE merchants SET ${keys.map((k) => k + '=?').join(',')} WHERE id=? RETURNING *`).bind(...keys.map((k) => f[k]), id).first();
    if (!row) fail(404, 'ما لقينا التاجر');
    await audit(db, user, 'merchant_updated', f, id);
    return json({ ok: true, merchant: row });
  }

  // المدير العام يقدر يرفع شعار التاجر وصورة أي دفعة نيابة عنه
  if ((match = path.match(/^\/api\/admin\/merchants\/(\d+)\/logo$/)) && (m === 'POST' || m === 'DELETE')) {
    const id = Number(match[1]);
    const cur = await db.prepare('SELECT logo_key FROM merchants WHERE id=?').bind(id).first();
    if (!cur) fail(404, 'ما لقينا التاجر');
    const key = m === 'POST' ? await saveImage(env, req, 'logos', id) : null;
    await db.prepare('UPDATE merchants SET logo_key=? WHERE id=?').bind(key, id).run();
    await deleteImage(env, cur.logo_key);
    await audit(db, user, m === 'POST' ? 'logo_set' : 'logo_removed', null, id);
    return json({ ok: true, logo_url: imageUrl(key) });
  }

  // ---------- الحسابات ----------
  if (path === '/api/admin/users' && m === 'GET') {
    const r = await db.prepare('SELECT u.id,u.email,u.name,u.role,u.merchant_id,u.merchant_role,u.status,u.last_login_at,m.name AS merchant_name,m.whatsapp AS merchant_whatsapp FROM users u LEFT JOIN merchants m ON m.id=u.merchant_id ORDER BY u.id').all();
    return json({ ok: true, users: r.results });
  }
  if (path === '/api/admin/users' && m === 'POST') {
    const b = await readJson(req);
    const role = b.role === 'admin' ? 'admin' : 'merchant';
    const email = str(b.email, 'البريد', { max: 200 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'البريد غير صحيح');
    const merchantId = role === 'merchant' ? int(b.merchant_id, 'التاجر', { min: 1 }) : null;
    if (merchantId && !(await db.prepare('SELECT id FROM merchants WHERE id=?').bind(merchantId).first())) fail(404, 'ما لقينا التاجر');
    if (await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) fail(409, 'البريد مستخدم لحساب ثاني');
    const { hash, salt } = await hashPassword(validPassword(b.password));
    const row = await db
      .prepare('INSERT INTO users(email,name,role,merchant_id,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?,?) RETURNING id,email,name,role,merchant_id,status')
      .bind(email, str(b.name, 'الاسم', { max: 100 }), role, merchantId, hash, salt, now())
      .first();
    await audit(db, user, 'user_created', { email, role }, merchantId);
    return json({ ok: true, user: row }, 201);
  }
  if ((match = path.match(/^\/api\/admin\/users\/(\d+)$/)) && m === 'PATCH') {
    const id = Number(match[1]);
    const b = await readJson(req);
    const stmts = [];
    if ('status' in b) {
      if (!['active', 'disabled'].includes(b.status)) fail(400, 'الحالة غير معروفة');
      if (id === user.id && b.status !== 'active') fail(400, 'ما تقدر توقف حسابك');
      stmts.push(db.prepare('UPDATE users SET status=? WHERE id=?').bind(b.status, id));
    }
    if ('password' in b) {
      const { hash, salt } = await hashPassword(validPassword(b.password));
      stmts.push(db.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(hash, salt, id));
    }
    if (!stmts.length) fail(400, 'ما فيه تغييرات');
    stmts.push(db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));
    await db.batch(stmts);
    await audit(db, user, 'user_updated', { id, status: b.status, password_reset: 'password' in b });
    return json({ ok: true });
  }

  // رابط إعادة كلمة المرور لمرة وحدة (24 ساعة). الإدارة ترسله لصاحبه على واتساب
  if ((match = path.match(/^\/api\/admin\/users\/(\d+)\/reset-link$/)) && m === 'POST') {
    const target = await db.prepare('SELECT id,email,name,merchant_id FROM users WHERE id=?').bind(Number(match[1])).first();
    if (!target) fail(404, 'ما لقينا الحساب');
    const link = await createResetLink(db, req, target, user);
    await db.prepare("UPDATE alerts SET read_at=? WHERE kind='password_request' AND read_at IS NULL AND message LIKE ?").bind(now(), '%(' + target.email + ')%').run();
    await audit(db, user, 'reset_link_created', { id: target.id, email: target.email }, target.merchant_id);
    return json({ ok: true, link, expires_in_hours: 24 });
  }

  // ---------- المتاجر: كل منتجات وريلز وتعليقات التجار، والإدارة توقف المخالف ----------
  if (path.startsWith('/api/admin/store')) return adminStore(req, env, path, user);

  // ---------- الدفعات ----------
  if (path === '/api/admin/batches' && m === 'GET') {
    const r = await db.prepare('SELECT b.id,b.code,b.size,b.status,b.is_test,b.kind,b.product_name,b.produced_on,b.created_at,b.activated_at,b.merchant_id,b.image_key,m.name AS merchant_name FROM batches b JOIN merchants m ON m.id=b.merchant_id ORDER BY b.id DESC').all();
    return json({ ok: true, batches: r.results.map(({ image_key, ...b }) => ({ ...b, image_url: imageUrl(image_key) })) });
  }
  if (path === '/api/admin/batches' && m === 'POST') {
    const b = await readJson(req);
    const merchantId = int(b.merchant_id, 'التاجر', { min: 1 });
    if (!(await db.prepare('SELECT id FROM merchants WHERE id=?').bind(merchantId).first())) fail(404, 'ما لقينا التاجر');
    const code = str(b.code, 'رمز الدفعة', { min: 2, max: 16 }).toUpperCase();
    if (!/^[A-Z0-9]+$/.test(code)) fail(400, 'رمز الدفعة: أحرف إنجليزية وأرقام فقط، مثل GK2610');
    if (await db.prepare('SELECT id FROM batches WHERE code=?').bind(code).first()) fail(409, 'رمز الدفعة مستخدم مسبقاً');
    const kind = ['qr', 'nfc424'].includes(b.kind) ? b.kind : 'nfc';
    const size = int(b.size, 'عدد العلامات', { min: 1, max: kind === 'qr' ? 20000 : 1000000 });
    const produced = str(b.produced_on, 'تاريخ الإنتاج', { max: 20, optional: true });
    if (produced && !/^\d{4}-\d{2}(-\d{2})?$/.test(produced)) fail(400, 'تاريخ الإنتاج بصيغة 2026-10 أو 2026-10-15');
    const row = await db
      .prepare('INSERT INTO batches(merchant_id,code,size,salt,status,is_test,product_name,produced_on,created_by,created_at,kind) VALUES(?,?,?,?,?,?,?,?,?,?,?) RETURNING id,code,size,status,is_test,merchant_id,kind')
      .bind(merchantId, code, size, randomHex(8), 'pending', b.is_test ? 1 : 0, str(b.product_name, 'اسم المنتج', { max: 100, optional: true }), produced, user.id, now(), kind)
      .first();
    await audit(db, user, 'batch_created', { code, size }, merchantId);
    return json({ ok: true, batch: row }, 201);
  }
  if ((match = path.match(/^\/api\/admin\/batches\/(\d+)$/)) && m === 'PATCH') {
    const id = Number(match[1]);
    const b = await readJson(req);
    if (!['active', 'blocked'].includes(b.status)) fail(400, 'الحالة لازم تكون active أو blocked');
    const row = await db
      .prepare('UPDATE batches SET status=?,activated_at=CASE WHEN ?=\'active\' THEN COALESCE(activated_at,?) ELSE activated_at END WHERE id=? RETURNING id,code,status,merchant_id')
      .bind(b.status, b.status, now(), id)
      .first();
    if (!row) fail(404, 'ما لقينا الدفعة');
    await audit(db, user, 'batch_' + b.status, { code: row.code }, row.merchant_id);
    return json({ ok: true, batch: row });
  }
  if ((match = path.match(/^\/api\/admin\/batches\/(\d+)\/image$/)) && (m === 'POST' || m === 'DELETE')) {
    const batch = await db.prepare('SELECT id,code,merchant_id,image_key FROM batches WHERE id=?').bind(Number(match[1])).first();
    if (!batch) fail(404, 'ما لقينا الدفعة');
    const key = m === 'POST' ? await saveImage(env, req, 'products', batch.merchant_id) : null;
    await db.prepare('UPDATE batches SET image_key=? WHERE id=?').bind(key, batch.id).run();
    await deleteImage(env, batch.image_key);
    await audit(db, user, m === 'POST' ? 'product_image_set' : 'product_image_removed', { batch: batch.code }, batch.merchant_id);
    return json({ ok: true, image_url: imageUrl(key) });
  }
  // ملف المصنع: رابط لكل علامة. يتولّد من التوقيع، فينزل كامل أو على أجزاء في أي وقت.
  if ((match = path.match(/^\/api\/admin\/batches\/(\d+)\/factory\.csv$/)) && m === 'GET') {
    const batch = await db.prepare('SELECT * FROM batches WHERE id=?').bind(Number(match[1])).first();
    if (!batch) fail(404, 'ما لقينا الدفعة');
    const q = new URL(req.url).searchParams;
    const from = int(q.get('from') ?? '1', 'بداية النطاق', { min: 1, max: batch.size });
    const to = int(q.get('to') ?? String(Math.min(batch.size, from + FACTORY_CHUNK - 1)), 'نهاية النطاق', { min: from, max: batch.size });
    if (to - from + 1 > FACTORY_CHUNK) fail(400, `أقصى ${FACTORY_CHUNK} علامة في الملف الواحد`);
    const origin = env.VERIFY_ORIGIN || new URL(req.url).origin;
    const rows = [];
    // شرائح 424: الرابط فيه أماكن فاضية تعبّيها الشريحة بنفسها مع كل لمسة (e = 32 خانة، c = 16 خانة)
    const sun = batch.kind === 'nfc424' ? `&e=${'0'.repeat(32)}&c=${'0'.repeat(16)}` : '';
    for (let s = from; s <= to; s++) rows.push({ serial: s, public_id: publicId(batch, s), url: `${origin}/v/?t=${await tokenFor(env, batch, s)}${sun}` });
    await audit(db, user, 'factory_file_downloaded', { code: batch.code, from, to }, batch.merchant_id);
    return csvResponse(rows, ['serial', 'public_id', 'url'], `${batch.code}-${from}-${to}.csv`);
  }

  // مفاتيح برمجة شرائح 424 DNA للمصنع (لكل دفعة). تنعرض للمدير بس وتنسجل في السجل
  if ((match = path.match(/^\/api\/admin\/batches\/(\d+)\/sun-keys$/)) && m === 'GET') {
    const batch = await db.prepare('SELECT id,code,salt,kind,merchant_id FROM batches WHERE id=?').bind(Number(match[1])).first();
    if (!batch) fail(404, 'ما لقينا الدفعة');
    if (batch.kind !== 'nfc424') fail(400, 'هذي الدفعة مو شرائح 424 DNA');
    const k = await batchKeys(env, batch);
    await audit(db, user, 'sun_keys_viewed', { code: batch.code }, batch.merchant_id);
    return json({ ok: true, meta_key: toHex(k.meta), file_key: toHex(k.file) });
  }

  // روابط جاهزة للطباعة كـ QR (أي دفعة، للمدير)
  if ((match = path.match(/^\/api\/admin\/batches\/(\d+)\/links$/)) && m === 'GET') {
    const batch = await db.prepare('SELECT * FROM batches WHERE id=?').bind(Number(match[1])).first();
    if (!batch) fail(404, 'ما لقينا الدفعة');
    const out = await printLinks(env, req, batch);
    await audit(db, user, 'qr_printed', { code: batch.code, from: out.from, to: out.to }, batch.merchant_id);
    return json(out);
  }

  // ---------- العلامات ----------
  if (path === '/api/admin/tags/lookup' && m === 'GET') {
    return json({ ok: true, tag: await lookupTag(env, db, new URL(req.url).searchParams.get('q'), null) });
  }
  if (path === '/api/admin/tags/status' && m === 'POST') {
    const b = await readJson(req);
    const r = await setTagStatus(db, { batchCode: b.batch_code, from: b.from, to: b.to ?? b.from, action: b.action }, null);
    await audit(db, user, 'tags_' + b.action, { batch: r.batch.code, from: b.from, to: b.to ?? b.from, changes: r.changes }, r.batch.merchant_id);
    return json({ ok: true, changes: r.changes, from: r.from, to: r.to });
  }

  // ---------- التنبيهات والسجل ----------
  if (path === '/api/admin/alerts' && m === 'GET') {
    const r = await db.prepare("SELECT a.id,a.kind,a.message,a.created_at,a.read_at,m.name AS merchant_name FROM alerts a LEFT JOIN merchants m ON m.id=a.merchant_id WHERE a.kind NOT IN ('store_blocked','staff_password','weekly_summary','monthly_report','new_order','credits_added') AND NOT (a.kind='new_login' AND a.merchant_id IS NOT NULL) ORDER BY a.id DESC LIMIT 40").all();
    return json({ ok: true, alerts: r.results, unread: r.results.filter((a) => !a.read_at).length });
  }
  if (path === '/api/admin/alerts/read' && m === 'POST') {
    await db.prepare('UPDATE alerts SET read_at=? WHERE read_at IS NULL').bind(now()).run();
    return json({ ok: true });
  }
  // النسخ الاحتياطية: القائمة، نسخة الحين، والتحميل
  if (path === '/api/admin/backups' && m === 'GET') return json({ ok: true, backups: await listBackups(env) });
  if (path === '/api/admin/backups' && m === 'POST') {
    const b = await makeBackup(env);
    await audit(db, user, 'backup_created', b.name);
    return json({ ok: true, backup: b, message: 'تم أخذ نسخة احتياطية' });
  }
  if ((match = path.match(/^\/api\/admin\/backups\/([A-Za-z0-9.-]+)$/)) && m === 'GET') {
    const obj = await getBackup(env, match[1]);
    if (!obj) fail(404, 'النسخة غير موجودة');
    await audit(db, user, 'backup_downloaded', match[1]);
    return new Response(obj.body, { headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${match[1]}"`, 'Cache-Control': 'no-store' } });
  }
  if (path === '/api/admin/audit' && m === 'GET') {
    const r = await db.prepare('SELECT a.*,u.email FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200').all();
    return json({ ok: true, audit: r.results });
  }
  if (path === '/api/admin/reports' && m === 'GET') {
    const r = await db.prepare('SELECT r.id,r.reason,r.city,r.point_of_sale,r.phone,r.note,r.created_at,r.photo_key,r.ai_verdict,r.ai_score,m.name AS merchant_name FROM reports r LEFT JOIN merchants m ON m.id=r.merchant_id ORDER BY r.id DESC LIMIT 200').all();
    return json({ ok: true, reports: r.results });
  }
  fail(404, 'المسار غير موجود');
}

const STORE_KINDS = {
  products: { table: 'store_products', ctable: 'product_comments', fk: 'product_id' },
  reels: { table: 'reels', ctable: 'reel_comments', fk: 'reel_id' },
};

async function adminStore(req, env, path, user) {
  const db = env.DB;
  const m = req.method;
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').trim().slice(0, 60);
  const mid = sp.get('merchant') ? int(sp.get('merchant'), 'التاجر') : null;
  const like = '%' + q.replace(/[%_]/g, '') + '%';
  let match;

  if (path === '/api/admin/store' && m === 'GET') {
    const since = now() - 7 * 86400;
    const [sum, merchants] = await Promise.all([
      db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM merchants WHERE store_enabled=1) AS stores,
                  (SELECT COUNT(*) FROM store_products WHERE status='active') AS products,
                  (SELECT COUNT(*) FROM reels WHERE status='active') AS reels,
                  (SELECT COUNT(*) FROM store_products WHERE admin_blocked=1) + (SELECT COUNT(*) FROM reels WHERE admin_blocked=1) AS blocked,
                  (SELECT COUNT(*) FROM product_comments WHERE created_at>=?) + (SELECT COUNT(*) FROM reel_comments WHERE created_at>=?) AS comments_7d,
                  (SELECT COALESCE(SUM(clicks),0) FROM store_daily WHERE day>=date(?, 'unixepoch')) AS clicks_7d`
        )
        .bind(since, since, since + 10800)
        .first(),
      db.prepare('SELECT id,name FROM merchants WHERE store_enabled=1 ORDER BY name').all(),
    ]);
    return json({ ok: true, summary: sum, merchants: merchants.results });
  }
  if (path === '/api/admin/store/products' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT p.id,p.title,p.category,p.price,p.status,p.admin_blocked,p.image_key,p.views,p.clicks,p.comments,p.rating_sum,p.rating_n,p.buy_url,p.created_at,m.id AS merchant_id,m.name AS merchant_name
         FROM store_products p JOIN merchants m ON m.id=p.merchant_id
         WHERE (?='' OR p.title LIKE ? OR m.name LIKE ?) AND (? IS NULL OR p.merchant_id=?) AND (?='' OR p.admin_blocked=1)
         ORDER BY p.admin_blocked DESC, p.id DESC LIMIT 100`
      )
      .bind(q, like, like, mid, mid, sp.get('blocked') ? '1' : '')
      .all();
    return json({ ok: true, products: r.results.map(({ image_key, price, ...x }) => ({ ...x, price: price == null ? null : price / 100, image_url: imageUrl(image_key) })) });
  }
  if (path === '/api/admin/store/reels' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT r.id,r.title,r.status,r.admin_blocked,r.publish_at,r.poster_key,r.video_key,r.views,r.clicks,r.likes,r.comments,r.created_at,m.id AS merchant_id,m.name AS merchant_name
         FROM reels r JOIN merchants m ON m.id=r.merchant_id
         WHERE r.status<>'uploading' AND (?='' OR r.title LIKE ? OR m.name LIKE ?) AND (? IS NULL OR r.merchant_id=?) AND (?='' OR r.admin_blocked=1)
         ORDER BY r.admin_blocked DESC, r.id DESC LIMIT 100`
      )
      .bind(q, like, like, mid, mid, sp.get('blocked') ? '1' : '')
      .all();
    return json({ ok: true, reels: r.results.map(({ poster_key, video_key, ...x }) => ({ ...x, poster_url: imageUrl(poster_key), video_url: video_key ? '/media/' + video_key : null })) });
  }
  // آخر التعليقات من كل المتاجر
  if (path === '/api/admin/store/comments' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT * FROM (
           SELECT 'products' AS kind,c.id,c.name,c.body,c.rating,c.reply,c.created_at,p.id AS item_id,p.title,m.name AS merchant_name,m.id AS merchant_id
           FROM product_comments c JOIN store_products p ON p.id=c.product_id JOIN merchants m ON m.id=p.merchant_id
           UNION ALL
           SELECT 'reels',c.id,c.name,c.body,c.rating,c.reply,c.created_at,r.id,r.title,m.name,m.id
           FROM reel_comments c JOIN reels r ON r.id=c.reel_id JOIN merchants m ON m.id=r.merchant_id)
         WHERE (?='' OR body LIKE ? OR name LIKE ? OR title LIKE ?) AND (? IS NULL OR merchant_id=?)
         ORDER BY created_at DESC LIMIT 150`
      )
      .bind(q, like, like, like, mid, mid)
      .all();
    return json({ ok: true, comments: r.results });
  }
  if ((match = path.match(/^\/api\/admin\/store\/(products|reels)\/(\d+)\/block$/)) && m === 'POST') {
    const K = STORE_KINDS[match[1]];
    const b = await readJson(req);
    const row = await db.prepare(`UPDATE ${K.table} SET admin_blocked=? WHERE id=? RETURNING id,title,merchant_id`).bind(b.blocked ? 1 : 0, Number(match[2])).first();
    if (!row) fail(404, 'ما لقيناه');
    const what = match[1] === 'products' ? 'المنتج' : 'الريل';
    if (b.blocked) {
      const reason = str(b.reason, 'السبب', { max: 200, optional: true });
      const bm = `🚫 إدارة أصالة أوقفت ${what} «${row.title}»${reason ? ': ' + reason : ''}`;
      await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'store_blocked',?,?)").bind(row.merchant_id, bm, now()).run();
      await pushAlert(db, row.merchant_id, 'store_blocked', bm);
    }
    await audit(db, user, b.blocked ? 'store_item_blocked' : 'store_item_unblocked', { kind: match[1], id: row.id, title: row.title }, row.merchant_id);
    return json({ ok: true, blocked: !!b.blocked });
  }
  if ((match = path.match(/^\/api\/admin\/store\/(products|reels)\/(\d+)\/comments\/(\d+)$/)) && m === 'DELETE') {
    const K = STORE_KINDS[match[1]];
    const c = await db.prepare(`SELECT * FROM ${K.ctable} WHERE id=? AND ${K.fk}=?`).bind(Number(match[3]), Number(match[2])).first();
    if (!c) fail(404, 'ما لقينا التعليق');
    await db.batch([
      db.prepare(`DELETE FROM ${K.ctable} WHERE id=?`).bind(c.id),
      db.prepare(`UPDATE ${K.table} SET comments=MAX(0,comments-?),rating_sum=rating_sum-?,rating_n=MAX(0,rating_n-?) WHERE id=?`).bind(c.body ? 1 : 0, c.rating || 0, c.rating ? 1 : 0, c[K.fk]),
    ]);
    await audit(db, user, 'store_comment_deleted', { kind: match[1], id: c[K.fk], name: c.name });
    return json({ ok: true });
  }
  fail(404, 'المسار غير موجود');
}

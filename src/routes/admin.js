// اللوحة الأم: المدير العام يدير التجار والحسابات والدفعات وكل العلامات.
import { hashPassword, requireUser, validPassword } from '../lib/auth.js';
import { lookupTag, overviewFor, setTagStatus } from '../lib/ops.js';
import { publicId, stockFor, tokenFor } from '../lib/tags.js';
import { audit, csvResponse, fail, int, json, now, randomHex, readJson, str, url } from '../lib/util.js';

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

  if (path === '/api/admin/overview' && m === 'GET') {
    const [ov, merchants, alerts, unknown] = await Promise.all([
      overviewFor(db, null),
      listMerchants(db),
      db.prepare('SELECT a.*,m.name AS merchant_name FROM alerts a LEFT JOIN merchants m ON m.id=a.merchant_id ORDER BY a.id DESC LIMIT 20').all(),
      db.prepare('SELECT u.preview,u.count,u.city,u.country,u.last_at,m.name AS merchant_name FROM unknown_codes u LEFT JOIN merchants m ON m.id=u.merchant_id ORDER BY u.last_at DESC LIMIT 20').all(),
    ]);
    const totals = merchants.reduce(
      (a, x) => ({ issued: a.issued + x.stock.issued, remaining: a.remaining + x.stock.remaining, active_merchants: a.active_merchants + (x.status === 'active' ? 1 : 0) }),
      { issued: 0, remaining: 0, active_merchants: 0 }
    );
    return json({ ok: true, overview: ov, totals, merchants, alerts: alerts.results, unknown: unknown.results });
  }

  // ---------- التجار ----------
  if (path === '/api/admin/merchants' && m === 'GET') return json({ ok: true, merchants: await listMerchants(db) });
  if (path === '/api/admin/merchants' && m === 'POST') {
    const f = merchantFields(await readJson(req), false);
    const dup = await db.prepare('SELECT id FROM merchants WHERE slug=?').bind(f.slug).first();
    if (dup) fail(409, 'الاسم المختصر مستخدم لتاجر ثاني');
    const row = await db
      .prepare('INSERT INTO merchants(slug,name,logo_url,brand_color,store_url,whatsapp,low_stock_threshold,max_checks,created_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING *')
      .bind(f.slug, f.name, f.logo_url, f.brand_color, f.store_url, f.whatsapp, f.low_stock_threshold, f.max_checks, now())
      .first();
    await audit(db, user, 'merchant_created', { slug: f.slug }, row.id);
    return json({ ok: true, merchant: row }, 201);
  }
  if ((match = path.match(/^\/api\/admin\/merchants\/(\d+)$/)) && m === 'PATCH') {
    const id = Number(match[1]);
    const f = merchantFields(await readJson(req), true);
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db.prepare(`UPDATE merchants SET ${keys.map((k) => k + '=?').join(',')} WHERE id=? RETURNING *`).bind(...keys.map((k) => f[k]), id).first();
    if (!row) fail(404, 'ما لقينا التاجر');
    await audit(db, user, 'merchant_updated', f, id);
    return json({ ok: true, merchant: row });
  }

  // ---------- الحسابات ----------
  if (path === '/api/admin/users' && m === 'GET') {
    const r = await db.prepare('SELECT u.id,u.email,u.name,u.role,u.merchant_id,u.status,u.last_login_at,m.name AS merchant_name FROM users u LEFT JOIN merchants m ON m.id=u.merchant_id ORDER BY u.id').all();
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

  // ---------- الدفعات ----------
  if (path === '/api/admin/batches' && m === 'GET') {
    const r = await db.prepare('SELECT b.id,b.code,b.size,b.status,b.is_test,b.product_name,b.produced_on,b.created_at,b.activated_at,b.merchant_id,m.name AS merchant_name FROM batches b JOIN merchants m ON m.id=b.merchant_id ORDER BY b.id DESC').all();
    return json({ ok: true, batches: r.results });
  }
  if (path === '/api/admin/batches' && m === 'POST') {
    const b = await readJson(req);
    const merchantId = int(b.merchant_id, 'التاجر', { min: 1 });
    if (!(await db.prepare('SELECT id FROM merchants WHERE id=?').bind(merchantId).first())) fail(404, 'ما لقينا التاجر');
    const code = str(b.code, 'رمز الدفعة', { min: 2, max: 16 }).toUpperCase();
    if (!/^[A-Z0-9]+$/.test(code)) fail(400, 'رمز الدفعة: أحرف إنجليزية وأرقام فقط، مثل GK2610');
    if (await db.prepare('SELECT id FROM batches WHERE code=?').bind(code).first()) fail(409, 'رمز الدفعة مستخدم مسبقاً');
    const size = int(b.size, 'عدد العلامات', { min: 1, max: 1000000 });
    const produced = str(b.produced_on, 'تاريخ الإنتاج', { max: 20, optional: true });
    if (produced && !/^\d{4}-\d{2}(-\d{2})?$/.test(produced)) fail(400, 'تاريخ الإنتاج بصيغة 2026-10 أو 2026-10-15');
    const row = await db
      .prepare('INSERT INTO batches(merchant_id,code,size,salt,status,is_test,product_name,produced_on,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id,code,size,status,is_test,merchant_id')
      .bind(merchantId, code, size, randomHex(8), 'pending', b.is_test ? 1 : 0, str(b.product_name, 'اسم المنتج', { max: 100, optional: true }), produced, user.id, now())
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
    for (let s = from; s <= to; s++) rows.push({ serial: s, public_id: publicId(batch, s), url: `${origin}/v?t=${await tokenFor(env, batch, s)}` });
    await audit(db, user, 'factory_file_downloaded', { code: batch.code, from, to }, batch.merchant_id);
    return csvResponse(rows, ['serial', 'public_id', 'url'], `${batch.code}-${from}-${to}.csv`);
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
  if (path === '/api/admin/alerts/read' && m === 'POST') {
    await db.prepare('UPDATE alerts SET read_at=? WHERE read_at IS NULL').bind(now()).run();
    return json({ ok: true });
  }
  if (path === '/api/admin/audit' && m === 'GET') {
    const r = await db.prepare('SELECT a.*,u.email FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200').all();
    return json({ ok: true, audit: r.results });
  }
  if (path === '/api/admin/reports' && m === 'GET') {
    const r = await db.prepare('SELECT r.id,r.reason,r.city,r.point_of_sale,r.phone,r.note,r.created_at,m.name AS merchant_name FROM reports r LEFT JOIN merchants m ON m.id=r.merchant_id ORDER BY r.id DESC LIMIT 200').all();
    return json({ ok: true, reports: r.results });
  }
  fail(404, 'المسار غير موجود');
}

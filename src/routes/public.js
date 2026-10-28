// المسارات العامة: التحقق من العلامة، المشاركة في المسابقة، بلاغ التقليد.
import { imageUrl } from '../lib/images.js';
import { checkSignature, parseToken, publicId } from '../lib/tags.js';
import { fail, geo, ipHash, json, now, rateLimit, readJson, saPhone, sha256, str } from '../lib/util.js';

const SECOND_DEVICE_SECONDS = 600; // جهاز ثانٍ مسموح خلال 10 دقائق من أول فحص (مثل الانتقال من سناب إلى سفاري)
const SID_RE = /^[a-f0-9]{64}$/;

const MESSAGES = {
  original: 'تم التحقق: المنتج أصلي',
  unknown: 'هذي العلامة غير مسجلة عندنا. لا تستخدم المنتج قبل ما تتأكد من البائع.',
  blocked: 'هذي العلامة موقوفة. قد يكون المنتج مقلّداً، تأكد من البائع.',
  not_activated: 'هذي العلامة لم تُفعَّل بعد. تأكد من البائع قبل استخدام المنتج.',
  locked: 'تجاوزت هذي العلامة عدد مرات التحقق المسموح، وتم إيقافها. قد يكون المنتج مقلّداً.',
  other_device: 'تم التحقق من هذي العلامة من جهاز آخر. أكمل من الجهاز اللي مسحتها فيه أول مرة.',
};

function brand(m) {
  return m ? { name: m.name, logo_url: imageUrl(m.logo_key) || m.logo_url, brand_color: m.brand_color, store_url: m.store_url, whatsapp: m.whatsapp } : null;
}

async function logScan(db, req, tagId, merchantId, result, checkNo) {
  const g = geo(req);
  await db
    .prepare('INSERT INTO scans(tag_id,merchant_id,result,check_no,country,city,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(tagId, merchantId, result, checkNo ?? null, g.country, g.city, now())
    .run();
}

async function logUnknown(db, req, raw, merchantId) {
  const g = geo(req), t = now();
  const code = typeof raw === 'string' ? raw.trim().slice(0, 200) : '';
  await db
    .prepare(
      `INSERT INTO unknown_codes(code_hash,preview,merchant_id,count,country,city,first_at,last_at) VALUES(?,?,?,1,?,?,?,?)
       ON CONFLICT(code_hash) DO UPDATE SET count=count+1,country=excluded.country,city=excluded.city,last_at=excluded.last_at`
    )
    .bind(await sha256('code:' + code), code.slice(0, 8) || '(فارغ)', merchantId, g.country, g.city, t, t)
    .run();
  await logScan(db, req, null, merchantId, 'unknown', null);
}

// يحدد العلامة ودفعتها وتاجرها من الرابط، أو يرجع سبب الرفض
async function resolve(env, db, raw) {
  const p = parseToken(raw);
  if (!p) return { state: 'unknown' };
  const b = await db
    .prepare(
      `SELECT b.id,b.code,b.size,b.salt,b.status,b.is_test,b.product_name,b.produced_on,b.merchant_id,b.image_key,
              m.name,m.logo_url,m.logo_key,m.brand_color,m.store_url,m.whatsapp,m.status AS merchant_status,m.max_checks,
              m.contest_enabled,m.contest_title,m.contest_ends_at,m.contest_terms_url
       FROM batches b JOIN merchants m ON m.id=b.merchant_id WHERE b.id=?`
    )
    .bind(p.batchId)
    .first();
  if (!b) return { state: 'unknown' };
  if (!(await checkSignature(env, b, p))) return { state: 'unknown', merchantId: b.merchant_id };
  return { state: 'found', batch: b, serial: p.serial };
}

function contestOpen(b) {
  return Boolean(b.contest_enabled) && (!b.contest_ends_at || b.contest_ends_at > now());
}

export async function verify(req, env) {
  const db = env.DB;
  await rateLimit(db, 'verify:' + (await ipHash(req)), 60, 3600);
  const body = await readJson(req);
  if (typeof body.sid !== 'string' || !SID_RE.test(body.sid)) fail(400, 'أعد فتح الرابط من جديد');
  const r = await resolve(env, db, body.t);
  if (r.state === 'unknown') {
    await logUnknown(db, req, body.t, r.merchantId ?? null);
    return json({ ok: false, result: 'unknown', message: MESSAGES.unknown, brand: null });
  }
  const b = r.batch;
  const reject = async (result, tagId = null, checkNo = null) => {
    await logScan(db, req, tagId, b.merchant_id, result, checkNo);
    return json({ ok: false, result, message: MESSAGES[result], brand: brand(b), report_allowed: true });
  };
  if (b.merchant_status !== 'active' || b.status === 'blocked') return reject('blocked');
  if (b.status === 'pending') return reject('not_activated');

  const t = now();
  // سجل العلامة ينشأ أول ما تنمسح
  await db.prepare('INSERT INTO tags(batch_id,merchant_id,serial) VALUES(?,?,?) ON CONFLICT(batch_id,serial) DO NOTHING').bind(b.id, b.merchant_id, r.serial).run();
  const tag = await db
    .prepare(
      `UPDATE tags SET check_count=check_count+1,last_checked_at=?,first_checked_at=COALESCE(first_checked_at,?)
       WHERE batch_id=? AND serial=? AND status='active'
       RETURNING id,check_count,first_device,second_device,first_checked_at,entry_done`
    )
    .bind(t, t, b.id, r.serial)
    .first();
  if (!tag) {
    const row = await db.prepare('SELECT id,status FROM tags WHERE batch_id=? AND serial=?').bind(b.id, r.serial).first();
    return reject(row?.status === 'auto_locked' ? 'locked' : 'blocked', row?.id);
  }
  // كل فتح للرابط يُحسب. الفحص اللي بعد الحد يقفل العلامة نهائياً حتى يعيد التاجر أو المدير تفعيلها.
  const max = b.max_checks || 0;
  if (max && tag.check_count > max) {
    await db.prepare("UPDATE tags SET status='auto_locked' WHERE id=? AND status='active'").bind(tag.id).run();
    return reject('locked', tag.id, tag.check_count);
  }

  const device = await sha256('device:' + body.sid);
  let bound = false;
  if (!tag.first_device) {
    const claimed = await db.prepare('UPDATE tags SET first_device=? WHERE id=? AND first_device IS NULL RETURNING id').bind(device, tag.id).first();
    bound = Boolean(claimed);
    if (!claimed) tag.first_device = (await db.prepare('SELECT first_device FROM tags WHERE id=?').bind(tag.id).first()).first_device;
  }
  if (!bound) {
    if (tag.first_device === device || tag.second_device === device) bound = true;
    else if (!tag.second_device && t - tag.first_checked_at <= SECOND_DEVICE_SECONDS) {
      bound = Boolean(await db.prepare('UPDATE tags SET second_device=? WHERE id=? AND second_device IS NULL RETURNING id').bind(device, tag.id).first());
    }
  }
  if (!bound) return reject('other_device', tag.id, tag.check_count);

  await logScan(db, req, tag.id, b.merchant_id, 'original', tag.check_count);
  const open = contestOpen(b);
  return json({
    ok: true,
    result: 'original',
    message: MESSAGES.original,
    brand: brand(b),
    tag: {
      public_id: publicId(b, r.serial),
      batch: b.code,
      product_name: b.product_name,
      // صورة المنتج للدفعة، وإذا ما فيه صورة تظهر الواجهة شعار التاجر
      image_url: imageUrl(b.image_key),
      produced_on: b.produced_on,
      is_test: Boolean(b.is_test),
      check_no: tag.check_count,
      checks_left: max ? max - tag.check_count : null,
    },
    contest: open ? { title: b.contest_title, ends_at: b.contest_ends_at, terms_url: b.contest_terms_url, entered: Boolean(tag.entry_done) } : null,
  });
}

export async function enter(req, env) {
  const db = env.DB;
  await rateLimit(db, 'enter:' + (await ipHash(req)), 20, 3600);
  const body = await readJson(req);
  if (typeof body.sid !== 'string' || !SID_RE.test(body.sid)) fail(400, 'أعد فتح الرابط من جديد');
  if (body.consent !== true) fail(400, 'لازم توافق على الشروط وسياسة الخصوصية');
  const f = {
    name: str(body.name, 'الاسم', { min: 2, max: 100 }),
    phone: saPhone(body.phone),
    city: str(body.city, 'المدينة', { min: 2, max: 100 }),
    pos: str(body.point_of_sale, 'اسم المحل', { min: 2, max: 150 }),
  };
  const r = await resolve(env, db, body.t);
  if (r.state !== 'found') fail(403, MESSAGES.unknown, 'unknown');
  const b = r.batch;
  if (b.status !== 'active' || b.merchant_status !== 'active') fail(403, MESSAGES.blocked, 'blocked');
  if (!contestOpen(b)) fail(403, 'المسابقة غير متاحة حالياً', 'contest_closed');
  const device = await sha256('device:' + body.sid);
  const tag = await db
    .prepare("SELECT id,status,entry_done FROM tags WHERE batch_id=? AND serial=? AND status='active' AND (first_device=? OR second_device=?)")
    .bind(b.id, r.serial, device, device)
    .first();
  if (!tag) fail(403, MESSAGES.other_device, 'other_device');
  if (tag.entry_done) fail(409, 'سبق تسجيل مشاركة بهذي العلامة', 'already_entered');
  const res = await db.batch([
    db
      .prepare('INSERT INTO entries(tag_id,merchant_id,customer_name,phone,city,point_of_sale,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tag_id) DO NOTHING')
      .bind(tag.id, b.merchant_id, f.name, f.phone, f.city, f.pos, now()),
    db.prepare('UPDATE tags SET entry_done=1 WHERE id=?').bind(tag.id),
  ]);
  if (!res[0].meta.changes) fail(409, 'سبق تسجيل مشاركة بهذي العلامة', 'already_entered');
  return json({ ok: true, message: 'تم تسجيل مشاركتك، بالتوفيق!' });
}

export async function report(req, env) {
  const db = env.DB;
  const ih = await ipHash(req);
  await rateLimit(db, 'report:' + ih, 5, 3600);
  const body = await readJson(req);
  const city = str(body.city, 'المدينة', { min: 2, max: 100 });
  const pos = str(body.point_of_sale, 'اسم المحل', { min: 2, max: 150 });
  const phone = saPhone(body.phone, { optional: true });
  const note = str(body.note, 'الملاحظة', { max: 500, optional: true });
  const reason = ['unknown', 'blocked', 'not_activated', 'locked', 'other_device'].includes(body.reason) ? body.reason : 'unknown';
  const r = await resolve(env, db, body.t);
  let merchantId = r.merchantId ?? null, tagId = null;
  if (r.state === 'found') {
    merchantId = r.batch.merchant_id;
    tagId = (await db.prepare('SELECT id FROM tags WHERE batch_id=? AND serial=?').bind(r.batch.id, r.serial).first())?.id ?? null;
  }
  await db
    .prepare('INSERT INTO reports(merchant_id,tag_id,reason,city,point_of_sale,phone,note,ip_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(merchantId, tagId, reason, city, pos, phone, note, ih, now())
    .run();
  return json({ ok: true, message: 'وصلنا بلاغك، شكراً لمساعدتك في وقف التقليد' });
}

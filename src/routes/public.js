// المسارات العامة: التحقق من العلامة، المشاركة في المسابقة، بلاغ التقليد.
import { pushAlert } from '../lib/push.js';
import { addLead } from '../lib/growth.js';
import { compareWithOriginal, evidencePhoto, levelFor, passportFor, soundClips, soundOn, voiceUrl } from '../lib/trust.js';
import { guaranteeClaim, saveEvidence } from './trust.js';
import { assistantEnabled } from '../lib/assistant.js';
import { guide } from '../lib/guide.js';
import { shopForVerify } from './store.js';
import { shopAI } from '../lib/shop.js';
import { imageUrl } from '../lib/images.js';
import { checkAnomaly, logScan, scanHistory } from '../lib/scans.js';
import { requireHuman, turnstileKey } from '../lib/human.js';
import { checkSignature, parseToken, publicId } from '../lib/tags.js';
import { fail, geo, int, ipHash, json, now, rateLimit, readJson, saPhone, sha256, str } from '../lib/util.js';

const SECOND_DEVICE_SECONDS = 600; // جهاز ثانٍ مسموح خلال 10 دقائق من أول فحص (مثل الانتقال من سناب إلى سفاري)
const SID_RE = /^[a-f0-9]{64}$/;

const MESSAGES = {
  original: 'تم التحقق: المنتج أصلي',
  unknown: 'هذي العلامة غير مسجلة عندنا. لا تستخدم المنتج قبل ما تتأكد من البائع.',
  blocked: 'هذي العلامة موقوفة. قد يكون المنتج مقلّداً، تأكد من البائع.',
  not_activated: 'هذي العلامة لم تُفعَّل بعد. تأكد من البائع قبل استخدام المنتج.',
  locked: 'تجاوزت هذي العلامة عدد مرات التحقق المسموح، وتم إيقافها. قد يكون المنتج مقلّداً.',
  other_device: 'قد يكون هذا المنتج مقلّداً أو مسجّلاً لشخص آخر. تأكد من البائع.',
};

function brand(m) {
  return m ? { name: m.name, logo_url: imageUrl(m.logo_key) || m.logo_url, brand_color: m.brand_color, store_url: m.store_url, whatsapp: m.whatsapp } : null;
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
              m.contest_enabled,m.contest_title,m.contest_ends_at,m.contest_terms_url,b.expires_on,b.details,
              m.loyalty_enabled,m.loyalty_mode,m.loyalty_per_tag,m.loyalty_min_redeem,m.loyalty_reward,m.ratings_enabled,
              m.slug,m.store_enabled,m.store_coupon,m.store_coupon_note,b.store_product_id,m.guarantee_enabled,m.guarantee_terms,m.voice_key,m.verify_sound
       FROM batches b JOIN merchants m ON m.id=b.merchant_id WHERE b.id=?`
    )
    .bind(p.batchId)
    .first();
  if (!b) return { state: 'unknown' };
  if (!(await checkSignature(env, b, p))) return { state: 'unknown', merchantId: b.merchant_id };
  return { state: 'found', batch: b, serial: p.serial };
}

// "2026-12" = ينتهي آخر يوم في ديسمبر 2026 بتوقيت الرياض
function expired(expiresOn) {
  if (!/^\d{4}-\d{2}$/.test(expiresOn || '')) return false;
  const [y, m] = expiresOn.split('-').map(Number);
  return now() >= Date.UTC(y, m, 1) / 1000 - 10800;
}

const loyaltyInfo = (b) => ({ mode: b.loyalty_mode, per_tag: b.loyalty_per_tag, min_redeem: b.loyalty_min_redeem, reward: b.loyalty_reward });

// العلامة لازم تكون أصلية ومفعّلة ومربوطة بهذا الجهاز (نفس شروط المسابقة)
async function boundTag(env, db, body, req, phone = null) {
  if (typeof body.sid !== 'string' || !SID_RE.test(body.sid)) fail(400, 'أعد فتح الرابط من جديد');
  const r = await resolve(env, db, body.t);
  if (r.state !== 'found') fail(403, MESSAGES.unknown, 'unknown');
  const b = r.batch;
  if (b.status !== 'active' || b.merchant_status !== 'active') fail(403, MESSAGES.blocked, 'blocked');
  const device = await sha256('device:' + body.sid);
  const tag = await ownTag(db, req, b, r.serial, device, phone);
  return { b, tag, device };
}

// العلامة لهذا الجوال: إذا ما أحد سجّلها، تتسجّل باسمه الحين (المسابقة والنقاط والتقييم تعتبر شراء)
async function ownTag(db, req, b, serial, device, phone = null) {
  const tag = await db.prepare('SELECT id,status,loyalty_claimed,entry_done,first_device,second_device,owner_phone FROM tags WHERE batch_id=? AND serial=?').bind(b.id, serial).first();
  if (!tag || tag.status === 'blocked_merchant' || tag.status === 'blocked_admin') fail(403, MESSAGES.blocked, 'blocked');
  if (tag.first_device === device || tag.second_device === device) {
    if (phone && !tag.owner_phone) await db.prepare('UPDATE tags SET owner_phone=? WHERE id=?').bind(phone, tag.id).run();
    return tag;
  }
  if (tag.first_device) fail(409, 'هذا المنتج مسجّل لشخص آخر', 'other_device');
  if (tag.status !== 'active') fail(403, MESSAGES.locked, 'locked');
  const city = geo(req).city;
  const won = await db.prepare('UPDATE tags SET first_device=?,owner_at=?,owner_city=?,owner_phone=? WHERE id=? AND first_device IS NULL RETURNING id').bind(device, now(), city, phone, tag.id).first();
  if (!won) fail(409, 'هذا المنتج مسجّل لشخص آخر', 'other_device');
  await logScan(db, req, tag.id, b.merchant_id, 'claimed', null, device);
  return { ...tag, first_device: device };
}

// «اشتريت المنتج؟ سجّله باسمك»: رقم الجوال اختياري
export async function claimOwnership(req, env) {
  const db = env.DB;
  await rateLimit(db, 'claim:' + (await ipHash(req)), 30, 3600);
  const body = await readJson(req);
  if (typeof body.sid !== 'string' || !SID_RE.test(body.sid)) fail(400, 'أعد فتح الرابط من جديد');
  const phone = saPhone(body.phone, { optional: true });
  const r = await resolve(env, db, body.t);
  if (r.state !== 'found') fail(403, MESSAGES.unknown, 'unknown');
  const b = r.batch;
  if (b.status !== 'active' || b.merchant_status !== 'active') fail(403, MESSAGES.blocked, 'blocked');
  await ownTag(db, req, b, r.serial, await sha256('device:' + body.sid), phone);
  return json({ ok: true, message: 'تم تسجيل المنتج باسمك ✅' });
}

async function wallet(db, b, member) {
  const codes = await db
    .prepare("SELECT code,amount,reward,status,created_at FROM redemptions WHERE member_id=? ORDER BY id DESC LIMIT 5")
    .bind(member.id)
    .all();
  return {
    ...loyaltyInfo(b),
    phone: member.phone,
    balance: member.balance,
    earned_total: member.earned_total,
    tags_count: member.tags_count,
    can_redeem: member.balance >= b.loyalty_min_redeem,
    codes: codes.results,
  };
}

// العميل يضيف رصيد العلامة لرقم جواله. كل علامة تنحسب مرة وحدة.
export async function loyaltyClaim(req, env) {
  const db = env.DB;
  await rateLimit(db, 'loyalty:' + (await ipHash(req)), 30, 3600);
  const body = await readJson(req);
  const phone = saPhone(body.phone);
  const name = str(body.name, 'الاسم', { max: 100, optional: true });
  const { b, tag, device } = await boundTag(env, db, body, req, phone);
  if (!b.loyalty_enabled) fail(403, 'برنامج النقاط غير مفعّل لهذا المنتج', 'loyalty_off');
  const t = now();
  const claimed = await db.prepare('UPDATE tags SET loyalty_claimed=1 WHERE id=? AND loyalty_claimed=0 RETURNING id').bind(tag.id).first();
  if (!claimed) fail(409, 'سبق إضافة رصيد هذي العلامة', 'already_claimed');
  const member = await db
    .prepare(
      `INSERT INTO loyalty_members(merchant_id,phone,name,balance,earned_total,tags_count,created_at,last_at) VALUES(?,?,?,?,?,1,?,?)
       ON CONFLICT(merchant_id,phone) DO UPDATE SET balance=balance+excluded.balance,earned_total=earned_total+excluded.earned_total,
         tags_count=tags_count+1,last_at=excluded.last_at,name=COALESCE(excluded.name,name)
       RETURNING *`
    )
    .bind(b.merchant_id, phone, name, b.loyalty_per_tag, b.loyalty_per_tag, t, t)
    .first();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO loyalty_devices(member_id,device,created_at) VALUES(?,?,?)').bind(member.id, device, t),
    db.prepare("INSERT INTO loyalty_events(merchant_id,member_id,kind,amount,tag_id,created_at) VALUES(?,?,'earn',?,?,?)").bind(b.merchant_id, member.id, b.loyalty_per_tag, tag.id, t),
  ]);
  return json({ ok: true, added: b.loyalty_per_tag, wallet: await wallet(db, b, member) });
}

async function memberForDevice(db, b, phone, device) {
  const member = await db.prepare('SELECT * FROM loyalty_members WHERE merchant_id=? AND phone=?').bind(b.merchant_id, phone).first();
  if (!member) fail(404, 'ما عندك رصيد بهذا الرقم للحين', 'no_member');
  const known = await db.prepare('SELECT 1 FROM loyalty_devices WHERE member_id=? AND device=?').bind(member.id, device).first();
  // حماية: رصيد الرقم يظهر ويُستبدل بس من جهاز جمع فيه نقاط لنفس الرقم
  if (!known) fail(403, 'افتح رصيدك من نفس الجوال اللي جمعت فيه النقاط', 'unknown_device');
  return member;
}

export async function loyaltyWallet(req, env) {
  const db = env.DB;
  await rateLimit(db, 'loyalty:' + (await ipHash(req)), 30, 3600);
  const body = await readJson(req);
  const { b, device } = await boundTag(env, db, body, req);
  if (!b.loyalty_enabled) fail(403, 'برنامج النقاط غير مفعّل', 'loyalty_off');
  return json({ ok: true, wallet: await wallet(db, b, await memberForDevice(db, b, saPhone(body.phone), device)) });
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const redeemCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => CODE_CHARS[x % CODE_CHARS.length]).join('');

export async function loyaltyRedeem(req, env) {
  const db = env.DB;
  await rateLimit(db, 'loyalty:' + (await ipHash(req)), 30, 3600);
  const body = await readJson(req);
  const { b, device } = await boundTag(env, db, body, req);
  if (!b.loyalty_enabled) fail(403, 'برنامج النقاط غير مفعّل', 'loyalty_off');
  const member = await memberForDevice(db, b, saPhone(body.phone), device);
  const cost = b.loyalty_min_redeem;
  // نخصم الرصيد أول بشرط إنه يكفي، عشان طلبين مع بعض ما يستبدلون مرتين
  const left = await db.prepare('UPDATE loyalty_members SET balance=balance-? WHERE id=? AND balance>=? RETURNING *').bind(cost, member.id, cost).first();
  if (!left) fail(400, 'رصيدك ما يكفي للاستبدال للحين', 'insufficient');
  const t = now();
  let row = null;
  for (let i = 0; i < 3 && !row; i++) {
    row = await db
      .prepare('INSERT INTO redemptions(merchant_id,member_id,code,amount,reward,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(merchant_id,code) DO NOTHING RETURNING id,code')
      .bind(b.merchant_id, member.id, redeemCode(), cost, b.loyalty_reward, t)
      .first();
  }
  await db.prepare("INSERT INTO loyalty_events(merchant_id,member_id,kind,amount,redemption_id,created_at) VALUES(?,?,'redeem',?,?,?)").bind(b.merchant_id, member.id, -cost, row.id, t).run();
  return json({ ok: true, code: row.code, wallet: await wallet(db, b, left) });
}

// تقييم المنتج: مرة وحدة لكل علامة، من الجهاز المربوط
export async function rate(req, env) {
  const db = env.DB;
  await rateLimit(db, 'rate:' + (await ipHash(req)), 20, 3600);
  const body = await readJson(req);
  const stars = int(body.stars, 'التقييم', { min: 1, max: 5 });
  const comment = str(body.comment, 'التعليق', { max: 300, optional: true });
  const { b, tag } = await boundTag(env, db, body, req);
  if (!b.ratings_enabled) fail(403, 'التقييم غير متاح', 'ratings_off');
  const r = await db
    .prepare('INSERT INTO ratings(tag_id,merchant_id,batch_id,stars,comment,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(tag_id) DO NOTHING')
    .bind(tag.id, b.merchant_id, b.id, stars, comment, now())
    .run();
  if (!r.meta.changes) fail(409, 'سبق تقييم هذا المنتج', 'already_rated');
  return json({ ok: true, message: 'شكراً على تقييمك!' });
}

function contestOpen(b) {
  return Boolean(b.contest_enabled) && (!b.contest_ends_at || b.contest_ends_at > now());
}

// الصوت شغّال؟ ومعه تسجيلات المدير إذا فيه
async function soundInfo(db, merchantOn) {
  const sound = merchantOn && (await soundOn(db));
  return sound ? { sound, sound_clips: await soundClips(db) } : { sound };
}

export async function verify(req, env) {
  const db = env.DB;
  await rateLimit(db, 'verify:' + (await ipHash(req)), 60, 3600);
  const body = await readJson(req);
  if (typeof body.sid !== 'string' || !SID_RE.test(body.sid)) fail(400, 'أعد فتح الرابط من جديد');
  const r = await resolve(env, db, body.t);
  if (r.state === 'unknown') {
    await logUnknown(db, req, body.t, r.merchantId ?? null);
    return json({ ok: false, result: 'unknown', message: MESSAGES.unknown, brand: null, ...(await soundInfo(db, true)) });
  }
  const b = r.batch;
  const snd = await soundInfo(db, Boolean(b.verify_sound));
  const device = await sha256('device:' + body.sid);
  // لو العلامة معروفة نعرض للعميل سجل مسحاتها (متى ووين ومن أي جوال) عشان يحكم بنفسه
  const reject = async (result, tag = null, checkNo = null) => {
    if (tag) await checkAnomaly(db, req, tag, b.merchant_id);
    await logScan(db, req, tag?.id ?? null, b.merchant_id, result, checkNo, tag ? device : null);
    const history = tag ? await scanHistory(db, tag, device) : null;
    return json({ ok: false, result, message: MESSAGES[result], brand: brand(b), report_allowed: true, history, check_no: checkNo, ...snd });
  };
  if (b.merchant_status !== 'active' || b.status === 'blocked') return reject('blocked');
  if (b.status === 'pending') return reject('not_activated');

  const t = now();
  // سجل العلامة ينشأ أول ما تنمسح
  await db.prepare('INSERT INTO tags(batch_id,merchant_id,serial) VALUES(?,?,?) ON CONFLICT(batch_id,serial) DO NOTHING').bind(b.id, b.merchant_id, r.serial).run();
  // كل فتح للرابط ينحسب في السجل. الملكية تنحسم بزر «اشتريت المنتج»، والقفل بعدد الجوالات المختلفة مو المسحات
  const tag = await db
    .prepare(
      `UPDATE tags SET check_count=check_count+1,last_checked_at=?,first_checked_at=COALESCE(first_checked_at,?)
       WHERE batch_id=? AND serial=? AND status IN ('active','auto_locked')
       RETURNING id,status,check_count,first_device,second_device,first_checked_at,entry_done,loyalty_claimed,flagged_at,owner_at,owner_city,owner_phone,count_from`
    )
    .bind(t, t, b.id, r.serial)
    .first();
  // موقوفة من التاجر أو المدير: ما تنحسب كمسحة
  if (!tag) return reject('blocked', await db.prepare('SELECT id,status,first_device,second_device,flagged_at,owner_at,owner_city,owner_phone FROM tags WHERE batch_id=? AND serial=?').bind(b.id, r.serial).first());
  let isOwner = Boolean(tag.first_device) && (tag.first_device === device || tag.second_device === device);
  // جوال ثاني خلال 10 دقائق من التسجيل (مثل الانتقال من سناب إلى سفاري) يعتبر لنفس الشخص
  if (!isOwner && tag.first_device && !tag.second_device && tag.status === 'active' && t - (tag.owner_at || t) <= SECOND_DEVICE_SECONDS) {
    isOwner = Boolean(await db.prepare('UPDATE tags SET second_device=? WHERE id=? AND second_device IS NULL RETURNING id').bind(device, tag.id).first());
  }
  const max = b.max_checks || 0;
  let devices = null;
  // صاحب المنتج ما تنقفل عليه أبداً. غيره: بعد عدد جوالات مختلفة تنقفل العلامة (غالباً رابط منسوخ)
  if (!isOwner) {
    if (tag.status === 'auto_locked') return reject('locked', tag, tag.check_count);
    const seen = await db
      .prepare("SELECT COUNT(DISTINCT device) AS n, MAX(device=?) AS mine FROM scans WHERE tag_id=? AND id>? AND device IS NOT NULL AND device<>COALESCE(?,'') AND device<>COALESCE(?,'')")
      .bind(device, tag.id, tag.count_from || 0, tag.first_device, tag.second_device)
      .first();
    devices = (seen?.n || 0) + (seen?.mine ? 0 : 1);
    if (max && devices > max) {
      await db.prepare("UPDATE tags SET status='auto_locked' WHERE id=? AND status='active'").bind(tag.id).run();
      return reject('locked', tag, tag.check_count);
    }
    // مسجّل لشخص ثاني: قد يكون اللي بيد العميل نسخة
    if (tag.first_device) return reject('other_device', tag, tag.check_count);
  }

  await checkAnomaly(db, req, tag, b.merchant_id);
  await logScan(db, req, tag.id, b.merchant_id, 'original', tag.check_count, device);
  const open = contestOpen(b);
  const [rated, passport, level, claim] = await Promise.all([
    b.ratings_enabled ? db.prepare('SELECT stars FROM ratings WHERE tag_id=?').bind(tag.id).first() : null,
    passportFor(db, b, tag),
    levelFor(db, device),
    b.guarantee_enabled ? db.prepare('SELECT status FROM guarantee_claims WHERE tag_id=?').bind(tag.id).first() : null,
  ]);
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
      expires_on: b.expires_on,
      expired: expired(b.expires_on),
      details: b.details,
      is_test: Boolean(b.is_test),
      check_no: tag.check_count,
      devices,
      max_devices: max || null,
      checks_left: max && devices != null ? max - devices : null,
    },
    owner: { you: isOwner, claimable: !tag.first_device },
    contest: open ? { title: b.contest_title, ends_at: b.contest_ends_at, terms_url: b.contest_terms_url, entered: Boolean(tag.entry_done) } : null,
    loyalty: b.loyalty_enabled ? { ...loyaltyInfo(b), claimed: Boolean(tag.loyalty_claimed) } : null,
    rating: b.ratings_enabled ? { done: Boolean(rated), stars: rated?.stars ?? null } : null,
    shop: b.store_enabled && b.merchant_status === 'active' ? await shopForVerify(db, b) : null,
    passport,
    level,
    guarantee: b.guarantee_enabled ? { terms: b.guarantee_terms, claimed: claim?.status || null } : null,
    voice_url: voiceUrl(b.voice_key),
    history: await scanHistory(db, tag, device),
    ...snd,
  });
}

export async function enter(req, env) {
  const db = env.DB;
  await rateLimit(db, 'enter:' + (await ipHash(req)), 20, 3600);
  const body = await readJson(req);
  await requireHuman(env, req, body.cf_token);
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
  const tag = await ownTag(db, req, b, r.serial, device, f.phone);
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
  const body = await readJson(req, 1_500_000);
  await requireHuman(env, req, body.cf_token);
  const city = str(body.city, 'المدينة', { min: 2, max: 100 });
  const photo = evidencePhoto(body.photo);
  const pos = str(body.point_of_sale, 'اسم المحل', { min: 2, max: 150 });
  const phone = saPhone(body.phone, { optional: true });
  const note = str(body.note, 'الملاحظة', { max: 500, optional: true });
  const reason = ['unknown', 'blocked', 'not_activated', 'locked', 'other_device'].includes(body.reason) ? body.reason : 'unknown';
  const r = await resolve(env, db, body.t);
  let merchantId = r.merchantId ?? null, tagId = null, refKey = null;
  if (r.state === 'found') {
    merchantId = r.batch.merchant_id;
    refKey = r.batch.image_key;
    tagId = (await db.prepare('SELECT id FROM tags WHERE batch_id=? AND serial=?').bind(r.batch.id, r.serial).first())?.id ?? null;
  }
  // صورة المنتج المشكوك فيه: الذكاء يقارنها بصورة الأصلي (إذا الدفعة لها صورة)
  const photoKey = photo ? await saveEvidence(env, photo, merchantId) : null;
  const ai = photo ? await compareWithOriginal(env, refKey, photo) : null;
  await db
    .prepare('INSERT INTO reports(merchant_id,tag_id,reason,city,point_of_sale,phone,note,ip_hash,created_at,photo_key,ai_verdict,ai_score) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(merchantId, tagId, reason, city, pos, phone, note, ih, now(), photoKey, ai?.verdict ?? null, ai?.score ?? null)
    .run();
  if (merchantId) await pushAlert(db, merchantId, 'report', `🚩 بلاغ تقليد جديد من ${city} (${pos})${ai?.score != null ? ` · احتمال التقليد ${ai.score}٪` : ''}`);
  return json({ ok: true, message: 'وصلنا بلاغك، شكراً لمساعدتك في وقف التقليد', ai: ai?.verdict ? ai : null });
}

// ---------- الموقع العام ----------
// التجار اللي اختاروا الظهور، ونقاط البيع المعتمدة لكل تاجر
const publicBrand = (m) => ({ slug: m.slug, name: m.name, logo_url: imageUrl(m.logo_key) || m.logo_url, brand_color: m.brand_color, store_url: m.store_url, about: m.about });

export async function brands(env) {
  const r = await env.DB.prepare(
    `SELECT m.slug,m.name,m.logo_url,m.logo_key,m.brand_color,m.store_url,m.about,(SELECT COUNT(*) FROM sellers s WHERE s.merchant_id=m.id) AS sellers
     FROM merchants m WHERE m.public_listed=1 AND m.status='active' ORDER BY m.name`
  ).all();
  return json({ ok: true, brands: r.results.map((m) => ({ ...publicBrand(m), sellers: m.sellers })) }, 200, { 'Cache-Control': 'public, max-age=300' });
}

export async function brandPage(env, slug) {
  const db = env.DB;
  const m = await db.prepare("SELECT id,slug,name,logo_url,logo_key,brand_color,store_url,about,whatsapp FROM merchants WHERE slug=? AND public_listed=1 AND status='active'").bind(slug).first();
  if (!m) fail(404, 'ما لقينا هذي العلامة التجارية');
  const [sellers, products] = await db.batch([
    db.prepare('SELECT name,city,address,map_url,phone,online FROM sellers WHERE merchant_id=? ORDER BY online,city,name').bind(m.id),
    db.prepare("SELECT product_name,image_key,MAX(id) AS latest FROM batches WHERE merchant_id=? AND status='active' AND is_test=0 AND product_name IS NOT NULL GROUP BY product_name ORDER BY latest DESC LIMIT 12").bind(m.id),
  ]);
  return json(
    {
      ok: true,
      brand: { ...publicBrand(m), whatsapp: m.whatsapp },
      products: products.results.map((p) => ({ name: p.product_name, image_url: imageUrl(p.image_key) })),
      sellers: sellers.results,
    },
    200,
    { 'Cache-Control': 'public, max-age=300' }
  );
}

// أرقام المنصة للصفحة الرئيسية
export async function stats(env) {
  const db = env.DB;
  const [scans, merchants] = await db.batch([
    db.prepare("SELECT SUM(result='original') AS original,SUM(result IN ('unknown','blocked','locked')) AS caught,COUNT(DISTINCT city) AS cities FROM scans"),
    db.prepare("SELECT COUNT(*) AS n FROM merchants WHERE status='active'"),
  ]);
  const s = scans.results[0];
  return json({ ok: true, original: s.original ?? 0, caught: s.caught ?? 0, cities: s.cities ?? 0, brands: merchants.results[0].n }, 200, { 'Cache-Control': 'public, max-age=600' });
}

// طلب انضمام تاجر جديد: يوصل للمدير العام كتنبيه في اللوحة الأم.
// يستخدمه النموذج والمساعد الذكي.
export async function saveJoin(db, b) {
  const f = {
    name: str(b.name, 'اسمك', { min: 2, max: 100 }),
    brand: str(b.brand, 'اسم العلامة التجارية', { min: 2, max: 100 }),
    phone: saPhone(b.phone),
    product: str(b.product, 'نوع المنتج', { max: 150, optional: true }),
    qty: str(b.qty, 'الكمية', { max: 40, optional: true }),
  };
  const msg = `طلب انضمام: ${f.brand} · ${f.name} · ${f.phone}${f.product ? ' · ' + f.product : ''}${f.qty ? ' · ' + f.qty + ' منتج شهرياً' : ''}`;
  await addLead(db, f);
  await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(NULL,'join_request',?,?)").bind(msg, now()).run();
  await pushAlert(db, null, 'join_request', msg);
  return f;
}

export async function joinRequest(req, env) {
  const db = env.DB;
  await rateLimit(db, 'join:' + (await ipHash(req)), 3, 3600);
  await saveJoin(db, await readJson(req));
  return json({ ok: true, message: 'وصلنا طلبك، بنتواصل معك قريب' });
}

// ---------- مساعد أصالة للزوار ----------
export async function guideInfo(env) {
  return json({ ok: true, chat: assistantEnabled(env) });
}

export async function guideChat(req, env) {
  const db = env.DB;
  const ih = await ipHash(req);
  await rateLimit(db, 'guide:' + ih, 30, 3600);
  const b = await readJson(req, 30000);
  // طلبات الانضمام من المساعد لها نفس حد النموذج
  const r = await guide(env, b.messages, async (input) => {
    await rateLimit(db, 'join:' + ih, 3, 3600);
    await saveJoin(db, input);
  });
  return json({ ok: true, ...r });
}

// ---------- متاجر أصالة (نسخة تجريبية) ----------
export async function shopAiRoute(req, env) {
  if (req.method === 'GET') return json({ ok: true, chat: assistantEnabled(env) });
  await rateLimit(env.DB, 'shopai:' + (await ipHash(req)), 40, 3600);
  const b = await readJson(req, 2_000_000);
  return json({ ok: true, result: await shopAI(env, b) });
}

export const guarantee = (req, env) => guaranteeClaim(req, env, boundTag);

// مفتاح Turnstile العام للواجهات (null = الفحص غير مفعّل)
export const humanConfig = (env) => json({ ok: true, site_key: turnstileKey(env) }, 200, { 'Cache-Control': 'public, max-age=300' });

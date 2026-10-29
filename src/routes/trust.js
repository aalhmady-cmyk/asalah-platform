// مسارات مزايا الثقة: خريطة التقليد، ضمان أصالة، البائع المعتمد، الرسالة الصوتية، الملخص الأسبوعي، وصور الأدلة.
import { pushAlert } from '../lib/push.js';
import { imageUrl, saveImageBytes } from '../lib/images.js';
import { audioType, evidencePhoto, fakesMap, parseSellerToken, sellerToken, soundOn, voiceUrl, weeklySummary } from '../lib/trust.js';
import { audit, fail, ipHash, json, now, randomHex, rateLimit, readJson, saPhone, str } from '../lib/util.js';

const HOURS = { 24: 24, 168: 168, 720: 720 };
const hoursOf = (req) => HOURS[new URL(req.url).searchParams.get('h')] || 168;
const VOICE_MAX = 1.5 * 1024 * 1024;
const EVIDENCE_RE = /^evidence\/([0-9]+)\/[a-f0-9]{24}\.jpg$/;

export async function serveEvidence(env, key, merchantId) {
  const m = EVIDENCE_RE.exec(key);
  if (!m || (merchantId != null && Number(m[1]) !== merchantId)) fail(404, 'الصورة غير موجودة');
  const row = await env.DB.prepare('SELECT content_type,data FROM images WHERE key=?').bind(key).first();
  if (!row) fail(404, 'الصورة غير موجودة');
  return new Response(new Uint8Array(row.data), { headers: { 'Content-Type': row.content_type, 'Cache-Control': 'private, max-age=3600' } });
}
export const saveEvidence = (env, photo, merchantId) => (photo ? saveImageBytes(env, photo.buf, photo.type, 'evidence', merchantId ?? 0) : null);

// ---------- عام ----------
export async function handlePublicTrust(req, env, path, ctx) {
  const db = env.DB;
  if (path === '/api/public/fakes-map' && req.method === 'GET') {
    await rateLimit(db, 'map:' + (await ipHash(req)), 240, 3600);
    return json({ ok: true, ...(await fakesMap(db, null, hoursOf(req))) }, 200, { 'Cache-Control': 'public, max-age=20' });
  }
  if (path === '/api/public/seller' && req.method === 'GET') {
    const id = await parseSellerToken(env, new URL(req.url).searchParams.get('s'));
    const s = id && (await db.prepare(
      `SELECT s.id,s.name,s.city,s.address,s.map_url,s.online,m.name AS brand,m.slug,m.logo_key,m.logo_url,m.brand_color,m.status
       FROM sellers s JOIN merchants m ON m.id=s.merchant_id WHERE s.id=?`
    ).bind(id).first());
    if (!s || s.status !== 'active') return json({ ok: false, valid: false, message: 'هذي الشهادة غير صالحة أو انلغت. اشترِ من نقطة بيع معتمدة.' });
    return json({
      ok: true,
      valid: true,
      seller: { name: s.name, city: s.city, address: s.address, map_url: s.map_url, online: Boolean(s.online) },
      brand: { name: s.brand, slug: s.slug, logo_url: imageUrl(s.logo_key) || s.logo_url, brand_color: s.brand_color },
    });
  }
  return null;
}

// مطالبة ضمان أصالة: المنتج تحقق أصلي، والعميل اكتشف إنه مقلّد. التاجر يراجعها ويرد
export async function guaranteeClaim(req, env, bound) {
  const db = env.DB;
  await rateLimit(db, 'guarantee:' + (await ipHash(req)), 5, 86400);
  const body = await readJson(req, 1_500_000);
  if (body.consent !== true) fail(400, 'لازم توافق على مشاركة بياناتك مع صاحب العلامة');
  const { b, tag } = await bound(env, db, body);
  if (!b.guarantee_enabled) fail(403, 'صاحب هذي العلامة ما فعّل ضمان أصالة', 'no_guarantee');
  const f = {
    name: str(body.name, 'الاسم', { min: 2, max: 100 }),
    phone: saPhone(body.phone),
    city: str(body.city, 'المدينة', { min: 2, max: 100 }),
    pos: str(body.point_of_sale, 'مكان الشراء', { min: 2, max: 150 }),
    note: str(body.note, 'وش لاحظت', { min: 5, max: 800 }),
  };
  const photoKey = await saveEvidence(env, evidencePhoto(body.photo), b.merchant_id);
  const row = await db
    .prepare('INSERT INTO guarantee_claims(merchant_id,tag_id,name,phone,city,point_of_sale,note,photo_key,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(tag_id) DO NOTHING RETURNING id')
    .bind(b.merchant_id, tag.id, f.name, f.phone, f.city, f.pos, f.note, photoKey, now())
    .first();
  if (!row) fail(409, 'سبق تقديم طلب ضمان لهذي العلامة', 'already_claimed');
  const msg = `🛡️ طلب ضمان أصالة جديد من ${f.city}: ${f.note.slice(0, 80)}`;
  await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'guarantee_claim',?,?)").bind(b.merchant_id, msg, now()).run();
  await pushAlert(db, b.merchant_id, 'guarantee_claim', msg);
  return json({ ok: true, message: 'وصل طلبك لصاحب العلامة، وبيتواصل معك على جوالك خلال أيام العمل' });
}

// ---------- التاجر ----------
export async function handleMerchantTrust(req, env, path, user, mid) {
  const db = env.DB, m = req.method;
  if (path === '/api/m/fakes-map' && m === 'GET') return json({ ok: true, ...(await fakesMap(db, mid, hoursOf(req))) });

  if (path.startsWith('/api/m/evidence/') && m === 'GET') return serveEvidence(env, path.slice('/api/m/evidence/'.length), mid);

  if (path === '/api/m/guarantee' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT g.id,g.name,g.phone,g.city,g.point_of_sale,g.note,g.photo_key,g.status,g.decision_note,g.created_at,g.decided_at,t.serial,b.code AS batch,b.size
         FROM guarantee_claims g JOIN tags t ON t.id=g.tag_id JOIN batches b ON b.id=t.batch_id WHERE g.merchant_id=? ORDER BY g.id DESC LIMIT 200`
      )
      .bind(mid)
      .all();
    // الموظف ما يشوف أرقام العملاء
    const staff = user.merchant_role === 'staff';
    return json({ ok: true, claims: r.results.map((c) => ({ ...c, phone: staff ? null : c.phone })) });
  }
  const gm = path.match(/^\/api\/m\/guarantee\/(\d+)$/);
  if (gm && m === 'POST') {
    if (user.merchant_role === 'staff') fail(403, 'هذي لصاحب الحساب بس', 'owner_only');
    const b = await readJson(req);
    const status = b.status === 'approved' ? 'approved' : b.status === 'rejected' ? 'rejected' : fail(400, 'اختر قبول أو رفض');
    const note = str(b.note, 'الملاحظة', { max: 300, optional: true });
    const row = await db
      .prepare("UPDATE guarantee_claims SET status=?,decision_note=?,decided_by=?,decided_at=? WHERE id=? AND merchant_id=? RETURNING id")
      .bind(status, note, user.id, now(), Number(gm[1]), mid)
      .first();
    if (!row) fail(404, 'الطلب غير موجود');
    await audit(db, user, 'guarantee_' + status, { id: row.id, note });
    return json({ ok: true });
  }

  const sm = path.match(/^\/api\/m\/sellers\/(\d+)\/cert$/);
  if (sm && m === 'GET') {
    const s = await db.prepare('SELECT id,name,city,address,online FROM sellers WHERE id=? AND merchant_id=?').bind(Number(sm[1]), mid).first();
    if (!s) fail(404, 'نقطة البيع غير موجودة');
    const mm = await db.prepare('SELECT name,logo_key,logo_url,brand_color FROM merchants WHERE id=?').bind(mid).first();
    const origin = env.VERIFY_ORIGIN || new URL(req.url).origin;
    return json({ ok: true, url: `${origin}/seller/?s=${await sellerToken(env, s.id)}`, seller: s, merchant: { name: mm.name, logo_url: imageUrl(mm.logo_key) || mm.logo_url, brand_color: mm.brand_color } });
  }

  if (path === '/api/m/voice' && m === 'POST') {
    if (user.merchant_role === 'staff') fail(403, 'هذي لصاحب الحساب بس', 'owner_only');
    if (!env.MEDIA) fail(503, 'خدمة الملفات غير مفعّلة');
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length) fail(400, 'التسجيل فاضي');
    if (buf.length > VOICE_MAX) fail(413, 'التسجيل طويل، خلّه أقل من 30 ثانية');
    const t = audioType(buf);
    if (!t) fail(415, 'صيغة الصوت غير مدعومة');
    const key = `voice/${mid}/${randomHex(12)}.${t.ext}`;
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: t.type } });
    const old = await db.prepare('SELECT voice_key FROM merchants WHERE id=?').bind(mid).first();
    await db.prepare('UPDATE merchants SET voice_key=?,voice_type=? WHERE id=?').bind(key, t.type, mid).run();
    if (old?.voice_key) await env.MEDIA.delete(old.voice_key).catch(() => {});
    await audit(db, user, 'voice_uploaded', { bytes: buf.length });
    return json({ ok: true, voice_url: voiceUrl(key) });
  }
  if (path === '/api/m/voice' && m === 'DELETE') {
    if (user.merchant_role === 'staff') fail(403, 'هذي لصاحب الحساب بس', 'owner_only');
    const old = await db.prepare('SELECT voice_key FROM merchants WHERE id=?').bind(mid).first();
    await db.prepare('UPDATE merchants SET voice_key=NULL,voice_type=NULL WHERE id=?').bind(mid).run();
    if (old?.voice_key && env.MEDIA) await env.MEDIA.delete(old.voice_key).catch(() => {});
    return json({ ok: true });
  }

  if (path === '/api/m/weekly' && m === 'GET') {
    await rateLimit(db, 'weekly:' + mid, 6, 86400);
    const mm = await db.prepare('SELECT id,name FROM merchants WHERE id=?').bind(mid).first();
    return json({ ok: true, ...(await weeklySummary(env, mm)) });
  }

  if (path === '/api/m/trust' && m === 'GET') {
    const r = await db.prepare('SELECT guarantee_enabled,guarantee_terms,voice_key,weekly_summary,verify_sound FROM merchants WHERE id=?').bind(mid).first();
    const open = await db.prepare("SELECT COUNT(*) AS n FROM guarantee_claims WHERE merchant_id=? AND status='new'").bind(mid).first();
    return json({ ok: true, guarantee_enabled: Boolean(r.guarantee_enabled), guarantee_terms: r.guarantee_terms, voice_url: voiceUrl(r.voice_key), weekly_summary: Boolean(r.weekly_summary), verify_sound: Boolean(r.verify_sound), sound_global: await soundOn(db), open_claims: open.n });
  }
  if (path === '/api/m/trust' && m === 'PATCH') {
    if (user.merchant_role === 'staff') fail(403, 'هذي لصاحب الحساب بس', 'owner_only');
    const b = await readJson(req);
    const f = {};
    if ('guarantee_enabled' in b) f.guarantee_enabled = b.guarantee_enabled ? 1 : 0;
    if ('guarantee_terms' in b) f.guarantee_terms = str(b.guarantee_terms, 'شروط الضمان', { max: 400, optional: true });
    if ('weekly_summary' in b) f.weekly_summary = b.weekly_summary ? 1 : 0;
    if ('verify_sound' in b) f.verify_sound = b.verify_sound ? 1 : 0;
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    await db.prepare(`UPDATE merchants SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => f[k]), mid).run();
    await audit(db, user, 'trust_settings', f);
    return json({ ok: true });
  }
  return null;
}

// ---------- المدير ----------
export async function handleAdminTrust(req, env, path, user) {
  const db = env.DB, m = req.method;
  // صوت نتيجة التحقق لكل المنصة
  if (path === '/api/admin/sound' && m === 'GET') return json({ ok: true, enabled: await soundOn(db) });
  if (path === '/api/admin/sound' && m === 'PATCH') {
    const enabled = Boolean((await readJson(req)).enabled);
    await db.prepare("INSERT INTO settings(key,value) VALUES('verify_sound',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(enabled ? '1' : '0').run();
    await audit(db, user, 'verify_sound', { enabled });
    return json({ ok: true, enabled });
  }
  if (path === '/api/admin/fakes-map' && m === 'GET') return json({ ok: true, ...(await fakesMap(db, null, hoursOf(req))) });
  if (path.startsWith('/api/admin/evidence/') && m === 'GET') return serveEvidence(env, path.slice('/api/admin/evidence/'.length), null);
  if (path === '/api/admin/guarantee' && m === 'GET') {
    const r = await db
      .prepare('SELECT g.id,g.city,g.point_of_sale,g.note,g.photo_key,g.status,g.decision_note,g.created_at,g.decided_at,m.name AS merchant_name FROM guarantee_claims g JOIN merchants m ON m.id=g.merchant_id ORDER BY g.id DESC LIMIT 200')
      .all();
    return json({ ok: true, claims: r.results });
  }
  return null;
}


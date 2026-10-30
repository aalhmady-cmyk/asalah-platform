// سجل مسحات العلامة: وين ومتى ومن أي جوال انمسحت، ومن سجّلها باسمه، وكشف المسح المشبوه
import { pushAlert } from './push.js';
import { cityAr, cityDistance } from './trust.js';
import { geo, now } from './util.js';

// نوع الجوال من المتصفح (تقريبي، للعرض فقط)
export function deviceKind(req) {
  const ua = req.headers.get('user-agent') || '';
  if (/iPhone/.test(ua)) return 'iphone';
  if (/iPad/.test(ua)) return 'ipad';
  if (/SM-|Samsung/i.test(ua)) return 'samsung';
  if (/Huawei|HUAWEI|Honor/i.test(ua)) return 'huawei';
  if (/Redmi|Xiaomi|POCO|\bMi /i.test(ua)) return 'xiaomi';
  if (/OPPO|CPH\d|realme|RMX\d/i.test(ua)) return 'oppo';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh/.test(ua)) return 'mac';
  return 'other';
}

export async function logScan(db, req, tagId, merchantId, result, checkNo, device = null) {
  const g = geo(req);
  await db
    .prepare('INSERT INTO scans(tag_id,merchant_id,result,check_no,country,city,device,device_kind,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(tagId, merchantId, result, checkNo ?? null, g.country, g.city, device, tagId ? deviceKind(req) : null, now())
    .run();
}

// "إبراهيم العتيبي" ← "إبراهيم ع"
export function maskName(name) {
  const [first, second] = String(name || '').trim().split(/\s+/);
  if (!first) return null;
  return second ? `${first} ${second[0]}` : first;
}

// "966551112223" ← "05xxxxx223"
export const maskPhone = (p) => (p ? '05xxxxx' + String(p).slice(-3) : null);

// اللي يشوفه العميل: أول مسحة، آخر المسحات، كم جوال، ومن سجّل المنتج باسمه
export async function scanHistory(db, tag, device) {
  const [first, recent, stats, entry] = await db.batch([
    db.prepare("SELECT created_at,city,device,device_kind FROM scans WHERE tag_id=? AND device IS NOT NULL ORDER BY id LIMIT 1").bind(tag.id),
    db.prepare("SELECT created_at,city,device,device_kind,result FROM scans WHERE tag_id=? AND device IS NOT NULL ORDER BY id DESC LIMIT 8").bind(tag.id),
    db.prepare("SELECT COUNT(*) AS n, COUNT(DISTINCT device) AS devices FROM scans WHERE tag_id=? AND device IS NOT NULL").bind(tag.id),
    db.prepare('SELECT customer_name,phone FROM entries WHERE tag_id=?').bind(tag.id),
  ]);
  const row = (s) => s && { at: s.created_at, city: cityAr(s.city), kind: s.device_kind, mine: s.device === device, result: s.result || null };
  const e = entry.results[0];
  const you = Boolean(tag.first_device) && (device === tag.first_device || device === tag.second_device);
  return {
    total: stats.results[0]?.n || 0,
    devices: stats.results[0]?.devices || 0,
    first: row(first.results[0]),
    recent: recent.results.map(row),
    // المالك = اللي ضغط «اشتريت المنتج» (أو شارك في المسابقة أو أضاف النقاط). لغيره نعرض اسمه ورقمه مخفيين
    owner: tag.first_device
      ? { you, name: you ? null : maskName(e?.customer_name), phone: you ? null : maskPhone(tag.owner_phone || e?.phone), at: tag.owner_at || null, city: cityAr(tag.owner_city) }
      : null,
    flagged: Boolean(tag.flagged_at),
  };
}

// علامة انمسحت في مدينتين بعيدتين بسرعة ما يقدر عليها إنسان: غالباً منسوخة. ننبّه التاجر مرة وحدة
const MIN_KM = 200, MAX_KMH = 250;
export async function checkAnomaly(db, req, tag, merchantId) {
  if (tag.flagged_at) return;
  const city = geo(req).city;
  if (!city) return;
  const prev = await db.prepare("SELECT city,created_at FROM scans WHERE tag_id=? AND city IS NOT NULL AND city<>? ORDER BY id DESC LIMIT 1").bind(tag.id, city).first();
  if (!prev) return;
  const km = cityDistance(prev.city, city);
  if (km == null || km < MIN_KM) return;
  const hours = Math.max((now() - prev.created_at) / 3600, 0.05);
  if (km / hours <= MAX_KMH) return;
  const done = await db.prepare('UPDATE tags SET flagged_at=? WHERE id=? AND flagged_at IS NULL RETURNING serial').bind(now(), tag.id).first();
  if (!done) return;
  tag.flagged_at = now();
  const msg = `⚠️ علامة مشبوهة: انمسحت في ${cityAr(prev.city)} ثم في ${cityAr(city)} خلال ${hours < 1 ? Math.round(hours * 60) + ' دقيقة' : Math.round(hours) + ' ساعة'}. قد تكون منسوخة.`;
  await db.prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'tag_anomaly',?,?)").bind(merchantId, msg, now()).run();
  await pushAlert(db, merchantId, 'tag_anomaly', msg);
}

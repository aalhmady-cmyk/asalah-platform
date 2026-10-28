// المسابقة (المشاركات المشبوهة والسحب)، بؤر التقليد، والتقرير الشهري.
import { fail, now, sqlDay } from './util.js';

// ---------- المشاركات المشبوهة ----------
// نعلّم المشاركة لو:
//  - نفس الجهاز سجّل بأكثر من رقمين مختلفين (شخص يجمع علامات غيره)
//  - نفس الرقم سجّل 3 مشاركات أو أكثر خلال 10 دقائق (علامات منزوعة من منتجات بالجملة)
//  - الرقم مستبعد من التاجر
export const FLAGS = {
  device_many_phones: 'جهاز واحد سجّل بأكثر من رقمين',
  burst: '3 مشاركات أو أكثر من نفس الرقم خلال 10 دقائق',
  excluded: 'رقم مستبعد',
};

export async function entriesWithFlags(db, merchantId, { limit = 500 } = {}) {
  const [rows, devices, excluded] = await db.batch([
    db
      .prepare(
        `SELECT e.id,e.customer_name,e.phone,e.city,e.point_of_sale,e.created_at,t.first_device,b.code,t.serial
         FROM entries e JOIN tags t ON t.id=e.tag_id JOIN batches b ON b.id=t.batch_id
         WHERE e.merchant_id=? ORDER BY e.id DESC LIMIT ?`
      )
      .bind(merchantId, limit),
    db
      .prepare(
        `SELECT t.first_device AS device FROM entries e JOIN tags t ON t.id=e.tag_id
         WHERE e.merchant_id=? AND t.first_device IS NOT NULL GROUP BY t.first_device HAVING COUNT(DISTINCT e.phone)>2`
      )
      .bind(merchantId),
    db.prepare('SELECT phone FROM excluded_phones WHERE merchant_id=?').bind(merchantId),
  ]);
  const badDevices = new Set(devices.results.map((r) => r.device));
  const ex = new Set(excluded.results.map((r) => r.phone));
  const byPhone = new Map();
  for (const r of rows.results) {
    if (!byPhone.has(r.phone)) byPhone.set(r.phone, []);
    byPhone.get(r.phone).push(r.created_at);
  }
  const burst = (phone, at) => byPhone.get(phone).filter((x) => Math.abs(x - at) <= 600).length >= 3;
  return rows.results.map(({ first_device, ...r }) => {
    const flags = [];
    if (first_device && badDevices.has(first_device)) flags.push('device_many_phones');
    if (burst(r.phone, r.created_at)) flags.push('burst');
    if (ex.has(r.phone)) flags.push('excluded');
    return { ...r, entries_for_phone: byPhone.get(r.phone).length, flags };
  });
}

// ---------- السحب ----------
// فرصة وحدة لكل رقم مهما كان عدد مشاركاته. نستبعد الأرقام المستبعدة، والمشبوهة لو طلب،
// واللي فازوا قبل في سحوبات نفس التاجر لو طلب. الاختيار بـ crypto.getRandomValues.
function randomIndex(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

export async function drawPool(db, merchantId, { from, to, skipFlagged, skipPrevious }) {
  const entries = await entriesWithFlags(db, merchantId, { limit: 1000000 });
  const prev = skipPrevious
    ? new Set((await db.prepare('SELECT w.phone FROM draw_winners w JOIN draws d ON d.id=w.draw_id WHERE d.merchant_id=?').bind(merchantId).all()).results.map((r) => r.phone))
    : new Set();
  const pool = new Map(); // رقم ← أول مشاركة صالحة له
  for (const e of entries) {
    if (from && e.created_at < from) continue;
    if (to && e.created_at > to) continue;
    if (e.flags.includes('excluded') || prev.has(e.phone)) continue;
    if (skipFlagged && e.flags.length) continue;
    pool.set(e.phone, e);
  }
  return [...pool.values()];
}

export async function runDraw(db, user, merchantId, opts) {
  const pool = await drawPool(db, merchantId, opts);
  if (!pool.length) fail(400, 'ما فيه مشاركين يدخلون السحب بهذي الشروط');
  if (opts.winners > pool.length) fail(400, `عدد الفائزين أكثر من عدد المشاركين (${pool.length})`);
  const picked = [];
  const left = [...pool];
  for (let i = 0; i < opts.winners; i++) picked.push(left.splice(randomIndex(left.length), 1)[0]);
  const draw = await db
    .prepare('INSERT INTO draws(merchant_id,title,winners_count,pool_size,from_at,to_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?) RETURNING id')
    .bind(merchantId, opts.title, opts.winners, pool.length, opts.from ?? null, opts.to ?? null, user.id, now())
    .first();
  await db.batch(picked.map((e, i) => db.prepare('INSERT INTO draw_winners(draw_id,rank,entry_id,phone) VALUES(?,?,?,?)').bind(draw.id, i + 1, e.id, e.phone)));
  return { id: draw.id, pool_size: pool.length, winners: picked.map((e, i) => ({ rank: i + 1, ...e })) };
}

export async function listDraws(db, merchantId) {
  const draws = (await db.prepare('SELECT * FROM draws WHERE merchant_id=? ORDER BY id DESC LIMIT 50').bind(merchantId).all()).results;
  if (!draws.length) return [];
  const winners = (
    await db
      .prepare(
        `SELECT w.draw_id,w.rank,e.customer_name,e.phone,e.city,e.point_of_sale FROM draw_winners w JOIN entries e ON e.id=w.entry_id
         WHERE w.draw_id IN (${draws.map(() => '?').join(',')}) ORDER BY w.draw_id,w.rank`
      )
      .bind(...draws.map((d) => d.id))
      .all()
  ).results;
  return draws.map((d) => ({ ...d, winners: winners.filter((w) => w.draw_id === d.id) }));
}

// ---------- بؤر التقليد ----------
// لكل مدينة: الأكواد المزيّفة، العلامات الموقوفة أو المقفلة، الجهاز الآخر، والبلاغات.
export async function hotspots(db, merchantId, days = 30) {
  const since = now() - days * 86400;
  const where = merchantId == null ? '1=1' : 'merchant_id=?';
  const b = (stmt) => (merchantId == null ? stmt.bind(since) : stmt.bind(merchantId, since));
  const [scans, reports] = await db.batch([
    b(
      db.prepare(
        `SELECT COALESCE(city,'غير معروف') AS city,
                SUM(result='unknown') AS unknown, SUM(result IN ('blocked','locked')) AS blocked,
                SUM(result='other_device') AS other_device, SUM(result='original') AS original
         FROM scans WHERE ${where} AND created_at>=? GROUP BY 1`
      )
    ),
    b(db.prepare(`SELECT city, COUNT(*) AS n, GROUP_CONCAT(DISTINCT point_of_sale) AS places FROM reports WHERE ${where} AND created_at>=? GROUP BY city`)),
  ]);
  const map = new Map();
  for (const r of scans.results) map.set(r.city, { city: r.city, unknown: r.unknown, blocked: r.blocked, other_device: r.other_device, original: r.original, reports: 0, places: [] });
  for (const r of reports.results) {
    const c = map.get(r.city) ?? { city: r.city, unknown: 0, blocked: 0, other_device: 0, original: 0, reports: 0, places: [] };
    c.reports = r.n;
    c.places = String(r.places || '').split(',').filter(Boolean).slice(0, 5);
    map.set(r.city, c);
  }
  return [...map.values()]
    .map((c) => {
      const suspicious = c.unknown + c.blocked + c.other_device + c.reports;
      const total = suspicious + c.original;
      return { ...c, suspicious, risk: total ? Math.round((suspicious / total) * 100) : 0 };
    })
    .filter((c) => c.suspicious > 0)
    .sort((a, b) => b.suspicious - a.suspicious)
    .slice(0, 20);
}

// ---------- التقرير الشهري ----------
// month = "2026-10" بتوقيت الرياض
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) fail(400, 'الشهر لازم يكون بصيغة 2026-10');
  const [y, m] = month.split('-').map(Number);
  const from = Date.UTC(y, m - 1, 1) / 1000 - 10800;
  const to = Date.UTC(y, m, 1) / 1000 - 10800;
  return { from, to };
}

export async function monthlyReport(db, merchantId, month) {
  const { from, to } = monthRange(month);
  const merchant = await db.prepare('SELECT id,name,slug,logo_url,logo_key FROM merchants WHERE id=?').bind(merchantId).first();
  if (!merchant) fail(404, 'ما لقينا التاجر');
  const q = (sql) => db.prepare(sql).bind(merchantId, from, to);
  const [results, daily, cities, sold, batches, entries, reports, unknownCodes] = await db.batch([
    q('SELECT result,COUNT(*) AS n FROM scans WHERE merchant_id=? AND created_at>=? AND created_at<? GROUP BY result'),
    q(`SELECT ${sqlDay('created_at')} AS day,COUNT(*) AS n,SUM(result='original') AS ok FROM scans WHERE merchant_id=? AND created_at>=? AND created_at<? GROUP BY day ORDER BY day`),
    q("SELECT COALESCE(city,'غير معروف') AS city,COUNT(*) AS n FROM scans WHERE merchant_id=? AND created_at>=? AND created_at<? GROUP BY 1 ORDER BY n DESC LIMIT 10"),
    q('SELECT COUNT(*) AS n FROM tags WHERE merchant_id=? AND first_checked_at>=? AND first_checked_at<?'),
    q(
      `SELECT b.code,b.product_name,COUNT(t.id) AS n FROM tags t JOIN batches b ON b.id=t.batch_id
       WHERE t.merchant_id=? AND t.first_checked_at>=? AND t.first_checked_at<? GROUP BY b.id ORDER BY n DESC LIMIT 10`
    ),
    q('SELECT COUNT(*) AS n,COUNT(DISTINCT phone) AS phones FROM entries WHERE merchant_id=? AND created_at>=? AND created_at<?'),
    q('SELECT COUNT(*) AS n FROM reports WHERE merchant_id=? AND created_at>=? AND created_at<?'),
    q('SELECT COUNT(*) AS n FROM unknown_codes WHERE merchant_id=? AND first_at>=? AND first_at<?'),
  ]);
  const by = Object.fromEntries(results.results.map((r) => [r.result, r.n]));
  const total = results.results.reduce((a, r) => a + r.n, 0);
  return {
    month,
    merchant: { name: merchant.name, logo_url: merchant.logo_key ? '/img/' + merchant.logo_key : merchant.logo_url },
    scans: total,
    original: by.original ?? 0,
    original_ratio: total ? Math.round(((by.original ?? 0) / total) * 1000) / 10 : null,
    results: by,
    sold: sold.results[0].n,
    daily: daily.results,
    cities: cities.results,
    batches: batches.results,
    entries: entries.results[0].n,
    entry_phones: entries.results[0].phones,
    reports: reports.results[0].n,
    new_fake_codes: unknownCodes.results[0].n,
    hotspots: (await hotspots(db, merchantId, Math.max(1, Math.round((Math.min(to, now()) - from) / 86400)))).slice(0, 5),
    generated_at: now(),
  };
}

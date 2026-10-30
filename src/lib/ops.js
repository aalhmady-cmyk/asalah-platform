// عمليات مشتركة بين اللوحة الأم ولوحة التاجر. merchantId = null يعني المدير العام (كل التجار).
import { checkSignature, parseLookup, publicId, serialWidth, stockFor } from './tags.js';
import { fail, now, riyadhDayStart, sqlDay } from './util.js';

const MAX_RANGE = 20000;

async function batchFor(db, lookup, merchantId) {
  const b =
    lookup.kind === 'token'
      ? await db.prepare('SELECT * FROM batches WHERE id=?').bind(lookup.batchId).first()
      : await db.prepare('SELECT * FROM batches WHERE code=?').bind(lookup.code).first();
  if (!b || (merchantId != null && b.merchant_id !== merchantId)) fail(404, 'ما لقينا علامة بهذا الرقم');
  return b;
}

export async function lookupTag(env, db, q, merchantId) {
  const l = parseLookup(q);
  const b = await batchFor(db, l, merchantId);
  if (l.kind === 'token' && !(await checkSignature(env, b, l))) fail(404, 'هذا الرابط مزيّف: توقيعه ما يطابق أي علامة عندنا');
  if (l.serial < 1 || l.serial > b.size) fail(404, 'الرقم خارج نطاق الدفعة');
  const tag = await db.prepare('SELECT * FROM tags WHERE batch_id=? AND serial=?').bind(b.id, l.serial).first();
  const [checks, entry] = await db.batch([
    db.prepare('SELECT result,check_no,city,country,created_at FROM scans WHERE tag_id=? ORDER BY id DESC LIMIT 20').bind(tag?.id ?? -1),
    db.prepare('SELECT customer_name,phone,city,point_of_sale,created_at FROM entries WHERE tag_id=?').bind(tag?.id ?? -1),
  ]);
  return {
    public_id: publicId(b, l.serial),
    batch: { id: b.id, code: b.code, status: b.status, size: b.size, product_name: b.product_name },
    serial: l.serial,
    status: tag?.status ?? 'active',
    check_count: tag?.check_count ?? 0,
    devices: (tag?.first_device ? 1 : 0) + (tag?.second_device ? 1 : 0),
    first_checked_at: tag?.first_checked_at ?? null,
    last_checked_at: tag?.last_checked_at ?? null,
    entry: entry.results[0] ?? null,
    checks: checks.results,
  };
}

// يوقف أو يفعّل علامة وحدة أو نطاق أرقام داخل دفعة.
// التاجر ما يقدر يلغي إيقاف المدير العام. إعادة التفعيل تصفّر عدّاد الفحوصات.
export async function setTagStatus(db, { batchCode, from, to, action }, merchantId) {
  if (!['block', 'activate'].includes(action)) fail(400, 'الإجراء غير معروف');
  const b = await db.prepare('SELECT * FROM batches WHERE code=?').bind(String(batchCode ?? '').toUpperCase()).first();
  if (!b || (merchantId != null && b.merchant_id !== merchantId)) fail(404, 'ما لقينا الدفعة');
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > b.size) fail(400, `النطاق لازم يكون بين 1 و ${b.size}`);
  if (to - from + 1 > MAX_RANGE) fail(400, `أقصى نطاق ${MAX_RANGE} علامة في المرة، أو أوقف الدفعة كاملة`);
  const isAdmin = merchantId == null;
  let changes;
  if (action === 'block') {
    const status = isAdmin ? 'blocked_admin' : 'blocked_merchant';
    const r = await db
      .prepare(
        `WITH RECURSIVE s(n) AS (SELECT ? UNION ALL SELECT n+1 FROM s WHERE n<?)
         INSERT INTO tags(batch_id,merchant_id,serial,status) SELECT ?,?,n,? FROM s WHERE true
         ON CONFLICT(batch_id,serial) DO UPDATE SET status=CASE WHEN tags.status='blocked_admin' THEN tags.status ELSE excluded.status END
         WHERE tags.status<>excluded.status`
      )
      .bind(from, to, b.id, b.merchant_id, status)
      .run();
    changes = r.meta.changes;
  } else {
    const r = await db
      .prepare(
        `UPDATE tags SET status='active',check_count=0,count_from=(SELECT COALESCE(MAX(id),0) FROM scans) WHERE batch_id=? AND serial BETWEEN ? AND ? AND status<>'active'
         ${isAdmin ? '' : "AND status<>'blocked_admin'"}`
      )
      .bind(b.id, from, to)
      .run();
    changes = r.meta.changes;
  }
  return { batch: b, changes, from: publicId(b, from), to: publicId(b, to) };
}

export async function overviewFor(db, merchantId) {
  const t = now();
  const today = riyadhDayStart(t);
  const since14 = today - 13 * 86400;
  const since7 = t - 7 * 86400;
  const where = merchantId == null ? 'merchant_id IS NOT NULL' : 'merchant_id=?';
  const bind = (stmt, ...rest) => (merchantId == null ? stmt.bind(...rest) : stmt.bind(merchantId, ...rest));
  const [daily, results, cities, recent, unknown, reports] = await db.batch([
    bind(db.prepare(`SELECT ${sqlDay('created_at')} AS day,COUNT(*) AS n,SUM(result='original') AS ok FROM scans WHERE ${where} AND created_at>=? GROUP BY day ORDER BY day`), since14),
    bind(db.prepare(`SELECT result,COUNT(*) AS n FROM scans WHERE ${where} AND created_at>=? GROUP BY result`), since7),
    bind(db.prepare(`SELECT COALESCE(city,'غير معروف') AS city,COUNT(*) AS n FROM scans WHERE ${where} AND created_at>=? GROUP BY city ORDER BY n DESC LIMIT 8`), since7),
    bind(
      db.prepare(
        `SELECT s.result,s.check_no,s.city,s.created_at,t.serial,b.code,b.size FROM scans s
         LEFT JOIN tags t ON t.id=s.tag_id LEFT JOIN batches b ON b.id=t.batch_id
         WHERE s.${where} ORDER BY s.id DESC LIMIT 30`
      )
    ),
    bind(db.prepare(`SELECT COUNT(*) AS n FROM scans WHERE ${where} AND result='unknown' AND created_at>=?`), today),
    bind(db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE ${where} AND created_at>=?`), since7),
  ]);
  const todayRow = daily.results.find((d) => d.day === new Date((today + 10800) * 1000).toISOString().slice(0, 10));
  const total7 = results.results.reduce((a, r) => a + r.n, 0);
  const ok7 = results.results.find((r) => r.result === 'original')?.n ?? 0;
  return {
    scans_today: todayRow?.n ?? 0,
    scans_7d: total7,
    original_ratio: total7 ? Math.round((ok7 / total7) * 1000) / 10 : null,
    unknown_today: unknown.results[0].n,
    reports_7d: reports.results[0].n,
    daily: daily.results,
    results_7d: results.results,
    cities_7d: cities.results,
    recent: recent.results.map((r) => ({
      result: r.result,
      check_no: r.check_no,
      city: r.city,
      created_at: r.created_at,
      public_id: r.code ? `${r.code}-${String(r.serial).padStart(serialWidth(r.size), '0')}` : null,
    })),
    stock: merchantId == null ? null : await stockFor(db, merchantId),
  };
}

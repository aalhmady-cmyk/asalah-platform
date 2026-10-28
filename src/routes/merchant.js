// لوحة التاجر: كل استعلام مقيّد بتاجر المستخدم.
import { requireUser } from '../lib/auth.js';
import { lookupTag, overviewFor, setTagStatus } from '../lib/ops.js';
import { audit, csvResponse, fail, int, json, now, readJson, str, url } from '../lib/util.js';

export async function handleMerchant(req, env, path) {
  const db = env.DB;
  const user = await requireUser(db, req, 'merchant');
  const mid = user.merchant_id;
  const m = req.method;

  if (path === '/api/m/overview' && m === 'GET') {
    const [ov, merchant, alerts] = await Promise.all([
      overviewFor(db, mid),
      db.prepare('SELECT id,name,slug,logo_url,brand_color,store_url,low_stock_threshold,max_checks,contest_enabled,contest_title,contest_ends_at,contest_terms_url FROM merchants WHERE id=?').bind(mid).first(),
      db.prepare('SELECT id,kind,message,created_at,read_at FROM alerts WHERE merchant_id=? AND kind<>'tag_request' ORDER BY id DESC LIMIT 10').bind(mid).all(),
    ]);
    const entries = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE merchant_id=?').bind(mid).first();
    return json({ ok: true, merchant, overview: ov, alerts: alerts.results, entries: entries.n });
  }

  if (path === '/api/m/batches' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT b.code,b.size,b.status,b.product_name,b.produced_on,b.activated_at,
                (SELECT COUNT(*) FROM tags t WHERE t.batch_id=b.id AND t.first_checked_at IS NOT NULL) AS sold,
                (SELECT COUNT(*) FROM tags t WHERE t.batch_id=b.id AND t.status<>'active') AS blocked
         FROM batches b WHERE b.merchant_id=? AND b.is_test=0 ORDER BY b.id DESC`
      )
      .bind(mid)
      .all();
    return json({ ok: true, batches: r.results });
  }

  if (path === '/api/m/tags/lookup' && m === 'GET') {
    return json({ ok: true, tag: await lookupTag(env, db, new URL(req.url).searchParams.get('q'), mid) });
  }
  if (path === '/api/m/tags/status' && m === 'POST') {
    const b = await readJson(req);
    const r = await setTagStatus(db, { batchCode: b.batch_code, from: b.from, to: b.to ?? b.from, action: b.action }, mid);
    await audit(db, user, 'tags_' + b.action, { batch: r.batch.code, from: b.from, to: b.to ?? b.from, changes: r.changes });
    return json({ ok: true, changes: r.changes, from: r.from, to: r.to });
  }

  // إعدادات المسابقة ورابط المتجر. حدود الحماية يحددها المدير العام.
  if (path === '/api/m/settings' && m === 'PATCH') {
    const b = await readJson(req);
    const f = {};
    if ('contest_enabled' in b) f.contest_enabled = b.contest_enabled ? 1 : 0;
    if ('contest_title' in b) f.contest_title = str(b.contest_title, 'اسم المسابقة', { max: 100, optional: true });
    if ('contest_ends_at' in b) f.contest_ends_at = int(b.contest_ends_at, 'تاريخ نهاية المسابقة', { min: 0, optional: true });
    if ('contest_terms_url' in b) f.contest_terms_url = url(b.contest_terms_url, 'شروط المسابقة');
    if ('store_url' in b) f.store_url = url(b.store_url, 'المتجر');
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db
      .prepare(`UPDATE merchants SET ${keys.map((k) => k + '=?').join(',')} WHERE id=? RETURNING contest_enabled,contest_title,contest_ends_at,contest_terms_url,store_url`)
      .bind(...keys.map((k) => f[k]), mid)
      .first();
    await audit(db, user, 'settings_updated', f);
    return json({ ok: true, settings: row });
  }

  if (path === '/api/m/entries.csv' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT e.id,b.code,t.serial,e.customer_name,e.phone,e.city,e.point_of_sale,datetime(e.created_at+10800,'unixepoch') AS created_riyadh
         FROM entries e JOIN tags t ON t.id=e.tag_id JOIN batches b ON b.id=t.batch_id WHERE e.merchant_id=? ORDER BY e.id`
      )
      .bind(mid)
      .all();
    await audit(db, user, 'entries_exported', { count: r.results.length });
    return csvResponse(r.results, ['id', 'code', 'serial', 'customer_name', 'phone', 'city', 'point_of_sale', 'created_riyadh'], 'entries.csv');
  }

  if (path === '/api/m/reports' && m === 'GET') {
    const r = await db.prepare('SELECT id,reason,city,point_of_sale,note,created_at FROM reports WHERE merchant_id=? ORDER BY id DESC LIMIT 200').bind(mid).all();
    return json({ ok: true, reports: r.results });
  }

  // طلب دفعة جديدة يوصل للمدير العام كتنبيه في اللوحة الأم
  if (path === '/api/m/request-tags' && m === 'POST') {
    const b = await readJson(req);
    const count = int(b.count, 'عدد العلامات', { min: 100, max: 1000000 });
    const note = str(b.note, 'الملاحظة', { max: 300, optional: true });
    const name = (await db.prepare('SELECT name FROM merchants WHERE id=?').bind(mid).first()).name;
    await db
      .prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'tag_request',?,?)")
      .bind(mid, `طلب ${count.toLocaleString('en-US')} علامة جديدة من ${name}${note ? ': ' + note : ''}`, now())
      .run();
    await audit(db, user, 'tags_requested', { count, note });
    return json({ ok: true, message: 'وصل طلبك لإدارة أصالة' });
  }

  if (path === '/api/m/alerts/read' && m === 'POST') {
    await db.prepare('UPDATE alerts SET read_at=? WHERE merchant_id=? AND read_at IS NULL').bind(now(), mid).run();
    return json({ ok: true });
  }
  fail(404, 'المسار غير موجود');
}

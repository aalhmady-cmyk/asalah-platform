// لوحة التاجر: كل استعلام مقيّد بتاجر المستخدم.
import { requireUser } from '../lib/auth.js';
import { ask, assistantEnabled, merchantContext, tips } from '../lib/assistant.js';
import { deleteImage, imageUrl, saveImage } from '../lib/images.js';
import { entriesWithFlags, FLAGS, hotspots, listDraws, monthlyReport, runDraw } from '../lib/insights.js';
import { lookupTag, overviewFor, setTagStatus } from '../lib/ops.js';
import { audit, csvResponse, fail, int, json, now, rateLimit, readJson, saPhone, str, url } from '../lib/util.js';

function sellerFields(b) {
  const online = b.online ? 1 : 0;
  return {
    name: str(b.name, 'اسم المحل', { max: 100 }),
    city: str(b.city, 'المدينة', { max: 60 }),
    address: str(b.address, 'العنوان', { max: 200, optional: true }),
    map_url: url(b.map_url, 'رابط الخريطة'),
    phone: str(b.phone, 'الجوال', { max: 20, optional: true }),
    online,
  };
}

export async function handleMerchant(req, env, path) {
  const db = env.DB;
  const user = await requireUser(db, req, 'merchant');
  const mid = user.merchant_id;
  const m = req.method;

  if (path === '/api/m/overview' && m === 'GET') {
    const [ov, merchant, alerts] = await Promise.all([
      overviewFor(db, mid),
      db.prepare('SELECT id,name,slug,logo_url,logo_key,brand_color,store_url,low_stock_threshold,max_checks,contest_enabled,contest_title,contest_ends_at,contest_terms_url,public_listed,about FROM merchants WHERE id=?').bind(mid).first(),
      db.prepare("SELECT id,kind,message,created_at,read_at FROM alerts WHERE merchant_id=? AND kind<>'tag_request' ORDER BY id DESC LIMIT 10").bind(mid).all(),
    ]);
    const entries = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE merchant_id=?').bind(mid).first();
    merchant.logo_url = imageUrl(merchant.logo_key) || merchant.logo_url;
    return json({ ok: true, merchant, overview: ov, alerts: alerts.results, entries: entries.n });
  }

  if (path === '/api/m/batches' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT b.code,b.size,b.status,b.product_name,b.produced_on,b.activated_at,b.image_key,
                (SELECT COUNT(*) FROM tags t WHERE t.batch_id=b.id AND t.first_checked_at IS NOT NULL) AS sold,
                (SELECT COUNT(*) FROM tags t WHERE t.batch_id=b.id AND t.status<>'active') AS blocked
         FROM batches b WHERE b.merchant_id=? AND b.is_test=0 ORDER BY b.id DESC`
      )
      .bind(mid)
      .all();
    return json({ ok: true, batches: r.results.map(({ image_key, ...b }) => ({ ...b, image_url: imageUrl(image_key) })) });
  }

  // صورة المنتج لدفعة: ترفع كملف خام، والقديمة تنحذف
  let match;
  if ((match = path.match(/^\/api\/m\/batches\/([A-Z0-9]{2,16})\/image$/)) && (m === 'POST' || m === 'DELETE')) {
    const batch = await db.prepare('SELECT id,code,image_key FROM batches WHERE code=? AND merchant_id=?').bind(match[1], mid).first();
    if (!batch) fail(404, 'ما لقينا الدفعة');
    const key = m === 'POST' ? await saveImage(env, req, 'products', mid) : null;
    await db.prepare('UPDATE batches SET image_key=? WHERE id=?').bind(key, batch.id).run();
    await deleteImage(env, batch.image_key);
    await audit(db, user, m === 'POST' ? 'product_image_set' : 'product_image_removed', { batch: batch.code });
    return json({ ok: true, image_url: imageUrl(key) });
  }
  if (path === '/api/m/logo' && (m === 'POST' || m === 'DELETE')) {
    const cur = await db.prepare('SELECT logo_key FROM merchants WHERE id=?').bind(mid).first();
    const key = m === 'POST' ? await saveImage(env, req, 'logos', mid) : null;
    await db.prepare('UPDATE merchants SET logo_key=? WHERE id=?').bind(key, mid).run();
    await deleteImage(env, cur.logo_key);
    await audit(db, user, m === 'POST' ? 'logo_set' : 'logo_removed');
    return json({ ok: true, logo_url: imageUrl(key) });
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
    if ('public_listed' in b) f.public_listed = b.public_listed ? 1 : 0;
    if ('about' in b) f.about = str(b.about, 'النبذة', { max: 600, optional: true });
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db
      .prepare(`UPDATE merchants SET ${keys.map((k) => k + '=?').join(',')} WHERE id=? RETURNING contest_enabled,contest_title,contest_ends_at,contest_terms_url,store_url,public_listed,about`)
      .bind(...keys.map((k) => f[k]), mid)
      .first();
    await audit(db, user, 'settings_updated', f);
    return json({ ok: true, settings: row });
  }

  if (path === '/api/m/entries' && m === 'GET') {
    const entries = await entriesWithFlags(db, mid);
    return json({ ok: true, entries, flags: FLAGS, suspicious: entries.filter((e) => e.flags.length).length });
  }
  if (path === '/api/m/entries.csv' && m === 'GET') {
    const rows = (await entriesWithFlags(db, mid, { limit: 1000000 })).map((e) => ({
      ...e,
      created_riyadh: new Date((e.created_at + 10800) * 1000).toISOString().slice(0, 16).replace('T', ' '),
      flags: e.flags.map((f) => FLAGS[f]).join(' | '),
    }));
    await audit(db, user, 'entries_exported', { count: rows.length });
    return csvResponse(rows, ['id', 'code', 'serial', 'customer_name', 'phone', 'city', 'point_of_sale', 'created_riyadh', 'entries_for_phone', 'flags'], 'entries.csv');
  }

  // ---------- استبعاد الأرقام والسحب ----------
  if (path === '/api/m/excluded' && m === 'GET') {
    const r = await db.prepare('SELECT phone,reason,created_at FROM excluded_phones WHERE merchant_id=? ORDER BY created_at DESC').bind(mid).all();
    return json({ ok: true, excluded: r.results });
  }
  if (path === '/api/m/excluded' && (m === 'POST' || m === 'DELETE')) {
    const b = await readJson(req);
    const phone = saPhone(b.phone);
    if (m === 'POST') {
      await db.prepare('INSERT OR REPLACE INTO excluded_phones(merchant_id,phone,reason,created_at) VALUES(?,?,?,?)').bind(mid, phone, str(b.reason, 'السبب', { max: 200, optional: true }), now()).run();
    } else await db.prepare('DELETE FROM excluded_phones WHERE merchant_id=? AND phone=?').bind(mid, phone).run();
    await audit(db, user, m === 'POST' ? 'phone_excluded' : 'phone_unexcluded', { phone });
    return json({ ok: true });
  }
  if (path === '/api/m/draws' && m === 'GET') return json({ ok: true, draws: await listDraws(db, mid) });
  if (path === '/api/m/draws' && m === 'POST') {
    const b = await readJson(req);
    const opts = {
      title: str(b.title, 'اسم السحب', { max: 100 }),
      winners: int(b.winners, 'عدد الفائزين', { min: 1, max: 100 }),
      from: int(b.from, 'بداية الفترة', { optional: true }),
      to: int(b.to, 'نهاية الفترة', { optional: true }),
      skipFlagged: b.skip_flagged !== false,
      skipPrevious: b.skip_previous !== false,
    };
    const d = await runDraw(db, user, mid, opts);
    await audit(db, user, 'draw_run', { draw: d.id, title: opts.title, winners: opts.winners, pool: d.pool_size });
    return json({ ok: true, draw: d }, 201);
  }
  if ((match = path.match(/^\/api\/m\/draws\/(\d+)\/winners\.csv$/)) && m === 'GET') {
    const d = (await listDraws(db, mid)).find((x) => x.id === Number(match[1]));
    if (!d) fail(404, 'ما لقينا السحب');
    return csvResponse(d.winners, ['rank', 'customer_name', 'phone', 'city', 'point_of_sale'], `winners-${d.id}.csv`);
  }

  // ---------- التقليد والتقارير ----------
  if (path === '/api/m/hotspots' && m === 'GET') {
    const days = int(new URL(req.url).searchParams.get('days') || 30, 'المدة', { min: 1, max: 365 });
    return json({ ok: true, days, hotspots: await hotspots(db, mid, days) });
  }
  if (path === '/api/m/report' && m === 'GET') {
    return json({ ok: true, report: await monthlyReport(db, mid, new URL(req.url).searchParams.get('month')) });
  }

  // ---------- نقاط البيع المعتمدة ----------
  if (path === '/api/m/sellers' && m === 'GET') {
    const r = await db.prepare('SELECT id,name,city,address,map_url,phone,online FROM sellers WHERE merchant_id=? ORDER BY city,name').bind(mid).all();
    return json({ ok: true, sellers: r.results });
  }
  if (path === '/api/m/sellers' && m === 'POST') {
    const f = sellerFields(await readJson(req));
    const n = await db.prepare('SELECT COUNT(*) AS n FROM sellers WHERE merchant_id=?').bind(mid).first();
    if (n.n >= 500) fail(400, 'وصلت الحد الأعلى لنقاط البيع (500)');
    const row = await db
      .prepare('INSERT INTO sellers(merchant_id,name,city,address,map_url,phone,online,created_at) VALUES(?,?,?,?,?,?,?,?) RETURNING id')
      .bind(mid, f.name, f.city, f.address, f.map_url, f.phone, f.online, now())
      .first();
    await audit(db, user, 'seller_added', { name: f.name, city: f.city });
    return json({ ok: true, id: row.id }, 201);
  }
  if ((match = path.match(/^\/api\/m\/sellers\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const id = Number(match[1]);
    if (m === 'DELETE') {
      const r = await db.prepare('DELETE FROM sellers WHERE id=? AND merchant_id=?').bind(id, mid).run();
      if (!r.meta.changes) fail(404, 'ما لقينا نقطة البيع');
      await audit(db, user, 'seller_removed', { id });
      return json({ ok: true });
    }
    const f = sellerFields(await readJson(req));
    const r = await db
      .prepare('UPDATE sellers SET name=?,city=?,address=?,map_url=?,phone=?,online=? WHERE id=? AND merchant_id=?')
      .bind(f.name, f.city, f.address, f.map_url, f.phone, f.online, id, mid)
      .run();
    if (!r.meta.changes) fail(404, 'ما لقينا نقطة البيع');
    return json({ ok: true });
  }

  // ---------- المساعد الذكي ----------
  if (path === '/api/m/assistant' && m === 'GET') {
    return json({ ok: true, tips: tips(await merchantContext(db, mid)), chat: assistantEnabled(env) });
  }
  if (path === '/api/m/assistant' && m === 'POST') {
    await rateLimit(db, 'assistant:' + mid, 40, 3600);
    const b = await readJson(req, 40000);
    const answer = await ask(env, await merchantContext(db, mid), b.question, b.history);
    return json({ ok: true, answer });
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

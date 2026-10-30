// لوحة التاجر: كل استعلام مقيّد بتاجر المستخدم.
import { pushAlert } from '../lib/push.js';
import { handleMerchantTrust } from './trust.js';
import { handleMerchantGrowth } from './growth.js';
import { hashPassword, requireUser, validPassword } from '../lib/auth.js';
import { ask, assistantEnabled, merchantContext, tips } from '../lib/assistant.js';
import { deleteImage, imageUrl, saveImage } from '../lib/images.js';
import { entriesWithFlags, FLAGS, hotspots, listDraws, monthlyReport, runDraw } from '../lib/insights.js';
import { lookupTag, overviewFor, setTagStatus } from '../lib/ops.js';
import { printLinks } from '../lib/tags.js';
import { handleMerchantStore } from './store.js';
import { deliver, whatsappEnabled } from '../lib/notify.js';
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

// الموظف يشتغل على المنتجات والريلز والعلامات والتقارير، وما يوصل للإعدادات ولا بيانات العملاء
function ownerOnly(path, m) {
  if (/^\/api\/m\/(staff|notify|excluded|entries|logo|request-tags)(\/|\.|$)/.test(path)) return true;
  if (/^\/api\/m\/draws/.test(path) && (m !== 'GET' || path.endsWith('.csv'))) return true;
  if ((path === '/api/m/settings' || path === '/api/m/loyalty' || path === '/api/m/store') && m !== 'GET') return true;
  return path === '/api/m/store/request';
}
const MAX_STAFF = 10;

export async function handleMerchant(req, env, path) {
  const db = env.DB;
  const user = await requireUser(db, req, 'merchant');
  const mid = user.merchant_id;
  const m = req.method;
  if (user.merchant_role === 'staff' && ownerOnly(path, m)) fail(403, 'هذي الصفحة لصاحب الحساب بس', 'owner_only');
  const trust = (await handleMerchantTrust(req, env, path, user, mid)) || (await handleMerchantGrowth(req, env, path, mid));
  if (trust) return trust;

  // ---------- حسابات الموظفين ----------
  if (path === '/api/m/staff' && m === 'GET') {
    const r = await db.prepare("SELECT id,name,email,status,last_login_at,created_at FROM users WHERE merchant_id=? AND merchant_role='staff' ORDER BY id").bind(mid).all();
    return json({ ok: true, staff: r.results, max: MAX_STAFF });
  }
  if (path === '/api/m/staff' && m === 'POST') {
    const b = await readJson(req);
    const n = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE merchant_id=? AND merchant_role='staff'").bind(mid).first();
    if (n.n >= MAX_STAFF) fail(400, `وصلت الحد (${MAX_STAFF} موظفين)`);
    const email = str(b.email, 'البريد', { max: 200 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'البريد غير صحيح');
    if (await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) fail(409, 'البريد مستخدم لحساب ثاني');
    const { hash, salt } = await hashPassword(validPassword(b.password));
    const row = await db
      .prepare("INSERT INTO users(email,name,role,merchant_id,merchant_role,password_hash,password_salt,created_at) VALUES(?,?,'merchant',?,'staff',?,?,?) RETURNING id,name,email,status,created_at")
      .bind(email, str(b.name, 'الاسم', { max: 100 }), mid, hash, salt, now())
      .first();
    await audit(db, user, 'staff_created', { email });
    return json({ ok: true, staff: row }, 201);
  }
  let sm;
  if ((sm = path.match(/^\/api\/m\/staff\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const st = await db.prepare("SELECT id,email FROM users WHERE id=? AND merchant_id=? AND merchant_role='staff'").bind(Number(sm[1]), mid).first();
    if (!st) fail(404, 'ما لقينا الموظف');
    const stmts = [];
    if (m === 'DELETE') stmts.push(db.prepare("UPDATE users SET status='disabled' WHERE id=?").bind(st.id));
    else {
      const b = await readJson(req);
      if ('status' in b) {
        if (!['active', 'disabled'].includes(b.status)) fail(400, 'الحالة غير معروفة');
        stmts.push(db.prepare('UPDATE users SET status=? WHERE id=?').bind(b.status, st.id));
      }
      if ('password' in b) {
        const { hash, salt } = await hashPassword(validPassword(b.password));
        stmts.push(db.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(hash, salt, st.id));
      }
      if (!stmts.length) fail(400, 'ما فيه تغييرات');
    }
    stmts.push(db.prepare('DELETE FROM sessions WHERE user_id=?').bind(st.id));
    await db.batch(stmts);
    await audit(db, user, 'staff_updated', { email: st.email, method: m });
    return json({ ok: true });
  }
  if (path === '/api/m/store' || path.startsWith('/api/m/store/')) return handleMerchantStore(req, env, path, user);

  if (path === '/api/m/overview' && m === 'GET') {
    const [ov, merchant, alerts] = await Promise.all([
      overviewFor(db, mid),
      db.prepare('SELECT id,name,slug,logo_url,logo_key,brand_color,store_url,store_enabled,low_stock_threshold,max_checks,contest_enabled,contest_title,contest_ends_at,contest_terms_url,public_listed,about FROM merchants WHERE id=?').bind(mid).first(),
      db.prepare("SELECT id,kind,message,created_at,read_at FROM alerts WHERE merchant_id=? AND kind NOT IN ('tag_request','store_request') ORDER BY id DESC LIMIT 10").bind(mid).all(),
    ]);
    const entries = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE merchant_id=?').bind(mid).first();
    merchant.logo_url = imageUrl(merchant.logo_key) || merchant.logo_url;
    return json({ ok: true, merchant, overview: ov, alerts: alerts.results, entries: entries.n });
  }

  // ملصقات QR: التاجر يطبع دفعاته اللي نوعها QR بنفسه
  const qm = path.match(/^\/api\/m\/batches\/([A-Z0-9]{2,16})\/links$/);
  if (qm && m === 'GET') {
    const batch = await db.prepare('SELECT * FROM batches WHERE code=? AND merchant_id=?').bind(qm[1], mid).first();
    if (!batch) fail(404, 'ما لقينا الدفعة');
    if (batch.kind !== 'qr') fail(403, 'هذي دفعة شرائح NFC، ملفها يروح للمصنع من إدارة أصالة');
    const out = await printLinks(env, req, batch);
    await audit(db, user, 'qr_printed', { code: batch.code, from: out.from, to: out.to }, mid);
    return json(out);
  }
  if (path === '/api/m/batches' && m === 'GET') {
    const r = await db
      .prepare(
        `SELECT b.code,b.size,b.status,b.kind,b.product_name,b.produced_on,b.activated_at,b.image_key,b.expires_on,b.details,b.store_product_id,
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

  // ---------- النقاط والكاش باك ----------
  // الكاش باك يُخزَّن بالهللة، والواجهة ترسله بالريال
  if (path === '/api/m/loyalty' && m === 'GET') {
    const [settings, stats, codes, top, recent, today] = await db.batch([
      db.prepare('SELECT loyalty_enabled,loyalty_mode,loyalty_per_tag,loyalty_min_redeem,loyalty_reward,ratings_enabled FROM merchants WHERE id=?').bind(mid),
      db.prepare('SELECT COUNT(*) AS members,COALESCE(SUM(balance),0) AS outstanding,COALESCE(SUM(earned_total),0) AS earned FROM loyalty_members WHERE merchant_id=?').bind(mid),
      db.prepare("SELECT SUM(status='issued') AS issued,SUM(status='used') AS used,COALESCE(SUM(CASE WHEN status='used' THEN amount END),0) AS used_amount FROM redemptions WHERE merchant_id=?").bind(mid),
      db.prepare('SELECT name,phone,balance,earned_total,tags_count,last_at FROM loyalty_members WHERE merchant_id=? ORDER BY earned_total DESC LIMIT 50').bind(mid),
      db.prepare('SELECT r.code,r.amount,r.reward,r.status,r.created_at,r.used_at,lm.phone,lm.name FROM redemptions r JOIN loyalty_members lm ON lm.id=r.member_id WHERE r.merchant_id=? ORDER BY r.id DESC LIMIT 30').bind(mid),
      db.prepare("SELECT COUNT(*) AS n FROM loyalty_events WHERE merchant_id=? AND kind='earn' AND created_at>=?").bind(mid, now() - 7 * 86400),
    ]);
    return json({
      ok: true,
      settings: settings.results[0],
      stats: { ...stats.results[0], issued: codes.results[0].issued ?? 0, used: codes.results[0].used ?? 0, used_amount: codes.results[0].used_amount, earns_7d: today.results[0].n },
      members: top.results,
      redemptions: recent.results,
    });
  }
  if (path === '/api/m/loyalty' && m === 'PATCH') {
    const b = await readJson(req);
    const cur = await db.prepare('SELECT loyalty_mode FROM merchants WHERE id=?').bind(mid).first();
    const mode = 'loyalty_mode' in b ? b.loyalty_mode : cur.loyalty_mode;
    if (!['points', 'cashback'].includes(mode)) fail(400, 'نوع البرنامج لازم يكون نقاط أو كاش باك');
    const amount = (v, label, opts) => (mode === 'cashback' ? Math.round(Number(v) * 100) : int(v, label, opts));
    const f = {};
    if ('loyalty_enabled' in b) f.loyalty_enabled = b.loyalty_enabled ? 1 : 0;
    if ('loyalty_mode' in b) f.loyalty_mode = mode;
    if ('loyalty_per_tag' in b) f.loyalty_per_tag = amount(b.loyalty_per_tag, 'المكافأة لكل منتج', { min: 1, max: 100000 });
    if ('loyalty_min_redeem' in b) f.loyalty_min_redeem = amount(b.loyalty_min_redeem, 'حد الاستبدال', { min: 1, max: 10000000 });
    if ('loyalty_reward' in b) f.loyalty_reward = str(b.loyalty_reward, 'وصف المكافأة', { max: 150, optional: true });
    if ('ratings_enabled' in b) f.ratings_enabled = b.ratings_enabled ? 1 : 0;
    for (const k of ['loyalty_per_tag', 'loyalty_min_redeem']) {
      if (k in f && !(Number.isInteger(f[k]) && f[k] >= 1 && f[k] <= 10000000)) fail(400, 'اكتب مبلغ صحيح أكبر من صفر');
    }
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db
      .prepare(`UPDATE merchants SET ${keys.map((k) => k + '=?').join(',')} WHERE id=? RETURNING loyalty_enabled,loyalty_mode,loyalty_per_tag,loyalty_min_redeem,loyalty_reward,ratings_enabled`)
      .bind(...keys.map((k) => f[k]), mid)
      .first();
    await audit(db, user, 'loyalty_updated', f);
    return json({ ok: true, settings: row });
  }
  // الكاشير يكتب كود العميل: يتأكد منه ويعلّمه مستخدم
  if (path === '/api/m/loyalty/use' && m === 'POST') {
    const b = await readJson(req);
    const code = String(b.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) fail(400, 'الكود 8 حروف وأرقام');
    const found = await db
      .prepare('SELECT r.id,r.code,r.amount,r.reward,r.status,r.used_at,lm.phone,lm.name FROM redemptions r JOIN loyalty_members lm ON lm.id=r.member_id WHERE r.merchant_id=? AND r.code=?')
      .bind(mid, code)
      .first();
    if (!found) fail(404, 'الكود غير صحيح');
    if (found.status === 'used') fail(409, 'هذا الكود مستخدم من قبل', 'used');
    if (found.status === 'cancelled') fail(409, 'هذا الكود ملغي', 'cancelled');
    if (b.check_only) return json({ ok: true, redemption: found });
    const r = await db.prepare("UPDATE redemptions SET status='used',used_at=?,used_by=? WHERE id=? AND status='issued'").bind(now(), user.id, found.id).run();
    if (!r.meta.changes) fail(409, 'هذا الكود مستخدم من قبل', 'used');
    await audit(db, user, 'redemption_used', { code });
    return json({ ok: true, redemption: { ...found, status: 'used' } });
  }

  // ---------- تقييمات المنتجات ----------
  if (path === '/api/m/ratings' && m === 'GET') {
    const [sum, dist, byBatch, recent] = await db.batch([
      db.prepare('SELECT COUNT(*) AS n,ROUND(AVG(stars),2) AS avg FROM ratings WHERE merchant_id=?').bind(mid),
      db.prepare('SELECT stars,COUNT(*) AS n FROM ratings WHERE merchant_id=? GROUP BY stars').bind(mid),
      db.prepare('SELECT b.code,b.product_name,COUNT(*) AS n,ROUND(AVG(r.stars),2) AS avg FROM ratings r JOIN batches b ON b.id=r.batch_id WHERE r.merchant_id=? GROUP BY b.id ORDER BY n DESC LIMIT 20').bind(mid),
      db.prepare("SELECT r.stars,r.comment,r.created_at,b.product_name FROM ratings r JOIN batches b ON b.id=r.batch_id WHERE r.merchant_id=? AND r.comment IS NOT NULL AND r.comment<>'' ORDER BY r.created_at DESC LIMIT 30").bind(mid),
    ]);
    const d = Object.fromEntries(dist.results.map((x) => [x.stars, x.n]));
    return json({ ok: true, count: sum.results[0].n, avg: sum.results[0].avg, distribution: [5, 4, 3, 2, 1].map((s) => ({ stars: s, n: d[s] ?? 0 })), batches: byBatch.results, comments: recent.results });
  }

  // تاريخ الانتهاء وتفاصيل المنتج لكل دفعة (تظهر للعميل بعد التحقق)
  if ((match = path.match(/^\/api\/m\/batches\/([A-Z0-9]{2,16})$/)) && m === 'PATCH') {
    const b = await readJson(req);
    const f = {};
    if ('expires_on' in b) {
      const v = b.expires_on ? String(b.expires_on) : null;
      if (v && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) fail(400, 'تاريخ الانتهاء لازم يكون شهر وسنة');
      f.expires_on = v;
    }
    if ('details' in b) f.details = str(b.details, 'تفاصيل المنتج', { max: 500, optional: true });
    if ('store_product_id' in b) {
      f.store_product_id = int(b.store_product_id, 'منتج المتجر', { min: 1, optional: true });
      if (f.store_product_id && !(await db.prepare('SELECT 1 FROM store_products WHERE id=? AND merchant_id=?').bind(f.store_product_id, mid).first())) fail(404, 'ما لقينا المنتج');
    }
    const keys = Object.keys(f);
    if (!keys.length) fail(400, 'ما فيه تغييرات');
    const row = await db
      .prepare(`UPDATE batches SET ${keys.map((k) => k + '=?').join(',')} WHERE code=? AND merchant_id=? RETURNING code,expires_on,details,store_product_id`)
      .bind(...keys.map((k) => f[k]), match[1], mid)
      .first();
    if (!row) fail(404, 'ما لقينا الدفعة');
    await audit(db, user, 'batch_details_updated', { batch: row.code, ...f });
    return json({ ok: true, batch: row });
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
    const r = await db.prepare('SELECT id,reason,city,point_of_sale,note,created_at,photo_key,ai_verdict,ai_score FROM reports WHERE merchant_id=? ORDER BY id DESC LIMIT 200').bind(mid).all();
    return json({ ok: true, reports: r.results });
  }

  // ---------- إشعارات واتساب ----------
  if (path === '/api/m/notify' && m === 'GET') {
    const [row, recent] = await Promise.all([
      db.prepare('SELECT alert_phone,notify_whatsapp FROM merchants WHERE id=?').bind(mid).first(),
      db.prepare('SELECT message,status,error,created_at FROM notifications WHERE merchant_id=? ORDER BY id DESC LIMIT 10').bind(mid).all(),
    ]);
    return json({ ok: true, enabled: whatsappEnabled(env), alert_phone: row.alert_phone, notify_whatsapp: !!row.notify_whatsapp, recent: recent.results });
  }
  if (path === '/api/m/notify' && m === 'PATCH') {
    const b = await readJson(req);
    const phone = saPhone(b.alert_phone, { optional: true });
    await db.prepare('UPDATE merchants SET alert_phone=?,notify_whatsapp=? WHERE id=?').bind(phone, b.notify_whatsapp ? 1 : 0, mid).run();
    await audit(db, user, 'notify_updated', { alert_phone: phone, notify_whatsapp: !!b.notify_whatsapp });
    return json({ ok: true, alert_phone: phone });
  }
  if (path === '/api/m/notify/test' && m === 'POST') {
    if (!whatsappEnabled(env)) fail(503, 'إشعارات واتساب ما تفعّلت في المنصة للحين', 'whatsapp_disabled');
    await rateLimit(db, 'watest:' + mid, 5, 3600);
    const row = await db.prepare('SELECT alert_phone FROM merchants WHERE id=?').bind(mid).first();
    if (!row.alert_phone) fail(400, 'احفظ رقم جوالك أول');
    const st = await deliver(env, mid, row.alert_phone, '✅ رسالة تجربة من أصالة: التنبيهات بتوصلك على هذا الرقم.');
    if (st !== 'sent') fail(502, 'ما وصلت الرسالة. تأكد من الرقم، أو تواصل مع أصالة');
    return json({ ok: true, message: 'أرسلنا رسالة تجربة لجوالك' });
  }

  // طلب دفعة جديدة يوصل للمدير العام كتنبيه في اللوحة الأم
  if (path === '/api/m/request-tags' && m === 'POST') {
    const b = await readJson(req);
    const qr = b.kind === 'qr';
    const count = int(b.count, 'عدد العلامات', { min: qr ? 10 : 100, max: qr ? 20000 : 1000000 });
    const note = str(b.note, 'الملاحظة', { max: 300, optional: true });
    const name = (await db.prepare('SELECT name FROM merchants WHERE id=?').bind(mid).first()).name;
    await db
      .prepare("INSERT INTO alerts(merchant_id,kind,message,created_at) VALUES(?,'tag_request',?,?)")
      .bind(mid, `طلب ${count.toLocaleString('en-US')} ${qr ? 'ملصق QR جديد' : 'علامة NFC جديدة'} من ${name}${note ? ': ' + note : ''}`, now())
      .run();
    await pushAlert(db, mid, 'tag_request', `طلب ${count.toLocaleString('en-US')} ${qr ? 'ملصق QR جديد' : 'علامة NFC جديدة'} من ${name}${note ? ': ' + note : ''}`);
    await audit(db, user, 'tags_requested', { count, note, kind: qr ? 'qr' : 'nfc' });
    return json({ ok: true, message: 'وصل طلبك لإدارة أصالة' });
  }

  if (path === '/api/m/alerts/read' && m === 'POST') {
    await db.prepare('UPDATE alerts SET read_at=? WHERE merchant_id=? AND read_at IS NULL').bind(now(), mid).run();
    return json({ ok: true });
  }
  fail(404, 'المسار غير موجود');
}

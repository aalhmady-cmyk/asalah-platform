// اختبار تكامل: يشغّل الـ Worker محلياً بقاعدة بيانات فاضية ويجرب المسارات الأساسية.
// التشغيل: npm test
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const PORT = 8790 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const SETUP_TOKEN = 'dev-setup-token-0123456789abcdef0123456789';
const persist = mkdtempSync(join(tmpdir(), 'asalah-test-'));
let proc;

async function call(path, { method = 'GET', body, cookie, origin = BASE } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('Content-Type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  const set = res.headers.get('Set-Cookie');
  return { status: res.status, data, cookie: set ? set.split(';')[0] : null };
}
const post = (path, body, cookie) => call(path, { method: 'POST', body, cookie });
const patch = (path, body, cookie) => call(path, { method: 'PATCH', body, cookie });
const sid = (c) => c.repeat(64);
const tokenOf = (u) => new URL(u).searchParams.get('t');

before(async () => {
  proc = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', persist, '--test-scheduled', '--show-interactive-dev-session=false'], {
    stdio: 'ignore',
    detached: true, // نقتل المجموعة كاملة بعد الاختبار، npx ما يمرر الإشارة لـ wrangler
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  for (let i = 0; i < 180; i++) {
    try {
      const r = await fetch(BASE + '/api/auth/me');
      if (r.status === 401) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('wrangler dev did not start');
});
after(() => {
  if (proc) try { process.kill(-proc.pid, 'SIGTERM'); } catch {}
  rmSync(persist, { recursive: true, force: true });
});

const S = {};

test('الإعداد يشتغل مرة وحدة وبالمفتاح الصحيح', async () => {
  const admin = { email: 'admin@asalah.test', name: 'إبراهيم', password: 'very-strong-pass-1' };
  assert.equal((await post('/api/setup', { ...admin, token: 'wrong'.repeat(8) })).status, 401);
  assert.equal((await post('/api/setup', { ...admin, token: SETUP_TOKEN })).status, 200);
  assert.equal((await post('/api/setup', { ...admin, token: SETUP_TOKEN })).status, 409);
  assert.equal((await post('/api/auth/login', { email: admin.email, password: 'nope-nope-nope' })).status, 401);
  const r = await post('/api/auth/login', { email: 'ADMIN@asalah.test', password: admin.password });
  assert.equal(r.status, 200);
  S.admin = r.cookie;
  assert.equal((await call('/api/auth/me', { cookie: S.admin })).data.user.role, 'admin');
});

test('الطلبات اللي تغيّر بيانات بدون Origin مرفوضة', async () => {
  const r = await call('/api/admin/merchants', { method: 'POST', body: { name: 'x', slug: 'x' }, cookie: S.admin, origin: null });
  assert.equal(r.status, 403);
});

test('إنشاء تاجر وحساب ودفعة وملف المصنع', async () => {
  let r = await post('/api/admin/merchants', { name: 'الكيف الأخضر', slug: 'green-kif', low_stock_threshold: 100, max_checks: 5 }, S.admin);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  S.mid = r.data.merchant.id;
  r = await post('/api/admin/users', { email: 'gk@asalah.test', name: 'تاجر', password: 'merchant-pass-1', merchant_id: S.mid }, S.admin);
  assert.equal(r.status, 201);
  r = await post('/api/admin/batches', { merchant_id: S.mid, code: 'gk2610', size: 50, product_name: 'شاي أخضر', produced_on: '2026-10' }, S.admin);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.batch.code, 'GK2610');
  assert.equal(r.data.batch.status, 'pending');
  S.batch = r.data.batch;
  r = await call(`/api/admin/batches/${S.batch.id}/factory.csv?from=1&to=50`, { cookie: S.admin });
  assert.equal(r.status, 200);
  const lines = r.data.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines.length, 51);
  assert.match(lines[1], /"GK2610-000001"/);
  S.urls = lines.slice(1).map((l) => l.split(',')[2].replace(/"/g, ''));
  assert.equal(new Set(S.urls).size, 50);
  // نفس الملف يتولّد بنفس الروابط في كل مرة
  const again = await call(`/api/admin/batches/${S.batch.id}/factory.csv?from=1&to=1`, { cookie: S.admin });
  assert.ok(again.data.includes(S.urls[0]));
  const m = await post('/api/auth/login', { email: 'gk@asalah.test', password: 'merchant-pass-1' });
  S.merchant = m.cookie;
});

test('الدفعة الموقوفة قبل الشحن ما تنقبل', async () => {
  const r = await post('/api/verify', { t: tokenOf(S.urls[0]), sid: sid('a') });
  assert.equal(r.data.result, 'not_activated');
});

test('التحقق وربط الجهاز', async () => {
  assert.equal((await patch(`/api/admin/batches/${S.batch.id}`, { status: 'active' }, S.admin)).status, 200);
  const t = tokenOf(S.urls[0]);
  let r = await post('/api/verify', { t, sid: sid('a') });
  assert.equal(r.data.result, 'original', JSON.stringify(r.data));
  assert.equal(r.data.tag.public_id, 'GK2610-000001');
  assert.equal(r.data.tag.check_no, 1);
  assert.equal(r.data.tag.checks_left, 4);
  assert.equal(r.data.brand.name, 'الكيف الأخضر');
  assert.equal(r.data.contest, null);
  r = await post('/api/verify', { t, sid: sid('a') });
  assert.equal(r.data.tag.check_no, 2);
  r = await post('/api/verify', { t, sid: sid('b') }); // جهاز ثانٍ خلال 10 دقائق
  assert.equal(r.data.result, 'original');
  r = await post('/api/verify', { t, sid: sid('c') }); // جهاز ثالث
  assert.equal(r.data.result, 'other_device');
});

test('الروابط المزيّفة والمعدّلة', async () => {
  const t = tokenOf(S.urls[1]);
  const fake = t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A');
  assert.equal((await post('/api/verify', { t: fake, sid: sid('a') })).data.result, 'unknown');
  assert.equal((await post('/api/verify', { t: 'not-a-code', sid: sid('a') })).data.result, 'unknown');
  const ov = await call('/api/admin/overview', { cookie: S.admin });
  assert.ok(ov.data.unknown.length >= 2);
  // التوقيع المعدّل يُنسب للتاجر عشان يظهر في موجات التقليد حقه
  assert.ok(ov.data.unknown.some((u) => u.merchant_name === 'الكيف الأخضر'));
});

test('الفحص السادس يقفل العلامة', async () => {
  const t = tokenOf(S.urls[1]);
  for (let i = 1; i <= 5; i++) assert.equal((await post('/api/verify', { t, sid: sid('d') })).data.result, 'original');
  assert.equal((await post('/api/verify', { t, sid: sid('d') })).data.result, 'locked');
  assert.equal((await post('/api/verify', { t, sid: sid('d') })).data.result, 'locked');
  const look = await call('/api/m/tags/lookup?q=GK2610-000002', { cookie: S.merchant });
  assert.equal(look.data.tag.status, 'auto_locked');
});

test('إيقاف التاجر وإيقاف المدير', async () => {
  let r = await post('/api/m/tags/status', { batch_code: 'GK2610', from: 3, to: 5, action: 'block' }, S.merchant);
  assert.equal(r.data.changes, 3, JSON.stringify(r.data));
  assert.equal((await post('/api/verify', { t: tokenOf(S.urls[2]), sid: sid('e') })).data.result, 'blocked');
  r = await post('/api/admin/tags/status', { batch_code: 'GK2610', from: 4, action: 'block' }, S.admin);
  assert.equal(r.data.changes, 1);
  r = await post('/api/m/tags/status', { batch_code: 'GK2610', from: 3, to: 5, action: 'activate' }, S.merchant);
  assert.equal(r.data.changes, 2); // رقم 4 موقوف من المدير
  assert.equal((await post('/api/verify', { t: tokenOf(S.urls[3]), sid: sid('e') })).data.result, 'blocked');
  assert.equal((await post('/api/verify', { t: tokenOf(S.urls[4]), sid: sid('e') })).data.result, 'original');
  r = await post('/api/m/tags/status', { batch_code: 'GK2610', from: 2, action: 'activate' }, S.merchant);
  assert.equal(r.data.changes, 1); // إعادة تفعيل المقفلة تلقائياً
  assert.equal((await post('/api/verify', { t: tokenOf(S.urls[1]), sid: sid('d') })).data.result, 'original');
});

test('المسابقة: مشاركة وحدة من الجهاز المربوط', async () => {
  assert.equal((await patch('/api/m/settings', { contest_enabled: true, contest_title: 'مسابقة الشتاء' }, S.merchant)).status, 200);
  const t = tokenOf(S.urls[0]);
  const v = await post('/api/verify', { t, sid: sid('a') });
  assert.equal(v.data.contest.title, 'مسابقة الشتاء');
  const form = { t, name: 'محمد', phone: '0551234567', city: 'الرياض', point_of_sale: 'بقالة النور', consent: true };
  assert.equal((await post('/api/enter', { ...form, sid: sid('c') })).status, 403);
  assert.equal((await post('/api/enter', { ...form, consent: false, sid: sid('a') })).status, 400);
  assert.equal((await post('/api/enter', { ...form, sid: sid('a') })).status, 200);
  assert.equal((await post('/api/enter', { ...form, sid: sid('b') })).status, 409);
  const csv = await call('/api/m/entries.csv', { cookie: S.merchant });
  assert.ok(csv.data.includes('966551234567'));
});

test('البلاغ', async () => {
  const r = await post('/api/report', { t: 'bad', city: 'جدة', point_of_sale: 'محل الأمانة', reason: 'unknown' });
  assert.equal(r.status, 200);
  assert.equal((await call('/api/admin/reports', { cookie: S.admin })).data.reports.length, 1);
});

test('عزل التجار والصلاحيات', async () => {
  assert.equal((await call('/api/admin/overview', { cookie: S.merchant })).status, 403);
  assert.equal((await call('/api/m/overview')).status, 401);
  let r = await post('/api/admin/merchants', { name: 'عسل السدر', slug: 'sidr' }, S.admin);
  r = await post('/api/admin/batches', { merchant_id: r.data.merchant.id, code: 'SD2610', size: 10 }, S.admin);
  assert.equal((await call('/api/m/tags/lookup?q=SD2610-000001', { cookie: S.merchant })).status, 404);
  assert.equal((await post('/api/m/tags/status', { batch_code: 'SD2610', from: 1, action: 'block' }, S.merchant)).status, 404);
});

test('المخزون وتنبيه قرب الخلوص', async () => {
  const ov = await call('/api/m/overview', { cookie: S.merchant });
  assert.equal(ov.status, 200);
  assert.equal(ov.data.overview.stock.active, 50);
  assert.equal(ov.data.overview.stock.sold, 3); // العلامات 1 و 2 و 5
  assert.equal(ov.data.overview.stock.remaining, 47);
  assert.ok(ov.data.overview.scans_today > 0);
  await fetch(BASE + '/cdn-cgi/local/scheduled?cron=0+*+*+*+*');
  await new Promise((r) => setTimeout(r, 500));
  const after1 = await call('/api/m/overview', { cookie: S.merchant });
  assert.equal(after1.data.alerts.filter((a) => a.kind === 'low_stock').length, 1);
  await fetch(BASE + '/cdn-cgi/local/scheduled?cron=0+*+*+*+*');
  await new Promise((r) => setTimeout(r, 500));
  const after2 = await call('/api/m/overview', { cookie: S.merchant });
  assert.equal(after2.data.alerts.filter((a) => a.kind === 'low_stock').length, 1); // ما يتكرر خلال 24 ساعة
});

test('صورة المنتج وشعار التاجر بعد التحقق', async () => {
  // أصغر PNG صالح (1×1)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const upload = (path, body, type = 'image/png', cookie = S.merchant) =>
    fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': type, Cookie: cookie, Origin: BASE }, body }).then(async (r) => ({ status: r.status, data: await r.json() }));
  const t = tokenOf(S.urls[4]);
  let v = await post('/api/verify', { t, sid: sid('e') });
  assert.equal(v.data.tag.image_url, null);
  assert.equal(v.data.brand.logo_url, null);

  assert.equal((await upload('/api/m/logo', Buffer.from('not an image'))).status, 415);
  assert.equal((await upload('/api/m/logo', png, 'text/plain')).status, 415);
  const logo = await upload('/api/m/logo', png);
  assert.equal(logo.status, 200, JSON.stringify(logo.data));
  v = await post('/api/verify', { t, sid: sid('e') });
  assert.equal(v.data.brand.logo_url, logo.data.logo_url);
  assert.equal(v.data.tag.image_url, null);

  const img = await upload('/api/m/batches/GK2610/image', png);
  assert.equal(img.status, 200);
  assert.match(img.data.image_url, /^\/img\/products\/\d+\/[a-f0-9]{24}\.png$/);
  v = await post('/api/verify', { t, sid: sid('e') });
  assert.equal(v.data.tag.image_url, img.data.image_url);
  const file = await fetch(BASE + img.data.image_url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
  assert.equal((await fetch(BASE + '/img/products/1/../../x.png')).status, 404);

  // التاجر ما يقدر يغيّر صورة دفعة تاجر ثاني
  assert.equal((await upload('/api/m/batches/SD2610/image', png)).status, 404);

  const del = await call('/api/m/batches/GK2610/image', { method: 'DELETE', cookie: S.merchant });
  assert.equal(del.status, 200);
  assert.equal((await fetch(BASE + img.data.image_url)).status, 404);
  assert.equal((await call('/api/m/batches', { cookie: S.merchant })).data.batches[0].image_url, null);
});

test('المشاركات المشبوهة والاستبعاد والسحب', async () => {
  // جهاز واحد يسجّل 3 علامات بثلاث أرقام مختلفة = مشبوه
  const phones = ['0551110001', '0551110002', '0551110003'];
  for (let i = 0; i < 3; i++) {
    const t = tokenOf(S.urls[5 + i]);
    assert.equal((await post('/api/verify', { t, sid: sid('f') })).data.result, 'original');
    const r = await post('/api/enter', { t, sid: sid('f'), name: 'عميل ' + i, phone: phones[i], city: 'الدمام', point_of_sale: 'سوبرماركت', consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  let e = await call('/api/m/entries', { cookie: S.merchant });
  assert.equal(e.status, 200);
  assert.equal(e.data.entries.length, 4);
  assert.equal(e.data.suspicious, 3);
  assert.ok(e.data.entries.find((x) => x.phone === '966551110001').flags.includes('device_many_phones'));
  assert.deepEqual(e.data.entries.find((x) => x.phone === '966551234567').flags, []);

  // مع استبعاد المشبوهين يبقى مشارك واحد
  let d = await post('/api/m/draws', { title: 'سحب 1', winners: 2 }, S.merchant);
  assert.equal(d.status, 400);
  d = await post('/api/m/draws', { title: 'سحب 1', winners: 1 }, S.merchant);
  assert.equal(d.status, 201, JSON.stringify(d.data));
  assert.equal(d.data.draw.pool_size, 1);
  assert.equal(d.data.draw.winners[0].phone, '966551234567');
  // الفائز السابق ما يدخل مرة ثانية، فما يبقى أحد
  assert.equal((await post('/api/m/draws', { title: 'سحب 2', winners: 1 }, S.merchant)).status, 400);
  // بدون استبعاد المشبوهين والفائزين السابقين: كل رقم فرصة وحدة
  d = await post('/api/m/draws', { title: 'سحب 3', winners: 4, skip_flagged: false, skip_previous: false }, S.merchant);
  assert.equal(d.data.draw.pool_size, 4);
  assert.equal(new Set(d.data.draw.winners.map((w) => w.phone)).size, 4);

  // الرقم المستبعد ما يدخل أي سحب
  assert.equal((await post('/api/m/excluded', { phone: '0551234567', reason: 'موظف' }, S.merchant)).status, 200);
  d = await post('/api/m/draws', { title: 'سحب 4', winners: 3, skip_flagged: false, skip_previous: false }, S.merchant);
  assert.equal(d.data.draw.pool_size, 3);
  assert.ok(!d.data.draw.winners.some((w) => w.phone === '966551234567'));
  const list = await call('/api/m/draws', { cookie: S.merchant });
  assert.equal(list.data.draws.length, 3);
  const csv = await call(`/api/m/draws/${list.data.draws[0].id}/winners.csv`, { cookie: S.merchant });
  assert.equal(csv.status, 200);
  assert.ok(csv.data.includes('9665511100'));
});

test('بؤر التقليد والتقرير الشهري', async () => {
  await post('/api/report', { t: tokenOf(S.urls[2]), city: 'جدة', point_of_sale: 'محل الأمانة', reason: 'blocked' });
  const h = await call('/api/m/hotspots?days=30', { cookie: S.merchant });
  assert.equal(h.status, 200);
  assert.ok(Array.isArray(h.data.hotspots));
  const all = await call('/api/admin/hotspots', { cookie: S.admin });
  assert.ok(all.data.hotspots.length >= 1);
  const month = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7);
  const r = await call('/api/m/report?month=' + month, { cookie: S.merchant });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.report.sold, 6);
  assert.equal(r.data.report.entries, 4);
  assert.ok(r.data.report.scans > 0);
  assert.equal((await call('/api/m/report?month=2026-13', { cookie: S.merchant })).status, 400);
  assert.equal((await call(`/api/admin/report?merchant=${S.mid}&month=${month}`, { cookie: S.admin })).data.report.sold, 6);
  assert.equal((await call('/api/admin/report?merchant=1&month=' + month, { cookie: S.merchant })).status, 403);
});

test('نقاط البيع والموقع العام', async () => {
  assert.equal((await call('/api/public/brands')).data.brands.length, 0);
  assert.equal((await call('/api/public/brands/green-kif')).status, 404);
  let r = await post('/api/m/sellers', { name: 'بقالة النور', city: 'الرياض', map_url: 'https://maps.google.com/?q=1' }, S.merchant);
  assert.equal(r.status, 201);
  await post('/api/m/sellers', { name: 'المتجر', city: 'أونلاين', online: true }, S.merchant);
  assert.equal((await post('/api/m/sellers', { name: 'x', city: 'y', map_url: 'javascript:alert(1)' }, S.merchant)).status, 400);
  assert.equal((await patch('/api/m/settings', { public_listed: true, about: 'شاي طبيعي' }, S.merchant)).status, 200);
  const list = await call('/api/public/brands');
  assert.equal(list.data.brands.length, 1);
  assert.equal(list.data.brands[0].sellers, 2);
  const page = await call('/api/public/brands/green-kif');
  assert.equal(page.data.brand.about, 'شاي طبيعي');
  assert.equal(page.data.sellers.length, 2);
  assert.equal(page.data.products[0].name, 'شاي أخضر');
  // تاجر ثاني ما يقدر يعدّل نقطة بيع غيره
  const id = r.data.id;
  assert.equal((await call('/api/m/sellers/' + id, { method: 'DELETE', cookie: S.merchant })).status, 200);
  assert.equal((await call('/api/m/sellers/' + id, { method: 'DELETE', cookie: S.merchant })).status, 404);
});

test('المساعد الذكي: الملاحظات تشتغل بدون مفتاح', async () => {
  const r = await call('/api/m/assistant', { cookie: S.merchant });
  assert.equal(r.status, 200);
  assert.equal(r.data.chat, false);
  assert.ok(r.data.tips.length >= 1);
  assert.ok(r.data.tips.some((t) => t.text.includes('مشبوهة')));
  const a = await post('/api/m/assistant', { question: 'كم بعت؟' }, S.merchant);
  assert.equal(a.status, 503);
  assert.equal((await call('/api/m/assistant', { cookie: S.admin })).status, 403);
});

test('النقاط والكاش باك: جمع مرة وحدة واستبدال بكود', async () => {
  let r = await patch('/api/m/loyalty', { loyalty_enabled: true, loyalty_mode: 'points', loyalty_per_tag: 10, loyalty_min_redeem: 20, loyalty_reward: 'علبة مجانية' }, S.merchant);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const [t1, t2] = [tokenOf(S.urls[8]), tokenOf(S.urls[9])];
  let v = await post('/api/verify', { t: t1, sid: sid('1') });
  assert.deepEqual(v.data.loyalty, { mode: 'points', per_tag: 10, min_redeem: 20, reward: 'علبة مجانية', claimed: false });
  assert.equal(v.data.rating.done, false);
  const phone = '0559990001';
  assert.equal((await post('/api/loyalty/claim', { t: t1, sid: sid('9'), phone })).status, 403); // جهاز غير مربوط
  r = await post('/api/loyalty/claim', { t: t1, sid: sid('1'), phone });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.wallet.balance, 10);
  assert.equal(r.data.wallet.can_redeem, false);
  assert.equal((await post('/api/loyalty/claim', { t: t1, sid: sid('1'), phone: '0559990002' })).status, 409);
  assert.equal((await post('/api/verify', { t: t1, sid: sid('1') })).data.loyalty.claimed, true);
  // منتج ثاني من جهاز ثاني لنفس الرقم
  await post('/api/verify', { t: t2, sid: sid('2') });
  r = await post('/api/loyalty/claim', { t: t2, sid: sid('2'), phone });
  assert.equal(r.data.wallet.balance, 20);
  assert.equal(r.data.wallet.can_redeem, true);
  // جهاز ما جمع لهذا الرقم ما يشوف رصيده
  await post('/api/verify', { t: tokenOf(S.urls[10]), sid: sid('3') });
  assert.equal((await post('/api/loyalty/wallet', { t: tokenOf(S.urls[10]), sid: sid('3'), phone })).status, 403);
  assert.equal((await post('/api/loyalty/wallet', { t: t1, sid: sid('1'), phone })).data.wallet.balance, 20);
  // الاستبدال يخصم ويطلع كود
  r = await post('/api/loyalty/redeem', { t: t1, sid: sid('1'), phone });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.data.code, /^[A-Z2-9]{8}$/);
  assert.equal(r.data.wallet.balance, 0);
  assert.equal((await post('/api/loyalty/redeem', { t: t1, sid: sid('1'), phone })).status, 400);
  const code = r.data.code;
  // التاجر يتحقق من الكود ويأكده مرة وحدة
  assert.equal((await post('/api/m/loyalty/use', { code: 'ZZZZZZZZ' }, S.merchant)).status, 404);
  assert.equal((await post('/api/m/loyalty/use', { code: code.toLowerCase(), check_only: true }, S.merchant)).data.redemption.status, 'issued');
  assert.equal((await post('/api/m/loyalty/use', { code }, S.merchant)).status, 200);
  assert.equal((await post('/api/m/loyalty/use', { code }, S.merchant)).status, 409);
  const l = await call('/api/m/loyalty', { cookie: S.merchant });
  assert.equal(l.data.stats.members, 1);
  assert.equal(l.data.stats.used, 1);
  assert.equal(l.data.members[0].earned_total, 20);
  // الكاش باك يتخزن بالهللة
  r = await patch('/api/m/loyalty', { loyalty_mode: 'cashback', loyalty_per_tag: 2.5, loyalty_min_redeem: 25 }, S.merchant);
  assert.equal(r.data.settings.loyalty_per_tag, 250);
  assert.equal(r.data.settings.loyalty_min_redeem, 2500);
  assert.equal((await patch('/api/m/loyalty', { loyalty_mode: 'cashback', loyalty_per_tag: 0 }, S.merchant)).status, 400);
});

test('التقييم وتاريخ الانتهاء', async () => {
  const t = tokenOf(S.urls[8]);
  assert.equal((await post('/api/rate', { t, sid: sid('1'), stars: 6 })).status, 400);
  assert.equal((await post('/api/rate', { t, sid: sid('9'), stars: 5 })).status, 403);
  assert.equal((await post('/api/rate', { t, sid: sid('1'), stars: 4, comment: 'ممتاز' })).status, 200);
  assert.equal((await post('/api/rate', { t, sid: sid('1'), stars: 5 })).status, 409);
  const r = await call('/api/m/ratings', { cookie: S.merchant });
  assert.equal(r.data.count, 1);
  assert.equal(r.data.avg, 4);
  assert.equal(r.data.comments[0].comment, 'ممتاز');
  assert.equal((await patch('/api/m/batches/GK2610', { expires_on: '2026-13' }, S.merchant)).status, 400);
  assert.equal((await patch('/api/m/batches/GK2610', { expires_on: '2020-01', details: 'الوزن 250 جرام' }, S.merchant)).status, 200);
  let v = await post('/api/verify', { t, sid: sid('1') });
  assert.equal(v.data.tag.expired, true);
  assert.equal(v.data.tag.details, 'الوزن 250 جرام');
  assert.equal(v.data.rating.done, true);
  await patch('/api/m/batches/GK2610', { expires_on: '2099-12' }, S.merchant);
  v = await post('/api/verify', { t, sid: sid('1') });
  assert.equal(v.data.tag.expired, false);
});

test('أرقام المنصة وطلب الانضمام', async () => {
  const s = await call('/api/public/stats');
  assert.equal(s.status, 200);
  assert.ok(s.data.original > 0);
  assert.ok(s.data.caught > 0);
  assert.equal((await post('/api/public/join', { name: 'سعد', brand: 'عطور', phone: '123' })).status, 400);
  assert.equal((await post('/api/public/join', { name: 'سعد', brand: 'عطور الورد', phone: '0501234567', qty: 'أقل من 1000' })).status, 200);
  const ov = await call('/api/admin/overview', { cookie: S.admin });
  assert.ok(ov.data.alerts.some((a) => a.kind === 'join_request' && a.message.includes('عطور الورد')));
});

test('مساعد أصالة للزوار بدون مفتاح', async () => {
  assert.equal((await call('/api/public/assistant')).data.chat, false);
  assert.equal((await post('/api/public/assistant', { messages: [{ role: 'user', content: 'هلا' }] })).status, 503);
});

test('متاجر أصالة: الصفحة والذكاء بدون مفتاح', async () => {
  assert.equal((await call('/api/public/shop-ai')).data.chat, false);
  assert.equal((await post('/api/public/shop-ai', { task: 'filters', text: 'تيشيرت أسود' })).status, 503);
  const page = await fetch(BASE + '/stores/');
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('متاجر أصالة'));
  assert.equal((await fetch(BASE + '/stores/demo/')).status, 200);
});

test('متجر التاجر: الاشتراك والمنتجات والريلز والعرض العام', async () => {
  // قبل التفعيل: يشوف حالته بس، والإضافة مرفوضة
  let r = await call('/api/m/store', { cookie: S.merchant });
  assert.equal(r.data.enabled, false);
  assert.equal((await post('/api/m/store/products', { title: 'x', price: 1, buy_url: 'https://a.salla.sa/p' }, S.merchant)).status, 403);
  assert.equal((await post('/api/m/store/request', {}, S.merchant)).status, 200);
  const ov = await call('/api/admin/overview', { cookie: S.admin });
  assert.ok(ov.data.alerts.some((a) => a.kind === 'store_request'));
  assert.equal((await patch(`/api/admin/merchants/${S.mid}`, { store_enabled: true }, S.admin)).status, 200);

  r = await post('/api/m/store/products', { title: 'شاي أخضر فاخر 250 جرام', price: '49.5', old_price: 65, category: 'coffee', buy_url: 'https://green.salla.sa/p/123', description: 'شاي أصلي' }, S.merchant);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const pid = r.data.product.id;
  assert.equal(r.data.product.price, 49.5);
  assert.equal((await post('/api/m/store/products', { title: 'بدون رابط', price: 10 }, S.merchant)).status, 400);
  assert.equal((await post('/api/m/store/products', { title: 'رابط http', price: 10, buy_url: 'http://x.sa' }, S.merchant)).status, 400);

  // يظهر للعامة، والبحث يلقاه
  let pub = await call('/api/public/store');
  assert.equal(pub.data.products.length, 1);
  assert.equal(pub.data.merchants[0].slug, 'green-kif');
  assert.equal((await call('/api/public/store/products?q=' + encodeURIComponent('شاي'))).data.products.length, 1);
  assert.equal((await call('/api/public/store/products?cat=perfume')).data.products.length, 0);
  const one = await call('/api/public/store/products/' + pid);
  assert.equal(one.data.product.buy_url, 'https://green.salla.sa/p/123');
  assert.equal((await post('/api/public/store/track', { type: 'click', id: pid })).status, 200);

  // الريل: بيانات، ثم الفيديو
  const bad = await post('/api/m/store/reels', { title: 'قصير', duration: 5 }, S.merchant);
  assert.equal(bad.status, 400);
  r = await post('/api/m/store/reels', { title: 'طريقة التحضير', duration: 20, product_id: pid }, S.merchant);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const mp4 = new Uint8Array(4096);
  mp4.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const up = await fetch(`${BASE}/api/m/store/reels/${r.data.id}/video`, { method: 'PUT', headers: { Cookie: S.merchant, Origin: BASE, 'Content-Type': 'video/mp4' }, body: mp4 });
  assert.equal(up.status, 200, await up.clone().text());
  const reel = (await up.json()).reel;
  const reels = await call('/api/public/store/reels');
  assert.equal(reels.data.reels.length, 1);
  assert.equal(reels.data.reels[0].product_title, 'شاي أخضر فاخر 250 جرام');
  const vid = await fetch(BASE + reel.video_url, { headers: { Range: 'bytes=0-99' } });
  assert.equal(vid.status, 206);
  assert.equal(vid.headers.get('Content-Range'), 'bytes 0-99/4096');
  assert.equal((await vid.arrayBuffer()).byteLength, 100);

  // التعليقات والتقييم
  const rc = `/api/public/store/reels/${reel.id}/comments`;
  assert.equal((await post(rc, { name: 'نورة' })).status, 400);
  assert.equal((await post(rc, { name: 'نورة', body: 'شوفوا https://x.com' })).status, 400);
  assert.equal((await post(rc, { name: 'نورة', body: 'شاي رهيب', rating: 5 })).status, 201);
  assert.equal((await post(rc, { name: 'نورة', rating: 4 })).status, 409);
  assert.equal((await post(rc, { name: 'خالد', body: 'كم سعره؟' })).status, 201);
  let cm = await call(rc);
  assert.equal(cm.data.count, 2);
  assert.deepEqual(cm.data.rating, { avg: 5, n: 1 });
  const feed = (await call('/api/public/store/reels')).data.reels.find((x) => x.id === reel.id);
  assert.equal(feed.comments, 2);
  assert.equal(feed.rating.avg, 5);
  const mine = await call(`/api/m/store/reels/${reel.id}/comments`, { cookie: S.merchant });
  assert.equal(mine.data.comments.length, 2);
  const rated = mine.data.comments.find((c) => c.rating);
  assert.equal((await call(`/api/m/store/reels/${reel.id}/comments/${rated.id}`, { method: 'DELETE', cookie: S.merchant })).status, 200);
  cm = await call(rc);
  assert.equal(cm.data.count, 1);
  assert.equal(cm.data.rating, null);

  // ريل أصلي (فيديو الآيفون MOV) مع أرقام القص، والملف اللي مو فيديو ينرفض
  const c = await post('/api/m/store/reels', { title: 'ريل من الآيفون', duration: 15, clip: { start: 4.5, zoom: 1.4, x: 0.2, y: 9 } }, S.merchant);
  assert.equal(c.status, 201);
  const mov = new Uint8Array(30 * 1024 * 1024);
  mov.set([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
  const cu = await fetch(`${BASE}/api/m/store/reels/${c.data.id}/video`, { method: 'PUT', headers: { Cookie: S.merchant, Origin: BASE, 'Content-Type': 'video/mp4' }, body: mov });
  assert.equal(cu.status, 200, await cu.clone().text());
  const clipReel = (await cu.json()).reel;
  assert.deepEqual(clipReel.clip, { start: 4.5, zoom: 1.4, x: 0.2, y: 1 });
  assert.equal(clipReel.video_bytes, mov.length);
  const pubClip = (await call('/api/public/store/reels')).data.reels.find((x) => x.id === c.data.id);
  assert.equal(pubClip.clip.start, 4.5);
  const n = await post('/api/m/store/reels', { title: 'مو فيديو', duration: 15 }, S.merchant);
  const nu = await fetch(`${BASE}/api/m/store/reels/${n.data.id}/video`, { method: 'PUT', headers: { Cookie: S.merchant, Origin: BASE, 'Content-Type': 'video/mp4' }, body: new Uint8Array(5000) });
  assert.equal(nu.status, 415);
  // الريل المقصوص مسبقاً حده أصغر
  const big = await fetch(`${BASE}/api/m/store/reels/${n.data.id}/video`, { method: 'PUT', headers: { Cookie: S.merchant, Origin: BASE, 'Content-Type': 'video/mp4' }, body: mov });
  assert.equal(big.status, 413);
  assert.equal((await call(`/api/m/store/reels/${c.data.id}`, { method: 'DELETE', cookie: S.merchant })).status, 200);
  assert.equal((await call(`/api/m/store/reels/${n.data.id}`, { method: 'DELETE', cookie: S.merchant })).status, 200);

  // الإيقاف من المدير يخفي المتجر كامل
  assert.equal((await patch(`/api/admin/merchants/${S.mid}`, { store_enabled: false }, S.admin)).status, 200);
  pub = await call('/api/public/store');
  assert.equal(pub.data.products.length, 0);
  assert.equal(pub.data.reels.length, 0);
  assert.equal((await call('/api/public/store/products/' + pid)).status, 404);
  assert.equal((await patch(`/api/admin/merchants/${S.mid}`, { store_enabled: true }, S.admin)).status, 200);
  assert.equal((await call(`/api/m/store/reels/${reel.id}`, { method: 'DELETE', cookie: S.merchant })).status, 200);
  assert.equal((await fetch(BASE + reel.video_url)).status, 404);
  assert.equal((await post('/api/public/store/chat', { messages: [{ role: 'user', content: 'شاي' }] })).status, 503);
});

test('تطويرات المتاجر: اطلبه مرة ثانية والكوبون واللايك والمفضلة والتنبيهات', async () => {
  const st = await call('/api/m/store', { cookie: S.merchant });
  const pid = st.data.products[0].id;
  // كوبون أصالة يظهر مع المنتج
  assert.equal((await patch('/api/m/store', { store_coupon: 'asalah10', store_coupon_note: 'خصم 10٪' }, S.merchant)).status, 200);
  assert.equal((await patch('/api/m/store', { store_coupon: 'فيه مسافة' }, S.merchant)).status, 400);
  let one = await call('/api/public/store/products/' + pid);
  assert.deepEqual(one.data.product.coupon, { code: 'ASALAH10', note: 'خصم 10٪' });
  await post('/api/public/store/track', { type: 'coupon', id: pid });
  assert.equal((await call('/api/m/store', { cookie: S.merchant })).data.coupon.copies, 1);
  // المفضلة بالأرقام
  assert.equal((await call('/api/public/store/products?ids=' + pid + ',99999')).data.products.length, 1);

  // ربط الدفعة بمنتج المتجر، وبعد التحقق يطلع "اطلبه مرة ثانية"
  assert.equal((await patch('/api/m/batches/GK2610', { store_product_id: pid }, S.merchant)).status, 200);
  assert.equal((await patch('/api/m/batches/GK2610', { store_product_id: 99999 }, S.merchant)).status, 404);
  const v = await post('/api/verify', { t: tokenOf(S.urls[40]), sid: sid('e') });
  assert.equal(v.data.result, 'original');
  assert.equal(v.data.shop.product.id, pid);
  assert.equal(v.data.shop.coupon.code, 'ASALAH10');

  // ريل جديد: لايك وترتيب حسب الأكثر مشاهدة
  const r = await post('/api/m/store/reels', { title: 'ريل اللايك', duration: 15 }, S.merchant);
  const mp4 = new Uint8Array(2048);
  mp4.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]);
  assert.equal((await fetch(`${BASE}/api/m/store/reels/${r.data.id}/video`, { method: 'PUT', headers: { Cookie: S.merchant, Origin: BASE, 'Content-Type': 'video/mp4' }, body: mp4 })).status, 200);
  await post('/api/public/store/track', { type: 'like', id: r.data.id });
  await post('/api/public/store/track', { type: 'reel_view', id: r.data.id });
  const pop = await call('/api/public/store/reels?sort=popular');
  assert.equal(pop.data.reels[0].likes, 1);
  assert.equal(pop.data.reels[0].views, 1);
  assert.equal((await call('/api/public/store/reels?ids=' + r.data.id)).data.reels.length, 1);
  const v2 = await post('/api/verify', { t: tokenOf(S.urls[40]), sid: sid('e') });
  // المنتج ما له ريلز، فتطلع ريلز التاجر بداله
  assert.equal(v2.data.shop.reels[0].id, r.data.id);

  // تنبيهات واتساب: الرقم ينحفظ، والإرسال متوقف بدون مفاتيح
  assert.equal((await patch('/api/m/notify', { alert_phone: '0551234567', notify_whatsapp: true }, S.merchant)).data.alert_phone, '966551234567');
  const n = await call('/api/m/notify', { cookie: S.merchant });
  assert.equal(n.data.enabled, false);
  assert.equal((await post('/api/m/notify/test', {}, S.merchant)).status, 503);
  // تشغيل الفحص الدوري ما يتعطل بسبب الإشعارات والمزامنة
  assert.equal((await fetch(BASE + '/cdn-cgi/local/scheduled?cron=0+*+*+*+*')).status, 200);
});

test('التصفح: الترتيب والميزانية والحالات وسلة العائلة', async () => {
  const st = await call('/api/m/store', { cookie: S.merchant });
  const pid = st.data.products[0].id;
  const price = st.data.products[0].price;
  assert.equal((await call('/api/public/store/products?limit=200&sort=cheap')).status, 200);
  assert.equal((await call(`/api/public/store/products?max=${price}`)).data.products.length >= 1, true);
  assert.equal((await call(`/api/public/store/products?max=${price - 1}`)).data.products.length, 0);
  const stories = (await call('/api/public/store/stories')).data.stories;
  assert.equal(stories[0].slug, 'green-kif');
  assert.equal(stories[0].items[0].id, pid);

  // سلة العائلة: إنشاء، إضافة من شخصين، شراء، حذف
  const c = await post('/api/public/store/family', { title: 'مقاضي البيت' });
  assert.equal(c.status, 201);
  const code = c.data.code;
  assert.match(code, /^[a-f0-9]{12}$/);
  assert.equal((await call('/api/public/store/family/ffffffffffff')).status, 404);
  let r = await post(`/api/public/store/family/${code}/items`, { product_id: pid, who: 'أبو محمد' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  r = await post(`/api/public/store/family/${code}/items`, { product_id: pid, who: 'أبو محمد', qty: 2 });
  assert.equal(r.data.list.items.length, 1);
  assert.equal(r.data.list.items[0].qty, 3);
  r = await post(`/api/public/store/family/${code}/items`, { product_id: pid, who: 'سارة' });
  assert.equal(r.data.list.items.length, 2);
  assert.equal((await post(`/api/public/store/family/${code}/items`, { product_id: pid })).status, 400);
  assert.equal((await post(`/api/public/store/family/${code}/items`, { product_id: 99999, who: 'سارة' })).status, 404);
  const it = r.data.list.items.find((x) => x.who === 'سارة');
  r = await patch(`/api/public/store/family/${code}/items/${it.id}`, { bought: true });
  assert.equal(r.data.list.items.find((x) => x.id === it.id).bought, true);
  assert.equal(r.data.list.items[0].bought, false);
  assert.equal((await call(`/api/public/store/family/${code}/items/${it.id}`, { method: 'DELETE' })).data.list.items.length, 1);
  const g = await call('/api/public/store/family/' + code);
  assert.equal(g.data.list.title, 'مقاضي البيت');
  assert.equal(g.data.list.items[0].product.buy_url.startsWith('https://'), true);
});

test('تقييم وتعليقات المنتجات، وحساب العميل', async () => {
  const st = await call('/api/m/store', { cookie: S.merchant });
  const pid = st.data.products[0].id;
  const me = await call('/api/c/me');
  assert.equal(me.data.login, false);
  assert.equal(me.data.customer, null);
  assert.equal((await call('/api/c/google/start')).status, 503);
  const pc = `/api/public/store/products/${pid}/comments`;
  assert.equal((await post(pc, { name: 'سعد', body: 'منتج ممتاز', rating: 4, device: 'aaaaaaaaaaaaaaaa1' })).status, 201);
  assert.equal((await post(pc, { name: 'سعد', rating: 5, device: 'aaaaaaaaaaaaaaaa1' })).status, 409);
  assert.equal((await post(pc, { name: 'منى', rating: 2, device: 'bbbbbbbbbbbbbbbb2' })).status, 201);
  const g = await call(pc);
  assert.equal(g.data.count, 1);
  assert.deepEqual(g.data.rating, { avg: 3, n: 2 });
  assert.equal(g.data.login, false);
  const one = await call('/api/public/store/products/' + pid);
  assert.deepEqual(one.data.product.rating, { avg: 3, n: 2 });
  assert.equal(one.data.product.comments, 1);
  const mine = await call(`/api/m/store/products/${pid}/comments`, { cookie: S.merchant });
  assert.equal(mine.data.comments.length, 2);
  assert.equal((await call(`/api/m/store/products/${pid}/comments/${mine.data.comments[0].id}`, { method: 'DELETE', cookie: S.merchant })).status, 200);
  assert.equal((await call(pc)).data.rating.n, 1);
  assert.equal((await call('/api/public/store/products/99999/comments')).status, 404);
});

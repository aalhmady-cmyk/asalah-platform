// اختبار تكامل: يشغّل الـ Worker محلياً بقاعدة بيانات فاضية ويجرب المسارات الأساسية.
// التشغيل: npm test
import { spawn, execFileSync } from 'node:child_process';
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
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist], { stdio: 'ignore' });
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
  await fetch(BASE + '/__scheduled?cron=0+*+*+*+*');
  await new Promise((r) => setTimeout(r, 500));
  const after1 = await call('/api/m/overview', { cookie: S.merchant });
  assert.equal(after1.data.alerts.filter((a) => a.kind === 'low_stock').length, 1);
  await fetch(BASE + '/__scheduled?cron=0+*+*+*+*');
  await new Promise((r) => setTimeout(r, 500));
  const after2 = await call('/api/m/overview', { cookie: S.merchant });
  assert.equal(after2.data.alerts.filter((a) => a.kind === 'low_stock').length, 1); // ما يتكرر خلال 24 ساعة
});

import { initPanelApp } from '/assets/panel-app.js';
import { playResult } from '/assets/sound.js';
import { loadCredits, creditsBadge } from '/admin/credits.js';
import { mountSecurity } from '/assets/security.js';
import { api, raw, bars, BATCH_STATUS, hbars, hotspotsTable, html, pickImage, logout, num, onSubmit, pill, render, RESULT, TAG_STATUS, tabs, toast, when } from '/assets/common.js';

const $ = (id) => document.getElementById(id);
let merchants = [];

const me = await api('/api/auth/me');
if (me.user.role !== 'admin') location.href = '/merchant/';
$('me').textContent = me.user.name;
$('greet').textContent = `أهلاً ${me.user.name}`;
$('logout').addEventListener('click', logout);
initPanelApp({ scope: '/admin/', title: 'اللوحة الأم', what: 'لما يوصلك طلب انضمام تاجر، أو طلب علامات، أو طلب اشتراك متجر، أو تنبيه مخزون' });

// ---------- النوافذ ----------
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) openDialog(open.dataset.open);
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
});
function openDialog(id, merchant) {
  if (id === 'dlg-merchant') {
    const f = $('merchant-form');
    f.reset();
    f.id.value = merchant?.id ?? '';
    $('merchant-form-title').textContent = merchant ? `تعديل ${merchant.name}` : 'تاجر جديد';
    $('merchant-status-field').hidden = !merchant;
    $('merchant-store-field').hidden = !merchant;
    $('merchant-sound-field').hidden = !merchant;
    f.slug.readOnly = Boolean(merchant);
    if (merchant) for (const k of ['name', 'slug', 'brand_color', 'logo_url', 'store_url', 'whatsapp', 'low_stock_threshold', 'max_checks', 'status']) if (merchant[k] != null) f[k].value = merchant[k];
    f.public_listed.checked = Boolean(merchant?.public_listed);
    f.store_enabled.checked = Boolean(merchant?.store_enabled);
    f.verify_sound.checked = merchant ? Boolean(merchant.verify_sound) : true;
  }
  if (id === 'dlg-batch' || id === 'dlg-user') {
    const opts = merchants.map((m) => html`<option value="${m.id}">${m.name}</option>`);
    render($('batch-merchant'), html`${opts}`);
    render($('user-merchant'), html`${opts}`);
  }
  $(id).showModal();
}

const optional = (v) => (v === '' ? null : v);
onSubmit($('merchant-form'), async (f, form) => {
  const body = {
    name: f.name, brand_color: f.brand_color, logo_url: optional(f.logo_url), store_url: optional(f.store_url), whatsapp: optional(f.whatsapp),
    low_stock_threshold: Number(f.low_stock_threshold), max_checks: Number(f.max_checks), public_listed: f.public_listed === 'on',
  };
  if (f.id) await api(`/api/admin/merchants/${f.id}`, { method: 'PATCH', body: { ...body, status: f.status, store_enabled: f.store_enabled === 'on', verify_sound: f.verify_sound === 'on' } });
  else {
    const r = await api('/api/admin/merchants', { method: 'POST', body: { ...body, slug: f.slug } });
    // التاجر جاي من طلب انضمام: نعلّم الطلب إنه اشترك
    if (pendingLead) await api('/api/admin/leads/' + pendingLead, { method: 'PATCH', body: { status: 'subscribed', merchant_id: r.merchant.id } }).catch(() => {});
  }
  pendingLead = null;
  form.closest('dialog').close();
  toast('تم حفظ التاجر');
  refresh();
});
onSubmit($('batch-form'), async (f, form) => {
  const d = await api('/api/admin/batches', {
    method: 'POST',
    body: { merchant_id: Number(f.merchant_id), code: f.code, kind: f.kind, size: Number(f.size), product_name: optional(f.product_name), produced_on: optional(f.produced_on), is_test: f.is_test === 'on' },
  });
  form.closest('dialog').close();
  toast(`تم إنشاء الدفعة ${d.batch.code}. نزّل ملف المصنع من قائمة الدفعات.`);
  refresh();
});
$('user-role').addEventListener('change', (e) => ($('user-merchant-field').hidden = e.target.value === 'admin'));
onSubmit($('user-form'), async (f, form) => {
  await api('/api/admin/users', { method: 'POST', body: { role: f.role, merchant_id: f.role === 'merchant' ? Number(f.merchant_id) : null, name: f.name, email: f.email, password: f.password } });
  form.closest('dialog').close();
  toast('تم إنشاء الحساب. أرسل كلمة المرور المؤقتة لصاحبه بطريقة آمنة.');
  refresh();
});

// ---------- الجداول ----------
function merchantRows(list, withEdit) {
  if (!list.length) return html`<div class="empty">ما فيه تجار للحين. أضف أول تاجر.</div>`;
  return html`<table style="min-width:820px"><thead><tr>
    <th>التاجر</th><th>العلامات المصدرة</th><th>المتبقي</th><th>بانتظار الشحن</th><th>مسحات 7 أيام</th><th>المسابقة</th><th>الحالة</th><th><span class="sr-only">إجراءات</span></th>
  </tr></thead><tbody>${list.map((m) => {
    const low = m.stock.active > 0 && m.stock.remaining <= m.low_stock_threshold;
    const status = m.status !== 'active' ? pill({ x: ['موقوف', 'err'] }, 'x') : low ? pill({ x: ['مخزون منخفض', 'warn'] }, 'x') : pill({ x: ['نشط', 'ok'] }, 'x');
    return html`<tr>
      <td><b>${m.name}</b>${m.store_enabled ? html` <span class="pill ok" title="مشترك في متاجر أصالة">🛍️ متجر</span>` : ''}${m.verify_sound ? '' : html` <span class="pill" title="صوت نتيجة التحقق موقوف">🔇</span>`}<div class="small muted ltr">${m.slug}</div></td>
      <td>${num(m.stock.issued)}</td>
      <td style="font-weight:600;color:${low ? '#8A5300' : 'inherit'}">${num(m.stock.remaining)}${m.stock.days_left != null ? html`<div class="small muted">يخلص خلال ${m.stock.days_left} يوم</div>` : ''}</td>
      <td>${num(m.stock.pending)}</td>
      <td>${num(m.scans_7d)}</td>
      <td>${m.contest_enabled ? 'مفعّلة' : 'موقوفة'}</td>
      <td>${status}</td>
      <td>${withEdit ? html`<div class="actions"><button class="btn btn-sm" type="button" data-edit-merchant="${m.id}">تعديل</button><button class="btn btn-sm" type="button" data-logo-for="${m.id}">${m.logo_key ? 'تغيير الشعار' : 'رفع الشعار'}</button><a class="btn btn-sm" href="/report/?merchant=${m.id}" target="_blank" rel="noopener">التقرير</a></div>` : html`<button class="btn" type="button" data-batch-for="${m.id}">دفعة جديدة</button>`}</td>
    </tr>`;
  })}</tbody></table>`;
}
// رفع الشعار وصورة المنتج من اللوحة الأم
document.addEventListener('click', async (e) => {
  const lg = e.target.closest('[data-logo-for]'), bi = e.target.closest('[data-batch-image]');
  if (!lg && !bi) return;
  try {
    const img = await pickImage(lg ? 600 : 1200);
    if (!img) return;
    if (lg) { await api(`/api/admin/merchants/${lg.dataset.logoFor}/logo`, { method: 'POST', body: img }); toast('تم رفع الشعار'); loadMerchants(); }
    else { await api(`/api/admin/batches/${bi.dataset.batchImage}/image`, { method: 'POST', body: img }); toast('تم رفع صورة المنتج'); loadBatches(); }
  } catch (err) { toast(err.message, true); }
});
document.addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit-merchant]');
  if (edit) openDialog('dlg-merchant', merchants.find((m) => m.id === Number(edit.dataset.editMerchant)));
  const nb = e.target.closest('[data-batch-for]');
  if (nb) {
    openDialog('dlg-batch');
    $('batch-merchant').value = nb.dataset.batchFor;
  }
});

async function loadHome() {
  loadHealth().catch(() => {});
  const d = await api('/api/admin/overview');
  merchants = d.merchants;
  const o = d.overview;
  render($('home-kpis'), html`
    <div class="kpi"><span class="label">العلامات المصدرة</span><span class="value">${num(d.totals.issued)}</span><span class="note">المتبقي في السوق ${num(d.totals.remaining)}</span></div>
    <div class="kpi"><span class="label">مسحات اليوم</span><span class="value">${num(o.scans_today)}</span><span class="note">${num(o.scans_7d)} خلال 7 أيام</span></div>
    <div class="kpi"><span class="label">تجار نشطون</span><span class="value">${num(d.totals.active_merchants)} من ${num(merchants.length)}</span><span class="note">نسبة الأصلي ${o.original_ratio ?? '-'}%</span></div>
    <div class="kpi"><span class="label">أكواد مزيّفة اليوم</span><span class="value">${num(o.unknown_today)}</span><span class="note bad">${num(o.reports_7d)} بلاغ خلال 7 أيام</span></div>`);
  const unread = d.alerts.filter((a) => !a.read_at);
  render($('home-alerts'), html`${unread.map((a) => html`<div class="alert ${['tag_request', 'join_request', 'store_request', 'password_request', 'credit_request'].includes(a.kind) ? 'info' : a.kind === 'low_stock' ? 'warn' : 'err'}"><div><b>${a.merchant_name || 'المنصة'}</b><div class="small">${a.message} · ${when(a.created_at)}</div></div></div>`)}${unread.length ? html`<div><button class="btn" type="button" id="alerts-read">تم الاطلاع على التنبيهات</button></div>` : ''}`);
  $('alerts-read')?.addEventListener('click', async () => { await api('/api/admin/alerts/read', { method: 'POST', body: {} }); loadHome(); });
  render($('home-bars'), bars(o.daily));
  render($('home-cities'), hbars(o.cities_7d));
  render($('home-merchants'), merchantRows(merchants, false));
  $('unknown-badge').textContent = o.unknown_today ? num(o.unknown_today) : '';
  return d;
}

$('sound-global').addEventListener('change', async (e) => {
  try { await api('/api/admin/sound', { method: 'PATCH', body: { enabled: e.target.checked } }); toast(e.target.checked ? 'صوت النتيجة شغّال لكل المنصة 🔔' : 'وقّفنا الصوت لكل المنصة'); } catch (err) { toast(err.message, true); }
});
const CLIPS = [
  ['hi', 'الترحيب (قبل الجرس)', 'هلا والله، المنتج أصلي'],
  ['thanks', 'الشكر (بعد الجرس)', 'شكراً إنك اخترت المنتج الأصلي، وصحتين وعافية!'],
  ['warn', 'التحذير (المقلّد)', 'احذر! المنتج يُشتبه إنه مزوّر أو مقلّد. بلّغ عنه على الفور.'],
];
function drawClips(clips) {
  render($('sound-clips'), html`${CLIPS.map(([k, label, text]) => html`<div class="sound-clip">
    <div><b>${label}</b><div class="small muted">«${text}»</div></div>
    ${clips[k] ? html`<audio controls preload="none" src="${clips[k]}"></audio>` : html`<span class="pill">الصوت الافتراضي</span>`}
    <div class="actions">
      <button class="btn btn-sm btn-primary" type="button" data-clip-rec="${k}">🎙️ سجّل</button>
      <label class="btn btn-sm">📁 ارفع<input type="file" accept="audio/*" data-clip-file="${k}" hidden></label>
      ${clips[k] ? html`<button class="btn btn-sm" type="button" data-clip-reset="${k}">↩️ الافتراضي</button>` : ''}
    </div>
  </div>`)}`);
}
async function loadSound() {
  const d = await api('/api/admin/sound');
  $('sound-global').checked = d.enabled;
  soundCustom = d.clips || {};
  drawClips(soundCustom);
}
async function uploadClip(k, blob) {
  if (blob.size > 1.5 * 1024 * 1024) return toast('التسجيل طويل، خلّه أقل من 30 ثانية', true);
  $('clip-status').textContent = 'نرفع التسجيل…';
  try {
    await api('/api/admin/sound/clip/' + k, { method: 'POST', body: blob });
    toast('تم، صار العملاء يسمعون تسجيلك 🔊');
    await loadSound();
  } catch (err) { toast(err.message, true); }
  $('clip-status').textContent = '';
}
let clipRec = null;
$('sound-clips').addEventListener('click', async (e) => {
  const reset = e.target.closest('[data-clip-reset]');
  if (reset) {
    if (!confirm('ترجع للصوت الافتراضي؟')) return;
    try { await api('/api/admin/sound/clip/' + reset.dataset.clipReset, { method: 'DELETE' }); await loadSound(); } catch (err) { toast(err.message, true); }
    return;
  }
  const b = e.target.closest('[data-clip-rec]');
  if (!b) return;
  if (clipRec) return clipRec.stop();
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('جهازك ما يدعم التسجيل هنا، ارفع ملف صوت بدال', true);
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('اسمح للمتصفح يستخدم المايك', true); }
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  const rec = (clipRec = new MediaRecorder(stream, type ? { mimeType: type } : {}));
  const parts = [];
  let left = 30;
  const tick = setInterval(() => { left--; $('clip-status').textContent = `جاري التسجيل… باقي ${left} ثانية، اضغط «وقّف» لما تخلص`; if (left <= 0) rec.stop(); }, 1000);
  rec.ondataavailable = (ev) => ev.data.size && parts.push(ev.data);
  rec.onstop = () => {
    clearInterval(tick);
    stream.getTracks().forEach((t) => t.stop());
    clipRec = null;
    b.textContent = '🎙️ سجّل';
    uploadClip(b.dataset.clipRec, new Blob(parts, { type: (rec.mimeType || 'audio/webm').split(';')[0] }));
  };
  rec.start();
  b.textContent = '⏹️ وقّف';
  $('clip-status').textContent = 'جاري التسجيل… تكلّم الحين';
});
$('sound-clips').addEventListener('change', (e) => {
  const f = e.target.closest('[data-clip-file]');
  if (f?.files[0]) uploadClip(f.dataset.clipFile, f.files[0]);
  if (f) f.value = '';
});
let soundCustom = {};
$('sound-try-ok').addEventListener('click', () => playResult('original', false, soundCustom).catch(() => {}));
$('sound-try-bad').addEventListener('click', () => playResult('fake', false, soundCustom).catch(() => {}));
async function loadMerchants() {
  loadSound().catch(() => {});
  merchants = (await api('/api/admin/merchants')).merchants;
  render($('merchants-table'), merchantRows(merchants, true));
}

async function loadBatches() {
  if (!merchants.length) merchants = (await api('/api/admin/merchants')).merchants;
  const { batches } = await api('/api/admin/batches');
  render($('batches-table'), !batches.length ? html`<div class="empty">ما فيه دفعات للحين.</div>` : html`<table style="min-width:860px"><thead><tr>
    <th>الدفعة</th><th>التاجر</th><th>العدد</th><th>المنتج</th><th>الحالة</th><th>أُنشئت</th><th><span class="sr-only">إجراءات</span></th>
  </tr></thead><tbody>${batches.map((b) => html`<tr>
    <td><b class="ltr">${b.code}</b>${b.is_test ? html` <span class="pill warn">تجريبية</span>` : ''}${b.kind === 'qr' ? html` <span class="pill ok">QR</span>` : ''}</td>
    <td>${b.merchant_name}</td><td>${num(b.size)}</td><td>${b.product_name || '-'}</td>
    <td>${pill(BATCH_STATUS, b.status)}</td><td>${when(b.created_at)}</td>
    <td><div class="actions">
      ${b.image_url ? html`<img src="${b.image_url}" alt="" class="thumb" style="width:36px;height:36px">` : ''}
      <button class="btn btn-sm" type="button" data-batch-image="${b.id}">${b.image_url ? 'تغيير الصورة' : 'صورة المنتج'}</button>
      ${b.kind === 'qr' ? html`<a class="btn btn-gold" href="/print/?b=${b.id}" target="_blank" rel="noopener">🖨️ اطبع QR</a>` : html`<button class="btn" type="button" data-factory="${b.id}" data-code="${b.code}" data-size="${b.size}">ملف المصنع</button>`}
      ${b.status === 'active' ? html`<button class="btn btn-danger" type="button" data-batch-status="blocked" data-id="${b.id}">إيقاف</button>` : html`<button class="btn btn-primary" type="button" data-batch-status="active" data-id="${b.id}">تفعيل</button>`}
    </div></td>
  </tr>`)}</tbody></table>`);
}
document.addEventListener('click', async (e) => {
  const st = e.target.closest('[data-batch-status]');
  if (st) {
    const activating = st.dataset.batchStatus === 'active';
    if (!confirm(activating ? 'تفعيل الدفعة يعني العلامات صارت في السوق وتنقبل عند العملاء. تكمل؟' : 'إيقاف الدفعة يخلي كل علاماتها تظهر للعميل كموقوفة. تكمل؟')) return;
    try {
      await api(`/api/admin/batches/${st.dataset.id}`, { method: 'PATCH', body: { status: st.dataset.batchStatus } });
      toast(activating ? 'تم تفعيل الدفعة' : 'تم إيقاف الدفعة');
      loadBatches();
    } catch (err) { toast(err.message, true); }
  }
  const fb = e.target.closest('[data-factory]');
  if (fb) downloadFactory(fb);
});

// ملف المصنع ينزل على أجزاء من 10 آلاف ويتجمّع في ملف واحد
async function downloadFactory(btn) {
  const size = Number(btn.dataset.size), id = btn.dataset.factory, chunk = 10000;
  btn.disabled = true;
  try {
    let out = '';
    for (let from = 1; from <= size; from += chunk) {
      btn.textContent = `جاري التجهيز ${Math.min(100, Math.round(((from - 1) / size) * 100))}%`;
      const res = await fetch(`/api/admin/batches/${id}/factory.csv?from=${from}&to=${Math.min(size, from + chunk - 1)}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'تعذر تنزيل الملف');
      const text = (await res.text()).replace(/^﻿/, '');
      out += from === 1 ? text : text.slice(text.indexOf('\r\n'));
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out], { type: 'text/csv;charset=utf-8' }));
    a.download = `${btn.dataset.code}-factory.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('نزل ملف المصنع. أرسله للمصنع فقط، واحتفظ بنسخة في مكان آمن.');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'ملف المصنع';
  }
}

// ---------- العلامات ----------
function tagCard(t) {
  return html`<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line-soft);padding-top:14px">
    <div class="card-head"><b class="ltr" style="font-size:18px">${t.public_id}</b>${pill(TAG_STATUS, t.status)}</div>
    <div class="small muted">الدفعة ${t.batch.code} ${pill(BATCH_STATUS, t.batch.status)} · ${t.batch.product_name || ''}</div>
    <div class="form-grid small">
      <div>الفحوصات: <b>${t.check_count}</b></div><div>الأجهزة: <b>${t.devices}</b></div>
      <div>أول فحص: <b>${when(t.first_checked_at)}</b></div><div>آخر فحص: <b>${when(t.last_checked_at)}</b></div>
    </div>
    ${t.entry ? html`<div class="alert info small"><div>مشاركة: ${t.entry.customer_name} · <span class="ltr">${t.entry.phone}</span> · ${t.entry.city}</div></div>` : ''}
    ${t.checks.length ? html`<table><thead><tr><th>النتيجة</th><th>الفحص</th><th>المدينة</th><th>الوقت</th></tr></thead><tbody>${t.checks.map((c) => html`<tr><td>${pill(RESULT, c.result)}</td><td>${c.check_no ?? '-'}</td><td>${c.city || '-'}</td><td>${when(c.created_at)}</td></tr>`)}</tbody></table>` : html`<div class="empty">ما انمسحت هذي العلامة للحين</div>`}
  </div>`;
}
onSubmit($('lookup-form'), async (f) => {
  const { tag } = await api('/api/admin/tags/lookup?q=' + encodeURIComponent(f.q));
  render($('lookup-result'), tagCard(tag));
  const sf = $('status-form');
  sf.batch_code.value = tag.batch.code;
  sf.from.value = tag.serial;
  sf.to.value = '';
});
onSubmit($('status-form'), async (f) => {
  const body = { batch_code: f.batch_code, from: Number(f.from), to: f.to ? Number(f.to) : Number(f.from), action: f.action };
  const label = body.from === body.to ? `العلامة ${body.from}` : `العلامات من ${body.from} إلى ${body.to}`;
  if (!confirm(`${f.action === 'block' ? 'إيقاف' : 'تفعيل'} ${label} في الدفعة ${body.batch_code.toUpperCase()}؟`)) return;
  const d = await api('/api/admin/tags/status', { method: 'POST', body });
  toast(`تم ${f.action === 'block' ? 'الإيقاف' : 'التفعيل'}: ${num(d.changes)} علامة تغيّرت`);
});

// ---------- البلاغات والحسابات والسجل ----------
async function loadReports() {
  const [ov, rep, hot] = await Promise.all([api('/api/admin/overview'), api('/api/admin/reports'), api('/api/admin/hotspots?days=' + $('hot-days').value)]);
  render($('hotspots'), hotspotsTable(hot.hotspots));
  render($('unknown-table'), !ov.unknown.length ? html`<div class="empty">ما فيه أكواد مزيّفة</div>` : html`<table><thead><tr><th>بداية الكود</th><th>التاجر المنتحَل</th><th>المحاولات</th><th>المكان</th><th>آخر مرة</th></tr></thead><tbody>${ov.unknown.map((u) => html`<tr><td class="mono">${u.preview}…</td><td>${u.merchant_name || '-'}</td><td>${num(u.count)}</td><td>${u.city || '-'}</td><td>${when(u.last_at)}</td></tr>`)}</tbody></table>`);
  render($('reports-table'), !rep.reports.length ? html`<div class="empty">ما فيه بلاغات</div>` : html`<table><thead><tr><th>التاجر</th><th>المدينة</th><th>المحل</th><th>ملاحظة</th><th>الوقت</th></tr></thead><tbody>${rep.reports.map((r) => html`<tr><td>${r.merchant_name || '-'}</td><td>${r.city}</td><td>${r.point_of_sale}</td><td>${r.note || '-'}${r.photo_key ? html`<div class="ev"><a href="/api/admin/evidence/${r.photo_key}" target="_blank" rel="noopener"><img src="/api/admin/evidence/${r.photo_key}" alt="صورة البلاغ" loading="lazy"></a><div>${r.ai_score != null ? html`<span class="pill ${r.ai_score >= 60 ? 'err' : r.ai_score >= 30 ? 'warn' : 'ok'}">احتمال التقليد ${r.ai_score}٪</span>` : ''}${r.ai_verdict ? html`<div class="small">${r.ai_verdict}</div>` : ''}</div></div>` : ''}</td><td>${when(r.created_at)}</td></tr>`)}</tbody></table>`);
  const { claims } = await api('/api/admin/guarantee');
  $('claims-card').hidden = !claims.length;
  const CL = { new: ['جديد', 'warn'], approved: ['مقبول', 'ok'], rejected: ['مرفوض', 'err'] };
  render($('claims-table'), html`<table><thead><tr><th>التاجر</th><th>المدينة والمحل</th><th>وش لاحظ العميل</th><th>الحالة</th><th>الوقت</th></tr></thead><tbody>${claims.map((c) => html`<tr><td>${c.merchant_name}</td><td>${c.city}<div class="small muted">${c.point_of_sale}</div></td><td>${c.note}${c.photo_key ? html`<div class="ev"><a href="/api/admin/evidence/${c.photo_key}" target="_blank" rel="noopener"><img src="/api/admin/evidence/${c.photo_key}" alt="صورة" loading="lazy"></a></div>` : ''}</td><td>${pill(CL, c.status)}${c.decision_note ? html`<div class="small muted">${c.decision_note}</div>` : ''}</td><td>${when(c.created_at)}</td></tr>`)}</tbody></table>`);
}
async function loadUsers() {
  if (!merchants.length) merchants = (await api('/api/admin/merchants')).merchants;
  const { users } = await api('/api/admin/users');
  render($('users-table'), html`<table style="min-width:720px"><thead><tr><th>الاسم</th><th>البريد</th><th>النوع</th><th>آخر دخول</th><th>الحالة</th><th><span class="sr-only">إجراءات</span></th></tr></thead><tbody>${users.map((u) => html`<tr>
    <td><b>${u.name}</b></td><td class="ltr">${u.email}</td><td>${u.role === 'admin' ? 'مدير عام' : (u.merchant_role === 'staff' ? 'موظف عند ' : 'تاجر: ') + (u.merchant_name || '')}</td><td>${when(u.last_login_at)}</td>
    <td>${u.status === 'active' ? pill({ x: ['نشط', 'ok'] }, 'x') : pill({ x: ['موقوف', 'err'] }, 'x')}</td>
    <td>${u.id === me.user.id ? '' : html`<div class="actions"><button class="btn" type="button" data-user="${u.id}" data-user-status="${u.status === 'active' ? 'disabled' : 'active'}">${u.status === 'active' ? 'إيقاف' : 'تفعيل'}</button><button class="btn" type="button" data-user-link="${u.id}" data-wa="${u.merchant_whatsapp || ''}" data-name="${u.name}">رابط تغيير كلمة المرور</button><button class="btn" type="button" data-user-reset="${u.id}">كلمة مرور مؤقتة</button></div>`}</td>
  </tr>`)}</tbody></table>`);
}
document.addEventListener('click', async (e) => {
  const s = e.target.closest('[data-user-status]');
  const r = e.target.closest('[data-user-reset]');
  const l = e.target.closest('[data-user-link]');
  try {
    if (l) {
      const d = await api(`/api/admin/users/${l.dataset.userLink}/reset-link`, { method: 'POST', body: {} });
      $('reset-link').value = d.link;
      const msg = `هلا ${l.dataset.name}، هذا رابط تغيير كلمة المرور في أصالة (يشتغل مرة وحدة خلال 24 ساعة):\n${d.link}`;
      const wa = (l.dataset.wa || '').replace(/\D/g, '');
      $('reset-wa').href = 'https://wa.me/' + (wa ? wa : '') + '?text=' + encodeURIComponent(msg);
      $('dlg-reset').showModal();
    }
    if (s) {
      await api(`/api/admin/users/${s.dataset.user}`, { method: 'PATCH', body: { status: s.dataset.userStatus } });
      toast('تم تحديث الحساب');
      loadUsers();
    }
    if (r) {
      const p = prompt('اكتب كلمة مرور مؤقتة جديدة (10 أحرف أو أكثر):');
      if (!p) return;
      await api(`/api/admin/users/${r.dataset.userReset}`, { method: 'PATCH', body: { password: p } });
      toast('تم تغيير كلمة المرور، وانقفلت جلسات الحساب المفتوحة');
    }
  } catch (err) { toast(err.message, true); }
});
$('reset-copy').addEventListener('click', async () => {
  await navigator.clipboard?.writeText($('reset-link').value).catch(() => {});
  $('reset-link').select();
  toast('نسخنا الرابط');
});

// ---------- المتاجر ----------
const ST = { kind: 'products', merchants: null };
const CAT_AR = { perfume: 'عطور وبخور', coffee: 'قهوة وشاي', food: 'تمور وأغذية', health: 'صحة ومكملات', beauty: 'عناية وتجميل', fashion: 'أزياء', accessories: 'شنط وإكسسوارات', watches: 'ساعات', home: 'المنزل', kids: 'أطفال', electronics: 'إلكترونيات', other: 'أخرى' };
const sarAd = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س');
async function loadStore() {
  const d = await api('/api/admin/store');
  const s = d.summary;
  render($('store-kpis'), html`
    <div class="kpi"><span class="label">متاجر مشتركة</span><span class="value">${num(s.stores)}</span></div>
    <div class="kpi"><span class="label">منتجات معروضة</span><span class="value">${num(s.products)}</span><span class="note">${num(s.reels)} ريل</span></div>
    <div class="kpi"><span class="label">ضغطات "اشتر" 7 أيام</span><span class="value">${num(s.clicks_7d)}</span></div>
    <div class="kpi"><span class="label">تعليقات 7 أيام</span><span class="value">${num(s.comments_7d)}</span><span class="note ${s.blocked ? 'bad' : ''}">${num(s.blocked)} موقوف من الإدارة</span></div>`);
  if (!ST.merchants) {
    ST.merchants = d.merchants;
    render($('store-merchant'), html`<option value="">كل التجار</option>${d.merchants.map((m) => html`<option value="${m.id}">${m.name}</option>`)}`);
  }
  await loadStoreList();
}
async function loadStoreList() {
  const f = $('store-filter');
  const q = new URLSearchParams({ q: f.q.value.trim() });
  if (f.merchant.value) q.set('merchant', f.merchant.value);
  if (f.blocked.checked && ST.kind !== 'comments') q.set('blocked', '1');
  $('store-blocked-f').hidden = ST.kind === 'comments';
  const el = $('store-list');
  if (ST.kind === 'comments') {
    const { comments } = await api('/api/admin/store/comments?' + q);
    return render(el, !comments.length ? html`<div class="empty">ما فيه تعليقات</div>` : html`${comments.map((c) => html`<div class="ad-cm">
      <div><b>${c.name}</b> ${c.rating ? '⭐'.repeat(c.rating) : ''} <span class="small muted">على ${c.kind === 'reels' ? 'ريل' : 'منتج'} «${c.title}» · ${c.merchant_name} · ${when(c.created_at)}</span>
        ${c.body ? html`<p>${c.body}</p>` : ''}${c.reply ? html`<div class="reply">رد التاجر: ${c.reply}</div>` : ''}</div>
      <button class="btn btn-sm btn-danger" type="button" data-ad-cdel="${c.kind}/${c.item_id}/${c.id}">حذف</button></div>`)}`);
  }
  if (ST.kind === 'products') {
    const { products } = await api('/api/admin/store/products?' + q);
    return render(el, !products.length ? html`<div class="empty">ما فيه منتجات</div>` : html`<div class="ad-items">${products.map((p) => html`<article class="ad-item ${p.admin_blocked ? 'off' : ''}">
      <div class="media">${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : '🛍️'}${p.admin_blocked ? html`<span class="pill err">موقوف من الإدارة</span>` : p.status !== 'active' ? html`<span class="pill">مخفي من التاجر</span>` : ''}</div>
      <div class="info"><b>${p.title}</b><span class="small muted">${p.merchant_name} · ${CAT_AR[p.category] || p.category} · ${sarAd(p.price)}</span>
        <span class="small muted">👁 ${num(p.views)} · 🛒 ${num(p.clicks)} · 💬 ${num(p.comments)}${p.rating_n ? ` · ⭐ ${(p.rating_sum / p.rating_n).toFixed(1)}` : ''}</span>
        <div class="actions"><a class="btn btn-sm" href="${p.buy_url}" target="_blank" rel="noopener">صفحته في سلة ↗</a>${p.admin_blocked ? html`<button class="btn btn-sm btn-primary" type="button" data-ad-block="products/${p.id}" data-on="0">إرجاع</button>` : html`<button class="btn btn-sm btn-danger" type="button" data-ad-block="products/${p.id}" data-on="1">إيقاف</button>`}</div></div>
    </article>`)}</div>`);
  }
  const { reels } = await api('/api/admin/store/reels?' + q);
  render(el, !reels.length ? html`<div class="empty">ما فيه ريلز</div>` : html`<div class="ad-items">${reels.map((r) => html`<article class="ad-item reel ${r.admin_blocked ? 'off' : ''}">
    <div class="media">${r.video_url ? html`<video src="${r.video_url}" poster="${r.poster_url || ''}" preload="none" controls playsinline></video>` : r.poster_url ? html`<img src="${r.poster_url}" alt="">` : '🎬'}${r.admin_blocked ? html`<span class="pill err">موقوف من الإدارة</span>` : r.status !== 'active' ? html`<span class="pill">مخفي من التاجر</span>` : r.publish_at && r.publish_at * 1000 > Date.now() ? html`<span class="pill warn">مجدول</span>` : ''}</div>
    <div class="info"><b>${r.title}</b><span class="small muted">${r.merchant_name} · ${when(r.created_at)}</span>
      <span class="small muted">👁 ${num(r.views)} · 🛒 ${num(r.clicks)} · ❤️ ${num(r.likes)} · 💬 ${num(r.comments)}</span>
      <div class="actions">${r.admin_blocked ? html`<button class="btn btn-sm btn-primary" type="button" data-ad-block="reels/${r.id}" data-on="0">إرجاع</button>` : html`<button class="btn btn-sm btn-danger" type="button" data-ad-block="reels/${r.id}" data-on="1">إيقاف</button>`}</div></div>
  </article>`)}</div>`);
}
$('store-kind').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  ST.kind = b.dataset.kind;
  $('store-kind').querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  loadStoreList().catch((err) => toast(err.message, true));
});
onSubmit($('store-filter'), () => loadStoreList());
$('store-merchant').addEventListener('change', () => loadStoreList().catch((err) => toast(err.message, true)));
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ad-block]'), c = e.target.closest('[data-ad-cdel]');
  if (!b && !c) return;
  try {
    if (b) {
      const on = b.dataset.on === '1';
      let reason = null;
      if (on) {
        reason = prompt('سبب الإيقاف (يوصل للتاجر، اختياري):');
        if (reason === null) return;
      }
      await api(`/api/admin/store/${b.dataset.adBlock}/block`, { method: 'POST', body: { blocked: on, reason: reason || null } });
      toast(on ? 'تم الإيقاف ووصل تنبيه للتاجر' : 'رجع يظهر في المتاجر');
    } else {
      if (!confirm('تحذف التعليق؟')) return;
      const [kind, item, id] = c.dataset.adCdel.split('/');
      await api(`/api/admin/store/${kind}/${item}/comments/${id}`, { method: 'DELETE' });
      toast('انحذف التعليق');
    }
    loadStore();
  } catch (err) { toast(err.message, true); }
});

const ACTIONS = {
  login: 'دخول', merchant_created: 'إنشاء تاجر', merchant_updated: 'تعديل تاجر', user_created: 'إنشاء حساب', user_updated: 'تعديل حساب',
  batch_created: 'إنشاء دفعة', batch_active: 'تفعيل دفعة', batch_blocked: 'إيقاف دفعة', factory_file_downloaded: 'تنزيل ملف المصنع', qr_printed: 'طباعة ملصقات QR', push_sent: 'إرسال إشعار', push_cleared: 'حذف كل الإشعارات', push_hidden: 'حذف إشعار',
  tags_block: 'إيقاف علامات', tags_activate: 'تفعيل علامات', settings_updated: 'تعديل إعدادات التاجر', entries_exported: 'تصدير المشاركات',
  password_changed: 'تغيير كلمة المرور', tags_requested: 'طلب علامات', setup_admin_created: 'إعداد النظام',
  reset_link_created: 'رابط تغيير كلمة المرور', password_reset_done: 'تغيير كلمة المرور بالرابط', staff_created: 'إضافة موظف', staff_updated: 'تعديل موظف',
  store_item_blocked: 'إيقاف من المتاجر', store_item_unblocked: 'إرجاع للمتاجر', store_comment_deleted: 'حذف تعليق', comment_replied: 'رد على تعليق',
};
async function loadAudit() {
  const { audit } = await api('/api/admin/audit');
  render($('audit-table'), html`<table style="min-width:720px"><thead><tr><th>الوقت</th><th>الحساب</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${audit.map((a) => html`<tr><td>${when(a.created_at)}</td><td class="ltr">${a.email || '-'}</td><td>${ACTIONS[a.action] || a.action}</td><td class="mono small" style="white-space:normal;word-break:break-all">${a.detail || ''}</td></tr>`)}</tbody></table>`);
}

$('hot-days').addEventListener('change', () => loadReports().catch((e) => toast(e.message, true)));
// ---------- الإشعارات ----------
const AUD = { all: 'الكل (مسجل وبدون تسجيل)', accounts: 'المسجلين', ar: 'العربي', en: 'الإنجليزي' };
const PST = { sending: ['يرسل…', 'warn'], done: ['انرسل', 'ok'], stopped: ['موقوف', 'err'] };
let pushProducts = null;
async function loadPush() {
  const d = await api('/api/admin/push');
  const s = d.stats;
  render($('push-kpis'), html`
    <div class="kpi"><span class="label">أجهزة مشتركة</span><span class="value">${num(s.total)}</span><span class="note">+${num(s.week)} هالأسبوع</span></div>
    <div class="kpi"><span class="label">مسجلين بحساب</span><span class="value">${num(s.accounts)}</span></div>
    <div class="kpi"><span class="label">عربي / إنجليزي</span><span class="value">${num(s.ar)} / ${num(s.en)}</span></div>
    <div class="kpi"><span class="label">إشعارات مرسلة</span><span class="value">${num(d.campaigns.length)}</span></div>`);
  render($('push-list'), !d.campaigns.length ? html`<div class="empty">ما أرسلت إشعارات للحين</div>` : html`<table><thead><tr><th>الإشعار</th><th>لمين</th><th>وصل</th><th>ضغطات</th><th>الحالة</th><th>متى</th><th></th></tr></thead><tbody>
    ${d.campaigns.map((c) => html`<tr><td><b>${c.title}</b><div class="small muted">${c.body}</div></td><td>${AUD[c.audience] || c.audience}</td>
      <td>${num(c.sent)} / ${num(c.total)}${c.failed ? html`<div class="small muted">${num(c.failed)} ما وصل</div>` : ''}</td>
      <td>${num(c.clicks)}${c.sent ? html` <span class="small muted">(${Math.round((c.clicks / c.sent) * 100)}%)</span>` : ''}</td>
      <td>${c.hidden_at ? html`<span class="pill">🗑️ محذوف</span>` : pill(PST, c.status)}</td><td class="small">${when(c.created_at)}</td>
      <td>${c.status === 'sending' ? html`<button type="button" class="btn btn-sm" data-push-go="${c.id}">كمّل</button> <button type="button" class="btn btn-sm" data-push-stop="${c.id}">أوقف</button> ` : ''}${c.hidden_at ? '' : html`<button type="button" class="btn btn-sm" data-push-hide="${c.id}">احذف</button>`}</td></tr>`)}</tbody></table>`);
  if (!pushProducts) {
    const r = await fetch('/api/public/store/products?limit=200').then((x) => x.json()).catch(() => ({ products: [] }));
    pushProducts = r.products || [];
    render($('push-form').product_id, html`${pushProducts.map((p) => html`<option value="${p.id}">${p.title} · ${p.merchant_name}</option>`)}`);
  }
  pushPreview();
}
function pushPreview() {
  const f = $('push-form');
  for (const k of ['title', 'body']) f.querySelector(`[data-count="${k}"]`).textContent = f[k].value.length;
  $('push-product').hidden = f.target.value !== 'product';
  $('push-url').hidden = f.target.value !== 'url';
  const p = f.target.value === 'product' && pushProducts?.find((x) => String(x.id) === f.product_id.value);
  render($('push-preview'), html`<div class="ad-notif-h"><img src="/stores/icons/icon-192.png" alt="" width="20" height="20"><span>متاجر أصالة · الآن</span></div>
    <b>${f.title.value || 'عنوان الإشعار'}</b><p>${f.body.value || 'نص الإشعار يطلع هنا'}</p>${p?.image_url ? html`<img class="ad-notif-img" src="${p.image_url}" alt="">` : ''}`);
}
$('push-form').addEventListener('input', pushPreview);
// الإرسال يمشي دفعات: الصفحة تكمل لين يخلص، ولو قفلتها يكمّل تلقائياً كل ساعة
async function drivePush(c) {
  const bar = $('push-progress');
  while (c && c.status === 'sending') {
    render(bar, html`<div class="ad-prog"><i style="width:${Math.round(((c.sent + c.failed) / Math.max(1, c.total)) * 100)}%"></i></div><p class="small muted">يرسل… ${num(c.sent + c.failed)} من ${num(c.total)}</p>`);
    c = (await api(`/api/admin/push/${c.id}/continue`, { method: 'POST', body: {} })).campaign;
  }
  render(bar, c ? html`<p class="small">✅ وصل لـ ${num(c.sent)} جهاز${c.failed ? ` · ${num(c.failed)} ما وصل (أجهزة ألغت الاشتراك)` : ''}</p>` : '');
  loadPush();
}
onSubmit($('push-form'), async (data, form) => {
  if (!confirm(`نرسل الإشعار «${data.title}» لـ ${AUD[data.audience]}؟ ما يمديك ترجعه بعد الإرسال.`)) return;
  const body = { title: data.title, body: data.body, audience: data.audience };
  if (data.target === 'product') body.product_id = Number(data.product_id);
  else if (data.target === 'reels') body.url = '/stores/?v=reels';
  else if (data.target === 'url') body.url = data.url.trim();
  const { campaign } = await api('/api/admin/push', { method: 'POST', body });
  form.reset();
  pushPreview();
  await drivePush(campaign);
});
document.addEventListener('click', async (e) => {
  const go = e.target.closest('[data-push-go]'), stop = e.target.closest('[data-push-stop]'), hide = e.target.closest('[data-push-hide]');
  if (hide && confirm('نحذف هذا الإشعار من تطبيقات كل العملاء؟')) { await api(`/api/admin/push/${hide.dataset.pushHide}/hide`, { method: 'POST', body: {} }).catch((x) => toast(x.message, true)); loadPush(); }
  if (go) await drivePush((await api(`/api/admin/push/${go.dataset.pushGo}/continue`, { method: 'POST', body: {} })).campaign).catch((x) => toast(x.message, true));
  if (stop && confirm('نوقف إرسال هذا الإشعار؟')) { await api(`/api/admin/push/${stop.dataset.pushStop}/stop`, { method: 'POST', body: {} }).catch((x) => toast(x.message, true)); loadPush(); }
});

$('push-clear').addEventListener('click', async () => {
  if (!confirm('متأكد؟ بنحذف كل الإشعارات اللي أرسلتها من تطبيقات كل العملاء، وما تقدر ترجعها.')) return;
  try {
    const r = await api('/api/admin/push/clear', { method: 'POST', body: {} });
    toast(r.cleared ? `انحذف ${num(r.cleared)} إشعار من كل التطبيقات ✅` : 'ما فيه إشعارات تنحذف');
    loadPush();
  } catch (x) { toast(x.message, true); }
});

// ---------- صحة المنصة ----------
async function loadHealth() {
  const h = await api('/api/admin/health');
  const item = (cls, icon, title, list, fmt) => list.length ? html`<div class="hl-item ${cls}"><b>${icon} ${title} <span class="pill">${list.length}</span></b><div class="small">${list.slice(0, 6).map((x, i) => html`${i ? '، ' : ''}${fmt(x)}`)}${list.length > 6 ? ` و${list.length - 6} غيرهم` : ''}</div></div>` : '';
  const issues = h.low_stock.length + h.quiet.length + h.not_activated.length + h.no_batch.length;
  $('leads-badge').textContent = h.new_leads ? String(h.new_leads) : '';
  render($('health'), html`<div class="card-head"><h2>صحة المنصة 🩺</h2>${issues ? html`<span class="pill warn">${issues} يحتاج متابعة</span>` : html`<span class="pill ok">كل شي تمام 👌</span>`}</div>
    <div class="hl-grid">
      ${h.new_leads ? html`<button type="button" class="hl-item info" data-goto-tab="leads"><b>📥 طلبات تجار جديدة <span class="pill">${h.new_leads}</span></b><div class="small">افتح «طلبات التجار» وتواصل معهم</div></button>` : ''}
      ${item('warn', '📦', 'مخزون علامات قرب يخلص', h.low_stock, (x) => `${x.name} (باقي ${num(x.remaining)}${x.days_left != null ? ` · ${x.days_left} يوم` : ''})`)}
      ${item('warn', '⏳', 'دفعات ما تفعّلت من أكثر من أسبوع', h.not_activated, (x) => `${x.name} (${x.batches} دفعة · ${x.days} يوم)`)}
      ${item('err', '😴', 'تجار ما انمسح لهم شي من أسبوعين', h.quiet, (x) => x.name)}
      ${item('info', '🆕', 'تجار بدون أي دفعة', h.no_batch, (x) => `${x.name} (من ${x.days} يوم)`)}
      <div class="hl-item"><b>🗺️ أكثر المدن تقليداً (30 يوم)</b><div class="small">${h.fake_cities.length ? h.fake_cities.map((c, i) => html`${i ? ' · ' : ''}${c.city} ${num(c.n)}`) : 'ما فيه تقليد ملحوظ 👍'}</div><a class="small" href="/map/?admin=1" target="_blank">افتح الخريطة ↗</a></div>
    </div>`);
}
$('health').addEventListener('click', (e) => { const b = e.target.closest('[data-goto-tab]'); if (b) showTab(b.dataset.gotoTab); });

// ---------- طلبات التجار الجدد ----------
const LEAD_COLS = [['new', 'جديد', '🆕'], ['contacted', 'تواصلنا', '📞'], ['subscribed', 'اشترك', '✅'], ['rejected', 'ما كمل', '✖️']];
async function loadLeads() {
  const d = await api('/api/admin/leads');
  $('leads-badge').textContent = d.counts.new ? String(d.counts.new) : '';
  render($('leads-board'), html`${LEAD_COLS.map(([k, label, icon]) => html`<div class="lead-col"><h3>${icon} ${label} <span class="pill">${d.counts[k]}</span></h3>
    ${d.leads.filter((l) => l.status === k).map((l) => html`<div class="lead-card">
      <b>${l.brand}</b>
      <div class="small">${l.name}${l.phone ? html` · <a class="ltr" href="https://wa.me/${l.phone.replace(/^0/, '966')}" target="_blank" rel="noopener">${l.phone.replace(/^966/, '0')}</a>` : ''}</div>
      ${l.product || l.qty ? html`<div class="small muted">${[l.product, l.qty ? l.qty + ' منتج شهرياً' : ''].filter(Boolean).join(' · ')}</div>` : ''}
      ${l.note ? html`<div class="small lead-note">📝 ${l.note}</div>` : ''}
      <div class="small muted">${l.source === 'manual' ? 'يدوي' : 'من المساعد'} · ${when(l.created_at)}</div>
      <div class="lead-actions">
        <select data-lead-status="${l.id}" aria-label="المرحلة">${LEAD_COLS.map(([v, t]) => html`<option value="${v}" ${raw(v === l.status ? 'selected' : '')}>${t}</option>`)}</select>
        <button class="btn btn-sm" type="button" data-lead-note="${l.id}">📝</button>
        ${l.status !== 'subscribed' ? html`<button class="btn btn-sm" type="button" data-lead-merchant="${l.id}" title="إنشاء حساب تاجر">➕ تاجر</button>` : ''}
        <button class="btn btn-sm btn-danger" type="button" data-lead-del="${l.id}" aria-label="حذف">🗑️</button>
      </div>
    </div>`)}
    ${d.counts[k] ? '' : html`<div class="empty small">ما فيه</div>`}
  </div>`)}`);
  leadsCache = d.leads;
}
let leadsCache = [];
$('leads-board').addEventListener('change', async (e) => {
  const s = e.target.closest('[data-lead-status]');
  if (!s) return;
  try { await api('/api/admin/leads/' + s.dataset.leadStatus, { method: 'PATCH', body: { status: s.value } }); await loadLeads(); } catch (err) { toast(err.message, true); }
});
$('leads-board').addEventListener('click', async (e) => {
  const n = e.target.closest('[data-lead-note]'), m = e.target.closest('[data-lead-merchant]'), del = e.target.closest('[data-lead-del]');
  try {
    if (n) {
      const l = leadsCache.find((x) => String(x.id) === n.dataset.leadNote);
      const note = prompt('ملاحظة على الطلب', l?.note || '');
      if (note === null) return;
      await api('/api/admin/leads/' + n.dataset.leadNote, { method: 'PATCH', body: { note: note.trim() || null } });
      await loadLeads();
    } else if (m) {
      const l = leadsCache.find((x) => String(x.id) === m.dataset.leadMerchant);
      openDialog('dlg-merchant');
      $('merchant-form').name.value = l.brand;
      pendingLead = l.id;
    } else if (del) {
      if (!confirm('تحذف الطلب؟')) return;
      await api('/api/admin/leads/' + del.dataset.leadDel, { method: 'DELETE' });
      await loadLeads();
    }
  } catch (err) { toast(err.message, true); }
});
let pendingLead = null;
$('lead-add-btn').addEventListener('click', () => { $('lead-form').hidden = false; $('lead-form').name.focus(); });
$('lead-cancel').addEventListener('click', () => { $('lead-form').hidden = true; });
onSubmit($('lead-form'), async (f, form) => {
  await api('/api/admin/leads', { method: 'POST', body: { name: f.name, brand: f.brand, phone: f.phone || null, product: f.product || null } });
  form.reset();
  form.hidden = true;
  toast('انضاف الطلب');
  await loadLeads();
});

// ---------- صفحة التجار: الباقات وقصة النجاح ----------
function drawPlans(plans) {
  render($('plans-edit'), html`${plans.map((p, i) => html`<fieldset class="plan-edit">
    <legend>الباقة ${i + 1}</legend>
    <label class="field">الاسم<input name="name${i}" value="${p.name}" maxlength="40" required></label>
    <label class="field">السعر<input name="price${i}" value="${p.price}" maxlength="40" required></label>
    <label class="field">وصف قصير<input name="note${i}" value="${p.note || ''}" maxlength="60"></label>
    <label class="field">المزايا (كل ميزة بسطر)<textarea name="items${i}" rows="4">${p.items.join('\n')}</textarea></label>
    <label class="check"><input type="radio" name="featured" value="${i}" ${raw(p.featured ? 'checked' : '')}> الباقة المميزة</label>
  </fieldset>`)}`);
}
async function loadSite() {
  const d = await api('/api/admin/site');
  if (!merchants.length) merchants = (await api('/api/admin/merchants')).merchants;
  drawPlans(d.plans);
  const f = $('story-form');
  render($('story-merchant'), html`<option value="">بدون قصة</option>${merchants.map((m) => html`<option value="${m.id}">${m.name}</option>`)}`);
  f.merchant_id.value = d.story?.merchant_id || '';
  f.headline.value = d.story?.headline || '';
  f.quote.value = d.story?.quote || '';
  f.author.value = d.story?.author || '';
}
onSubmit($('plans-form'), async (f) => {
  const plans = [0, 1, 2, 3].filter((i) => f['name' + i] !== undefined).map((i) => ({ name: f['name' + i], price: f['price' + i], note: f['note' + i] || null, items: f['items' + i], featured: f.featured === String(i) }));
  const d = await api('/api/admin/site', { method: 'PUT', body: { plans } });
  drawPlans(d.plans);
  toast('انحفظت الباقات ✅');
});
$('plans-reset').addEventListener('click', async () => {
  if (!confirm('ترجع الباقات للنص الافتراضي؟')) return;
  try { const d = await api('/api/admin/site', { method: 'PUT', body: { plans: null } }); drawPlans(d.plans); toast('رجعت الباقات الافتراضية'); } catch (err) { toast(err.message, true); }
});
onSubmit($('story-form'), async (f) => {
  await api('/api/admin/site', { method: 'PUT', body: { story: f.merchant_id ? { merchant_id: Number(f.merchant_id), headline: f.headline || null, quote: f.quote, author: f.author } : null } });
  toast(f.merchant_id ? 'انحفظت القصة، تطلع الحين في صفحة التجار ✅' : 'انشالت القصة من الصفحة');
});

const loaders = { credits: loadCredits, home: loadHome, leads: loadLeads, site: loadSite, merchants: loadMerchants, batches: loadBatches, tags: async () => {}, store: loadStore, push: loadPush, reports: loadReports, users: loadUsers, audit: loadAudit, security: async () => { mountSecurity($('security-box')).catch((e) => toast(e.message, true)); await loadBackups(); } };
async function loadBackups() {
  const { backups } = await api('/api/admin/backups');
  render($('backups-list'), backups.length
    ? html`<ul class="sec-list">${backups.map((b) => html`<li><span class="sec-ic">💾</span><div><b>${when(b.at)}</b><small>${(b.size / 1024 / 1024).toFixed(2)} ميجا${b.rows ? ' · ' + num(b.rows) + ' سجل' : ''}</small></div><a class="btn small" href="/api/admin/backups/${b.name}" download>تحميل</a></li>`)}</ul>`
    : html`<p class="muted small">ما فيه نسخ للحين. أول نسخة تنحفظ تلقائياً خلال ساعة، أو اضغط الزر.</p>`);
}
$('backup-now').addEventListener('click', async (e) => {
  e.target.disabled = true;
  try { toast((await api('/api/admin/backups', { method: 'POST', body: {} })).message); await loadBackups(); } catch (err) { toast(err.message, true); } finally { e.target.disabled = false; }
});
onSubmit($('password-form'), async (f) => {
  const d = await api('/api/auth/password', { method: 'POST', body: f });
  toast(d.message);
  setTimeout(() => (location.href = '/admin/login/'), 1200);
});
let current = 'home';
const refresh = () => loaders[current]().catch((e) => toast(e.message, true));
const showTab = tabs($('nav'), [...document.querySelectorAll('.main > section')], (id) => { current = id; refresh(); });

creditsBadge();

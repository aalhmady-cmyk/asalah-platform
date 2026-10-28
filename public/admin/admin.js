import { api, bars, BATCH_STATUS, hbars, hotspotsTable, html, pickImage, logout, num, onSubmit, pill, render, RESULT, TAG_STATUS, tabs, toast, when } from '/assets/common.js';

const $ = (id) => document.getElementById(id);
let merchants = [];

const me = await api('/api/auth/me');
if (me.user.role !== 'admin') location.href = '/merchant/';
$('me').textContent = me.user.name;
$('greet').textContent = `أهلاً ${me.user.name}`;
$('logout').addEventListener('click', logout);

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
    f.slug.readOnly = Boolean(merchant);
    if (merchant) for (const k of ['name', 'slug', 'brand_color', 'logo_url', 'store_url', 'whatsapp', 'low_stock_threshold', 'max_checks', 'status']) if (merchant[k] != null) f[k].value = merchant[k];
    f.public_listed.checked = Boolean(merchant?.public_listed);
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
  if (f.id) await api(`/api/admin/merchants/${f.id}`, { method: 'PATCH', body: { ...body, status: f.status } });
  else await api('/api/admin/merchants', { method: 'POST', body: { ...body, slug: f.slug } });
  form.closest('dialog').close();
  toast('تم حفظ التاجر');
  refresh();
});
onSubmit($('batch-form'), async (f, form) => {
  const d = await api('/api/admin/batches', {
    method: 'POST',
    body: { merchant_id: Number(f.merchant_id), code: f.code, size: Number(f.size), product_name: optional(f.product_name), produced_on: optional(f.produced_on), is_test: f.is_test === 'on' },
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
      <td><b>${m.name}</b><div class="small muted ltr">${m.slug}</div></td>
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
  const d = await api('/api/admin/overview');
  merchants = d.merchants;
  const o = d.overview;
  render($('home-kpis'), html`
    <div class="kpi"><span class="label">العلامات المصدرة</span><span class="value">${num(d.totals.issued)}</span><span class="note">المتبقي في السوق ${num(d.totals.remaining)}</span></div>
    <div class="kpi"><span class="label">مسحات اليوم</span><span class="value">${num(o.scans_today)}</span><span class="note">${num(o.scans_7d)} خلال 7 أيام</span></div>
    <div class="kpi"><span class="label">تجار نشطون</span><span class="value">${num(d.totals.active_merchants)} من ${num(merchants.length)}</span><span class="note">نسبة الأصلي ${o.original_ratio ?? '-'}%</span></div>
    <div class="kpi"><span class="label">أكواد مزيّفة اليوم</span><span class="value">${num(o.unknown_today)}</span><span class="note bad">${num(o.reports_7d)} بلاغ خلال 7 أيام</span></div>`);
  const unread = d.alerts.filter((a) => !a.read_at);
  render($('home-alerts'), html`${unread.map((a) => html`<div class="alert ${a.kind === 'tag_request' || a.kind === 'join_request' ? 'info' : a.kind === 'low_stock' ? 'warn' : 'err'}"><div><b>${a.merchant_name || 'المنصة'}</b><div class="small">${a.message} · ${when(a.created_at)}</div></div></div>`)}${unread.length ? html`<div><button class="btn" type="button" id="alerts-read">تم الاطلاع على التنبيهات</button></div>` : ''}`);
  $('alerts-read')?.addEventListener('click', async () => { await api('/api/admin/alerts/read', { method: 'POST', body: {} }); loadHome(); });
  render($('home-bars'), bars(o.daily));
  render($('home-cities'), hbars(o.cities_7d));
  render($('home-merchants'), merchantRows(merchants, false));
  $('unknown-badge').textContent = o.unknown_today ? num(o.unknown_today) : '';
  return d;
}

async function loadMerchants() {
  merchants = (await api('/api/admin/merchants')).merchants;
  render($('merchants-table'), merchantRows(merchants, true));
}

async function loadBatches() {
  if (!merchants.length) merchants = (await api('/api/admin/merchants')).merchants;
  const { batches } = await api('/api/admin/batches');
  render($('batches-table'), !batches.length ? html`<div class="empty">ما فيه دفعات للحين.</div>` : html`<table style="min-width:860px"><thead><tr>
    <th>الدفعة</th><th>التاجر</th><th>العدد</th><th>المنتج</th><th>الحالة</th><th>أُنشئت</th><th><span class="sr-only">إجراءات</span></th>
  </tr></thead><tbody>${batches.map((b) => html`<tr>
    <td><b class="ltr">${b.code}</b>${b.is_test ? html` <span class="pill warn">تجريبية</span>` : ''}</td>
    <td>${b.merchant_name}</td><td>${num(b.size)}</td><td>${b.product_name || '-'}</td>
    <td>${pill(BATCH_STATUS, b.status)}</td><td>${when(b.created_at)}</td>
    <td><div class="actions">
      ${b.image_url ? html`<img src="${b.image_url}" alt="" class="thumb" style="width:36px;height:36px">` : ''}
      <button class="btn btn-sm" type="button" data-batch-image="${b.id}">${b.image_url ? 'تغيير الصورة' : 'صورة المنتج'}</button>
      <button class="btn" type="button" data-factory="${b.id}" data-code="${b.code}" data-size="${b.size}">ملف المصنع</button>
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
  render($('reports-table'), !rep.reports.length ? html`<div class="empty">ما فيه بلاغات</div>` : html`<table><thead><tr><th>التاجر</th><th>المدينة</th><th>المحل</th><th>ملاحظة</th><th>الوقت</th></tr></thead><tbody>${rep.reports.map((r) => html`<tr><td>${r.merchant_name || '-'}</td><td>${r.city}</td><td>${r.point_of_sale}</td><td>${r.note || '-'}</td><td>${when(r.created_at)}</td></tr>`)}</tbody></table>`);
}
async function loadUsers() {
  if (!merchants.length) merchants = (await api('/api/admin/merchants')).merchants;
  const { users } = await api('/api/admin/users');
  render($('users-table'), html`<table style="min-width:720px"><thead><tr><th>الاسم</th><th>البريد</th><th>النوع</th><th>آخر دخول</th><th>الحالة</th><th><span class="sr-only">إجراءات</span></th></tr></thead><tbody>${users.map((u) => html`<tr>
    <td><b>${u.name}</b></td><td class="ltr">${u.email}</td><td>${u.role === 'admin' ? 'مدير عام' : 'تاجر: ' + (u.merchant_name || '')}</td><td>${when(u.last_login_at)}</td>
    <td>${u.status === 'active' ? pill({ x: ['نشط', 'ok'] }, 'x') : pill({ x: ['موقوف', 'err'] }, 'x')}</td>
    <td>${u.id === me.user.id ? '' : html`<div class="actions"><button class="btn" type="button" data-user="${u.id}" data-user-status="${u.status === 'active' ? 'disabled' : 'active'}">${u.status === 'active' ? 'إيقاف' : 'تفعيل'}</button><button class="btn" type="button" data-user-reset="${u.id}">كلمة مرور جديدة</button></div>`}</td>
  </tr>`)}</tbody></table>`);
}
document.addEventListener('click', async (e) => {
  const s = e.target.closest('[data-user-status]');
  const r = e.target.closest('[data-user-reset]');
  try {
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
const ACTIONS = {
  login: 'دخول', merchant_created: 'إنشاء تاجر', merchant_updated: 'تعديل تاجر', user_created: 'إنشاء حساب', user_updated: 'تعديل حساب',
  batch_created: 'إنشاء دفعة', batch_active: 'تفعيل دفعة', batch_blocked: 'إيقاف دفعة', factory_file_downloaded: 'تنزيل ملف المصنع',
  tags_block: 'إيقاف علامات', tags_activate: 'تفعيل علامات', settings_updated: 'تعديل إعدادات التاجر', entries_exported: 'تصدير المشاركات',
  password_changed: 'تغيير كلمة المرور', tags_requested: 'طلب علامات', setup_admin_created: 'إعداد النظام',
};
async function loadAudit() {
  const { audit } = await api('/api/admin/audit');
  render($('audit-table'), html`<table style="min-width:720px"><thead><tr><th>الوقت</th><th>الحساب</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${audit.map((a) => html`<tr><td>${when(a.created_at)}</td><td class="ltr">${a.email || '-'}</td><td>${ACTIONS[a.action] || a.action}</td><td class="mono small" style="white-space:normal;word-break:break-all">${a.detail || ''}</td></tr>`)}</tbody></table>`);
}

$('hot-days').addEventListener('change', () => loadReports().catch((e) => toast(e.message, true)));
const loaders = { home: loadHome, merchants: loadMerchants, batches: loadBatches, tags: async () => {}, reports: loadReports, users: loadUsers, audit: loadAudit };
let current = 'home';
const refresh = () => loaders[current]().catch((e) => toast(e.message, true));
tabs($('nav'), [...document.querySelectorAll('.main > section')], (id) => { current = id; refresh(); });

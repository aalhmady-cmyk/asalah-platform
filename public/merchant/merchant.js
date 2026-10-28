import { api, initial, bars, BATCH_STATUS, hbars, html, logout, num, onSubmit, pill, render, RESULT, TAG_STATUS, tabs, toast, when } from '/assets/common.js';

const $ = (id) => document.getElementById(id);
const me = await api('/api/auth/me');
if (me.user.role !== 'merchant') location.href = '/admin/';
$('me').textContent = me.user.name;
$('logout').addEventListener('click', logout);

let merchant = null;

function brandHeader(m) {
  $('merchant-name').textContent = m.name;
  const logo = $('logo');
  if (m.logo_url) render(logo, html`<img src="${m.logo_url}" alt="" style="width:100%;height:100%;object-fit:cover">`);
  else logo.textContent = initial(m.name);
}

async function loadHome() {
  const d = await api('/api/m/overview');
  merchant = d.merchant;
  brandHeader(merchant);
  const o = d.overview, s = o.stock;
  const low = s.active > 0 && s.remaining <= merchant.low_stock_threshold;
  const used = s.active ? Math.round((s.sold / s.active) * 100) : 0;
  render($('stock'), html`
    <div class="card-head" style="align-items:flex-start">
      <div><div class="muted small">العلامات المتبقية</div><div class="big">${num(s.remaining)} <small>من ${num(s.active)} مفعّلة</small></div></div>
      ${low ? html`<span class="pill" style="background:#F3C969;color:#3A2A00">أقل من حد التنبيه</span>` : ''}
    </div>
    <div class="meter" role="img" aria-label="تم استخدام ${used} بالمئة من العلامات المفعّلة"><i style="width:${used}%"></i></div>
    <div class="card-head">
      <span class="muted">${s.days_left != null ? html`بمعدل المسح الحالي تخلص خلال <b style="color:#fff">${s.days_left} يوم تقريباً</b>` : 'ما فيه مسحات كافية لتوقّع موعد الخلوص'}${s.pending ? html` · ${num(s.pending)} بانتظار الشحن` : ''}</span>
      <button class="btn btn-gold" type="button" id="request-tags">اطلب علامات جديدة</button>
    </div>`);
  $('request-tags').addEventListener('click', async () => {
    const count = Number(prompt('كم علامة تحتاج؟', '20000'));
    if (!count) return;
    try { toast((await api('/api/m/request-tags', { method: 'POST', body: { count } })).message); } catch (e) { toast(e.message, true); }
  });
  renderContestCard(d.entries);
  render($('kpis'), html`
    <div class="kpi"><span class="label">مسحات اليوم</span><span class="value">${num(o.scans_today)}</span><span class="note">${num(o.scans_7d)} خلال 7 أيام</span></div>
    <div class="kpi"><span class="label">علامات انمسحت</span><span class="value">${num(s.sold)}</span><span class="note">مبيعات تقديرية · ${num(s.per_day)} يومياً</span></div>
    <div class="kpi"><span class="label">نسبة الأصلي</span><span class="value">${o.original_ratio == null ? '-' : o.original_ratio + '%'}</span><span class="note">من كل المسحات خلال 7 أيام</span></div>
    <div class="kpi"><span class="label">أكواد مزيّفة اليوم</span><span class="value">${num(o.unknown_today)}</span><span class="note bad">${num(o.reports_7d)} بلاغ خلال 7 أيام</span></div>`);
  render($('cities'), hbars(o.cities_7d));
  render($('daily'), bars(o.daily));
  render($('recent'), !o.recent.length ? html`<div class="empty">ما فيه عمليات تحقق للحين</div>` : html`<table style="min-width:520px"><thead><tr><th>رقم العلامة</th><th>النتيجة</th><th>المدينة</th><th>الفحص</th><th>الوقت</th></tr></thead><tbody>${o.recent.slice(0, 10).map((r) => html`<tr><td class="mono">${r.public_id || 'غير معروف'}</td><td>${pill(RESULT, r.result)}</td><td>${r.city || '-'}</td><td>${r.check_no ? `${r.check_no} من ${merchant.max_checks}` : '-'}</td><td class="muted">${when(r.created_at)}</td></tr>`)}</tbody></table>`);
  const unread = d.alerts.filter((a) => !a.read_at && a.kind !== 'tag_request');
  render($('alerts'), html`${unread.map((a) => html`<div class="alert ${a.kind === 'low_stock' ? 'warn' : 'err'}"><div>${a.message} <span class="small">· ${when(a.created_at)}</span></div></div>`)}${unread.length ? html`<div><button class="btn" type="button" id="alerts-read">تم الاطلاع</button></div>` : ''}`);
  $('alerts-read')?.addEventListener('click', async () => { await api('/api/m/alerts/read', { method: 'POST', body: {} }); loadHome(); });
}

function renderContestCard(entries) {
  const on = Boolean(merchant.contest_enabled);
  render($('contest-card'), html`
    <div class="card-head"><h2>${merchant.contest_title || 'المسابقة'}</h2>
      <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="تشغيل المسابقة" id="contest-switch"><span></span></button></div>
    <div style="font-weight:600" class="${on ? 'good' : 'muted'}">${on ? 'المسابقة شغّالة' : 'المسابقة موقوفة'}</div>
    <div class="small muted">${on ? 'العميل يشوف نموذج المشاركة بعد التحقق.' : 'العميل يشوف نتيجة التحقق فقط بدون نموذج.'}</div>
    <div class="form-grid" style="margin-top:auto">
      <div style="background:var(--ground);border-radius:10px;padding:12px"><div class="small muted">المشاركون</div><div style="font-size:22px;font-weight:700">${num(entries)}</div></div>
      <div style="background:var(--ground);border-radius:10px;padding:12px"><div class="small muted">تنتهي</div><div style="font-size:18px;font-weight:700">${merchant.contest_ends_at ? when(merchant.contest_ends_at) : 'بدون تاريخ'}</div></div>
    </div>`);
  $('contest-switch').addEventListener('click', async () => {
    try {
      await api('/api/m/settings', { method: 'PATCH', body: { contest_enabled: !on } });
      merchant.contest_enabled = on ? 0 : 1;
      renderContestCard(entries);
      toast(on ? 'تم إيقاف المسابقة' : 'تم تشغيل المسابقة');
    } catch (e) { toast(e.message, true); }
  });
}

async function loadTags() {
  const { batches } = await api('/api/m/batches');
  render($('batches'), !batches.length ? html`<div class="empty">ما عندك دفعات للحين. تواصل مع إدارة أصالة.</div>` : html`<table style="min-width:620px"><thead><tr><th>الدفعة</th><th>المنتج</th><th>العدد</th><th>انمسحت</th><th>موقوفة</th><th>الحالة</th></tr></thead><tbody>${batches.map((b) => html`<tr><td class="mono"><b>${b.code}</b></td><td>${b.product_name || '-'}</td><td>${num(b.size)}</td><td>${num(b.sold)}</td><td>${num(b.blocked)}</td><td>${pill(BATCH_STATUS, b.status)}</td></tr>`)}</tbody></table>`);
  if (batches[0] && !$('status-form').batch_code.value) $('status-form').batch_code.value = batches[0].code;
}
onSubmit($('lookup-form'), async (f) => {
  const { tag: t } = await api('/api/m/tags/lookup?q=' + encodeURIComponent(f.q));
  render($('lookup-result'), html`<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line-soft);padding-top:14px">
    <div class="card-head"><b class="ltr" style="font-size:18px">${t.public_id}</b>${pill(TAG_STATUS, t.status)}</div>
    <div class="form-grid small"><div>الفحوصات: <b>${t.check_count}</b></div><div>الأجهزة: <b>${t.devices}</b></div><div>أول فحص: <b>${when(t.first_checked_at)}</b></div><div>آخر فحص: <b>${when(t.last_checked_at)}</b></div></div>
    ${t.entry ? html`<div class="alert info small"><div>سجّل مشاركة: ${t.entry.customer_name} · ${t.entry.city}</div></div>` : ''}
    ${t.checks.length ? html`<table><thead><tr><th>النتيجة</th><th>الفحص</th><th>المدينة</th><th>الوقت</th></tr></thead><tbody>${t.checks.map((c) => html`<tr><td>${pill(RESULT, c.result)}</td><td>${c.check_no ?? '-'}</td><td>${c.city || '-'}</td><td>${when(c.created_at)}</td></tr>`)}</tbody></table>` : html`<div class="empty">ما انمسحت هذي العلامة للحين</div>`}
  </div>`);
  const sf = $('status-form');
  sf.batch_code.value = t.batch.code;
  sf.from.value = t.serial;
  sf.to.value = '';
});
onSubmit($('status-form'), async (f) => {
  const body = { batch_code: f.batch_code, from: Number(f.from), to: f.to ? Number(f.to) : Number(f.from), action: f.action };
  if (!confirm(`${f.action === 'block' ? 'إيقاف' : 'تفعيل'} العلامات من ${body.from} إلى ${body.to}؟`)) return;
  const d = await api('/api/m/tags/status', { method: 'POST', body });
  toast(`تم: ${num(d.changes)} علامة تغيّرت`);
  loadTags();
});

async function loadContest() {
  if (!merchant) merchant = (await api('/api/m/overview')).merchant;
  const f = $('contest-form');
  f.contest_enabled.checked = Boolean(merchant.contest_enabled);
  f.contest_title.value = merchant.contest_title || '';
  f.contest_terms_url.value = merchant.contest_terms_url || '';
  f.store_url.value = merchant.store_url || '';
  f.contest_ends_at.value = merchant.contest_ends_at ? new Date((merchant.contest_ends_at - 86399 + 10800) * 1000).toISOString().slice(0, 10) : '';
}
onSubmit($('contest-form'), async (f) => {
  // نهاية المسابقة = آخر ثانية في اليوم المختار بتوقيت الرياض
  const ends = f.contest_ends_at ? Math.floor(Date.parse(f.contest_ends_at + 'T23:59:59+03:00') / 1000) : null;
  const d = await api('/api/m/settings', {
    method: 'PATCH',
    body: { contest_enabled: f.contest_enabled === 'on', contest_title: f.contest_title || null, contest_ends_at: ends, contest_terms_url: f.contest_terms_url || null, store_url: f.store_url || null },
  });
  Object.assign(merchant, d.settings);
  toast('تم حفظ إعدادات المسابقة');
});

async function loadReports() {
  const { reports } = await api('/api/m/reports');
  render($('reports-table'), !reports.length ? html`<div class="empty">ما فيه بلاغات</div>` : html`<table style="min-width:560px"><thead><tr><th>المدينة</th><th>المحل</th><th>السبب</th><th>ملاحظة</th><th>الوقت</th></tr></thead><tbody>${reports.map((r) => html`<tr><td>${r.city}</td><td><b>${r.point_of_sale}</b></td><td>${pill(RESULT, r.reason)}</td><td>${r.note || '-'}</td><td>${when(r.created_at)}</td></tr>`)}</tbody></table>`);
}
onSubmit($('password-form'), async (f) => {
  const d = await api('/api/auth/password', { method: 'POST', body: f });
  toast(d.message);
  setTimeout(() => (location.href = '/login/'), 1200);
});

const loaders = { home: loadHome, tags: loadTags, contest: loadContest, reports: loadReports, account: async () => {} };
tabs($('nav'), [...document.querySelectorAll('.main > section')], (id) => loaders[id]().catch((e) => toast(e.message, true)));

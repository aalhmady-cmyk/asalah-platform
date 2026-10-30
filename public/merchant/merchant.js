import { api, raw, hotspotsTable, initial, pickImage, bars, BATCH_STATUS, hbars, html, logout, num, onSubmit, pill, render, RESULT, TAG_STATUS, tabs, toast, when } from '/assets/common.js';
import { loadStore } from '/merchant/store.js';
import { loadSite, loadOrders, ordersBadge } from '/merchant/site.js';
import { initPanelApp } from '/assets/panel-app.js';
import { playResult } from '/assets/sound.js';

const $ = (id) => document.getElementById(id);
const me = await api('/api/auth/me');
if (me.user.role !== 'merchant') location.href = '/admin/';
$('me').textContent = me.user.name;
$('logout').addEventListener('click', logout);
initPanelApp({ scope: '/merchant/', title: 'لوحة التاجر', what: 'لما تقارب علاماتك تخلص، أو تطلع موجة تقليد، أو يوصلك تنبيه من إدارة أصالة' });

let merchant = null;
// الموظف: نخفي اللي لصاحب الحساب بس (المسابقة فيها أرقام العملاء، والإعدادات)
const STAFF = me.user.merchant_role === 'staff';
if (STAFF) {
  document.body.classList.add('is-staff');
  document.querySelector('#nav [data-tab="contest"]')?.remove();
  $('me').textContent = me.user.name + ' · موظف';
}

function brandHeader(m) {
  $('merchant-name').textContent = m.name;
  const logo = $('logo');
  if (m.logo_url) render(logo, html`<img src="${m.logo_url}" alt="" style="width:100%;height:100%;object-fit:cover">`);
  else logo.textContent = initial(m.name);
}

// خطوات البداية: تختفي لما تكتمل أو يخفيها التاجر
async function loadOnboard() {
  const box = $('onboard');
  let hidden = false;
  try { hidden = localStorage.getItem('asalah_onboard_hide') === '1'; } catch {}
  if (hidden) return;
  const d = await api('/api/m/onboarding');
  if (d.done >= d.total) { box.hidden = true; return; }
  const next = d.steps.find((x) => !x.done);
  render(box, html`<div class="card-head"><h2>ابدأ هنا 🚀</h2><button class="btn btn-sm" type="button" id="onboard-hide">إخفاء</button></div>
    <div class="ob-progress"><i style="width:${Math.round((d.done / d.total) * 100)}%"></i></div>
    <p class="small muted" style="margin:0">خلصت ${d.done} من ${d.total} خطوات. كل خطوة تخلي حمايتك أقوى وعميلك أوثق.</p>
    <ol class="ob-steps">${d.steps.map((x) => html`<li class="${x.done ? 'done' : x === next ? 'next' : ''}"><button type="button" data-ob="${x.tab}" ${raw(x.done ? 'disabled' : '')}><span class="ob-dot">${x.done ? '✓' : ''}</span><span><b>${x.title}</b><small>${x.hint}</small></span>${x.done ? '' : html`<span class="ob-go">←</span>`}</button></li>`)}</ol>`);
  box.hidden = false;
}
$('onboard').addEventListener('click', (e) => {
  if (e.target.closest('#onboard-hide')) { try { localStorage.setItem('asalah_onboard_hide', '1'); } catch {} $('onboard').hidden = true; return; }
  const b = e.target.closest('[data-ob]');
  if (b) showTab(b.dataset.ob);
});

async function loadHome() {
  loadOnboard().catch(() => {});
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
    const qr = confirm('تبيها ملصقات QR تطبعها بنفسك؟ (أرخص وأسرع، مناسبة للبداية)\n\nموافق = ملصقات QR\nإلغاء = شرائح NFC');
    const count = Number(prompt(qr ? 'كم ملصق QR تحتاج؟' : 'كم شريحة NFC تحتاج؟', qr ? '500' : '20000'));
    if (!count) return;
    try { toast((await api('/api/m/request-tags', { method: 'POST', body: { count, kind: qr ? 'qr' : 'nfc' } })).message); } catch (e) { toast(e.message, true); }
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
  render($('alerts'), html`${unread.map((a) => html`<div class="alert ${a.kind === 'low_stock' ? 'warn' : ['new_order', 'credits_added', 'weekly_summary', 'monthly_report'].includes(a.kind) ? 'info' : 'err'}"><div>${a.message} <span class="small">· ${when(a.created_at)}</span></div></div>`)}${unread.length ? html`<div><button class="btn" type="button" id="alerts-read">تم الاطلاع</button></div>` : ''}`);
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
  render($('batches'), !batches.length ? html`<div class="empty">ما عندك دفعات للحين. تواصل مع إدارة أصالة.</div>` : html`<table style="min-width:720px"><thead><tr><th>صورة المنتج</th><th>الدفعة</th><th>المنتج</th><th>العدد</th><th>انمسحت</th><th>موقوفة</th><th>الحالة</th></tr></thead><tbody>${batches.map((b) => html`<tr>
    <td><div style="display:flex;align-items:center;gap:8px">${b.image_url ? html`<img src="${b.image_url}" alt="" class="thumb">` : html`<span class="thumb thumb-empty" aria-hidden="true">+</span>`}
      <button class="btn btn-sm" type="button" data-image="${b.code}">${b.image_url ? 'تغيير' : 'رفع صورة'}</button>
      ${b.image_url ? html`<button class="btn btn-sm" type="button" data-image-del="${b.code}">حذف</button>` : ''}</div></td>
    <td class="mono"><b>${b.code}</b>${b.kind === 'qr' ? html`<div><span class="pill warn">ملصقات QR</span> <a class="btn btn-sm btn-gold" href="/print/?code=${b.code}">🖨️ اطبع الملصقات</a></div>` : ''}</td><td>${b.product_name || '-'}</td><td>${num(b.size)}</td><td>${num(b.sold)}</td><td>${num(b.blocked)}</td><td>${pill(BATCH_STATUS, b.status)}</td></tr>`)}</tbody></table>
    <p class="small muted" style="margin:12px 0 0">صورة المنتج تظهر للعميل بعد ما يتأكد إن المنتج أصلي. لو الدفعة ما لها صورة، يظهر شعارك.</p>`);
  if (batches[0] && !$('status-form').batch_code.value) $('status-form').batch_code.value = batches[0].code;
  batchList = batches;
  const sel = $('bd-code'), cur = sel.value;
  render(sel, html`${batches.map((b) => html`<option value="${b.code}">${b.code}${b.product_name ? ' · ' + b.product_name : ''}</option>`)}`);
  if (cur && batches.some((b) => b.code === cur)) sel.value = cur;
  // منتجات المتجر لربطها بالدفعة
  const shop = await api('/api/m/store').catch(() => null);
  $('bd-shop-field').hidden = !(shop?.enabled && shop.products.length);
  if (shop?.enabled) render($('bd-shop'), html`<option value="">بدون</option>${shop.products.map((p) => html`<option value="${p.id}">${p.title}</option>`)}`);
  fillBatchDetails();
}
let batchList = [];
function fillBatchDetails() {
  const f = $('batch-details-form');
  const b = batchList.find((x) => x.code === f.code.value);
  f.expires_on.value = b?.expires_on || '';
  f.details.value = b?.details || '';
  f.store_product_id.value = b?.store_product_id ? String(b.store_product_id) : '';
}
$('bd-code').addEventListener('change', fillBatchDetails);
onSubmit($('batch-details-form'), async (f) => {
  await api('/api/m/batches/' + f.code, { method: 'PATCH', body: { expires_on: f.expires_on || null, details: f.details || null, ...($('bd-shop-field').hidden ? {} : { store_product_id: f.store_product_id ? Number(f.store_product_id) : null }) } });
  toast('تم حفظ تفاصيل الدفعة');
  loadTags();
});
$('batches').addEventListener('click', async (e) => {
  const up = e.target.closest('[data-image]'), del = e.target.closest('[data-image-del]');
  if (!up && !del) return;
  try {
    if (up) {
      const img = await pickImage();
      if (!img) return;
      await api(`/api/m/batches/${up.dataset.image}/image`, { method: 'POST', body: img });
      toast('تم رفع صورة المنتج');
    } else {
      if (!confirm('حذف صورة المنتج؟ بيظهر شعارك بدالها.')) return;
      await api(`/api/m/batches/${del.dataset.imageDel}/image`, { method: 'DELETE' });
      toast('تم حذف الصورة');
    }
    loadTags();
  } catch (err) { toast(err.message, true); }
});
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
  const days = $('hot-days').value;
  const [{ reports }, { hotspots }] = await Promise.all([api('/api/m/reports'), api('/api/m/hotspots?days=' + days)]);
  render($('hotspots'), hotspotsTable(hotspots));
  render($('reports-table'), !reports.length ? html`<div class="empty">ما فيه بلاغات</div>` : html`<table style="min-width:640px"><thead><tr><th>المدينة</th><th>المحل</th><th>السبب</th><th>ملاحظة</th><th>الصورة ورأي الذكاء</th><th>الوقت</th></tr></thead><tbody>${reports.map((r) => html`<tr><td>${r.city}</td><td><b>${r.point_of_sale}</b></td><td>${pill(RESULT, r.reason)}</td><td>${r.note || '-'}</td>
    <td>${r.photo_key ? html`<div class="ev"><a href="/api/m/evidence/${r.photo_key}" target="_blank" rel="noopener"><img src="/api/m/evidence/${r.photo_key}" alt="صورة البلاغ" loading="lazy"></a><div>${r.ai_score != null ? html`<span class="pill ${r.ai_score >= 60 ? 'err' : r.ai_score >= 30 ? 'warn' : 'ok'}">احتمال التقليد ${r.ai_score}٪</span>` : ''}${r.ai_verdict ? html`<div class="small">${r.ai_verdict}</div>` : ''}</div></div>` : '-'}</td><td>${when(r.created_at)}</td></tr>`)}</tbody></table>`);
  loadClaims().catch(() => {});
}
const CLAIM = { new: ['جديد', 'warn'], approved: ['مقبول', 'ok'], rejected: ['مرفوض', 'err'] };
async function loadClaims() {
  const { claims } = await api('/api/m/guarantee');
  $('claims-card').hidden = !claims.length;
  $('claims-count').textContent = `${claims.filter((c) => c.status === 'new').length} ينتظر ردك`;
  render($('claims-table'), html`<table style="min-width:720px"><thead><tr><th>العميل</th><th>المدينة والمحل</th><th>وش لاحظ</th><th>العلامة</th><th>الحالة</th><th></th></tr></thead><tbody>${claims.map((c) => html`<tr>
    <td><b>${c.name}</b>${c.phone ? html`<div class="small ltr"><a href="https://wa.me/966${String(c.phone).replace(/^0/, '')}" target="_blank" rel="noopener">${c.phone}</a></div>` : ''}</td>
    <td>${c.city}<div class="small muted">${c.point_of_sale}</div></td>
    <td>${c.note}${c.photo_key ? html`<div class="ev"><a href="/api/m/evidence/${c.photo_key}" target="_blank" rel="noopener"><img src="/api/m/evidence/${c.photo_key}" alt="صورة" loading="lazy"></a></div>` : ''}</td>
    <td class="ltr small">${c.batch}-${String(c.serial).padStart(Math.max(6, String(c.size).length), '0')}<div class="muted">${when(c.created_at)}</div></td>
    <td>${pill(CLAIM, c.status)}${c.decision_note ? html`<div class="small muted">${c.decision_note}</div>` : ''}</td>
    <td>${c.status === 'new' && !STAFF ? html`<div class="actions"><button class="btn btn-sm btn-primary" type="button" data-claim="${c.id}" data-st="approved">قبول</button><button class="btn btn-sm" type="button" data-claim="${c.id}" data-st="rejected">رفض</button></div>` : ''}</td></tr>`)}</tbody></table>`);
}
$('claims-table').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-claim]');
  if (!b) return;
  const ok = b.dataset.st === 'approved';
  const note = prompt(ok ? 'ملاحظة للسجل (مثال: رجّعنا المبلغ بتحويل)' : 'سبب الرفض (يشوفه العميل)') ;
  if (note === null) return;
  try {
    await api('/api/m/guarantee/' + b.dataset.claim, { method: 'POST', body: { status: b.dataset.st, note: note || null } });
    toast(ok ? 'تم قبول الطلب ✅' : 'تم رفض الطلب');
    loadClaims();
  } catch (err) { toast(err.message, true); }
});

// ---------- الضمان والثقة ----------
async function loadTrust() {
  const d = await api('/api/m/trust');
  const f = $('guarantee-form');
  f.guarantee_enabled.checked = d.guarantee_enabled;
  f.guarantee_terms.value = d.guarantee_terms || '';
  $('weekly-on').checked = d.weekly_summary;
  $('sound-on').checked = d.verify_sound;
  $('sound-global-off').hidden = d.sound_global;
  soundCustom = d.sound_clips || {};
  drawVoice(d.voice_url);
}
function drawVoice(url) {
  render($('voice-now'), url ? html`<div class="voice-now"><audio controls preload="none" src="${url}"></audio><button class="btn btn-sm btn-danger" type="button" id="voice-del">حذف</button></div>` : html`<div class="empty" style="padding:12px">ما سجّلت رسالة للحين</div>`);
}
onSubmit($('guarantee-form'), async (f) => {
  await api('/api/m/trust', { method: 'PATCH', body: { guarantee_enabled: f.guarantee_enabled === 'on', guarantee_terms: f.guarantee_terms || null } });
  toast(f.guarantee_enabled === 'on' ? 'ضمان أصالة صار يظهر لعملائك 🛡️' : 'تم الحفظ');
});
$('weekly-on').addEventListener('change', async (e) => {
  try { await api('/api/m/trust', { method: 'PATCH', body: { weekly_summary: e.target.checked } }); toast('تم الحفظ'); } catch (err) { toast(err.message, true); }
});
$('sound-on').addEventListener('change', async (e) => {
  try { await api('/api/m/trust', { method: 'PATCH', body: { verify_sound: e.target.checked } }); toast(e.target.checked ? 'صار عملاؤك يسمعون صوت النتيجة 🔔' : 'وقّفنا الصوت'); } catch (err) { toast(err.message, true); }
});
let soundCustom = {};
$('sound-try-ok').addEventListener('click', () => playResult('original', false, soundCustom).catch(() => {}));
$('sound-try-bad').addEventListener('click', () => playResult('fake', false, soundCustom).catch(() => {}));
$('weekly-btn').addEventListener('click', async (e) => {
  e.target.disabled = true;
  e.target.textContent = 'نجهّز ملخصك…';
  try {
    const d = await api('/api/m/weekly');
    $('weekly-out').textContent = d.message;
    $('weekly-out').hidden = false;
  } catch (err) { toast(err.message, true); }
  e.target.disabled = false;
  e.target.textContent = 'اعرض ملخص هالأسبوع';
});
async function uploadVoice(blob) {
  if (blob.size > 1.5 * 1024 * 1024) return toast('التسجيل طويل، خلّه أقل من 30 ثانية', true);
  $('rec-status').textContent = 'نرفع التسجيل…';
  try {
    const d = await api('/api/m/voice', { method: 'POST', body: blob });
    drawVoice(d.voice_url);
    $('rec-status').textContent = '';
    toast('رسالتك الصوتية صارت تطلع لعملائك 🔊');
  } catch (err) { $('rec-status').textContent = ''; toast(err.message, true); }
}
let rec = null, recTimer = null;
$('rec-btn').addEventListener('click', async () => {
  if (rec) return rec.stop();
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('جوالك ما يدعم التسجيل هنا، ارفع ملف صوت بدال', true);
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('اسمح للمتصفح يستخدم المايك', true); }
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  rec = new MediaRecorder(stream, type ? { mimeType: type } : {});
  const parts = [];
  let left = 30;
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  rec.onstop = () => {
    clearInterval(recTimer);
    stream.getTracks().forEach((t) => t.stop());
    $('rec-btn').textContent = '🎙️ سجّل الحين';
    const blob = new Blob(parts, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
    rec = null;
    uploadVoice(blob);
  };
  rec.start();
  $('rec-btn').textContent = '⏹️ وقّف وارفع';
  $('rec-status').textContent = `جاري التسجيل… باقي ${left} ثانية`;
  recTimer = setInterval(() => { left--; $('rec-status').textContent = `جاري التسجيل… باقي ${left} ثانية`; if (left <= 0) rec?.stop(); }, 1000);
});
$('voice-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) uploadVoice(f); e.target.value = ''; });
$('voice-now').addEventListener('click', async (e) => {
  if (!e.target.closest('#voice-del') || !confirm('تحذف رسالتك الصوتية؟')) return;
  try { await api('/api/m/voice', { method: 'DELETE' }); drawVoice(null); } catch (err) { toast(err.message, true); }
});
document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); showTab(g.dataset.goto); } });
$('hot-days').addEventListener('change', () => loadReports().catch((e) => toast(e.message, true)));

// ---------- النقاط والكاش باك ----------
let loyalty = null;
const isCash = () => $('loyalty-form').querySelector('[name=loyalty_mode]:checked')?.value === 'cashback';
// الكاش باك يرجع من الخادم بالهللة
const lfmt = (n, mode = loyalty.settings.loyalty_mode) => (mode === 'cashback' ? (n / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ريال' : num(n) + ' نقطة');
function loyaltyLabels() {
  const f = $('loyalty-form'), cash = isCash();
  $('lf-per').textContent = cash ? 'الكاش باك لكل منتج (ريال)' : 'النقاط لكل منتج';
  $('lf-min').textContent = cash ? 'المبلغ المطلوب للاستبدال (ريال)' : 'النقاط المطلوبة للاستبدال';
  const per = Number(f.loyalty_per_tag.value), min = Number(f.loyalty_min_redeem.value);
  const unit = cash ? 'ريال' : 'نقطة';
  $('lf-preview').textContent = per > 0 && min > 0
    ? `العميل يحتاج يشتري ${Math.ceil(min / per)} منتج عشان يستبدل${f.loyalty_reward.value ? ' ويحصل على: ' + f.loyalty_reward.value : ''}. كل منتج = ${per} ${unit}.`
    : 'اكتب المكافأة لكل منتج وحد الاستبدال.';
}
$('loyalty-form').addEventListener('input', loyaltyLabels);
$('loyalty-form').addEventListener('change', (e) => {
  // عند تغيير النوع نحوّل الأرقام بين النقاط والريال عشان ما تنقلب القيم
  if (e.target.name !== 'loyalty_mode') return;
  const f = $('loyalty-form');
  if (isCash()) { f.loyalty_per_tag.value = 1; f.loyalty_min_redeem.value = 10; }
  else { f.loyalty_per_tag.value = 10; f.loyalty_min_redeem.value = 100; }
  loyaltyLabels();
});
async function loadLoyalty() {
  const [d, r] = await Promise.all([api('/api/m/loyalty'), api('/api/m/ratings')]);
  loyalty = d;
  const s = d.settings, st = d.stats, cash = s.loyalty_mode === 'cashback';
  const f = $('loyalty-form');
  f.loyalty_enabled.checked = Boolean(s.loyalty_enabled);
  f.querySelector(`[name=loyalty_mode][value=${s.loyalty_mode}]`).checked = true;
  f.loyalty_per_tag.value = cash ? s.loyalty_per_tag / 100 : s.loyalty_per_tag;
  f.loyalty_min_redeem.value = cash ? s.loyalty_min_redeem / 100 : s.loyalty_min_redeem;
  f.loyalty_reward.value = s.loyalty_reward || '';
  f.ratings_enabled.checked = Boolean(s.ratings_enabled);
  loyaltyLabels();
  render($('l-kpis'), html`
    <div class="kpi"><span class="label">الأعضاء</span><span class="value">${num(st.members)}</span><span class="note">${s.loyalty_enabled ? 'البرنامج شغّال' : 'البرنامج موقوف'}</span></div>
    <div class="kpi"><span class="label">انضاف هالأسبوع</span><span class="value">${num(st.earns_7d)}</span><span class="note">منتج أضافه العملاء لرصيدهم</span></div>
    <div class="kpi"><span class="label">رصيد العملاء الحالي</span><span class="value">${lfmt(st.outstanding)}</span><span class="note">من أصل ${lfmt(st.earned)} انجمعت</span></div>
    <div class="kpi"><span class="label">أكواد الاستبدال</span><span class="value">${num(st.used)}</span><span class="note">مستخدمة · ${num(st.issued)} بانتظار الاستخدام</span></div>`);
  render($('l-members'), !d.members.length ? html`<div class="empty">ما فيه أعضاء للحين. أول ما يمسح العميل منتجك ويضيف رقمه، بيظهر هنا.</div>` : html`<table style="min-width:520px"><thead><tr><th>العميل</th><th>المنتجات</th><th>الرصيد</th><th>جمع إجمالاً</th><th>آخر مرة</th></tr></thead><tbody>${d.members.map((m) => html`<tr><td><span class="mono">${m.phone}</span>${m.name ? html` <span class="small muted">${m.name}</span>` : ''}</td><td>${num(m.tags_count)}</td><td><b>${lfmt(m.balance)}</b></td><td>${lfmt(m.earned_total)}</td><td class="muted">${when(m.last_at)}</td></tr>`)}</tbody></table>`);
  render($('l-redemptions'), !d.redemptions.length ? html`<div class="empty">ما فيه استبدالات للحين</div>` : html`<table><tbody>${d.redemptions.map((x) => html`<tr><td class="mono"><b>${x.code}</b><div class="small muted">${x.phone}</div></td><td>${x.status === 'used' ? html`<span class="pill ok">مستخدم</span>` : x.status === 'issued' ? html`<span class="pill">بانتظار</span>` : html`<span class="pill err">ملغي</span>`}<div class="small muted">${when(x.created_at)}</div></td></tr>`)}</tbody></table>`);
  const max = Math.max(1, ...r.distribution.map((x) => x.n));
  $('r-summary').textContent = r.count ? `${r.avg} من 5 · ${num(r.count)} تقييم` : '';
  render($('r-dist'), !r.count ? html`<div class="empty">ما فيه تقييمات للحين</div>` : html`<div style="display:flex;flex-direction:column;gap:8px">${r.distribution.map((x) => html`<div class="stars-row"><span style="width:44px">${x.stars} ★</span><span class="bar"><i style="width:${Math.round((x.n / max) * 100)}%"></i></span><span class="muted" style="width:40px">${num(x.n)}</span></div>`)}</div>
    ${r.batches.length ? html`<table style="margin-top:12px"><tbody>${r.batches.map((b) => html`<tr><td>${b.product_name || b.code}</td><td><b>${b.avg}</b> ★</td><td class="muted">${num(b.n)}</td></tr>`)}</tbody></table>` : ''}`);
  render($('r-comments'), !r.comments.length ? html`<div class="empty">ما فيه تعليقات للحين</div>` : html`${r.comments.map((c) => html`<div class="comment"><div><span class="gold-stars">${'★'.repeat(c.stars)}</span> <span class="small muted">${c.product_name || ''} · ${when(c.created_at)}</span></div><div>${c.comment}</div></div>`)}`);
}
onSubmit($('loyalty-form'), async (f) => {
  const d = await api('/api/m/loyalty', {
    method: 'PATCH',
    body: { loyalty_enabled: f.loyalty_enabled === 'on', loyalty_mode: f.loyalty_mode, loyalty_per_tag: Number(f.loyalty_per_tag), loyalty_min_redeem: Number(f.loyalty_min_redeem), loyalty_reward: f.loyalty_reward || null, ratings_enabled: f.ratings_enabled === 'on' },
  });
  toast(d.settings.loyalty_enabled ? 'تم الحفظ، والبرنامج يظهر للعملاء عند المسح' : 'تم الحفظ');
  loadLoyalty();
});
onSubmit($('use-form'), async (f, form) => {
  const use = f.act === 'use';
  if (use && !confirm(`تأكيد استخدام الكود ${f.code.toUpperCase()}؟ ما يقدر العميل يستخدمه مرة ثانية.`)) return;
  const box = $('use-result');
  try {
    const { redemption: x } = await api('/api/m/loyalty/use', { method: 'POST', body: { code: f.code, check_only: !use } });
    render(box, html`<div class="alert ${use ? 'info' : 'warn'}"><div>${use ? '✅ تم تأكيد الاستخدام. أعط العميل مكافأته.' : 'الكود صحيح وما استُخدم.'}<br><b>${x.reward || lfmt(x.amount)}</b> · <span class="mono">${x.phone}</span></div></div>`);
    if (use) { form.reset(); loadLoyalty(); }
  } catch (e) {
    render(box, html`<div class="alert err"><div>${e.message}</div></div>`);
  }
});

// ---------- المسابقة: المشاركات والاستبعاد والسحب ----------
async function loadContestData() {
  const [{ entries, flags, suspicious }, { excluded }, { draws }] = await Promise.all([api('/api/m/entries'), api('/api/m/excluded'), api('/api/m/draws')]);
  const phones = new Set(entries.map((e) => e.phone)).size;
  $('entries-summary').textContent = `${num(entries.length)} مشاركة من ${num(phones)} رقم${suspicious ? ` · ${num(suspicious)} مشبوهة` : ''}`;
  render($('entries'), !entries.length ? html`<div class="empty">ما فيه مشاركات للحين</div>` : html`<table style="min-width:760px"><thead><tr><th>الاسم</th><th>الجوال</th><th>المدينة</th><th>المحل</th><th>العلامة</th><th>الوقت</th><th>ملاحظات</th><th><span class="sr-only">إجراء</span></th></tr></thead><tbody>${entries.slice(0, 300).map((e) => html`<tr>
    <td><b>${e.customer_name}</b></td><td class="mono">${e.phone}</td><td>${e.city}</td><td>${e.point_of_sale}</td><td class="mono">${e.code}-${e.serial}</td><td class="muted">${when(e.created_at)}</td>
    <td>${e.flags.map((f) => html`<span class="flag">${flags[f]}</span>`)}${e.entries_for_phone > 1 ? html`<span class="small muted">${e.entries_for_phone} مشاركات للرقم</span>` : ''}</td>
    <td>${e.flags.includes('excluded') ? '' : html`<button class="btn btn-sm" type="button" data-exclude="${e.phone}">استبعاد</button>`}</td></tr>`)}</tbody></table>`);
  render($('excluded'), !excluded.length ? html`<div class="empty">ما فيه أرقام مستبعدة</div>` : html`<table><tbody>${excluded.map((x) => html`<tr><td class="mono">${x.phone}</td><td>${x.reason || '-'}</td><td><button class="btn btn-sm" type="button" data-unexclude="${x.phone}">إرجاع</button></td></tr>`)}</tbody></table>`);
  render($('draws'), !draws.length ? html`<div class="empty">ما سويت أي سحب للحين</div>` : html`${draws.map((d) => html`<div style="border-top:1px solid var(--line-soft);padding-top:12px;display:flex;flex-direction:column;gap:8px">
    <div class="card-head"><b>${d.title}</b><span class="small muted">${when(d.created_at)} · من ${num(d.pool_size)} مشارك · <a href="/api/m/draws/${d.id}/winners.csv">تنزيل الفائزين</a></span></div>
    <div class="winners">${d.winners.map((w) => html`<div class="winner"><b class="rank">${w.rank}</b><div><b>${w.customer_name}</b> <span class="mono small">${w.phone}</span><div class="small muted">${w.city} · ${w.point_of_sale}</div></div></div>`)}</div></div>`)}`);
}
$('entries').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-exclude]');
  if (!b || !confirm(`استبعاد الرقم ${b.dataset.exclude} من السحب؟`)) return;
  try { await api('/api/m/excluded', { method: 'POST', body: { phone: b.dataset.exclude } }); toast('تم الاستبعاد'); loadContestData(); } catch (err) { toast(err.message, true); }
});
$('excluded').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-unexclude]');
  if (!b) return;
  try { await api('/api/m/excluded', { method: 'DELETE', body: { phone: b.dataset.unexclude } }); loadContestData(); } catch (err) { toast(err.message, true); }
});
onSubmit($('exclude-form'), async (f, form) => {
  await api('/api/m/excluded', { method: 'POST', body: f });
  form.reset();
  toast('تم الاستبعاد');
  loadContestData();
});
const dayStart = (d) => (d ? Math.floor(Date.parse(d + 'T00:00:00+03:00') / 1000) : null);
const dayEnd = (d) => (d ? Math.floor(Date.parse(d + 'T23:59:59+03:00') / 1000) : null);
onSubmit($('draw-form'), async (f) => {
  if (!confirm(`بنسحب ${f.winners} فائز الحين، والنتيجة تنحفظ وما تتغيّر. نكمل؟`)) return;
  const box = $('draw-result');
  render(box, html`<div class="draw-rolling">🎲 جاري السحب…</div>`);
  const [d] = await Promise.all([
    api('/api/m/draws', { method: 'POST', body: { title: f.title, winners: Number(f.winners), from: dayStart(f.from), to: dayEnd(f.to), skip_flagged: f.skip_flagged === 'on', skip_previous: f.skip_previous === 'on' } }),
    new Promise((r) => setTimeout(r, 1200)),
  ]).catch((e) => { box.textContent = ''; throw e; });
  render(box, html`<div class="alert info"><div>🎉 تم السحب من بين ${num(d.draw.pool_size)} مشارك</div></div><div class="winners">${d.draw.winners.map((w) => html`<div class="winner"><b class="rank">${w.rank}</b><div><b>${w.customer_name}</b> <span class="mono small">${w.phone}</span><div class="small muted">${w.city} · ${w.point_of_sale}</div></div></div>`)}</div>`);
  loadContestData();
});

// ---------- التقرير الشهري ----------
$('month-form').month.value = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7);
onSubmit($('month-form'), async (f) => { window.open('/report/?month=' + encodeURIComponent(f.month), '_blank'); });
document.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => {
  const d = new Date(Date.now() + 3 * 3600e3);
  if (b.dataset.month === 'prev') d.setUTCDate(0);
  window.open(`/report/?month=${d.toISOString().slice(0, 7)}&pdf=1`, '_blank');
}));

// ---------- نقاط البيع ----------
let sellers = [];
async function loadSellers() {
  if (!merchant) merchant = (await api('/api/m/overview')).merchant;
  const pf = $('public-form');
  pf.public_listed.checked = Boolean(merchant.public_listed);
  pf.about.value = merchant.about || '';
  $('public-link').href = '/brand/?s=' + merchant.slug;
  $('public-link').hidden = !merchant.public_listed;
  sellers = (await api('/api/m/sellers')).sellers;
  render($('sellers-table'), !sellers.length ? html`<div class="empty">ما أضفت نقاط بيع للحين</div>` : html`<table style="min-width:560px"><thead><tr><th>المحل</th><th>المدينة</th><th>العنوان</th><th>الخريطة</th><th><span class="sr-only">إجراءات</span></th></tr></thead><tbody>${sellers.map((x) => html`<tr>
    <td><b>${x.name}</b>${x.online ? html` <span class="pill ok">متجر إلكتروني</span>` : ''}</td><td>${x.city}</td><td>${x.address || '-'}</td><td>${x.map_url ? html`<a href="${x.map_url}" target="_blank" rel="noopener">فتح</a>` : '-'}</td>
    <td><div class="actions"><a class="btn btn-sm" href="/print/seller/?id=${x.id}" target="_blank" rel="noopener">🏅 شهادة</a><button class="btn btn-sm" type="button" data-edit-seller="${x.id}">تعديل</button><button class="btn btn-sm btn-danger" type="button" data-del-seller="${x.id}">حذف</button></div></td></tr>`)}</tbody></table>`);
}
onSubmit($('public-form'), async (f) => {
  const d = await api('/api/m/settings', { method: 'PATCH', body: { public_listed: f.public_listed === 'on', about: f.about || null } });
  Object.assign(merchant, d.settings);
  $('public-link').hidden = !merchant.public_listed;
  toast(merchant.public_listed ? 'علامتك صارت تظهر في موقع أصالة' : 'تم الحفظ');
});
onSubmit($('seller-form'), async (f, form) => {
  const body = { name: f.name, city: f.city, address: f.address || null, map_url: f.map_url || null, phone: f.phone || null, online: f.online === 'on' };
  if (f.seller_id) await api('/api/m/sellers/' + f.seller_id, { method: 'PATCH', body });
  else await api('/api/m/sellers', { method: 'POST', body });
  form.reset();
  form.seller_id.value = '';
  $('seller-form-title').textContent = 'إضافة نقطة بيع';
  toast('تم الحفظ');
  loadSellers();
});
$('seller-reset').addEventListener('click', () => { $('seller-form').seller_id.value = ''; $('seller-form-title').textContent = 'إضافة نقطة بيع'; });
$('sellers-table').addEventListener('click', async (e) => {
  const ed = e.target.closest('[data-edit-seller]'), del = e.target.closest('[data-del-seller]');
  if (ed) {
    const x = sellers.find((s) => s.id === Number(ed.dataset.editSeller));
    const f = $('seller-form');
    f.seller_id.value = x.id;
    for (const k of ['name', 'city', 'address', 'map_url', 'phone']) f[k].value = x[k] ?? '';
    f.online.checked = Boolean(x.online);
    $('seller-form-title').textContent = 'تعديل نقطة بيع';
    f.scrollIntoView({ behavior: 'smooth' });
  }
  if (del && confirm('حذف نقطة البيع؟')) {
    try { await api('/api/m/sellers/' + del.dataset.delSeller, { method: 'DELETE' }); loadSellers(); } catch (err) { toast(err.message, true); }
  }
});

// ---------- المساعد الذكي ----------
const chat = [];
const SUGGEST = ['كم علامة انمسحت هالشهر؟', 'متى أطلب دفعة جديدة؟', 'وين فيه تقليد على منتجي؟', 'وش تنصحني أسوي هالأسبوع؟'];
let chatReady = false;
async function loadAssistant() {
  const d = await api('/api/m/assistant');
  render($('tips'), html`${d.tips.map((t) => html`<div class="tip ${t.level}">${t.text}</div>`)}`);
  $('chat-form').hidden = !d.chat;
  $('chat-off').hidden = d.chat;
  render($('chat-suggest'), d.chat ? html`${SUGGEST.map((q) => html`<button type="button" data-q="${q}">${q}</button>`)}` : html``);
  if (!chatReady) {
    chatReady = true;
    renderChat();
  }
}
function renderChat(typing) {
  const hello = { role: 'assistant', content: `هلا ${merchant?.name ?? ''} 👋 أنا مساعد أصالة. اسألني عن مخزونك ومسحاتك ومبيعاتك والتقليد والمسابقة.` };
  render($('chat-log'), html`${[hello, ...chat].map((m) => html`<div class="msg ${m.role === 'user' ? 'me' : 'bot'}">${m.content}</div>`)}${typing ? html`<div class="msg bot typing">يكتب…</div>` : ''}`);
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}
async function sendQuestion(q) {
  chat.push({ role: 'user', content: q });
  renderChat(true);
  try {
    const d = await api('/api/m/assistant', { method: 'POST', body: { question: q, history: chat.slice(0, -1) } });
    chat.push({ role: 'assistant', content: d.answer });
  } catch (e) {
    chat.pop();
    toast(e.message, true);
  }
  renderChat();
}
$('chat-suggest').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) sendQuestion(b.dataset.q); });
onSubmit($('chat-form'), async (f, form) => { form.reset(); await sendQuestion(f.q); });
async function loadNotify() {
  const n = await api('/api/m/notify');
  const f = $('notify-form');
  f.alert_phone.value = n.alert_phone ? '0' + n.alert_phone.slice(3) : '';
  f.notify_whatsapp.checked = n.notify_whatsapp;
  $('notify-off').hidden = n.enabled;
  $('notify-test').hidden = !n.enabled;
  const ST = { sent: ['وصلت', 'ok'], failed: ['ما وصلت', 'err'], pending: ['قيد الإرسال', ''], skipped: ['متخطاة', ''] };
  render($('notify-log'), n.recent.length ? html`<div class="small muted">آخر الرسائل</div>${n.recent.map((r) => html`<div class="small" style="display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line-soft)">${pill(ST, r.status)}<span style="flex:1">${r.message}</span><span class="muted">${when(r.created_at)}</span></div>`)}` : html``);
}
onSubmit($('notify-form'), async (f) => {
  await api('/api/m/notify', { method: 'PATCH', body: { alert_phone: f.alert_phone || null, notify_whatsapp: f.notify_whatsapp === 'on' } });
  toast('تم حفظ إعدادات التنبيهات');
  loadNotify();
});
$('notify-test').addEventListener('click', async () => {
  try { toast((await api('/api/m/notify/test', { method: 'POST' })).message); } catch (e) { toast(e.message, true); }
  loadNotify();
});

async function loadStaff() {
  const d = await api('/api/m/staff');
  $('staff-count').textContent = `${num(d.staff.filter((s) => s.status === 'active').length)} من ${d.max}`;
  render($('staff-list'), !d.staff.length ? html`<div class="empty">ما أضفت موظفين للحين</div>` : html`<table><thead><tr><th>الاسم</th><th>البريد</th><th>آخر دخول</th><th>الحالة</th><th><span class="sr-only">إجراءات</span></th></tr></thead><tbody>${d.staff.map((s) => html`<tr>
    <td><b>${s.name}</b></td><td class="ltr">${s.email}</td><td>${when(s.last_login_at)}</td>
    <td>${s.status === 'active' ? pill({ x: ['نشط', 'ok'] }, 'x') : pill({ x: ['موقوف', 'err'] }, 'x')}</td>
    <td><div class="actions"><button class="btn btn-sm" type="button" data-staff="${s.id}" data-staff-status="${s.status === 'active' ? 'disabled' : 'active'}">${s.status === 'active' ? 'إيقاف' : 'تفعيل'}</button><button class="btn btn-sm" type="button" data-staff-pass="${s.id}">كلمة مرور جديدة</button></div></td>
  </tr>`)}</tbody></table>`);
}
$('staff-list').addEventListener('click', async (e) => {
  const s = e.target.closest('[data-staff-status]'), p = e.target.closest('[data-staff-pass]');
  try {
    if (s) {
      await api(`/api/m/staff/${s.dataset.staff}`, { method: 'PATCH', body: { status: s.dataset.staffStatus } });
      toast('تم تحديث الموظف');
    }
    if (p) {
      const pw = prompt('اكتب كلمة مرور مؤقتة جديدة للموظف (10 أحرف أو أكثر):');
      if (!pw) return;
      await api(`/api/m/staff/${p.dataset.staffPass}`, { method: 'PATCH', body: { password: pw } });
      toast('تغيّرت كلمة المرور. أرسلها للموظف');
    }
    loadStaff();
  } catch (err) { toast(err.message, true); }
});
onSubmit($('staff-form'), async (f, form) => {
  await api('/api/m/staff', { method: 'POST', body: f });
  form.reset();
  toast('أضفنا الموظف. أرسل له البريد وكلمة المرور، ويغيّرها من حسابه');
  loadStaff();
});

async function loadAccount() {
  if (STAFF) return;
  loadNotify().catch((e) => toast(e.message, true));
  loadStaff().catch((e) => toast(e.message, true));
  if (!merchant) merchant = (await api('/api/m/overview')).merchant;
  render($('logo-box'), html`<div style="display:flex;align-items:center;gap:16px">
    ${merchant.logo_url ? html`<img src="${merchant.logo_url}" alt="" class="thumb" style="width:72px;height:72px">` : html`<span class="thumb thumb-empty" style="width:72px;height:72px;font-size:28px" aria-hidden="true">${initial(merchant.name)}</span>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" id="logo-up">${merchant.logo_url ? 'تغيير الشعار' : 'رفع الشعار'}</button>
    ${merchant.logo_url ? html`<button class="btn" type="button" id="logo-del">حذف</button>` : ''}</div></div>`);
  $('logo-up').addEventListener('click', async () => {
    try {
      const img = await pickImage(600);
      if (!img) return;
      merchant.logo_url = (await api('/api/m/logo', { method: 'POST', body: img })).logo_url;
      brandHeader(merchant);
      loadAccount();
      toast('تم رفع الشعار');
    } catch (e) { toast(e.message, true); }
  });
  $('logo-del')?.addEventListener('click', async () => {
    if (!confirm('حذف الشعار؟')) return;
    try {
      await api('/api/m/logo', { method: 'DELETE' });
      merchant = (await api('/api/m/overview')).merchant;
      brandHeader(merchant);
      loadAccount();
    } catch (e) { toast(e.message, true); }
  });
}
onSubmit($('password-form'), async (f) => {
  const d = await api('/api/auth/password', { method: 'POST', body: f });
  toast(d.message);
  setTimeout(() => (location.href = '/merchant/login/'), 1200);
});

const loaders = { home: loadHome, store: loadStore, site: loadSite, orders: loadOrders, assistant: async () => { if (!merchant) merchant = (await api('/api/m/overview')).merchant; return loadAssistant(); }, tags: loadTags, loyalty: loadLoyalty, contest: async () => { await loadContest(); await loadContestData(); }, reports: loadReports, monthly: async () => {}, sellers: loadSellers, account: loadAccount, trust: loadTrust };
// هوية التاجر في القائمة الجانبية حتى لو فتح اللوحة على غير الرئيسية
api('/api/m/overview').then((d) => { merchant = merchant || d.merchant; brandHeader(d.merchant); }).catch(() => {});
ordersBadge();
// الشريط السفلي في الجوال: أهم 4 أقسام، و«المزيد» يفتح القائمة كاملة
const BAR = ['home', 'tags', 'reports', 'store'];
function markBar(id) {
  document.body.classList.remove('nav-open');
  for (const b of document.querySelectorAll('#bottom-bar [data-go]')) b.toggleAttribute('aria-current', b.dataset.go === id || (b.dataset.go === 'more' && !BAR.includes(id)));
  for (const b of document.querySelectorAll('#bottom-bar [aria-current]')) b.setAttribute('aria-current', 'page');
}
const showTab = tabs($('nav'), [...document.querySelectorAll('.main > section')], (id) => { markBar(id); scrollTo(0, 0); return loaders[id]().catch((e) => toast(e.message, true)); });
$('bottom-bar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  if (b.dataset.go === 'more') document.body.classList.toggle('nav-open');
  else showTab(b.dataset.go);
});
document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('#nav, #bottom-bar')) document.body.classList.remove('nav-open'); });

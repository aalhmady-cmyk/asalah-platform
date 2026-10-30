// التقرير الشهري للتاجر (أو للمدير العام عن أي تاجر)، جاهز للطباعة أو الحفظ PDF
import { api, hbars, html, initial, num, render, toast } from '/assets/common.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const month = q.get('month') || new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7);
$('month').value = month;
$('month').addEventListener('change', (e) => { q.set('month', e.target.value); location.search = q.toString(); });
$('print').addEventListener('click', () => print());
$('back').addEventListener('click', () => (history.length > 1 ? history.back() : (location.href = '/login/')));

// السهم مقارنة بالشهر اللي قبله
const trend = (cur, prev) => {
  if (!prev) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  return html`<small class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}٪ عن الشهر اللي قبله</small>`;
};
const monthName = (m) => new Date(m + '-15T12:00:00Z').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });

function monthBars(daily) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const map = Object.fromEntries(daily.map((d) => [d.day, d]));
  const max = Math.max(1, ...daily.map((d) => d.n));
  const cols = [];
  for (let d = 1; d <= days; d++) {
    const k = `${month}-${String(d).padStart(2, '0')}`;
    const row = map[k] || { n: 0, ok: 0 };
    const h = Math.round((row.n / max) * 100), bad = row.n ? Math.round(((row.n - row.ok) / row.n) * h) : 0;
    cols.push(html`<div style="height:${h}%" title="${d}: ${row.n}"><i style="height:${bad}%"></i></div>`);
  }
  return html`<div class="mbars" role="img" aria-label="المسحات اليومية">${cols}</div><div class="small muted" style="display:flex;justify-content:space-between"><span>1</span><span>${days}</span></div>`;
}

try {
  const me = await api('/api/auth/me');
  const url = me.user.role === 'admin' ? `/api/admin/report?merchant=${encodeURIComponent(q.get('merchant') || '')}&month=${month}` : `/api/m/report?month=${month}`;
  const { report: r } = await api(url);
  document.title = `تقرير ${r.merchant.name} - ${monthName(month)}`;
  const fake = (r.results.unknown || 0) + (r.results.blocked || 0) + (r.results.locked || 0);
  render($('sheet'), html`
    <header class="r-head">
      <div class="r-brand"><div class="lg">${r.merchant.logo_url ? html`<img src="${r.merchant.logo_url}" alt="">` : initial(r.merchant.name)}</div><div><h1>${r.merchant.name}</h1><span class="small muted">بحماية أصالة المنتجات الأصلية</span></div></div>
      <div class="r-title"><span class="small muted">التقرير الشهري</span><b>${monthName(month)}</b></div>
    </header>
    <div class="r-kpis">
      <div class="r-kpi gold"><span>علامات انمسحت (مبيعات تقديرية)</span><b>${num(r.sold)}</b>${trend(r.sold, r.prev_sold)}</div>
      <div class="r-kpi"><span>كل المسحات</span><b>${num(r.scans)}</b></div>
      <div class="r-kpi"><span>نسبة الأصلي</span><b>${r.original_ratio == null ? '-' : r.original_ratio + '%'}</b></div>
      <div class="r-kpi"><span>مسحات مشبوهة</span><b>${num(fake)}</b></div>
      <div class="r-kpi"><span>أكواد مزيّفة جديدة</span><b>${num(r.new_fake_codes)}</b></div>
      <div class="r-kpi"><span>بلاغات العملاء</span><b>${num(r.reports)}</b></div>
      <div class="r-kpi"><span>مشاركات المسابقة</span><b>${num(r.entries)}</b></div>
      <div class="r-kpi"><span>أرقام مختلفة شاركت</span><b>${num(r.entry_phones)}</b></div>
      <div class="r-kpi"><span>تقييم العملاء</span><b>${r.ratings?.count ? `${r.ratings.avg} ★` : '-'}</b>${r.ratings?.count ? html`<small class="muted">من ${num(r.ratings.count)} تقييم</small>` : ''}</div>
      <div class="r-kpi"><span>طلبات ضمان أصالة</span><b>${num(r.guarantee?.claims || 0)}</b>${r.guarantee?.claims ? html`<small class="muted">انقبل ${num(r.guarantee.approved)}</small>` : ''}</div>
    </div>
    <section class="r-sec"><h2>المسحات اليومية <span class="small muted">(الأحمر = غير أصلي)</span></h2>${monthBars(r.daily)}</section>
    <div class="r-two">
      <section class="r-sec"><h2>أكثر المدن مسحاً</h2><div style="display:flex;flex-direction:column;gap:10px">${hbars(r.cities)}</div></section>
      <section class="r-sec"><h2>الدفعات الأكثر بيعاً</h2>${r.batches.length ? html`<table><thead><tr><th>الدفعة</th><th>المنتج</th><th>انمسحت</th></tr></thead><tbody>${r.batches.map((b) => html`<tr><td class="mono">${b.code}</td><td>${b.product_name || '-'}</td><td><b>${num(b.n)}</b></td></tr>`)}</tbody></table>` : html`<div class="empty">ما فيه مبيعات هالشهر</div>`}</section>
    </div>
    <section class="r-sec"><h2>بؤر التقليد</h2>${r.hotspots.length ? html`<table><thead><tr><th>المدينة</th><th>حالات مشبوهة</th><th>بلاغات</th><th>محلات مذكورة</th></tr></thead><tbody>${r.hotspots.map((h) => html`<tr><td><b>${h.city}</b></td><td>${num(h.suspicious)}</td><td>${num(h.reports)}</td><td class="small">${h.places.join('، ') || '-'}</td></tr>`)}</tbody></table>` : html`<div class="empty">ما فيه تقليد ملحوظ هالشهر 👍</div>`}</section>
    <footer class="r-foot"><span>أصالة المنتجات الأصلية</span><span>صدر في ${new Date(r.generated_at * 1000).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh' })}</span></footer>`);
  if (q.get('pdf') === '1') setTimeout(() => print(), 600);
} catch (e) {
  render($('sheet'), html`<div class="alert err"><div>${e.message}</div></div>`);
  toast(e.message, true);
}

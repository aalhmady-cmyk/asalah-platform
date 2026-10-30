// صفحة التجار: الباقات وقصة النجاح من الخادم، وحاسبة خسارة التقليد
import { html, initial, render } from '/assets/common.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------- حاسبة الخسارة ----------
const form = $('calc-form');
function calc() {
  const sales = Math.max(0, Number(form.sales.value) || 0);
  const price = Math.max(1, Number(form.price.value) || 1);
  const pct = Number(form.pct.value) / 100;
  $('pct-out').textContent = form.pct.value + '٪';
  // من كل 100 منتج ينباع في السوق باسمك، pct منها مقلّدة: يعني مبيعاتك الحقيقية كان ممكن تكون sales / (1 - pct)
  const lost = (sales / (1 - pct)) * pct;
  $('o-month').textContent = fmt(lost);
  $('o-year').textContent = fmt(lost * 12);
  $('o-units').textContent = fmt((lost * 12) / price);
}
form.addEventListener('input', calc);
form.addEventListener('submit', (e) => e.preventDefault());
calc();

// ---------- الباقات وقصة النجاح ----------
function plans(list) {
  render($('plan-list'), html`${list.map((p) => html`<div class="mc-plan${p.featured ? ' featured' : ''}">
    ${p.note ? html`<span class="mc-plan-note">${p.note}</span>` : ''}
    <h3>${p.name}</h3>
    <b class="mc-price">${p.price}</b>
    <ul>${p.items.map((i) => html`<li>${i}</li>`)}</ul>
    <a class="btn ${p.featured ? 'btn-gold' : ''} big" href="#" data-guide="${'أبي باقة ' + p.name}">اطلب ${p.name}</a>
  </div>`)}`);
}
function story(s) {
  const box = $('story');
  render(box, html`<span class="kicker">قصة نجاح</span>
    <div class="mc-story">
      <div class="mc-story-head">
        <div class="lg" style="${s.merchant.brand_color ? 'border-color:' + s.merchant.brand_color : ''}">${s.merchant.logo_url ? html`<img src="${s.merchant.logo_url}" alt="">` : initial(s.merchant.name)}</div>
        <div><h2>${s.headline || s.merchant.name + ' مع أصالة'}</h2><a href="/brand/?s=${s.merchant.slug}" class="small">صفحة ${s.merchant.name} ←</a></div>
      </div>
      <blockquote>«${s.quote}»<cite>${s.author}</cite></blockquote>
      <div class="mc-story-stats">
        <div><b>${fmt(s.stats.original)}</b><span>عملية تحقق لمنتج أصلي</span></div>
        <div><b>${fmt(s.stats.fakes)}</b><span>محاولة تقليد وبلاغ انكشف</span></div>
        <div><b>${fmt(s.stats.cities)}</b><span>مدينة يمسح منها عملاؤه</span></div>
        <div><b>${fmt(s.stats.days)}</b><span>يوم مع أصالة</span></div>
      </div>
    </div>`);
  box.hidden = false;
}
try {
  const d = await (await fetch('/api/public/merchants-page')).json();
  plans(d.plans || []);
  if (d.story) story(d.story);
} catch {
  render($('plan-list'), html`<div class="empty">تواصل معنا ونرسل لك الباقات</div>`);
}

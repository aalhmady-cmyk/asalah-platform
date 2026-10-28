// الموقع العام: قائمة العلامات التجارية المحمية
import { html, initial, render } from '/assets/common.js';

const list = document.getElementById('brand-list');
let brands = [];
function show(q = '') {
  const t = q.trim();
  const rows = t ? brands.filter((b) => b.name.includes(t) || (b.about || '').includes(t)) : brands;
  render(list, !rows.length ? html`<div class="empty">${brands.length ? 'ما لقينا علامة بهذا الاسم' : 'قريباً: العلامات التجارية المحمية بأصالة'}</div>` : html`${rows.map(
    (b) => html`<a class="brand-card" href="/brand/?s=${b.slug}">
      <div class="lg">${b.logo_url ? html`<img src="${b.logo_url}" alt="" loading="lazy">` : initial(b.name)}</div>
      <h3>${b.name}</h3>${b.about ? html`<p>${b.about}</p>` : ''}
      <span class="meta">${b.sellers ? `${b.sellers} نقطة بيع معتمدة ←` : 'عرض العلامة ←'}</span></a>`
  )}`);
}
document.getElementById('brand-q').addEventListener('input', (e) => show(e.target.value));

// أرقام المنصة تعدّ من صفر
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el, to) {
  if (reduced || to < 10) { el.textContent = to.toLocaleString('en-US'); return; }
  const t0 = performance.now(), dur = 1400;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// الأقسام تظهر بحركة خفيفة وقت النزول
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 }) : null;
if (io) document.querySelectorAll('.step, .feat, .split, .faq details, .merchants').forEach((el) => { el.classList.add('reveal'); io.observe(el); });

// طلب انضمام تاجر
const join = document.getElementById('join-form');
join.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = join.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const res = await fetch('/api/public/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(join))) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message || 'صار خطأ، حاول مرة ثانية');
    join.reset();
    const ok = document.getElementById('join-ok');
    ok.textContent = '✅ ' + d.message;
    ok.hidden = false;
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

try {
  brands = (await (await fetch('/api/public/brands')).json()).brands || [];
} catch {}
show();
try {
  const s = await (await fetch('/api/public/stats')).json();
  if (s.ok && s.original > 0) {
    document.getElementById('stats').hidden = false;
    for (const el of document.querySelectorAll('[data-stat]')) countUp(el, s[el.dataset.stat] ?? 0);
  }
} catch {}

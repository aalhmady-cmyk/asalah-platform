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
try {
  brands = (await (await fetch('/api/public/brands')).json()).brands || [];
} catch {}
show();

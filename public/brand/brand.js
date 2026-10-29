// صفحة العلامة التجارية العامة: منتجاتها ووين تلقى الأصلي
import { html, initial, render } from '/assets/common.js';

const box = document.getElementById('brand-page');
const slug = new URLSearchParams(location.search).get('s') || '';
const res = slug ? await fetch('/api/public/brands/' + encodeURIComponent(slug)).catch(() => null) : null;
const d = res ? await res.json().catch(() => null) : null;
if (!d?.ok) {
  render(box, html`<section class="sec"><div class="empty">${d?.message || 'ما لقينا هذي العلامة التجارية'}</div><a class="btn" href="/">الرئيسية</a></section>`);
} else {
  const b = d.brand;
  document.title = `${b.name} - منتجات أصلية | أصالة`;
  const cities = new Map();
  for (const s of d.sellers.filter((x) => !x.online)) {
    if (!cities.has(s.city)) cities.set(s.city, []);
    cities.get(s.city).push(s);
  }
  const online = d.sellers.filter((x) => x.online);
  const seller = (s) => html`<div class="seller"><b>${s.name}</b>${s.address ? html`<span class="muted">${s.address}</span>` : ''}
    <div class="links">${s.map_url ? html`<a href="${s.map_url}" target="_blank" rel="noopener">📍 الموقع</a>` : ''}${s.phone ? html`<a href="tel:${s.phone}">📞 اتصال</a>` : ''}</div></div>`;
  render(box, html`
    <section class="b-hero"><div class="b-hero-in">
      <div class="lg">${b.logo_url ? html`<img src="${b.logo_url}" alt="">` : initial(b.name)}</div>
      <div><span class="verified">✓ علامة محمية بأصالة</span><h1>${b.name}</h1>${b.about ? html`<p>${b.about}</p>` : ''}</div>
      ${b.store_url ? html`<a class="btn btn-gold big" style="margin-inline-start:auto" href="${b.store_url}" target="_blank" rel="noopener">المتجر الرسمي</a>` : ''}
    </div></section>
    <section class="sec"><div class="tip-box">💡 كل منتج أصلي من ${b.name} عليه علامة أصالة. قرّب جوالك منها قبل الشراء، ولو طلع لك تحذير لا تشتري وبلّغ من نفس الصفحة.</div></section>
    ${d.products.length ? html`<section class="sec"><h2>المنتجات</h2><div class="products">${d.products.map((p) => html`<div class="product-card"><div class="im">${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : '📦'}</div><b>${p.name}</b></div>`)}</div></section>` : ''}
    <section class="sec"><h2>وين ألقى الأصلي؟</h2>
      ${!d.sellers.length ? html`<div class="empty">قريباً: نقاط البيع المعتمدة</div>` : ''}
      ${online.length ? html`<div class="city-group"><h3>🛒 متاجر إلكترونية</h3><div class="sellers">${online.map(seller)}</div></div>` : ''}
      ${[...cities].map(([city, rows]) => html`<div class="city-group"><h3>${city} <small>${rows.length} نقطة بيع</small></h3><div class="sellers">${rows.map(seller)}</div></div>`)}
    </section>`);
}

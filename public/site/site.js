// متجر التاجر الخاص /s/slug: العرض العادي، صفحة الهبوط لكل منتج /s/slug/p/id، المعرض ثلاثي الأبعاد،
// والسلة اللي تنحفظ عند التاجر (سلة متروكة) وتتحول لطلب برقم يتأكد على واتساب أو يكمل في سلة.
import { html, raw, render } from '/assets/common.js';
import { humanToken } from '/assets/human.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const PREVIEW = qs.get('preview') === '1';
const EMBED = qs.get('embed') === '1';
const slug = location.pathname.split('/')[2];
// متجر تجريبي للتجار: بيانات ثابتة بدون خادم
const DEMO = slug === 'demo';
const KIND = qs.get('t') || 'perfume';
const keep = () => (PREVIEW ? `?preview=1${EMBED ? '&embed=1' : ''}` : DEMO ? `?t=${KIND}` : '');
let D = null; // بيانات المتجر
let C = null; // إعدادات المتجر
let show = null; // المعرض ثلاثي الأبعاد لو انفتح
let current = 'grid';

const FONT_URL = {
  plex: 'IBM+Plex+Sans+Arabic:wght@400;500;600;700',
  tajawal: 'Tajawal:wght@400;500;700;800',
  cairo: 'Cairo:wght@400;600;700;800',
  amiri: 'Amiri:wght@400;700',
  almarai: 'Almarai:wght@400;700;800',
};
const FONT_NAME = { plex: 'IBM Plex Sans Arabic', tajawal: 'Tajawal', cairo: 'Cairo', amiri: 'Amiri', almarai: 'Almarai' };
const sar = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س');
const store = (() => { try { return localStorage; } catch { return null; } })();

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- السلة ----------
const CART_KEY = 'asalah_cart_' + slug + (DEMO ? '_' + KIND : '');
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 28);
let cart = { token: rnd(), items: [], name: '', phone: '', city: '', note: '', coupon: '', consent: false };
try { const s = JSON.parse(store?.getItem(CART_KEY) || 'null'); if (s?.token) cart = { ...cart, ...s }; } catch { /* سلة تالفة */ }
const product = (id) => D.products.find((p) => p.id === id);
function saveCart(sync = true) {
  cart.items = cart.items.filter((it) => product(it.id));
  try { store?.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* تخزين مقفل */ }
  const n = cart.items.reduce((s, it) => s + it.qty, 0);
  $('cart-n').textContent = n;
  $('cart-n').hidden = !n;
  if (sync && !PREVIEW && !DEMO) {
    clearTimeout(saveCart.t);
    saveCart.t = setTimeout(() => {
      fetch(`/api/public/site/${slug}/cart`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: cart.token, items: cart.items, name: cart.name || null, phone: validPhone(cart.phone) ? cart.phone : null, city: cart.city || null, consent: cart.consent }) }).catch(() => {});
    }, 1200);
  }
}
const validPhone = (p) => /^(9665\d{8}|05\d{8}|5\d{8})$/.test(String(p || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, ''));

function addToCart(id, from) {
  const it = cart.items.find((x) => x.id === id);
  if (it) it.qty = Math.min(50, it.qty + 1);
  else cart.items.push({ id, qty: 1 });
  saveCart();
  flyToCart(from, product(id)?.image_url);
  toast('انضاف للسلة 🛒');
}

// المنتج يطير لزر السلة
function flyToCart(from, img) {
  const btn = $('cart-btn');
  btn.classList.remove('bump');
  void btn.offsetWidth;
  btn.classList.add('bump');
  if (!from || !img || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = from.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  const el = Object.assign(document.createElement('img'), { src: img, className: 'fly' });
  el.style.left = a.left + a.width / 2 - 30 + 'px';
  el.style.top = a.top + a.height / 2 - 30 + 'px';
  document.body.append(el);
  requestAnimationFrame(() => {
    el.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(.25) rotate(-25deg)`;
    el.style.opacity = '.4';
  });
  setTimeout(() => el.remove(), 750);
}

function totals() {
  const sub = cart.items.reduce((s, it) => s + (product(it.id)?.price || 0) * it.qty, 0);
  const cp = C.coupon && cart.coupon.trim().toUpperCase() === C.coupon.code ? C.coupon : null;
  const off = cp ? Math.round(sub * cp.percent) / 100 : 0;
  return { sub, off, total: sub - off, cp };
}

function openCart() {
  drawCart();
  $('cart').hidden = false;
  document.body.classList.add('lock');
}
function closeCart() {
  $('cart').hidden = true;
  document.body.classList.remove('lock');
}

function drawCart(done) {
  const body = $('cart-body');
  if (done?.demo) {
    render(body, html`<div class="done">
      <div class="done-ic">✅</div><h2>كذا يوصل طلب عميلك</h2><p>رقم الطلب</p><div class="done-no">${done.number}</div>
      <p>في متجرك الحقيقي: العميل ينفتح له واتساب برسالة «أريد تأكيد طلبي رقم ${done.number}»، والطلب يظهر لك في لوحتك في «طلبات العملاء» مع إشعار على جوالك 🔔</p>
      <a class="btn gold big" href="/merchants/">🏪 أبي متجر مثله</a>
      <button type="button" class="btn ghost" data-close>رجوع للمتجر</button></div>`);
    return;
  }
  if (done) {
    render(body, html`<div class="done">
      <div class="done-ic">✅</div><h2>انحفظ طلبك</h2><p>رقم طلبك</p><div class="done-no">${done.number}</div>
      ${done.channel === 'whatsapp'
        ? html`<p>كمّل على واتساب عشان يأكد لك المتجر الطلب وطريقة الدفع والتوصيل.</p><a class="btn wa big" href="${done.whatsapp_url}" target="_blank" rel="noopener">💬 أكّد طلبي على واتساب</a>`
        : html`<p>كمّل الدفع في متجرنا على سلة:</p>${done.links.map((l) => html`<a class="btn big" href="${l.url}" target="_blank" rel="noopener">🛒 ${l.title} × ${l.qty} ↗</a>`)}`}
      ${done.track ? html`<a class="btn ghost" href="${done.track}" target="_blank" rel="noopener">📦 تتبع طلبك</a>` : ''}
      <p class="note">💳 الدفع الإلكتروني عبر أصالة قريباً، حالياً يتم تأكيد الطلب مع المتجر.</p>
      <button type="button" class="btn ghost" data-close>رجوع للمتجر</button></div>`);
    return;
  }
  if (!cart.items.length) {
    render(body, html`<div class="empty-cart"><div>🛍️</div><p>سلتك فاضية</p><button type="button" class="btn" data-close>تسوّق الحين</button></div>`);
    return;
  }
  const t = totals();
  const viaWa = C.checkout !== 'salla' || !cart.items.every((it) => product(it.id)?.buy_url);
  render(body, html`
    <ul class="ci-list">${cart.items.map((it) => { const p = product(it.id); return html`<li class="ci">
      ${p.image_url ? html`<img src="${p.image_url}" alt="">` : raw('<span class="ci-noimg">🛍️</span>')}
      <div class="ci-info"><b>${p.title}</b><span>${sar(p.price)}</span></div>
      <div class="qty"><button type="button" data-q="${p.id}" data-d="1" aria-label="زيادة">+</button><span>${it.qty}</span><button type="button" data-q="${p.id}" data-d="-1" aria-label="نقص">−</button></div></li>`; })}</ul>
    ${C.coupon ? html`<label class="coupon-in"><span>🎁 كود الخصم</span><input id="c-coupon" class="ltr" value="${cart.coupon}" placeholder="${C.coupon.code}" autocomplete="off"></label>` : ''}
    <div class="sum"><div><span>المجموع</span><span>${sar(t.sub)}</span></div>${t.off ? html`<div class="off"><span>خصم ${t.cp.code}</span><span>-${sar(t.off)}</span></div>` : ''}<div class="tot"><span>الإجمالي</span><b>${sar(t.total)}</b></div></div>
    <form id="order-form" class="order-form" novalidate>
      <input name="name" placeholder="اسمك" autocomplete="name" maxlength="80" value="${cart.name}" required>
      <input name="phone" placeholder="رقم جوالك (05xxxxxxxx)" inputmode="tel" autocomplete="tel" value="${cart.phone}" required>
      <input name="city" placeholder="المدينة" autocomplete="address-level2" maxlength="60" value="${cart.city}">
      <textarea name="note" rows="2" maxlength="300" placeholder="ملاحظة على الطلب (اختياري)">${cart.note}</textarea>
      <label class="consent"><input type="checkbox" name="consent" ${raw(cart.consent ? 'checked' : '')}> أوافق إن المتجر يتواصل معي بخصوص طلبي</label>
      <button class="btn ${viaWa ? 'wa' : ''} big" type="submit">${viaWa ? '💬 أكّد الطلب عبر واتساب' : '🛒 أكمل الشراء في سلة'}</button>
      <p class="note">💳 الدفع الإلكتروني عبر أصالة قريباً، حالياً يتم تأكيد الطلب مع المتجر.</p>
      ${C.shipping ? html`<p class="note">${C.shipping}</p>` : ''}
    </form>`);
  const f = $('order-form');
  for (const k of ['name', 'phone', 'city', 'note']) f[k].addEventListener('change', () => { cart[k] = f[k].value.trim(); saveCart(); });
  f.consent.addEventListener('change', () => { cart.consent = f.consent.checked; saveCart(); });
  $('c-coupon')?.addEventListener('change', (e) => { cart.coupon = e.target.value.trim(); saveCart(false); drawCart(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.assign(cart, { name: f.name.value.trim(), phone: f.phone.value.trim(), city: f.city.value.trim(), note: f.note.value.trim(), consent: f.consent.checked });
    saveCart(false);
    if (!cart.name) return toast('اكتب اسمك');
    if (!validPhone(cart.phone)) return toast('اكتب رقم جوال صحيح');
    if (!cart.consent) return toast('وافق على تواصل المتجر معك');
    if (PREVIEW) return toast('هذي معاينة، الطلب يشتغل بعد النشر');
    if (DEMO) {
      cart = { ...cart, items: [], note: '', coupon: '' };
      saveCart(false);
      return drawCart({ demo: true, number: 'A-10234' });
    }
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const r = await fetch(`/api/public/site/${slug}/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cart, cf_token: await humanToken() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'تعذر حفظ الطلب');
      cart = { ...cart, token: rnd(), items: [], note: '', coupon: '' };
      saveCart(false);
      drawCart(d);
      if (d.whatsapp_url) location.href = d.whatsapp_url;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}

$('cart').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return closeCart();
  const q = e.target.closest('[data-q]');
  if (q) {
    const it = cart.items.find((x) => x.id === Number(q.dataset.q));
    it.qty += Number(q.dataset.d);
    if (it.qty < 1) cart.items = cart.items.filter((x) => x !== it);
    saveCart();
    drawCart();
  }
});
$('cart-btn').addEventListener('click', openCart);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('cart').hidden) closeCart(); });

// ---------- الشكل ----------
function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty('--p', C.colors.primary);
  r.setProperty('--a', C.colors.accent);
  r.setProperty('--bg', C.colors.bg);
  if (C.font !== 'plex') {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${FONT_URL[C.font]}&display=swap` }));
  }
  r.setProperty('--font', `'${FONT_NAME[C.font]}', 'IBM Plex Sans Arabic', system-ui, sans-serif`);
  document.body.dataset.card = C.card;
  document.body.dataset.theme = C.theme;
  $('sname').textContent = C.name;
  render($('logo'), D.merchant.logo_url ? html`<img src="${D.merchant.logo_url}" alt="">` : html`${C.name.trim().charAt(0)}`);
  $('brand').href = `/s/${slug}${keep()}`;
  if (C.announcement) { $('announce').textContent = C.announcement; $('announce').hidden = false; }
  $('preview-bar').hidden = !PREVIEW || EMBED;
}

// ---------- العرض العادي ----------
function sections() {
  const out = [];
  const used = new Set();
  for (const s of C.sections) {
    const items = D.products.filter((p) => p.category === s.category);
    if (items.length) { out.push({ title: s.title, items }); items.forEach((p) => used.add(p.id)); }
  }
  const rest = D.products.filter((p) => !used.has(p.id));
  if (rest.length) out.push({ title: out.length ? 'منتجات أخرى' : 'كل المنتجات', items: rest });
  return out;
}

const card = (p) => html`<article class="pc" data-open="${p.id}">
  <div class="pc-img">${p.image_url ? html`<img src="${p.image_url}" alt="${p.title}" loading="lazy">` : raw('<span>🛍️</span>')}${p.old_price ? html`<i class="pc-off">-${Math.round((1 - p.price / p.old_price) * 100)}٪</i>` : ''}<i class="pc-ok">✅ أصلي</i></div>
  <div class="pc-body"><h3>${p.title}</h3>${p.rating ? html`<span class="stars">★ ${p.rating.avg} <small>(${p.rating.n})</small></span>` : ''}
  <div class="pc-foot"><span class="price">${sar(p.price)}${p.old_price ? html`<s>${sar(p.old_price)}</s>` : ''}</span><button type="button" class="add" data-add="${p.id}" aria-label="أضف ${p.title} للسلة">+</button></div></div></article>`;

let slideTimer;
function drawGrid() {
  const secs = sections();
  const pics = D.products.filter((p) => p.image_url).slice(0, 3);
  render($('grid-view'), html`
    <section class="hero">
      <div class="slides" id="slides">${C.slides.map((s, i) => html`<div class="slide ${i ? '' : 'on'}"><h1>${s.title}</h1>${s.sub ? html`<p>${s.sub}</p>` : ''}${s.cta ? html`<a class="btn gold" href="#products">${s.cta}</a>` : ''}</div>`)}</div>
      <div class="hero-art" aria-hidden="true">${pics.map((p, i) => html`<img class="ha${i}" src="${p.image_url}" alt="">`)}</div>
      ${C.slides.length > 1 ? html`<div class="dots">${C.slides.map((_, i) => html`<button type="button" data-slide="${i}" class="${i ? '' : 'on'}" aria-label="شريحة ${i + 1}"></button>`)}</div>` : ''}
      <button type="button" class="hero-3d" data-go3d>🕶️ ادخل المعرض ثلاثي الأبعاد</button>
    </section>
    ${C.coupon ? html`<button type="button" class="coupon" data-copy="${C.coupon.code}">🎁 ${C.coupon.note || 'خصم'} ${C.coupon.percent}٪ بكود <b class="ltr">${C.coupon.code}</b> <small>اضغط للنسخ</small></button>` : ''}
    ${secs.length > 1 ? html`<nav class="chips">${secs.map((s, i) => html`<a href="#sec-${i}">${s.title}</a>`)}</nav>` : ''}
    <div id="products">${secs.length ? secs.map((s, i) => html`<section class="sec" id="sec-${i}"><h2>${s.title}</h2><div class="pgrid">${s.items.map(card)}</div></section>`) : html`<p class="empty">ما فيه منتجات معروضة للحين.</p>`}</div>
    <section class="trust"><div class="trust-ic">🛡️</div><div><h2>كل منتج أصلي ومضمون</h2><p>منتجات ${C.name} عليها علامة أصالة. بعد ما يوصلك المنتج، المسه بجوالك أو صوّر الـQR وتعرف خلال ثانية إنه أصلي.</p></div></section>
    ${C.about ? html`<section class="about"><h2>عن ${C.name}</h2><p>${C.about}</p></section>` : ''}
    <section class="info">${C.shipping ? html`<div><b>🚚 الشحن والتوصيل</b><p>${C.shipping}</p></div>` : ''}${C.payment ? html`<div><b>💳 الدفع</b><p>${C.payment}</p></div>` : ''}<div><b>💬 الطلب</b><p>${C.checkout === 'salla' ? 'تكمل الشراء في متجرنا على سلة، وطلبك ينحفظ برقم.' : 'تختار منتجاتك ويوصلك رقم طلب، وتأكده معنا على واتساب.'} الدفع الإلكتروني عبر أصالة قريباً.</p></div></section>
    <footer class="foot">${C.name} على منصة <a href="/" target="_blank" rel="noopener">أصالة المنتجات الأصلية</a> · <a href="/stores/?m=${slug}" target="_blank" rel="noopener">شوف منتجاتنا في متاجر أصالة</a></footer>`);
  clearInterval(slideTimer);
  if (C.slides.length > 1) slideTimer = setInterval(() => goSlide((curSlide + 1) % C.slides.length), 5000);
}
let curSlide = 0;
function goSlide(i) {
  curSlide = i;
  document.querySelectorAll('.slide').forEach((s, k) => s.classList.toggle('on', k === i));
  document.querySelectorAll('.dots button').forEach((s, k) => s.classList.toggle('on', k === i));
}

// ---------- صفحة الهبوط ----------
function drawLanding(p) {
  const l = p.landing || {};
  const more = D.products.filter((x) => x.id !== p.id).slice(0, 8);
  render($('grid-view'), html`
    <article class="lp">
      <a class="back" href="/s/${slug}${keep()}" data-home>→ ${C.name}</a>
      <div class="lp-top">
        <div class="lp-img">${p.image_url ? html`<img src="${p.image_url}" alt="${p.title}">` : raw('<span>🛍️</span>')}<i class="pc-ok">✅ أصلي موثّق</i></div>
        <div class="lp-copy">
          <h1>${l.headline || p.title}</h1>
          ${l.headline && l.headline !== p.title ? html`<p class="lp-name">${p.title}</p>` : ''}
          ${l.sub ? html`<p class="lp-sub">${l.sub}</p>` : ''}
          <div class="lp-price">${sar(p.price)}${p.old_price ? html`<s>${sar(p.old_price)}</s><i>وفّر ${sar(p.old_price - p.price)}</i>` : ''}</div>
          ${p.rating ? html`<span class="stars">★ ${p.rating.avg} <small>(${p.rating.n} تقييم)</small></span>` : ''}
          ${l.bullets?.length ? html`<ul class="lp-bul">${l.bullets.map((b) => html`<li>${b}</li>`)}</ul>` : ''}
          ${l.urgency ? html`<p class="lp-urg">⏳ ${l.urgency}</p>` : ''}
          <div class="lp-cta"><button type="button" class="btn gold big" data-buy="${p.id}">${l.cta || 'اطلب الحين'}</button><button type="button" class="btn ghost" data-add="${p.id}">+ أضف للسلة</button></div>
          <button type="button" class="link" data-go3d="${p.id}">🕶️ شوفه في المعرض ثلاثي الأبعاد</button>
          ${C.coupon ? html`<button type="button" class="coupon sm" data-copy="${C.coupon.code}">🎁 خصم ${C.coupon.percent}٪ بكود <b class="ltr">${C.coupon.code}</b></button>` : ''}
        </div>
      </div>
      ${p.description ? html`<section class="lp-desc"><h2>عن المنتج</h2><p>${p.description}</p></section>` : ''}
      <section class="trust"><div class="trust-ic">🛡️</div><div><h2>أصلي 100٪ وتقدر تتأكد بنفسك</h2><p>على المنتج علامة أصالة. المسها بجوالك أو صوّر الـQR، وتطلع لك النتيجة خلال ثانية.</p></div></section>
      ${l.faq?.length ? html`<section class="faq"><h2>أسئلة شائعة</h2>${l.faq.map((f) => html`<details><summary>${f.q}</summary><p>${f.a}</p></details>`)}</section>` : ''}
      ${more.length ? html`<section class="sec"><h2>ممكن يعجبك أيضاً</h2><div class="pgrid">${more.map(card)}</div></section>` : ''}
    </article>
    <div class="lp-bar"><div><b>${sar(p.price)}</b><small>${p.title}</small></div><button type="button" class="btn gold" data-buy="${p.id}">${l.cta || 'اطلب الحين'}</button></div>
    <footer class="foot">${C.name} على منصة <a href="/" target="_blank" rel="noopener">أصالة المنتجات الأصلية</a></footer>`);
  scrollTo(0, 0);
}

// ---------- التنقل ----------
function route() {
  const m = location.pathname.match(/^\/s\/[a-z0-9-]+\/p\/(\d+)/);
  const p = m && product(Number(m[1]));
  if (p) { setView('grid', true); drawLanding(p); document.title = `${p.landing?.headline || p.title} · ${C.name}`; return; }
  document.title = `${C.name} · منتجات أصلية موثّقة`;
  drawGrid();
}
function go(path) {
  history.pushState(null, '', path + keep());
  route();
}
addEventListener('popstate', route);

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) { e.stopPropagation(); return addToCart(Number(add.dataset.add), add); }
  const buy = e.target.closest('[data-buy]');
  if (buy) { const id = Number(buy.dataset.buy); if (!cart.items.find((x) => x.id === id)) addToCart(id, buy); return openCart(); }
  const g3 = e.target.closest('[data-go3d]');
  if (g3) return setView('3d', false, Number(g3.dataset.go3d) || null);
  const cp = e.target.closest('[data-copy]');
  if (cp) { cart.coupon = cp.dataset.copy; saveCart(false); navigator.clipboard?.writeText(cp.dataset.copy).catch(() => {}); return toast('انسخ الكود وينطبق تلقائياً في السلة 🎁'); }
  const sl = e.target.closest('[data-slide]');
  if (sl) return goSlide(Number(sl.dataset.slide));
  const home = e.target.closest('[data-home]');
  if (home) { e.preventDefault(); return go(`/s/${slug}`); }
  const open = e.target.closest('[data-open]');
  if (open) return go(`/s/${slug}/p/${open.dataset.open}`);
});
document.querySelector('.viewsw').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });

// ---------- المعرض ثلاثي الأبعاد ----------
const webgl = (() => { try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();

async function setView(v, quiet, focusId) {
  if (v === '3d' && (!webgl || !D.products.length)) { if (!quiet) toast(webgl ? 'ما فيه منتجات في المعرض للحين' : 'جوالك ما يدعم المعرض ثلاثي الأبعاد'); v = 'grid'; }
  current = v;
  try { sessionStorage.setItem('asalah_view_' + slug, v); } catch { /* تخزين مقفل */ }
  document.querySelectorAll('.viewsw [data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  document.body.dataset.view = v;
  $('grid-view').hidden = v !== 'grid';
  $('show').hidden = v !== '3d';
  if (v === '3d') {
    if (!show) {
      const { mountShowroom } = await import('/site/showroom.js');
      show = await mountShowroom({
        canvas: $('show-canvas'),
        products: D.products,
        config: C,
        merchant: D.merchant,
        sections: sections(),
        onPick: showCard,
        onNear: showNear,
      });
      render($('show-secs'), html`${sections().map((s, i) => html`<button type="button" data-sec="${i}">${s.title}</button>`)}`);
      $('show-secs').onclick = (e) => { const b = e.target.closest('[data-sec]'); if (b) show.goSection(Number(b.dataset.sec)); };
      setTimeout(() => $('show-hint').classList.add('fade'), 5000);
    }
    show.resume();
    if (focusId) show.focus(focusId);
  } else show?.pause();
}

function showNear(p) {
  const el = $('show-near');
  if (!p || !$('show-card').hidden) { el.hidden = true; return; }
  render(el, html`<button type="button" data-pick="${p.id}"><b>${p.title}</b><span>${sar(p.price)} · اضغط للتفاصيل</span></button>`);
  el.hidden = false;
}
$('show-near').addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) show.focus(Number(b.dataset.pick)); });

function showCard(p) {
  const el = $('show-card');
  if (!p) { el.hidden = true; return; }
  $('show-near').hidden = true;
  render(el, html`<button type="button" class="x" data-x aria-label="إغلاق">✕</button>
    <div class="sc-top">${p.image_url ? html`<img src="${p.image_url}" alt="">` : ''}<div><span class="sc-ok">✅ أصلي موثّق من أصالة</span><h3>${p.title}</h3><div class="price">${sar(p.price)}${p.old_price ? html`<s>${sar(p.old_price)}</s>` : ''}</div>${p.rating ? html`<span class="stars">★ ${p.rating.avg}</span>` : ''}</div></div>
    ${p.landing?.sub || p.description ? html`<p>${(p.landing?.sub || p.description).slice(0, 160)}</p>` : ''}
    <div class="sc-act"><button type="button" class="btn gold" data-add="${p.id}">🛒 أضف للسلة</button><button type="button" class="btn ghost" data-detail="${p.id}">التفاصيل</button></div>`);
  el.hidden = false;
}
$('show-card').addEventListener('click', (e) => {
  if (e.target.closest('[data-x]')) { $('show-card').hidden = true; show?.release(); }
  const d = e.target.closest('[data-detail]');
  if (d) go(`/s/${slug}/p/${d.dataset.detail}`);
});

// ---------- البداية ----------
async function boot() {
  try {
    if (DEMO) {
      const { demoData, DEMO_KINDS } = await import('/site/demo.js');
      D = demoData(KIND);
      C = D.config;
      document.body.classList.add('demo');
      render($('demo-bar'), html`<span>🕶️ تجريبي:</span>${DEMO_KINDS.map(([k, l]) => html`<a href="/s/demo?t=${k}" ${raw(k === KIND ? 'aria-current="true"' : '')}>${l}</a>`)}<a class="demo-cta" href="/merchants/">أبي متجر مثله ←</a>`);
      $('demo-bar').hidden = false;
      try { sessionStorage.removeItem('asalah_view_demo'); } catch { /* تخزين مقفل */ }
    } else {
    const r = await fetch(`/api/public/site/${slug}${PREVIEW ? '?preview=1' : ''}`, { credentials: 'same-origin' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'المتجر غير متاح');
    D = d;
    C = d.config;
    }
  } catch (e) {
    render($('boot'), html`<div class="boot-logo">🏪</div><h1>${e.message}</h1><p><a href="/stores/">تسوّق في متاجر أصالة ←</a></p>`);
    return;
  }
  applyTheme();
  saveCart(false);
  $('boot').hidden = true;
  $('top').hidden = false;
  const onProduct = /\/p\/\d+/.test(location.pathname);
  let v = C.view;
  try { v = sessionStorage.getItem('asalah_view_' + slug) || v; } catch { /* تخزين مقفل */ }
  route();
  if (onProduct || v !== '3d' || !webgl || !D.products.length) return setView('grid', true);
  // باب المعرض: ينفتح بلمسة (أو تلقائياً في معاينة اللوحة)
  const doors = $('doors');
  render($('door-logo'), D.merchant.logo_url ? html`<img src="${D.merchant.logo_url}" alt="">` : html`${C.name.trim().charAt(0)}`);
  $('door-name').textContent = C.name;
  doors.hidden = false;
  const enter = () => {
    doors.classList.add('open');
    setTimeout(() => { doors.hidden = true; }, 1300);
    setView('3d', true);
  };
  if (EMBED) setTimeout(enter, 600);
  else { doors.addEventListener('click', enter, { once: true }); setTimeout(() => { if (!doors.classList.contains('open')) enter(); }, 4000); }
}
boot();

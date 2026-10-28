// متاجر أصالة: منتجات التجار الحقيقية، الريلز، المفضلة، ومساعد التسوق. الشراء يكمل في متجر التاجر (سلة).
// الواجهة بالعربي والإنجليزي، ومحتوى المنتجات يبقى مثل ما كتبه التاجر.
import { html, raw, render } from '/assets/common.js';

const $ = (s) => document.querySelector(s);
const view = $('#view'), sheet = $('#sheet');

// ---------- التخزين المحلي (اللغة والمفضلة واللايكات) ----------
function box() { try { const s = localStorage; s.setItem('__m', '1'); s.removeItem('__m'); return s; } catch { return null; } }
const ls = box();
const load = (k, d) => { try { return JSON.parse(ls?.getItem(k) || 'null') ?? d; } catch { return d; } };
const keep = (k, v) => { try { ls?.setItem(k, JSON.stringify(v)); } catch {} };
const favs = new Set(load('asalah_favs', []));
const savedReels = new Set(load('asalah_saved_reels', []));
const liked = new Set(load('asalah_liked', []));

// ---------- اللغة ----------
const qLang = new URLSearchParams(location.search).get('lang');
let lang = qLang === 'en' || qLang === 'ar' ? qLang : load('asalah_lang', 'ar');
const T = {
  ar: {
    brand: 'متاجر أصالة', tagline: 'كل منتج أصلي وموثّق', search: 'دوّر على منتج أو متجر…', home: 'الرئيسية', reels: 'ريلز', chat: 'المساعد', saved: 'المفضلة', asalah: 'أصالة', langBtn: 'EN',
    heroA: 'تسوّق', heroB: 'الأصلي', heroC: 'وبس', heroP: 'كل منتج هنا من علامته التجارية مباشرة، ومحمي بعلامة أصالة. تدفع في متجر التاجر الرسمي.',
    askBtn: '✨ اسأل المساعد', reelsBtn: '🎬 شوف الريلز', stores: 'المتاجر', products: (n) => `${n} منتج`, all: 'الكل', newIn: 'وصل جديد', noCat: 'ما فيه منتجات في هذي الفئة حالياً',
    soon: 'المتاجر الأصلية في الطريق', soonP: 'قريب بتلقى هنا منتجات العلامات السعودية الموثّقة بعلامة أصالة.', demo: 'جرّب نسخة العرض', demoBtn: '🧪 النسخة التجريبية', demoT: 'شوف النسخة التجريبية', demoP: 'اكتشف وتصفح متاجر أصالة بمنتجات تجريبية لين تكتمل المتاجر', haveBrand: 'عندك علامة تجارية؟',
    results: (q) => `نتائج «${q}»`, noResults: 'ما لقينا شي بهالاسم', noResultsP: 'جرّب كلمة ثانية، أو خل المساعد يدوّر لك.', askAbout: (q) => `✨ اسأل المساعد عن «${q}»`,
    verified: '🛡️ أصلي موثّق', verifiedT: 'أصلي وموثّق من أصالة', trust: (m) => `الدفع والشحن من متجر ${m} الرسمي`, buy: (m) => `اشتر الآن من ${m} ↗`, buyNow: 'اشتر الآن ↗', from: (m) => `من متجر ${m}`, buyShort: 'اشتر', share: '↗ شارك',
    save: '♡ حفظ', unsave: '♥ محفوظ', save_aria: 'أضف للمفضلة', productReels: 'ريلز المنتج', youMayLike: 'ممكن يعجبك', save_pct: (n) => `وفّر ${n}٪`,
    coupon: 'كوبون أصالة', copy: 'انسخ', copied: 'نسخنا الكود ✅ الصقه وقت الدفع', shared: 'نسخنا الرابط ✅', shareText: (p, m) => `${p} من ${m}، أصلي وموثّق في متاجر أصالة 🛡️`,
    noReels: 'ما فيه ريلز للحين', noReelsP: 'التجار بيبدون ينزلون ريلز منتجاتهم قريب.', browse: 'تصفّح المنتجات', newest: 'الأحدث', popular: 'الأكثر مشاهدة', savedTab: 'المحفوظة',
    sound_on: 'تشغيل الصوت', sound_off: 'كتم الصوت', like: 'أعجبني', saveReel: 'حفظ الريل',
    savedTitle: 'المفضلة', savedEmpty: 'ما حفظت شي للحين', savedEmptyP: 'اضغط ♡ على أي منتج أو ريل وتلقاه هنا.', savedProducts: 'منتجات', savedReels: 'ريلز',
    hello: 'هلا 👋 أنا مساعد متاجر أصالة. قول لي وش تبي (نوع المنتج، المناسبة، الميزانية) وأطلع لك الأصلي من المتاجر الموثّقة.',
    suggest: ['عطر فخم للمناسبات', 'هدية أقل من 200', 'قهوة مختصة', 'وش الجديد؟'], chatPh: 'قول لي وش تدوّر عليه…', send: 'إرسال',
    found: 'هذي اللي لقيتها لك 👇', notFound: 'ما لقيت شي يطابق طلبك. جرّب تكتب نوع المنتج، مثل: عطر أو قهوة أو تمر.', offline: 'تعذر الاتصال، حاول مرة ثانية.',
    err: 'صار خطأ', back: 'رجوع للرئيسية', loadErr: 'تعذر التحميل، حاول مرة ثانية', unavailable: 'المتجر غير متاح', close: 'إغلاق', reelOf: 'ريل', productsN: (n) => `${n} منتج`,
    stop: ['ابغى', 'ابي', 'أبي', 'أبغى', 'ودي', 'عندكم', 'فيه', 'ممكن', 'وش', 'ايش'], cur: 'ر.س',
  },
  en: {
    brand: 'Asalah Stores', tagline: 'Every product verified original', search: 'Search products or stores…', home: 'Home', reels: 'Reels', chat: 'Assistant', saved: 'Saved', asalah: 'Asalah', langBtn: 'ع',
    heroA: 'Shop', heroB: 'genuine', heroC: 'only', heroP: 'Every product comes straight from its brand and is protected by an Asalah tag. You pay in the brand’s official store.',
    askBtn: '✨ Ask the assistant', reelsBtn: '🎬 Watch reels', stores: 'Stores', products: (n) => `${n} products`, all: 'All', newIn: 'New arrivals', noCat: 'No products in this category yet',
    soon: 'Genuine stores are on the way', soonP: 'Soon you will find verified Saudi brands here, protected by Asalah tags.', demo: 'Try the demo', demoBtn: '🧪 Demo version', demoT: 'See the demo version', demoP: 'Discover and browse Asalah Stores with sample products while real stores fill up', haveBrand: 'Own a brand?',
    results: (q) => `Results for “${q}”`, noResults: 'Nothing found', noResultsP: 'Try another word, or let the assistant look for you.', askAbout: (q) => `✨ Ask the assistant about “${q}”`,
    verified: '🛡️ Verified original', verifiedT: 'Verified original by Asalah', trust: (m) => `Payment and shipping by ${m}’s official store`, buy: (m) => `Buy now from ${m} ↗`, buyNow: 'Buy now ↗', from: (m) => `from ${m}`, buyShort: 'Buy', share: '↗ Share',
    save: '♡ Save', unsave: '♥ Saved', save_aria: 'Save to favourites', productReels: 'Product reels', youMayLike: 'You may also like', save_pct: (n) => `Save ${n}%`,
    coupon: 'Asalah coupon', copy: 'Copy', copied: 'Code copied ✅ paste it at checkout', shared: 'Link copied ✅', shareText: (p, m) => `${p} by ${m}, verified original on Asalah Stores 🛡️`,
    noReels: 'No reels yet', noReelsP: 'Brands will start posting reels of their products soon.', browse: 'Browse products', newest: 'Newest', popular: 'Most viewed', savedTab: 'Saved',
    sound_on: 'Unmute', sound_off: 'Mute', like: 'Like', saveReel: 'Save reel',
    savedTitle: 'Saved', savedEmpty: 'Nothing saved yet', savedEmptyP: 'Tap ♡ on any product or reel to find it here.', savedProducts: 'Products', savedReels: 'Reels',
    hello: 'Hi 👋 I’m the Asalah Stores assistant. Tell me what you need (product type, occasion, budget) and I’ll find genuine options from verified stores.',
    suggest: ['A luxury perfume', 'A gift under 200 SAR', 'Specialty coffee', 'What’s new?'], chatPh: 'Tell me what you’re looking for…', send: 'Send',
    found: 'Here’s what I found 👇', notFound: 'I couldn’t find a match. Try a product type, like perfume, coffee or dates.', offline: 'Connection failed, please try again.',
    err: 'Something went wrong', back: 'Back to home', loadErr: 'Couldn’t load, please try again', unavailable: 'Store unavailable', close: 'Close', reelOf: 'Reel', productsN: (n) => `${n} products`,
    stop: ['i', 'want', 'need', 'a', 'an', 'the', 'some', 'for', 'me', 'do', 'you', 'have'], cur: 'SAR',
  },
};
const CAT_EN = { perfume: 'Perfume & incense', coffee: 'Coffee & tea', food: 'Dates & food', health: 'Health & supplements', beauty: 'Beauty & care', fashion: 'Fashion', accessories: 'Bags & accessories', watches: 'Watches', home: 'Home', kids: 'Kids', electronics: 'Electronics', other: 'Other' };
const t = (k, ...a) => { const v = T[lang][k]; return typeof v === 'function' ? v(...a) : v; };
const catLabel = (c) => (lang === 'en' ? CAT_EN[c.key] || c.label : c.label);
const sar = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + t('cur'));
const off = (p) => (p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0);

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = t('brand');
  $('.mk-brand b').textContent = t('brand');
  $('.mk-brand small').textContent = t('tagline');
  $('#search').q.placeholder = t('search');
  $('#search').q.setAttribute('aria-label', t('search'));
  for (const [k, ic] of [['home', '🏠'], ['reels', '🎬'], ['saved', '♡'], ['chat', '✨']]) {
    const b = $(`.mk-tabs [data-go="${k}"]`);
    if (b) b.innerHTML = `<span aria-hidden="true">${ic}</span>${t(k)}`;
  }
  $('.mk-home-link').innerHTML = `<span aria-hidden="true">🛡️</span>${t('asalah')}`;
  $('#lang').textContent = t('langBtn');
  $('#lang').setAttribute('aria-label', lang === 'en' ? 'العربية' : 'English');
}

let D = null; // بيانات الصفحة الرئيسية
const cache = new Map(); // المنتجات اللي شفناها
let chatLog = [];
try { chatLog = JSON.parse(sessionStorage.getItem('asalah_market_chat') || '[]'); } catch {}
const saveChat = () => { try { sessionStorage.setItem('asalah_market_chat', JSON.stringify(chatLog.slice(-30))); } catch {} };

async function get(path) {
  const r = await fetch(path);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(lang === 'en' ? t('loadErr') : d.message || t('loadErr'));
  return d;
}
const track = (type, id) => fetch('/api/public/store/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }), keepalive: true }).catch(() => {});

let toastT;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.hidden = true), 2800);
}

// ---------- التنقل ----------
function params() { return new URLSearchParams(location.search); }
function go(q, replace) {
  const u = '/stores/' + (q ? '?' + q : '');
  history[replace ? 'replaceState' : 'pushState'](null, '', u);
  route();
}
addEventListener('popstate', route);

async function route() {
  const p = params();
  stopReels();
  const tab = p.get('v') || (p.get('m') ? 'merchant' : p.get('q') ? 'search' : 'home');
  const navTab = tab === 'merchant' || tab === 'search' ? 'home' : tab;
  document.querySelectorAll('.mk-tabs [data-go]').forEach((b) => (b.dataset.go === navTab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  document.body.dataset.view = tab;
  try {
    if (tab === 'reels') await showReels(Number(p.get('r')) || null, p.get('sort'));
    else if (tab === 'chat') showChat();
    else if (tab === 'saved') await showSaved();
    else if (tab === 'merchant') await showMerchant(p.get('m'));
    else if (tab === 'search') await showSearch(p.get('q'), p.get('cat'));
    else await showHome(p.get('cat'));
  } catch (e) {
    render(view, html`<div class="mk-empty"><b>${t('err')}</b><p>${e.message}</p><button class="mk-btn" type="button" data-go="home">${t('back')}</button></div>`);
  }
  if (p.get('p')) openProduct(Number(p.get('p')), true);
  else closeSheet(true);
}

// ---------- البطاقات ----------
const badge = () => html`<span class="mk-verified" title="${t('verifiedT')}">${t('verified')}</span>`;
function heart(id) {
  const on = favs.has(id);
  return html`<button type="button" class="mk-heart ${on ? 'on' : ''}" data-fav="${id}" aria-pressed="${on}" aria-label="${t('save_aria')}">${on ? '♥' : '♡'}</button>`;
}
function card(p) {
  cache.set(p.id, p);
  return html`<article class="mk-card" data-product="${p.id}" tabindex="0" role="button" aria-label="${p.title}، ${sar(p.price)}">
    <div class="mk-card-img">${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : raw('<span aria-hidden="true">🛍️</span>')}${off(p) ? html`<span class="mk-off">-${off(p)}%</span>` : ''}${heart(p.id)}</div>
    <div class="mk-card-b">
      <span class="mk-card-m">${p.merchant_name}</span>
      <b class="mk-card-t">${p.title}</b>
      <div class="mk-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s>` : ''}</div>
    </div>
  </article>`;
}
const grid = (list) => html`<div class="mk-grid">${list.map(card)}</div>`;
function reelTile(r, i = 0) {
  return html`<button type="button" class="mk-reel-tile" data-reel="${r.id}" aria-label="${t('reelOf')}: ${r.title}" style="--i:${i}">
    ${r.poster_url ? html`<img src="${r.poster_url}" alt="" loading="lazy">` : ''}
    <span class="mk-play" aria-hidden="true">▶</span>
    ${r.views ? html`<span class="mk-views" aria-hidden="true">👁 ${compact(r.views)}</span>` : ''}
    <span class="mk-reel-cap"><b>${r.title}</b><small>${r.merchant_name}</small></span>
  </button>`;
}
const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));
function logo(m, size = 56) {
  return m.logo_url
    ? html`<img class="mk-logo" src="${m.logo_url}" alt="" width="${size}" height="${size}">`
    : html`<span class="mk-logo mk-logo-t" style="background:${m.brand_color || '#0E6B4E'};width:${size}px;height:${size}px">${(m.name || '?').replace(/^ال(?=\S{2})/, '').charAt(0)}</span>`;
}

// ---------- الرئيسية ----------
async function showHome(cat) {
  if (!D) {
    render(view, skeleton());
    D = await get('/api/public/store');
    D.products.forEach((p) => cache.set(p.id, p));
  }
  if (!D.products.length) return render(view, emptyStore());
  const cats = D.categories.filter((c) => c.count);
  const list = cat ? (await get('/api/public/store/products?cat=' + encodeURIComponent(cat))).products : D.products;
  const current = cats.find((c) => c.key === cat);
  render(view, html`
    <section class="mk-hero">
      <div>
        <h1>${t('heroA')} <em>${t('heroB')}</em> ${t('heroC')}</h1>
        <p>${t('heroP')}</p>
        <div class="mk-hero-cta"><button type="button" class="mk-btn gold" data-go="chat">${t('askBtn')}</button>${D.reels.length ? html`<button type="button" class="mk-btn ghost" data-go="reels">${t('reelsBtn')}</button>` : ''}<a class="mk-btn ghost" href="/stores/demo/">${t('demoBtn')}</a></div>
      </div>
      <div class="mk-hero-shield" aria-hidden="true">🛡️</div>
    </section>
    ${D.merchants.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>${t('stores')}</h2></div>
      <div class="mk-row">${D.merchants.map((m) => html`<button type="button" class="mk-store" data-merchant="${m.slug}">${logo(m)}<b>${m.name}</b><small>${t('products', m.products)}</small></button>`)}</div></section>` : ''}
    ${D.reels.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>${t('reels')} 🔥</h2><button type="button" class="mk-link" data-go="reels">${t('all')}</button></div>
      <div class="mk-row">${D.reels.map(reelTile)}</div></section>` : ''}
    <section class="mk-sec">
      <div class="mk-sec-h"><h2>${current ? catLabel(current) : t('newIn')}</h2></div>
      ${cats.length > 1 ? html`<div class="mk-chips" role="list">
        <button type="button" role="listitem" class="mk-chip" data-cat="" aria-pressed="${!cat}">${t('all')}</button>
        ${cats.map((c) => html`<button type="button" role="listitem" class="mk-chip" data-cat="${c.key}" aria-pressed="${c.key === cat}">${catLabel(c)}</button>`)}
      </div>` : ''}
      ${list.length ? grid(list) : html`<div class="mk-empty small">${t('noCat')}</div>`}
    </section>
    <a class="mk-demo-card" href="/stores/demo/"><span aria-hidden="true">🧪</span><span><b>${t('demoT')}</b><small>${t('demoP')}</small></span><span aria-hidden="true">←</span></a>`);
}

function skeleton() {
  return html`<div class="mk-skel">${Array.from({ length: 6 }, () => raw('<div class="mk-skel-card"></div>'))}</div>`;
}
function emptyStore() {
  return html`<div class="mk-empty big">
    <div class="mk-empty-art" aria-hidden="true">🛍️</div>
    <h1>${t('soon')}</h1>
    <p>${t('soonP')}</p>
    <div class="mk-hero-cta"><a class="mk-btn gold" href="/stores/demo/">${t('demo')}</a><a class="mk-btn ghost-d" href="/#merchants">${t('haveBrand')}</a></div>
  </div>`;
}

// ---------- البحث والمتجر والمفضلة ----------
async function showSearch(q, cat) {
  $('#search').q.value = q || '';
  render(view, skeleton());
  const d = await get('/api/public/store/products?q=' + encodeURIComponent(q || '') + (cat ? '&cat=' + encodeURIComponent(cat) : ''));
  render(view, html`<section class="mk-sec">
    <div class="mk-sec-h"><h2>${t('results', q)}</h2><span class="mk-muted">${t('productsN', d.products.length)}</span></div>
    ${d.products.length ? grid(d.products) : html`<div class="mk-empty"><b>${t('noResults')}</b><p>${t('noResultsP')}</p><button type="button" class="mk-btn gold" data-ask="${q}">${t('askAbout', q)}</button></div>`}
  </section>`);
}

async function showMerchant(slug) {
  render(view, skeleton());
  const d = await get('/api/public/store?m=' + encodeURIComponent(slug));
  const m = d.merchants.find((x) => x.slug === slug) || (d.products[0] && { name: d.products[0].merchant_name, slug, logo_url: d.products[0].merchant_logo });
  if (!m) throw new Error(t('unavailable'));
  d.products.forEach((p) => cache.set(p.id, p));
  render(view, html`
    <section class="mk-merchant">
      ${logo(m, 72)}
      <div><h1>${m.name}</h1><p>${badge()} · ${t('productsN', d.products.length)}</p></div>
    </section>
    ${d.reels.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>${t('reels')} · ${m.name}</h2></div><div class="mk-row">${d.reels.map(reelTile)}</div></section>` : ''}
    <section class="mk-sec">${d.products.length ? grid(d.products) : html`<div class="mk-empty small">${t('noCat')}</div>`}</section>`);
}

async function showSaved() {
  render(view, skeleton());
  const [p, r] = await Promise.all([
    favs.size ? get('/api/public/store/products?ids=' + [...favs].join(',')) : { products: [] },
    savedReels.size ? get('/api/public/store/reels?ids=' + [...savedReels].join(',')) : { reels: [] },
  ]);
  if (!p.products.length && !r.reels.length)
    return render(view, html`<div class="mk-empty big"><div class="mk-empty-art" aria-hidden="true">♡</div><h1>${t('savedEmpty')}</h1><p>${t('savedEmptyP')}</p><button type="button" class="mk-btn gold" data-go="home">${t('browse')}</button></div>`);
  render(view, html`
    ${r.reels.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>${t('savedReels')}</h2></div><div class="mk-row">${r.reels.map(reelTile)}</div></section>` : ''}
    ${p.products.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>${t('savedProducts')}</h2></div>${grid(p.products)}</section>` : ''}`);
}

// ---------- صفحة المنتج (تطلع من تحت) ----------
async function openProduct(id, fromRoute) {
  if (!fromRoute) {
    const p = params();
    p.set('p', id);
    history.pushState(null, '', '/stores/?' + p);
  }
  const quick = cache.get(id);
  sheet.hidden = false;
  document.body.classList.add('mk-lock');
  requestAnimationFrame(() => sheet.classList.add('open'));
  if (quick) drawProduct(quick, null);
  else render(sheet, html`<div class="mk-sheet-in"><div class="mk-skel-card tall"></div></div>`);
  try {
    const d = await get('/api/public/store/products/' + id);
    d.more.forEach((p) => cache.set(p.id, p));
    drawProduct(d.product, d);
    track('view', id);
  } catch (e) {
    render(sheet, html`<div class="mk-sheet-in"><button type="button" class="mk-x" data-close aria-label="${t('close')}">×</button><div class="mk-empty"><b>${e.message}</b></div></div>`);
  }
}
function drawProduct(p, d) {
  cache.set(p.id, p);
  const fav = favs.has(p.id);
  render(sheet, html`<div class="mk-sheet-bg" data-close></div>
  <article class="mk-sheet-in" role="dialog" aria-modal="true" aria-label="${p.title}">
    <button type="button" class="mk-x" data-close aria-label="${t('close')}">×</button>
    <div class="mk-p-img">${p.image_url ? html`<div class="mk-p-blur" style="background-image:url('${p.image_url}')" aria-hidden="true"></div><img src="${p.image_url}" alt="${p.title}">` : raw('<span aria-hidden="true">🛍️</span>')}</div>
    <div class="mk-p-b">
      <button type="button" class="mk-p-m" data-merchant="${p.merchant_slug}">${p.merchant_name} ›</button>
      <h1>${p.title}</h1>
      <div class="mk-p-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s> <span class="mk-off inline">${t('save_pct', off(p))}</span>` : ''}</div>
      <div class="mk-trust">${badge()}<span>${t('trust', p.merchant_name)}</span></div>
      ${p.coupon ? html`<div class="mk-coupon"><span class="mk-coupon-ic" aria-hidden="true">🎟️</span><div><small>${t('coupon')}${p.coupon.note ? ' · ' + p.coupon.note : ''}</small><b class="ltr">${p.coupon.code}</b></div><button type="button" class="mk-btn ghost-d" data-coupon="${p.id}">${t('copy')}</button></div>` : ''}
      ${p.description ? html`<p class="mk-p-desc">${p.description}</p>` : ''}
      <div class="mk-buy-bar">
        <a class="mk-btn gold big" href="${p.buy_url}" target="_blank" rel="noopener" data-buy="${p.id}">${t('buyNow')}<small>${t('from', p.merchant_name)}</small></a>
        <button type="button" class="mk-btn ghost-d mk-icon-btn mk-fav-btn ${fav ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${t('save_aria')}">${fav ? '♥' : '♡'}</button>
        <button type="button" class="mk-btn ghost-d mk-icon-btn" data-share="${p.id}" aria-label="${t('share')}">↗</button>
      </div>
      ${d && d.reels.length ? html`<h2>${t('productReels')}</h2><div class="mk-row">${d.reels.map(reelTile)}</div>` : ''}
      ${d && d.more.length ? html`<h2>${t('youMayLike')}</h2><div class="mk-row cards">${d.more.map(card)}</div>` : ''}
    </div>
  </article>`);
  sheet.querySelector('.mk-x').focus({ preventScroll: true });
}
function closeSheet(fromRoute) {
  if (sheet.hidden) return;
  sheet.classList.remove('open');
  document.body.classList.remove('mk-lock');
  setTimeout(() => { if (!sheet.classList.contains('open')) { sheet.hidden = true; sheet.replaceChildren(); } }, 250);
  if (!fromRoute) {
    const p = params();
    p.delete('p');
    history.pushState(null, '', '/stores/' + (p.toString() ? '?' + p : ''));
  }
}

// ---------- الريلز ----------
let io = null;
function stopReels() {
  io?.disconnect();
  io = null;
  document.querySelectorAll('.mk-reel video').forEach((v) => v.pause());
}
async function showReels(startId, sort) {
  render(view, html`<div class="mk-reels-load">…</div>`);
  const d = await get('/api/public/store/reels' + (sort === 'popular' ? '?sort=popular' : ''));
  const list = d.reels;
  if (!list.length) return render(view, html`<div class="mk-empty big"><div class="mk-empty-art" aria-hidden="true">🎬</div><h1>${t('noReels')}</h1><p>${t('noReelsP')}</p><button type="button" class="mk-btn gold" data-go="home">${t('browse')}</button></div>`);
  render(view, html`<div class="mk-reels-wrap">
    <div class="mk-reel-sort" role="tablist">
      <button type="button" role="tab" data-sort="" aria-selected="${sort !== 'popular'}">${t('newest')}</button>
      <button type="button" role="tab" data-sort="popular" aria-selected="${sort === 'popular'}">${t('popular')} 🔥</button>
    </div>
    <div class="mk-reels" id="reels">${list.map((r) => {
      const lk = liked.has(r.id), sv = savedReels.has(r.id);
      return html`<section class="mk-reel" data-rid="${r.id}">
      <video src="${r.video_url}" poster="${r.poster_url || ''}" playsinline muted loop preload="metadata" aria-label="${r.title}"></video>
      <button type="button" class="mk-sound" data-sound aria-label="${t('sound_on')}">🔇</button>
      <div class="mk-reel-side">
        <button type="button" class="mk-side-btn ${lk ? 'on' : ''}" data-like="${r.id}" aria-pressed="${lk}" aria-label="${t('like')}"><span aria-hidden="true">${lk ? '❤️' : '🤍'}</span><small>${compact(r.likes || 0)}</small></button>
        <button type="button" class="mk-side-btn ${sv ? 'on' : ''}" data-save-reel="${r.id}" aria-pressed="${sv}" aria-label="${t('saveReel')}"><span aria-hidden="true">${sv ? '🔖' : '📑'}</span><small>${t('saved')}</small></button>
        <button type="button" class="mk-side-btn" data-share-reel="${r.id}" aria-label="${t('share')}"><span aria-hidden="true">↗</span><small>${t('share').replace('↗ ', '')}</small></button>
        <span class="mk-side-btn static" aria-label="views"><span aria-hidden="true">👁</span><small>${compact(r.views || 0)}</small></span>
      </div>
      <div class="mk-reel-info">
        <button type="button" class="mk-reel-m" data-merchant="${r.merchant_slug}">${logo({ name: r.merchant_name, logo_url: r.merchant_logo }, 36)}<b>${r.merchant_name}</b>${badge()}</button>
        <p>${r.title}</p>
        ${r.product_id && r.product_title ? html`<div class="mk-reel-p" data-product="${r.product_id}" role="button" tabindex="0">
          ${r.product_image ? html`<img src="${r.product_image}" alt="">` : ''}
          <span><b>${r.product_title}</b><small>${sar(r.product_price)}</small></span>
          <a class="mk-btn gold" href="${r.product_buy_url}" target="_blank" rel="noopener" data-reel-buy="${r.id}" data-buy="${r.product_id}">${t('buyShort')}</a>
        </div>` : ''}
      </div>
    </section>`;
    })}</div></div>`);
  const reelBox = $('#reels');
  let sound = false;
  const seen = new Set();
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target.querySelector('video');
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          v.muted = !sound;
          v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
          const id = Number(e.target.dataset.rid);
          if (!seen.has(id)) { seen.add(id); setTimeout(() => !v.paused && track('reel_view', id), 2000); }
        } else v.pause();
      }
    },
    { root: reelBox, threshold: [0, 0.6, 1] }
  );
  reelBox.querySelectorAll('.mk-reel').forEach((s) => io.observe(s));
  let lastTap = 0;
  reelBox.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sound]');
    const vid = e.target.closest('video');
    // ضغطتين على الفيديو = لايك، وضغطة وحدة = الصوت
    if (vid && Date.now() - lastTap < 300) {
      const id = Number(vid.closest('.mk-reel').dataset.rid);
      if (!liked.has(id)) toggleLike(id, vid.closest('.mk-reel').querySelector('[data-like]'));
      heartBurst(vid.closest('.mk-reel'));
      lastTap = 0;
      return;
    }
    if (vid) lastTap = Date.now();
    if (s || vid) {
      sound = !sound;
      reelBox.querySelectorAll('video').forEach((v) => (v.muted = !sound));
      reelBox.querySelectorAll('[data-sound]').forEach((b) => { b.textContent = sound ? '🔊' : '🔇'; b.setAttribute('aria-label', sound ? t('sound_off') : t('sound_on')); });
    }
  });
  if (startId) reelBox.querySelector(`[data-rid="${startId}"]`)?.scrollIntoView({ block: 'start' });
}
function heartBurst(section) {
  const h = document.createElement('span');
  h.className = 'mk-burst';
  h.textContent = '❤️';
  section.append(h);
  setTimeout(() => h.remove(), 800);
}
function toggleLike(id, btn) {
  const on = !liked.has(id);
  on ? liked.add(id) : liked.delete(id);
  keep('asalah_liked', [...liked]);
  track(on ? 'like' : 'unlike', id);
  if (btn) {
    const n = btn.querySelector('small');
    const cur = Number(String(n.textContent).replace(/k$/, '')) || 0;
    if (!/k$/.test(n.textContent)) n.textContent = String(Math.max(0, cur + (on ? 1 : -1)));
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('span').textContent = on ? '❤️' : '🤍';
  }
}

// ---------- المساعد ----------
function showChat() {
  render(view, html`<section class="mk-chat">
    <div class="mk-chat-log" id="chat-log" aria-live="polite"></div>
    <div class="mk-chat-sug" id="chat-sug">${t('suggest').map((s) => html`<button type="button" class="mk-chip" data-ask="${s}">${s}</button>`)}</div>
    <form class="mk-chat-form" id="chat-form"><input name="q" autocomplete="off" maxlength="500" placeholder="${t('chatPh')}" aria-label="${t('chatPh')}"><button type="submit" class="mk-btn gold" aria-label="${t('send')}">${lang === 'en' ? '➤' : '➤'}</button></form>
  </section>`);
  drawChat();
  setTimeout(() => $('#chat-form')?.q.focus({ preventScroll: true }), 50);
}
function drawChat(typing) {
  const el = $('#chat-log');
  if (!el) return;
  const hello = { role: 'assistant', content: t('hello') };
  render(el, html`${[hello, ...chatLog].map((m) => html`<div class="mk-msg ${m.role === 'user' ? 'me' : 'bot'}">${m.content}${m.products?.length ? html`<div class="mk-row cards">${m.products.map(card)}</div>` : ''}</div>`)}${typing ? raw('<div class="mk-msg bot typing"><i></i><i></i><i></i></div>') : ''}`);
  el.scrollTop = el.scrollHeight;
  $('#chat-sug').hidden = chatLog.length > 0;
}
let asking = false;
async function ask(text) {
  text = String(text || '').trim();
  if (!text || asking) return;
  if (params().get('v') !== 'chat') go('v=chat');
  asking = true;
  chatLog.push({ role: 'user', content: text });
  drawChat(true);
  let reply, products = [];
  try {
    if (D?.ai !== false) {
      const r = await fetch('/api/public/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, messages: chatLog.map(({ role, content }) => ({ role, content })) }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { reply = d.reply; products = d.products; }
      else if (r.status !== 503) reply = d.message;
    }
    if (reply == null) {
      // بدون ذكاء اصطناعي: بحث بالكلمات في المنتجات
      const stop = new Set(t('stop'));
      const words = text.replace(/[؟?!.،,]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.has(w.toLowerCase()));
      for (const w of words.length ? words : [text]) {
        products = (await get('/api/public/store/products?q=' + encodeURIComponent(w))).products;
        if (products.length) break;
      }
      products = products.slice(0, 6);
      reply = products.length ? t('found') : t('notFound');
    }
  } catch {
    reply = t('offline');
  }
  products.forEach((p) => cache.set(p.id, p));
  chatLog.push({ role: 'assistant', content: reply, products });
  saveChat();
  asking = false;
  drawChat();
}

// ---------- المشاركة والنسخ ----------
async function shareLink(title, text, link) {
  if (navigator.share) return navigator.share({ title, text, url: link }).catch(() => {});
  await navigator.clipboard?.writeText(text + '\n' + link).catch(() => {});
  toast(t('shared'));
}

// ---------- الأحداث ----------
document.addEventListener('click', async (e) => {
  const el = e.target;
  const buy = el.closest('[data-buy]');
  if (buy) {
    track('click', Number(buy.dataset.buy));
    if (buy.dataset.reelBuy) track('reel_click', Number(buy.dataset.reelBuy));
    return; // الرابط يفتح متجر التاجر
  }
  if (el.closest('#lang')) {
    lang = lang === 'en' ? 'ar' : 'en';
    keep('asalah_lang', lang);
    applyLang();
    return route();
  }
  const fv = el.closest('[data-fav]');
  if (fv) {
    e.stopPropagation();
    const id = Number(fv.dataset.fav);
    favs.has(id) ? favs.delete(id) : favs.add(id);
    keep('asalah_favs', [...favs]);
    const on = favs.has(id);
    document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => {
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '♥' : '♡';
    });
    return;
  }
  const lk = el.closest('[data-like]');
  if (lk) return toggleLike(Number(lk.dataset.like), lk);
  const sr = el.closest('[data-save-reel]');
  if (sr) {
    const id = Number(sr.dataset.saveReel);
    savedReels.has(id) ? savedReels.delete(id) : savedReels.add(id);
    keep('asalah_saved_reels', [...savedReels]);
    const on = savedReels.has(id);
    sr.classList.toggle('on', on);
    sr.setAttribute('aria-pressed', String(on));
    sr.querySelector('span').textContent = on ? '🔖' : '📑';
    return;
  }
  const shr = el.closest('[data-share-reel]');
  if (shr) {
    const sec = shr.closest('.mk-reel');
    return shareLink(sec.querySelector('p').textContent, sec.querySelector('p').textContent + ' 🎬', location.origin + '/stores/?v=reels&r=' + shr.dataset.shareReel);
  }
  const srt = el.closest('[data-sort]');
  if (srt) return go('v=reels' + (srt.dataset.sort ? '&sort=' + srt.dataset.sort : ''), true);
  const g = el.closest('[data-go]');
  if (g) { e.preventDefault(); closeSheet(true); return go(g.dataset.go === 'home' ? '' : 'v=' + g.dataset.go); }
  if (el.closest('[data-close]')) return closeSheet();
  const cp = el.closest('[data-coupon]');
  if (cp) {
    const p = cache.get(Number(cp.dataset.coupon));
    await navigator.clipboard?.writeText(p.coupon.code).catch(() => {});
    track('coupon', p.id);
    return toast(t('copied'));
  }
  const pr = el.closest('[data-product]');
  if (pr) return openProduct(Number(pr.dataset.product));
  const mr = el.closest('[data-merchant]');
  if (mr) { closeSheet(true); return go('m=' + encodeURIComponent(mr.dataset.merchant)); }
  const rl = el.closest('[data-reel]');
  if (rl) { closeSheet(true); return go('v=reels&r=' + rl.dataset.reel); }
  const c = el.closest('[data-cat]');
  if (c) return go(c.dataset.cat ? 'cat=' + encodeURIComponent(c.dataset.cat) : '', true);
  const a = el.closest('[data-ask]');
  if (a) return ask(a.dataset.ask);
  const sh = el.closest('[data-share]');
  if (sh) {
    const p = cache.get(Number(sh.dataset.share));
    shareLink(p.title, t('shareText', p.title, p.merchant_name), location.origin + '/stores/?p=' + p.id);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-product][role=button]')) { e.preventDefault(); openProduct(Number(e.target.dataset.product)); }
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'search') {
    const q = e.target.q.value.trim();
    if (q) go('q=' + encodeURIComponent(q));
  }
  if (e.target.id === 'chat-form') {
    const q = e.target.q.value;
    e.target.q.value = '';
    ask(q);
  }
});

applyLang();
route();

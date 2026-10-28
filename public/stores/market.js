// متاجر أصالة: منتجات التجار الحقيقية، الريلز، المفضلة، ومساعد التسوق. الشراء يكمل في متجر التاجر (سلة).
// الواجهة بالعربي والإنجليزي، ومحتوى المنتجات يبقى مثل ما كتبه التاجر.
import { html, raw, render } from '/assets/common.js';
import { bindClip } from '/stores/clip.js';

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
    postsT: 'المنشورات', askThis: 'اسأل المساعد عن هذا المنتج', askAbout2: (p, m) => `عندي سؤال عن «${p}» من ${m}`, fabT: 'محتار؟ اسألني',
    comments: 'التعليقات', loginToComment: 'سجّل دخولك بحساب Google عشان تقيّم وتعلّق. نعرض اسمك بس، وما ننشر إيميلك.', googleBtn: 'الدخول بحساب Google', asName: (n) => `باسم ${n}`, reviews: 'التقييمات والتعليقات', reviewsN: (n) => `${n} تعليق`, rateFirst: 'كن أول من يقيّم ⭐', loginOk: 'سجّلت دخولك ✅', loginFail: 'ما تم الدخول، حاول مرة ثانية', shareShort: 'شارك', ratingsN: (n) => `${n} تقييم`, noComments: 'ما فيه تعليقات للحين. كن أول واحد 👋', rateIt: 'قيّم', yourName: 'اسمك', addComment: 'اكتب تعليقك…', needComment: 'اكتب تعليق أو اختر النجوم', thanksComment: 'شكراً على رأيك 🌟', ago: (n, u) => `قبل ${n} ${{ m: 'د', h: 'س', d: 'يوم' }[u]}`,
    sound_on: 'تشغيل الصوت', sound_off: 'كتم الصوت', like: 'أعجبني', saveReel: 'حفظ الريل',
    savedTitle: 'المفضلة', savedEmpty: 'ما حفظت شي للحين', savedEmptyP: 'اضغط ♡ على أي منتج أو ريل وتلقاه هنا.', savedProducts: 'منتجات', savedReels: 'ريلز',
    hello: 'هلا 👋 أنا مساعد متاجر أصالة. قول لي وش تبي (نوع المنتج، المناسبة، الميزانية) وأطلع لك الأصلي من المتاجر الموثّقة.',
    suggest: ['عطر فخم للمناسبات', 'هدية أقل من 200', 'قهوة مختصة', 'وش الجديد؟'], chatPh: 'قول لي وش تدوّر عليه…', send: 'إرسال',
    found: 'هذي اللي لقيتها لك 👇', notFound: 'ما لقيت شي يطابق طلبك. جرّب تكتب نوع المنتج، مثل: عطر أو قهوة أو تمر.', offline: 'تعذر الاتصال، حاول مرة ثانية.',
    err: 'صار خطأ', back: 'رجوع للرئيسية', loadErr: 'تعذر التحميل، حاول مرة ثانية', unavailable: 'المتجر غير متاح', close: 'إغلاق', reelOf: 'ريل', productsN: (n) => `${n} منتج`,
    browseTab: 'تصفّح', storiesH: 'حالات المتاجر', storiesP: 'جديد كل متجر', discover: 'اكتشف', discoverP: 'اسحب للأعلى منتج منتج، ويتعلم ذوقك', budgetH: 'عندي', budgetN: (n) => `${n} منتج بهالمبلغ أو أقل`, budgetNone: 'ما فيه شي بهالمبلغ. زِد الميزانية شوي.',
    allProducts: 'كل المنتجات', allN: (n, m) => `${n} منتج من ${m} متجر`, favs: 'المفضلة', sortNew: 'الأحدث', sortCheap: 'الأرخص', sortPopular: 'الأكثر طلباً', sortDiscount: 'أكبر خصم', sortLabel: 'الترتيب', favEmpty: 'اضغط القلب على أي منتج ليظهر هنا.',
    seeProduct: 'التفاصيل', newBadge: 'جديد', becauseCat: (c) => `لأنك تحب ${c}`, discoverHint: 'اسحب للأعلى للمنتج التالي، واضغط مرتين للإعجاب', prev: 'السابق', next: 'التالي',
    fam: 'سلة العائلة', famP: 'سوّ سلة وشاركها في قروب العائلة. كل واحد يضيف اللي يبيه باسمه، وتشترون من متجر كل تاجر.', famOpen: 'افتح سلة العائلة', famNew: 'سوّ سلة العائلة', famName: 'اسم السلة', famNamePh: 'مثال: مقاضي رمضان', famWho: 'اسمك', famWhoPh: 'عشان يعرفون مين أضاف',
    famAdd: '👨‍👩‍👧 أضف لسلة العائلة', famAdded: 'أضفناه لسلة العائلة ✅', famShare: 'شارك في واتساب', famCopy: 'انسخ الرابط', famEmpty: 'السلة فاضية. تصفّح وأضف من صفحة أي منتج.', famBy: (w) => `أضافه ${w}`,
    famBought: 'اشتريته', famUndo: 'رجّعه', famDel: 'حذف', famStore: (m) => `من متجر ${m}`, famBuyAll: (m) => `اشتر من ${m} ↗`, famInvite: (t, l) => `سويت «${t}» في متاجر أصالة 🛍️\nأضف اللي تبيه باسمك:\n${l}`, famDone: 'المشترى', famLeave: 'سلة ثانية', famNeedWho: 'اكتب اسمك أول',
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
    postsT: 'Posts', askThis: 'Ask the assistant about this product', askAbout2: (p, m) => `I have a question about “${p}” from ${m}`, fabT: 'Not sure? Ask me',
    comments: 'Comments', loginToComment: 'Sign in with Google to rate and comment. We only show your name, never your email.', googleBtn: 'Sign in with Google', asName: (n) => `as ${n}`, reviews: 'Ratings & comments', reviewsN: (n) => `${n} comments`, rateFirst: 'Be the first to rate ⭐', loginOk: 'Signed in ✅', loginFail: 'Sign-in failed, please try again', shareShort: 'Share', ratingsN: (n) => `${n} ratings`, noComments: 'No comments yet. Be the first 👋', rateIt: 'Rate', yourName: 'Your name', addComment: 'Add a comment…', needComment: 'Write a comment or pick stars', thanksComment: 'Thanks for your feedback 🌟', ago: (n, u) => `${n}${u} ago`,
    sound_on: 'Unmute', sound_off: 'Mute', like: 'Like', saveReel: 'Save reel',
    savedTitle: 'Saved', savedEmpty: 'Nothing saved yet', savedEmptyP: 'Tap ♡ on any product or reel to find it here.', savedProducts: 'Products', savedReels: 'Reels',
    hello: 'Hi 👋 I’m the Asalah Stores assistant. Tell me what you need (product type, occasion, budget) and I’ll find genuine options from verified stores.',
    suggest: ['A luxury perfume', 'A gift under 200 SAR', 'Specialty coffee', 'What’s new?'], chatPh: 'Tell me what you’re looking for…', send: 'Send',
    found: 'Here’s what I found 👇', notFound: 'I couldn’t find a match. Try a product type, like perfume, coffee or dates.', offline: 'Connection failed, please try again.',
    err: 'Something went wrong', back: 'Back to home', loadErr: 'Couldn’t load, please try again', unavailable: 'Store unavailable', close: 'Close', reelOf: 'Reel', productsN: (n) => `${n} products`,
    browseTab: 'Browse', storiesH: 'Store stories', storiesP: 'What’s new in each store', discover: 'Discover', discoverP: 'Swipe up product by product, it learns your taste', budgetH: 'I have', budgetN: (n) => `${n} products at this price or less`, budgetNone: 'Nothing at this price. Raise the budget a little.',
    allProducts: 'All products', allN: (n, m) => `${n} products from ${m} stores`, favs: 'Saved', sortNew: 'Newest', sortCheap: 'Cheapest', sortPopular: 'Most wanted', sortDiscount: 'Biggest discount', sortLabel: 'Sort', favEmpty: 'Tap the heart on any product to see it here.',
    seeProduct: 'Details', newBadge: 'New', becauseCat: (c) => `Because you like ${c}`, discoverHint: 'Swipe up for the next product, double-tap to like', prev: 'Previous', next: 'Next',
    fam: 'Family basket', famP: 'Make a basket and share it in the family group. Everyone adds what they want under their name, and you buy from each brand’s store.', famOpen: 'Open family basket', famNew: 'Create family basket', famName: 'Basket name', famNamePh: 'e.g. Weekly groceries', famWho: 'Your name', famWhoPh: 'So everyone knows who added it',
    famAdd: '👨‍👩‍👧 Add to family basket', famAdded: 'Added to the family basket ✅', famShare: 'Share on WhatsApp', famCopy: 'Copy link', famEmpty: 'The basket is empty. Browse and add from any product page.', famBy: (w) => `Added by ${w}`,
    famBought: 'Bought', famUndo: 'Undo', famDel: 'Remove', famStore: (m) => `From ${m}`, famBuyAll: (m) => `Buy from ${m} ↗`, famInvite: (t, l) => `I made “${t}” on Asalah Stores 🛍️\nAdd what you want under your name:\n${l}`, famDone: 'Bought', famLeave: 'Another basket', famNeedWho: 'Type your name first',
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
  for (const [k, ic] of [['home', '🏠'], ['browse', '🧭'], ['reels', '🎬'], ['saved', '♡'], ['chat', '✨']]) {
    const b = $(`.mk-tabs [data-go="${k}"]`);
    if (b) b.innerHTML = `<span aria-hidden="true">${ic}</span>${t(k === 'browse' ? 'browseTab' : k)}`;
  }
  $('.mk-to-asalah b').textContent = t('asalah');
  $('.mk-to-asalah').setAttribute('aria-label', lang === 'en' ? 'Asalah main site' : 'موقع أصالة الرئيسي');
  $('.mk-home-link').innerHTML = `<span aria-hidden="true">🛡️</span>${t('asalah')}`;
  $('#lang').textContent = t('langBtn');
  $('#ai-fab').setAttribute('aria-label', t('chat'));
  $('#ai-fab small').textContent = t('fabT');
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
  closeFull();
  clearInterval(famTimer);
  const tab = p.get('v') || (p.get('m') ? 'merchant' : p.get('q') ? 'search' : 'home');
  const navTab = tab === 'merchant' || tab === 'search' ? 'home' : tab === 'family' ? 'browse' : tab;
  document.querySelectorAll('.mk-tabs [data-go]').forEach((b) => (b.dataset.go === navTab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  document.body.dataset.view = tab;
  try {
    if (tab === 'reels') await showReels(Number(p.get('r')) || null, p.get('sort'));
    else if (tab === 'chat') showChat();
    else if (tab === 'browse') await showBrowse();
    else if (tab === 'family') await showFamily(p.get('f'));
    else if (tab === 'saved') await showSaved();
    else if (tab === 'merchant') await showMerchant(p.get('m'));
    else if (tab === 'search') await showSearch(p.get('q'), p.get('cat'));
    else await showHome(p.get('cat'));
  } catch (e) {
    render(view, html`<div class="mk-empty"><b>${t('err')}</b><p>${e.message}</p><button class="mk-btn" type="button" data-go="home">${t('back')}</button></div>`);
  }
  if (p.get('p')) openProduct(Number(p.get('p')), true);
  else closeSheet(true);
  // راجع من الدخول بحساب Google: نفتح التعليقات اللي كان فيها
  if (p.get('login') || p.get('cm')) {
    if (p.get('login')) toast(p.get('login') === 'ok' ? t('loginOk') : t('loginFail'));
    const [kind, cid] = String(p.get('cm') || '').split(':');
    p.delete('login');
    p.delete('cm');
    history.replaceState(null, '', '/stores/' + (p.toString() ? '?' + p : ''));
    if ((kind === 'reels' || kind === 'products') && Number(cid)) openComments(Number(cid), kind);
  }
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
      ${p.rating ? html`<span class="mk-card-r">★ ${p.rating.avg} <small>(${p.rating.n})</small></span>` : ''}
    </div>
  </article>`;
}
const grid = (list) => html`<div class="mk-grid">${list.map(card)}</div>`;
function reelTile(r, i = 0) {
  return html`<button type="button" class="mk-reel-tile" data-reel="${r.id}" aria-label="${t('reelOf')}: ${r.title}" style="--i:${i}">
    ${r.poster_url || r.product_image ? html`<img src="${r.poster_url || r.product_image}" alt="" loading="lazy">` : ''}
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
      <button type="button" class="mk-rate-line" data-comments="${p.id}" data-kind="products">${p.rating ? html`<span class="mk-stars">${stars(p.rating.avg)}<b>${p.rating.avg}</b><small>(${p.rating.n})</small></span>` : html`<span class="mk-muted">${t('rateFirst')}</span>`}<span class="mk-link">${t('reviews')} ›</span></button>
      <div class="mk-trust">${badge()}<span>${t('trust', p.merchant_name)}</span></div>
      ${p.coupon ? html`<div class="mk-coupon"><span class="mk-coupon-ic" aria-hidden="true">🎟️</span><div><small>${t('coupon')}${p.coupon.note ? ' · ' + p.coupon.note : ''}</small><b class="ltr">${p.coupon.code}</b></div><button type="button" class="mk-btn ghost-d" data-coupon="${p.id}">${t('copy')}</button></div>` : ''}
      ${p.description ? html`<p class="mk-p-desc">${p.description}</p>` : ''}
      <div class="mk-buy-bar">
        <a class="mk-btn gold big" href="${p.buy_url}" target="_blank" rel="noopener" data-buy="${p.id}">${t('buyNow')}<small>${t('from', p.merchant_name)}</small></a>
        <button type="button" class="mk-btn ghost-d mk-icon-btn mk-fav-btn ${fav ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${t('save_aria')}">${fav ? '♥' : '♡'}</button>
        <button type="button" class="mk-btn ghost-d mk-icon-btn" data-share="${p.id}" aria-label="${t('share')}">↗</button>
      </div>
      <button type="button" class="mk-btn ghost-d mk-fam-add" data-fam-add="${p.id}">${t('famAdd')}</button>
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
// أيقونات الريلز (SVG عشان تطلع حادة وبنفس الشكل في كل الجوالات)
const IC = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.6 1.4 4.9 3.6 6.5L5 21.5l4.2-2.2c.9.2 1.8.3 2.8.3 5.5 0 10-3.8 10-8.5S17.5 3 12 3Z"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h12a1.2 1.2 0 0 1 1.2 1.2v17.2L12 16.8l-7.2 4.4V4A1.2 1.2 0 0 1 6 2.8Z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 4.5v4C6.8 9.3 3.5 13.6 3 20c2.2-3.3 5.4-4.8 10.5-4.9v4.4L21 12l-7.5-7.5Z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8a1 1 0 0 0 0-1.6l-10-6.8C8.9 3.9 8 4.4 8 5.2Z"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3.5L12 5v14l-4.5-4H4V9Z"/><path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3.5L12 5v14l-4.5-4H4V9Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z"/></svg>',
};
const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const stars = (avg) => raw([1, 2, 3, 4, 5].map((i) => `<i class="${avg >= i - 0.25 ? 'on' : ''}">${IC.star}</i>`).join(''));

let sound = false;
async function showReels(startId, sort) {
  render(view, html`<div class="mk-reels-load">…</div>`);
  const d = await get('/api/public/store/reels' + (sort === 'popular' ? '?sort=popular' : ''));
  const list = d.reels;
  if (!list.length) return render(view, html`<div class="mk-empty big"><div class="mk-empty-art" aria-hidden="true">🎬</div><h1>${t('noReels')}</h1><p>${t('noReelsP')}</p><button type="button" class="mk-btn gold" data-go="home">${t('browse')}</button></div>`);
  render(view, html`<div class="mk-reels-wrap">
    <div class="mk-reel-top">
      <div class="mk-reel-sort" role="tablist">
        <button type="button" role="tab" data-sort="" aria-selected="${sort !== 'popular'}">${t('newest')}</button>
        <button type="button" role="tab" data-sort="popular" aria-selected="${sort === 'popular'}">${t('popular')}</button>
      </div>
      <button type="button" class="mk-sound" data-sound aria-label="${sound ? t('sound_off') : t('sound_on')}">${raw(sound ? IC.sound : IC.muted)}</button>
    </div>
    <div class="mk-reels" id="reels">${list.map((r) => {
      const lk = liked.has(r.id), sv = savedReels.has(r.id);
      return html`<section class="mk-reel" data-rid="${r.id}">
      <div class="mk-reel-stage" data-stage>
        ${r.clip
          ? html`<div class="mk-clip"><video data-clip="${r.id}" src="${r.video_url}#t=${r.clip.start}" poster="${r.poster_url || ''}" playsinline muted preload="metadata" aria-label="${r.title}"></video></div>`
          : html`<video src="${r.video_url}" poster="${r.poster_url || ''}" playsinline muted loop preload="metadata" aria-label="${r.title}"></video>`}
        <span class="mk-paused" aria-hidden="true">${raw(IC.play)}</span>
      </div>
      <div class="mk-reel-progress" aria-hidden="true"><i></i></div>
      <div class="mk-reel-side">
        <button type="button" class="mk-side-av" data-merchant="${r.merchant_slug}" aria-label="${r.merchant_name}">${logo({ name: r.merchant_name, logo_url: r.merchant_logo }, 48)}<span aria-hidden="true">✓</span></button>
        <button type="button" class="mk-side-btn like ${lk ? 'on' : ''}" data-like="${r.id}" aria-pressed="${lk}" aria-label="${t('like')}">${raw(IC.heart)}<small>${compact(r.likes || 0)}</small></button>
        <button type="button" class="mk-side-btn" data-comments="${r.id}" aria-label="${t('comments')}">${raw(IC.chat)}<small data-ccount>${compact(r.comments || 0)}</small></button>
        <button type="button" class="mk-side-btn save ${sv ? 'on' : ''}" data-save-reel="${r.id}" aria-pressed="${sv}" aria-label="${t('saveReel')}">${raw(IC.save)}<small>${t('saved')}</small></button>
        <button type="button" class="mk-side-btn" data-share-reel="${r.id}" aria-label="${t('share')}">${raw(IC.share)}<small>${t('shareShort')}</small></button>
        ${r.product_id && r.product_image ? html`<button type="button" class="mk-disc" data-product="${r.product_id}" aria-label="${r.product_title}"><img src="${r.product_image}" alt=""></button>` : ''}
      </div>
      <div class="mk-reel-info">
        <button type="button" class="mk-reel-m" data-merchant="${r.merchant_slug}"><b>@${r.merchant_name}</b>${badge()}</button>
        <p>${r.title}</p>
        <div class="mk-reel-meta">${r.rating ? html`<button type="button" class="mk-stars" data-comments="${r.id}">${stars(r.rating.avg)}<b>${r.rating.avg}</b><small>(${r.rating.n})</small></button>` : ''}<span>${raw('&#9654;')} ${compact(r.views || 0)}</span></div>
        ${r.product_id && r.product_title ? html`<div class="mk-reel-p" data-product="${r.product_id}" role="button" tabindex="0">
          ${r.product_image ? html`<img src="${r.product_image}" alt="">` : ''}
          <span><b>${r.product_title}</b><small>${sar(r.product_price)}</small></span>
          <a class="mk-btn gold" href="${r.product_buy_url}" target="_blank" rel="noopener" data-reel-buy="${r.id}" data-buy="${r.product_id}">${t('buyShort')}</a>
        </div>` : ''}
      </div>
    </section>`;
    })}</div></div>`);
  const reelBox = $('#reels');
  for (const sec of reelBox.querySelectorAll('.mk-reel')) {
    const r = list.find((x) => x.id === Number(sec.dataset.rid));
    cacheReel.set(r.id, r);
    const v = sec.querySelector('video');
    if (r.clip) bindClip(v, r.clip, r.duration);
    // شريط التقدم تحت الفيديو
    const bar = sec.querySelector('.mk-reel-progress i');
    v.addEventListener('timeupdate', () => {
      const start = r.clip?.start || 0, dur = r.clip ? r.duration : v.duration || r.duration;
      bar.style.width = Math.max(0, Math.min(100, ((v.currentTime - start) / dur) * 100)) + '%';
    });
    v.addEventListener('pause', () => sec.classList.toggle('paused', !sec.dataset.auto));
    v.addEventListener('play', () => sec.classList.remove('paused'));
  }
  const seen = new Set();
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target.querySelector('video');
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          delete e.target.dataset.auto;
          v.muted = !sound;
          v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
          const id = Number(e.target.dataset.rid);
          if (!seen.has(id)) { seen.add(id); setTimeout(() => !v.paused && track('reel_view', id), 2000); }
        } else { e.target.dataset.auto = '1'; v.pause(); }
      }
    },
    { root: reelBox, threshold: [0, 0.6, 1] }
  );
  reelBox.querySelectorAll('.mk-reel').forEach((s) => io.observe(s));
  // ضغطة وحدة: توقف أو تشغّل (وأول مرة تشغّل الصوت). ضغطتين: لايك
  let tapT = 0, lastTap = 0;
  reelBox.addEventListener('click', (e) => {
    const stage = e.target.closest('[data-stage]');
    if (!stage) return;
    const sec = stage.closest('.mk-reel'), v = sec.querySelector('video');
    if (Date.now() - lastTap < 300) {
      clearTimeout(tapT);
      lastTap = 0;
      const id = Number(sec.dataset.rid);
      if (!liked.has(id)) toggleLike(id, sec.querySelector('[data-like]'));
      return heartBurst(sec);
    }
    lastTap = Date.now();
    tapT = setTimeout(() => {
      if (!sound) return setSound(true);
      if (v.paused) v.play().catch(() => {}); else v.pause();
    }, 280);
  });
  if (startId) reelBox.querySelector(`[data-rid="${startId}"]`)?.scrollIntoView({ block: 'start' });
}
const cacheReel = new Map();
function setSound(on) {
  sound = on;
  document.querySelectorAll('.mk-reel video').forEach((v) => (v.muted = !sound));
  document.querySelectorAll('[data-sound]').forEach((b) => { b.innerHTML = sound ? IC.sound : IC.muted; b.setAttribute('aria-label', sound ? t('sound_off') : t('sound_on')); });
}

// ---------- تعليقات وتقييم الريل ----------
async function openComments(id, kind = 'reels') {
  closeComments();
  const box = Object.assign(document.createElement('div'), { className: 'mk-cm', id: 'cm' });
  box.innerHTML = '<div class="mk-cm-bg" data-cm-close></div><section class="mk-cm-in" role="dialog" aria-modal="true"><div class="mk-cm-load">…</div></section>';
  document.body.append(box);
  requestAnimationFrame(() => box.classList.add('open'));
  let d;
  try { d = await get(`/api/public/store/${kind}/${id}/comments`); } catch (e) { closeComments(); return toast(e.message); }
  let pick = 0;
  const draw = () => {
    render(box.querySelector('.mk-cm-in'), html`
      <header class="mk-cm-h"><div><b>${t('comments')} ${d.count ? `(${d.count})` : ''}</b>${d.rating ? html`<span class="mk-stars">${stars(d.rating.avg)}<b>${d.rating.avg}</b><small>${t('ratingsN', d.rating.n)}</small></span>` : ''}</div>
        <button type="button" class="mk-round dark" data-cm-close aria-label="${t('close')}">×</button></header>
      <div class="mk-cm-list">${d.comments.length ? d.comments.map((c) => html`<div class="mk-cm-c"><span class="mk-cm-av" aria-hidden="true">${(c.name || '?').trim()[0]}</span><div>
          <div class="mk-cm-n"><b>${c.name}</b>${c.rating ? html`<span class="mk-stars sm">${stars(c.rating)}</span>` : ''}<small>${ago(c.created_at)}</small></div>
          ${c.body ? html`<p>${c.body}</p>` : ''}</div></div>`) : html`<div class="mk-empty small">${t('noComments')}</div>`}</div>
      ${d.login && !d.me
        ? html`<div class="mk-cm-f mk-cm-login"><p>${t('loginToComment')}</p><a class="mk-google" href="/api/c/google/start?next=${encodeURIComponent(location.pathname + (location.search || '?') + (location.search ? '&' : '') + 'cm=' + kind + ':' + id)}">${raw(GOOGLE)}<span>${t('googleBtn')}</span></a></div>`
        : html`<form class="mk-cm-f" id="cm-form">
        <div class="mk-cm-rate" role="radiogroup" aria-label="${t('rateIt')}"><span>${t('rateIt')}</span>${[1, 2, 3, 4, 5].map((i) => html`<button type="button" class="${pick >= i ? 'on' : ''}" data-rate="${i}" role="radio" aria-checked="${pick === i}" aria-label="${i}">${raw(IC.star)}</button>`)}
          ${d.me ? html`<span class="mk-cm-me">${d.me.picture ? html`<img src="${d.me.picture}" alt="" referrerpolicy="no-referrer">` : ''}${t('asName', d.me.name)}</span>` : ''}</div>
        <div class="mk-cm-row ${d.me ? 'me' : ''}">${d.me ? '' : html`<input name="name" maxlength="30" required placeholder="${t('yourName')}" value="${load('asalah_name', '')}" aria-label="${t('yourName')}">`}
        <input name="body" maxlength="300" placeholder="${t('addComment')}" aria-label="${t('addComment')}" autocomplete="off"><button type="submit" class="mk-btn gold" aria-label="${t('send')}">➤</button></div>
      </form>`}`);
  };
  draw();
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-cm-close]')) return closeComments();
    const r = e.target.closest('[data-rate]');
    if (r) {
      pick = Number(r.dataset.rate);
      box.querySelectorAll('[data-rate]').forEach((b) => { const on = Number(b.dataset.rate) <= pick; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(Number(b.dataset.rate) === pick)); });
    }
  });
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.target;
    const name = d.me ? d.me.name : f.name.value.trim(), body = f.body.value.trim();
    if (!name) return f.name.focus();
    if (!body && !pick) return toast(t('needComment'));
    keep('asalah_name', name);
    f.querySelector('[type=submit]').disabled = true;
    try {
      const r = await fetch(`/api/public/store/${kind}/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, body: body || null, rating: pick || null, device: deviceId() }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(lang === 'en' ? t('err') : x.message || t('err'));
      d = await get(`/api/public/store/${kind}/${id}/comments`);
      pick = 0;
      draw();
      document.querySelectorAll(kind === 'reels' ? `.mk-reel[data-rid="${id}"] [data-ccount]` : `[data-pcount="${id}"]`).forEach((cc) => (cc.textContent = compact(d.count)));
      toast(t('thanksComment'));
    } catch (err) {
      toast(err.message);
      f.querySelector('[type=submit]').disabled = false;
    }
  });
}
function deviceId() {
  let d = load('asalah_dev', '');
  if (!/^[a-z0-9]{16,40}$/.test(d)) { d = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join(''); keep('asalah_dev', d); }
  return d;
}
function closeComments() {
  const b = $('#cm');
  if (!b) return;
  b.classList.remove('open');
  setTimeout(() => b.remove(), 220);
}
function ago(ts) {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts));
  const [n, u] = s < 3600 ? [Math.max(1, Math.floor(s / 60)), 'm'] : s < 86400 ? [Math.floor(s / 3600), 'h'] : [Math.floor(s / 86400), 'd'];
  return t('ago', n, u);
}
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-comments]');
  if (c) return openComments(Number(c.dataset.comments), c.dataset.kind || 'reels');
  if (e.target.closest('[data-sound]')) return setSound(!sound);
});
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

// ---------- تصفّح: حالات المتاجر، اكتشف، الميزانية، كل المنتجات ----------
// المنتجات تنجاب مرة وحدة (حتى 200)، والترتيب والتصفية والذوق كلها في الجهاز.
let pool = null, stories = null;
const taste = load('asalah_taste', {});
const seenStories = load('asalah_seen_stories', {});
const B = { cat: 'all', sort: 'new', budget: 0 };
const learn = (p, w) => { taste[p.category] = Math.max(-3, Math.min(10, (taste[p.category] || 0) + w)); keep('asalah_taste', taste); };
const tasteOf = (p) => (taste[p.category] || 0) + (favs.has(p.id) ? 3 : 0);
const catName = (key) => catLabel(D?.categories?.find((c) => c.key === key) || { key, label: key });

async function loadPool() {
  if (!D) D = await get('/api/public/store');
  if (!pool) {
    const [a, b] = await Promise.all([get('/api/public/store/products?limit=200'), get('/api/public/store/stories')]);
    pool = a.products;
    stories = b.stories;
    pool.forEach((p) => cache.set(p.id, p));
  }
}

async function showBrowse() {
  render(view, skeleton());
  await loadPool();
  if (!pool.length) return render(view, emptyStore());
  const prices = pool.map((p) => p.price).filter((x) => x > 0);
  const top = Math.max(50, Math.ceil(Math.max(...prices, 50) / 50) * 50);
  if (!B.budget || B.budget > top) B.budget = Math.min(top, Math.max(50, Math.round(top / 2 / 10) * 10));
  const cats = D.categories.filter((c) => c.count);
  const fam = load('asalah_family', null);
  render(view, html`
    ${stories.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>${t('storiesH')}</h2><span class="mk-muted">${t('storiesP')}</span></div>
      <div class="mk-stories">${stories.map((s, i) => html`<button type="button" class="mk-story" data-story="${i}" aria-label="${s.name}">
        <span class="mk-ring ${seenStories[s.slug] >= s.latest ? 'seen' : ''}">${logo({ name: s.name, logo_url: s.logo_url }, 64)}</span><small>${s.name}</small></button>`)}</div></section>` : ''}
    <div class="mk-browse-cards">
      <button type="button" class="mk-discover" data-discover><span class="mk-disc-ic" aria-hidden="true">▶</span><span><b>${t('discover')}</b><small>${t('discoverP')}</small></span></button>
      <button type="button" class="mk-discover fam" data-go="family"><span class="mk-disc-ic" aria-hidden="true">👨‍👩‍👧</span><span><b>${t('fam')}</b><small>${fam ? fam.title || t('famOpen') : t('famP')}</small></span></button>
    </div>
    <section class="mk-budget">
      <div class="mk-budget-h"><label for="budget">${t('budgetH')}</label><b id="budget-v"></b></div>
      <input type="range" id="budget" min="10" max="${top}" step="10" value="${B.budget}" aria-label="${t('budgetH')}">
      <span class="mk-muted" id="budget-n"></span>
      <div id="budget-list"></div>
    </section>
    <section class="mk-sec">
      <div class="mk-sec-h"><h2>${t('allProducts')}</h2><span class="mk-muted">${t('allN', pool.length, new Set(pool.map((p) => p.merchant_slug)).size)}</span></div>
      <div class="mk-chips" id="b-chips" role="list">
        ${[['all', t('all')], ['fav', '♥ ' + t('favs')], ...cats.map((c) => [c.key, catLabel(c)])].map(([k, l]) => html`<button type="button" role="listitem" class="mk-chip" data-bcat="${k}" aria-pressed="${B.cat === k}">${l}</button>`)}
      </div>
      <div class="mk-sortbar"><label class="mk-muted" for="b-sort">${t('sortLabel')}</label>
        <select id="b-sort">${[['new', t('sortNew')], ['cheap', t('sortCheap')], ['popular', t('sortPopular')], ['discount', t('sortDiscount')]].map(([k, l]) => html`<option value="${k}" ${raw(B.sort === k ? 'selected' : '')}>${l}</option>`)}</select></div>
      <div id="b-grid"></div>
    </section>`);
  const range = $('#budget');
  const drawBudget = () => {
    B.budget = Number(range.value);
    $('#budget-v').textContent = sar(B.budget);
    const list = pool.filter((p) => p.price > 0 && p.price <= B.budget).sort((a, b) => tasteOf(b) - tasteOf(a) || a.price - b.price);
    $('#budget-n').textContent = list.length ? t('budgetN', list.length) : t('budgetNone');
    const by = {};
    list.forEach((p) => (by[p.category] ||= []).push(p));
    render($('#budget-list'), html`${Object.entries(by).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([c, ps]) => html`<div class="mk-sec-h small"><h3>${catName(c)}</h3><span class="mk-muted">${ps.length}</span></div><div class="mk-row cards">${ps.slice(0, 12).map(card)}</div>`)}`);
  };
  range.addEventListener('input', drawBudget);
  drawBudget();
  drawGrid();
  $('#b-sort').addEventListener('change', (e) => { B.sort = e.target.value; drawGrid(); });
}
function drawGrid() {
  const el = $('#b-grid');
  if (!el) return;
  let list = pool.filter((p) => B.cat === 'all' || (B.cat === 'fav' ? favs.has(p.id) : p.category === B.cat));
  const disc = (p) => (p.old_price ? 1 - p.price / p.old_price : 0);
  if (B.sort === 'new') list.sort((a, b) => b.created_at - a.created_at || tasteOf(b) - tasteOf(a));
  if (B.sort === 'cheap') list.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  if (B.sort === 'popular') list.sort((a, b) => tasteOf(b) - tasteOf(a) || b.id - a.id);
  if (B.sort === 'discount') list.sort((a, b) => disc(b) - disc(a));
  document.querySelectorAll('#b-chips [data-bcat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bcat === B.cat)));
  render(el, list.length ? grid(list) : html`<div class="mk-empty small">${B.cat === 'fav' ? t('favEmpty') : t('noCat')}</div>`);
}

// ---------- شاشة كاملة (الحالات واكتشف) ----------
let full = null, fullClose = null;
function openFull(label) {
  closeFull();
  full = Object.assign(document.createElement('div'), { className: 'mk-full' });
  full.setAttribute('role', 'dialog');
  full.setAttribute('aria-modal', 'true');
  full.setAttribute('aria-label', label);
  document.body.append(full);
  document.body.classList.add('mk-lock');
  return full;
}
function closeFull() {
  if (!full) return;
  fullClose?.();
  fullClose = null;
  full.remove();
  full = null;
  if (sheet.hidden) document.body.classList.remove('mk-lock');
}
const pimg = (p) => (p.image_url ? html`<div class="mk-p-blur" style="background-image:url('${p.image_url}')" aria-hidden="true"></div><img src="${p.image_url}" alt="">` : raw('<span class="mk-full-emoji" aria-hidden="true">🛍️</span>'));
const fullActions = (p) => html`<div class="mk-full-acts">
  <a class="mk-btn gold" href="${p.buy_url}" target="_blank" rel="noopener" data-buy="${p.id}">${t('buyNow')}</a>
  <button type="button" class="mk-btn ghost" data-full-product="${p.id}">${t('seeProduct')}</button>
  <button type="button" class="mk-round ${favs.has(p.id) ? 'on' : ''}" data-fav="${p.id}" aria-pressed="${favs.has(p.id)}" aria-label="${t('save_aria')}">${favs.has(p.id) ? '♥' : '♡'}</button></div>`;

function openStories(start) {
  let si = start, ii = 0, timer = 0, t0 = 0, left = 0, paused = false;
  const DUR = 5000;
  const el = openFull(t('storiesH'));
  fullClose = () => clearTimeout(timer);
  const show = () => {
    const s = stories[si], p = s.items[ii];
    seenStories[s.slug] = Math.max(seenStories[s.slug] || 0, s.latest);
    keep('asalah_seen_stories', seenStories);
    render(el, html`<div class="mk-bars">${s.items.map((_, k) => html`<i class="${k < ii ? 'done' : k === ii ? 'cur' : ''}"><b></b></i>`)}</div>
      <div class="mk-full-top"><button type="button" class="mk-reel-m" data-full-merchant="${s.slug}">${logo({ name: s.name, logo_url: s.logo_url }, 36)}<b>${s.name}</b>${badge()}</button><button type="button" class="mk-round" data-full-close aria-label="${t('close')}">×</button></div>
      <div class="mk-full-img">${pimg(p)}</div>
      <button type="button" class="mk-tap prev" data-story-prev aria-label="${t('prev')}"></button><button type="button" class="mk-tap next" data-story-next aria-label="${t('next')}"></button>
      <div class="mk-full-info">${Date.now() / 1000 - p.created_at < 14 * 86400 ? html`<span class="mk-new">${t('newBadge')}</span>` : ''}<b>${p.title}</b><div class="mk-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s>` : ''}</div>${fullActions(p)}</div>`);
    run(DUR);
  };
  const run = (ms) => {
    clearTimeout(timer); t0 = Date.now(); left = ms; paused = false;
    timer = setTimeout(next, ms);
    const b = el.querySelector('.mk-bars .cur b');
    if (b) { b.style.transition = 'none'; b.style.width = ((DUR - ms) / DUR) * 100 + '%'; requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = `width ${ms}ms linear`; b.style.width = '100%'; })); }
  };
  const next = () => { if (ii < stories[si].items.length - 1) ii++; else if (si < stories.length - 1) { si++; ii = 0; } else return closeFull(); show(); };
  const prev = () => { if (ii > 0) ii--; else if (si > 0) { si--; ii = stories[si].items.length - 1; } show(); };
  const pause = () => { if (paused) return; paused = true; clearTimeout(timer); left = Math.max(300, left - (Date.now() - t0)); const b = el.querySelector('.mk-bars .cur b'); if (b) { b.style.width = getComputedStyle(b).width; b.style.transition = 'none'; } };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-story-next]')) next();
    else if (e.target.closest('[data-story-prev]')) prev();
  });
  // ضغطة مطوّلة توقف الحالة
  el.addEventListener('pointerdown', (e) => { if (e.target.closest('.mk-tap')) pause(); });
  el.addEventListener('pointerup', () => { if (paused) run(left); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFull(); });
  show();
}

function openDiscover() {
  const el = openFull(t('discover'));
  const shown = new Set();
  let cur = null, enter = 0;
  const why = (p) => { const top = Object.entries(taste).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1])[0]; return top && top[0] === p.category ? t('becauseCat', catName(p.category)) : ''; };
  const batch = () => {
    let rest = pool.filter((p) => !shown.has(p.id));
    if (rest.length < 4) { shown.clear(); rest = pool.slice(); }
    return rest.map((p) => [p, tasteOf(p) + Math.random() * 2.5]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p);
  };
  render(el, html`<div class="mk-feed" id="feed"></div><div class="mk-full-top over"><b>${t('discover')}</b><button type="button" class="mk-round" data-full-close aria-label="${t('close')}">×</button></div>`);
  const feed = el.querySelector('#feed');
  const io2 = new IntersectionObserver((es) => es.forEach((e) => {
    const p = cache.get(Number(e.target.dataset.id));
    if (e.isIntersecting) {
      cur = p; enter = Date.now();
      if (e.target === feed.lastElementChild || e.target === feed.lastElementChild?.previousElementSibling) append();
    } else if (cur === p) {
      const dwell = Date.now() - enter;
      if (!favs.has(p.id)) learn(p, dwell < 1500 ? -0.5 : dwell > 4000 ? 0.7 : 0);
    }
  }), { root: feed, threshold: 0.6 });
  fullClose = () => io2.disconnect();
  const append = () => batch().forEach((p) => {
    shown.add(p.id);
    const w = why(p);
    const sec = document.createElement('section');
    sec.className = 'mk-slide';
    sec.dataset.id = p.id;
    render(sec, html`<div class="mk-full-img" data-dbl="${p.id}">${pimg(p)}</div>
      <div class="mk-full-info">${w ? html`<span class="mk-new">${w}</span>` : ''}<button type="button" class="mk-card-m light" data-full-merchant="${p.merchant_slug}">${p.merchant_name} ${badge()}</button><b>${p.title}</b><div class="mk-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s>` : ''}</div>${fullActions(p)}</div>`);
    feed.append(sec);
    io2.observe(sec);
  });
  let lastTap = 0;
  feed.addEventListener('click', (e) => {
    const img = e.target.closest('[data-dbl]');
    if (!img) return;
    if (Date.now() - lastTap < 320) {
      const id = Number(img.dataset.dbl);
      if (!favs.has(id)) img.closest('.mk-slide').querySelector('[data-fav]')?.click();
      learn(cache.get(id), 2);
      heartBurst(img.closest('.mk-slide'));
      lastTap = 0;
    } else lastTap = Date.now();
  });
  append();
  if (!taste.__hinted) { taste.__hinted = 1; keep('asalah_taste', taste); toast(t('discoverHint')); }
}

// ---------- سلة العائلة ----------
// نحفظ في الجهاز رمز السلة واسم الشخص، والسلة نفسها على السيرفر عشان الكل يشوفها
let famTimer = 0;
const famLink = (code) => location.origin + '/stores/?v=family&f=' + code;
async function famApi(path, method = 'GET', body) {
  const r = await fetch('/api/public/store/family' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || t('loadErr'));
  return d;
}
async function showFamily(code) {
  const saved = load('asalah_family', null);
  // جاي من رابط عائلته: نحفظ السلة في جهازه
  if (code && /^[a-f0-9]{12}$/.test(code) && saved?.code !== code) keep('asalah_family', { code, who: saved?.who || '' });
  const fam = load('asalah_family', null);
  if (!fam?.code) return drawFamilyIntro();
  render(view, skeleton());
  let list;
  try { list = (await famApi('/' + fam.code)).list; } catch (e) {
    keep('asalah_family', null);
    toast(e.message);
    return drawFamilyIntro();
  }
  keep('asalah_family', { ...fam, title: list.title });
  if (!code) history.replaceState(null, '', '/stores/?v=family&f=' + fam.code);
  drawFamily(list);
  clearInterval(famTimer);
  famTimer = setInterval(async () => {
    if (params().get('v') !== 'family' || document.hidden || view.querySelector('input:focus')) return;
    try { const l = (await famApi('/' + fam.code)).list; if (l.updated_at !== list.updated_at) { list = l; drawFamily(l); } } catch {}
  }, 15000);
}
function drawFamilyIntro() {
  render(view, html`<section class="mk-fam">
    <div class="mk-empty big"><div class="mk-empty-art" aria-hidden="true">👨‍👩‍👧</div><h1>${t('fam')}</h1><p>${t('famP')}</p></div>
    <form id="fam-new" class="mk-fam-form">
      <label>${t('famName')}<input name="title" maxlength="60" placeholder="${t('famNamePh')}"></label>
      <label>${t('famWho')}<input name="who" required maxlength="30" placeholder="${t('famWhoPh')}" value="${load('asalah_family_who', '')}"></label>
      <button type="submit" class="mk-btn gold big">${t('famNew')}</button>
    </form></section>`);
}
function drawFamily(list) {
  const fam = load('asalah_family', {});
  const open = list.items.filter((x) => !x.bought), done = list.items.filter((x) => x.bought);
  const by = new Map();
  for (const it of open) {
    const k = it.product.merchant_slug;
    if (!by.has(k)) by.set(k, { name: it.product.merchant_name, items: [] });
    by.get(k).items.push(it);
  }
  const total = open.reduce((s, x) => s + (x.product.price || 0) * x.qty, 0);
  const row = (it) => html`<div class="mk-fam-it ${it.bought ? 'done' : ''}">
    <button type="button" class="mk-fam-img" data-product="${it.product.id}">${it.product.image_url ? html`<img src="${it.product.image_url}" alt="">` : raw('<span>🛍️</span>')}</button>
    <div class="mk-fam-b"><b>${it.product.title}</b><small>${t('famBy', it.who)} · ${it.qty} × ${sar(it.product.price)}</small>
      <div class="mk-fam-acts">
        ${it.bought ? '' : html`<a class="mk-btn gold sm" href="${it.product.buy_url}" target="_blank" rel="noopener" data-buy="${it.product.id}">${t('buyShort')} ↗</a>`}
        <button type="button" class="mk-btn ghost-d sm" data-fam-bought="${it.id}" data-on="${it.bought ? 0 : 1}">${it.bought ? t('famUndo') : '✓ ' + t('famBought')}</button>
        <button type="button" class="mk-link" data-fam-del="${it.id}">${t('famDel')}</button>
      </div></div></div>`;
  render(view, html`<section class="mk-fam">
    <div class="mk-fam-head"><div><h1>👨‍👩‍👧 ${list.title}</h1><span class="mk-muted">${open.length ? `${open.length} · ${sar(total)}` : ''}</span></div>
      <div class="mk-fam-share"><a class="mk-btn gold" href="https://wa.me/?text=${encodeURIComponent(t('famInvite', list.title, famLink(list.code)))}" target="_blank" rel="noopener">${t('famShare')}</a><button type="button" class="mk-btn ghost-d" data-fam-copy>${t('famCopy')}</button></div></div>
    <form id="fam-who" class="mk-fam-who"><label>${t('famWho')}<input name="who" maxlength="30" required placeholder="${t('famWhoPh')}" value="${fam.who || ''}"></label></form>
    ${open.length ? [...by.values()].map((g) => html`<div class="mk-fam-g"><div class="mk-sec-h small"><h3>${t('famStore', g.name)}</h3></div>${g.items.map(row)}</div>`) : html`<div class="mk-empty small">${t('famEmpty')} <button type="button" class="mk-link" data-go="browse">${t('browseTab')}</button></div>`}
    ${done.length ? html`<details class="mk-fam-done"><summary>${t('famDone')} (${done.length})</summary>${done.map(row)}</details>` : ''}
    <button type="button" class="mk-link" data-fam-leave>${t('famLeave')}</button>
  </section>`);
  $('#fam-who').addEventListener('input', (e) => { const who = e.target.value.trim(); keep('asalah_family', { ...load('asalah_family', {}), who }); keep('asalah_family_who', who); });
}
async function famAdd(id) {
  let fam = load('asalah_family', null);
  if (!fam?.code || !fam.who) {
    closeSheet(true);
    return go('v=family');
  }
  try {
    await famApi(`/${fam.code}/items`, 'POST', { product_id: id, who: fam.who, qty: 1 });
    toast(t('famAdded'));
  } catch (e) { toast(e.message); }
}

document.addEventListener('click', async (e) => {
  const el = e.target;
  const st = el.closest('[data-story]');
  if (st) return openStories(Number(st.dataset.story));
  if (el.closest('[data-discover]')) return openDiscover();
  if (el.closest('[data-full-close]')) return closeFull();
  const fp = el.closest('[data-full-product]');
  if (fp) { closeFull(); return openProduct(Number(fp.dataset.fullProduct)); }
  const fm = el.closest('[data-full-merchant]');
  if (fm) { closeFull(); return go('m=' + encodeURIComponent(fm.dataset.fullMerchant)); }
  const bc = el.closest('[data-bcat]');
  if (bc) { B.cat = bc.dataset.bcat; return drawGrid(); }
  const fa = el.closest('[data-fam-add]');
  if (fa) return famAdd(Number(fa.dataset.famAdd));
  const fam = load('asalah_family', null);
  const fb = el.closest('[data-fam-bought]');
  if (fb && fam) return drawFamily((await famApi(`/${fam.code}/items/${fb.dataset.famBought}`, 'PATCH', { bought: fb.dataset.on === '1' }).catch((x) => (toast(x.message), {}))).list || (await famApi('/' + fam.code)).list);
  const fd = el.closest('[data-fam-del]');
  if (fd && fam) return drawFamily((await famApi(`/${fam.code}/items/${fd.dataset.famDel}`, 'DELETE').catch((x) => (toast(x.message), {}))).list || (await famApi('/' + fam.code)).list);
  if (el.closest('[data-fam-copy]') && fam) { await navigator.clipboard?.writeText(famLink(fam.code)).catch(() => {}); return toast(t('shared')); }
  if (el.closest('[data-fam-leave]')) { keep('asalah_family', null); return drawFamilyIntro(); }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'fam-who') return;
  if (e.target.id !== 'fam-new') return;
  const f = e.target;
  const who = f.who.value.trim();
  if (!who) return toast(t('famNeedWho'));
  f.querySelector('button').disabled = true;
  try {
    const title = f.title.value.trim() || t('fam');
    const { code } = await famApi('', 'POST', { title });
    keep('asalah_family', { code, who, title });
    keep('asalah_family_who', who);
    go('v=family&f=' + code, true);
  } catch (x) { toast(x.message); f.querySelector('button').disabled = false; }
});

// ---------- منشورات مثل انستقرام: الضغط على صورة المنتج يفتح المنتجات كمنشورات ----------
const PIC = {
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12.2a1 1 0 0 1-1 .8H8a1 1 0 0 1-1-.8L6 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  heartO: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.2-4.4-9.1-8.9C1.5 8.1 3.5 4.8 6.8 4.8c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.3 0 5.3 3.3 3.9 6.6-1.9 4.5-9.1 8.9-9.1 8.9Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-6.5 18-4.5-7-7-4.5L21 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  ask: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.8 3 3 6.6 3 11c0 2.4 1.2 4.6 3.2 6.1L5.5 21l4-2.1c.8.2 1.6.3 2.5.3 5.2 0 9-3.6 9-8.1S17.2 3 12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  fam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4v-17Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
function openPosts(startId, ids) {
  const list = [...new Set([startId, ...ids, ...(pool || []).map((p) => p.id)])].map((id) => cache.get(id)).filter(Boolean);
  const el = openFull(t('postsT'));
  el.classList.add('light');
  const post = (p) => {
    const on = favs.has(p.id);
    return html`<article class="mk-post" data-post="${p.id}">
      <header><button type="button" class="mk-post-m" data-full-merchant="${p.merchant_slug}">${logo({ name: p.merchant_name, logo_url: p.merchant_logo }, 36)}<span><b>${p.merchant_name}</b><small>${t('verified')}</small></span></button>
        <a class="mk-btn gold sm" href="${p.buy_url}" target="_blank" rel="noopener" data-buy="${p.id}">${t('buyShort')} ↗</a></header>
      <div class="mk-post-img" data-dbl-fav="${p.id}">${p.image_url ? html`<div class="mk-p-blur" style="background-image:url('${p.image_url}')" aria-hidden="true"></div><img src="${p.image_url}" alt="${p.title}" loading="lazy">` : raw('<span class="mk-full-emoji" aria-hidden="true">🛍️</span>')}${off(p) ? html`<span class="mk-off">-${off(p)}%</span>` : ''}</div>
      <div class="mk-post-acts">
        <button type="button" class="mk-pa fav ${on ? 'on' : ''}" data-post-fav="${p.id}" aria-pressed="${on}" aria-label="${t('save_aria')}">${raw(on ? IC.heart : PIC.heartO)}</button>
        <button type="button" class="mk-pa" data-comments="${p.id}" data-kind="products" aria-label="${t('comments')}">${raw(PIC.ask)}</button>
        <button type="button" class="mk-pa" data-share="${p.id}" aria-label="${t('share')}">${raw(PIC.send)}</button>
        <button type="button" class="mk-pa end" data-fam-add="${p.id}" aria-label="${t('famAdd')}">${raw(PIC.fam)}</button>
      </div>
      <div class="mk-post-cap">
        <button type="button" class="mk-rate-line" data-comments="${p.id}" data-kind="products">${p.rating ? html`<span class="mk-stars">${stars(p.rating.avg)}<b>${p.rating.avg}</b><small>(${p.rating.n})</small></span>` : html`<span class="mk-muted">${t('rateFirst')}</span>`}${p.comments ? html`<span class="mk-muted">· <span data-pcount="${p.id}">${compact(p.comments)}</span> ${t('comments')}</span>` : ''}</button>
        <div class="mk-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s>` : ''}</div>
        <p><b>${p.merchant_name}</b> ${p.title}</p>
        ${p.description ? html`<p class="mk-post-desc">${p.description}</p>` : ''}
        <button type="button" class="mk-link" data-full-product="${p.id}">${t('seeProduct')} ›</button>
      </div>
    </article>`;
  };
  render(el, html`<div class="mk-posts-top"><button type="button" class="mk-round dark" data-full-close aria-label="${t('close')}">${lang === 'en' ? '←' : '→'}</button><b>${t('postsT')}</b><span></span></div>
    <div class="mk-posts" id="posts">${list.slice(0, 12).map(post)}</div>`);
  const box = el.querySelector('#posts');
  let shown = 12;
  box.addEventListener('scroll', () => {
    if (shown < list.length && box.scrollTop + box.clientHeight > box.scrollHeight - 900) {
      const tmp = document.createElement('div');
      render(tmp, html`${list.slice(shown, shown + 12).map(post)}`);
      box.append(...tmp.children);
      shown += 12;
    }
  });
  let lastTap = 0;
  box.addEventListener('click', (e) => {
    const img = e.target.closest('[data-dbl-fav]');
    if (img) {
      if (Date.now() - lastTap < 320) {
        lastTap = 0;
        const id = Number(img.dataset.dblFav);
        if (!favs.has(id)) setFav(id, true);
        learn(cache.get(id), 2);
        heartBurst(img);
      } else lastTap = Date.now();
      return;
    }
    const f = e.target.closest('[data-post-fav]');
    if (f) return setFav(Number(f.dataset.postFav), !favs.has(Number(f.dataset.postFav)));
    const a = e.target.closest('[data-post-ask]');
    if (a) { const p = cache.get(Number(a.dataset.postAsk)); closeFull(); return ask(t('askAbout2', p.title, p.merchant_name)); }
  });
}
// المفضلة من أي مكان: نحدّث كل الأزرار اللي تخص المنتج
function setFav(id, on) {
  on ? favs.add(id) : favs.delete(id);
  keep('asalah_favs', [...favs]);
  document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '♥' : '♡'; });
  document.querySelectorAll(`[data-post-fav="${id}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? IC.heart : PIC.heartO; });
}

// زر المساعد العائم: لو العميل محتار، يسأل عن المنتج اللي قدامه
document.addEventListener('click', (e) => {
  const fab = e.target.closest('#ai-fab');
  if (!fab) return;
  const pid = Number(params().get('p'));
  const p = pid && cache.get(pid);
  closeSheet(true);
  closeFull();
  if (p) return ask(t('askAbout2', p.title, p.merchant_name));
  go('v=chat');
}, true);
// صورة المنتج في البطاقة تفتح المنشورات بدل التفاصيل
document.addEventListener('click', (e) => {
  const img = e.target.closest('.mk-card-img');
  if (!img || e.target.closest('[data-fav]')) return;
  const cardEl = img.closest('[data-product]');
  if (!cardEl) return;
  e.stopPropagation();
  e.preventDefault();
  const scope = cardEl.closest('.mk-grid, .mk-row') || document;
  const ids = [...scope.querySelectorAll('[data-product]')].map((x) => Number(x.dataset.product));
  closeSheet(true);
  openPosts(Number(cardEl.dataset.product), ids);
}, true);

applyLang();
route();

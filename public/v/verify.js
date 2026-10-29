// صفحة التحقق: تقرأ رمز العلامة من الرابط، تشيله من شريط العنوان، وتسأل الخادم.
import { EN, onLangToggle, takeCachedResult, translatePage, tx } from '/v/i18n.js';
import { playResult, preload } from '/assets/sound.js';

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => ($(id).hidden = !on);

function store(kind) {
  try { const s = window[kind]; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch { return null; }
}
const local = store('localStorage'), session = store('sessionStorage');

// معرّف عشوائي للمتصفح: العلامة ترتبط بأول جهاز يمسحها
function deviceId() {
  let id = local?.getItem('asalah_sid');
  if (!/^[a-f0-9]{64}$/.test(id || '')) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
    local?.setItem('asalah_sid', id);
  }
  return id;
}

// الرمز يُشال من العنوان عشان الرابط المنسوخ من المتصفح ما يحمله، ويبقى في الجلسة لو حدّث الصفحة
const params = new URLSearchParams(location.search);
const hashParams = new URLSearchParams(location.hash.slice(1));
let token = params.get('t') || hashParams.get('t') || session?.getItem('asalah_t') || '';
if (params.has('t') || hashParams.has('t')) {
  session?.setItem('asalah_t', token);
  history.replaceState(null, '', location.pathname);
}
const sid = deviceId();

async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ ok: false, message: tx('تعذر الاتصال، حاول مرة ثانية', 'Connection failed, please try again') }));
  if (!res.ok && res.status !== 200) throw Object.assign(new Error(EN ? enError(data) : data.message || 'صار خطأ'), { data, status: res.status });
  return data;
}

function applyBrand(b) {
  if (!b) return;
  $('b-name').textContent = b.name;
  document.title = tx(`التحقق من ${b.name} - أصالة`, `Verify ${b.name} - Asalah`);
  const logo = $('b-logo');
  if (b.logo_url) {
    const img = document.createElement('img');
    img.src = b.logo_url;
    img.alt = '';
    logo.replaceChildren(img);
  } else logo.textContent = b.name.trim().replace(/^ال(?=\S{2})/, '').charAt(0);
  if (b.whatsapp && /^\d{8,15}$/.test(b.whatsapp)) {
    $('wa').href = 'https://wa.me/' + b.whatsapp;
    show('wa');
  }
}

// شاشة المسح: الخطوات تتعلّم وحدة وحدة، والنتيجة ما تطلع قبل ما تخلص (أقل من ثانيتين)
const STEP_MS = 550;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function scanSteps() {
  const items = [...document.querySelectorAll('.scan-steps li')];
  let i = 0;
  items[0].classList.add('active');
  return new Promise((resolve) => {
    const tick = () => {
      items[i].classList.replace('active', 'done');
      i++;
      if (i < items.length) { items[i].classList.add('active'); setTimeout(tick, STEP_MS); }
      else setTimeout(resolve, 250);
    };
    setTimeout(tick, reduced ? 50 : STEP_MS);
  });
}

// نصوص النتائج بالإنجليزي حسب رمز النتيجة، لأن رسائل الخادم بالعربي
const RESULT_EN = {
  unknown: 'This tag is not registered with us. Do not use the product before checking with the seller.',
  blocked: 'This tag has been blocked. The product may be counterfeit, check with the seller.',
  not_activated: 'This tag has not been activated yet. Check with the seller before using the product.',
  locked: 'This tag has passed its allowed number of checks and was locked. The product may be counterfeit.',
  other_device: 'This tag was already verified on another device. Continue on the device that scanned it first.',
};
const resultMsg = (d) => (EN && RESULT_EN[d.result] ? RESULT_EN[d.result] : d.message);
function enError(data) {
  const byCode = { rate_limited: 'Too many attempts, try again shortly', already_claimed: 'Already added to a balance', already_rated: 'Already rated', already_entered: 'You already entered with this tag', no_member: 'No balance for this number yet', contest_closed: 'The contest is not open' };
  return byCode[data.code] || RESULT_EN[data.code] || 'Something went wrong, please try again';
}

let lastResult = 'unknown', lastData = null, replay = false;

// صوت النتيجة: يشتغل لحاله إذا المتصفح سمح، وإلا يطلع زر "اسمع النتيجة"
function resultSound(kind) {
  if (replay || !lastData?.sound) return;
  playResult(kind, EN).then((r) => r === 'blocked' && soundChip(kind)).catch(() => {});
}
function soundChip(kind) {
  const b = $('sound-chip');
  b.textContent = kind === 'original' ? tx('🔊 اسمع النتيجة', '🔊 Hear the result') : tx('🔊 اسمع التحذير', '🔊 Hear the warning');
  b.classList.toggle('warn', kind !== 'original');
  b.onclick = () => { show('sound-chip', false); playResult(kind, EN).catch(() => {}); };
  show('sound-chip');
  setTimeout(() => show('sound-chip', false), 20000);
}
translatePage();
onLangToggle(() => lastData);
async function run() {
  const cached = takeCachedResult();
  replay = Boolean(cached);
  if (!cached) preload(EN);
  const steps = cached ? Promise.resolve() : scanSteps();
  if (!token && !cached) { await steps; return bad('unknown', tx('ما لقينا رمز العلامة في الرابط. امسح العلامة مرة ثانية.', 'We could not find the tag code in the link. Scan the tag again.')); }
  let d;
  try {
    [d] = cached ? [cached] : await Promise.all([post('/api/verify', { t: token, sid }), steps]);
  } catch (e) {
    await steps;
    show('loading', false);
    show('bad');
    $('bad-title').textContent = e.status === 429 ? tx('محاولات كثيرة', 'Too many attempts') : tx('تعذر التحقق', 'Could not verify');
    $('bad-msg').textContent = e.message;
    return;
  }
  show('loading', false);
  lastData = d;
  applyBrand(d.brand);
  lastResult = d.result;
  if (d.result === 'original') return ok(d);
  if (d.result === 'other_device') {
    $('other-msg').textContent = resultMsg(d);
    show('other');
    show('report');
    return;
  }
  bad(d.result, resultMsg(d));
}

function ok(d) {
  const t = d.tag;
  $('ok-sub').textContent = tx(`تم التحقق من هذي العلامة وهي مسجلة باسم ${d.brand.name}`, `This tag is verified and registered to ${d.brand.name}`);
  $('f-id').textContent = t.public_id;
  $('f-batch').textContent = t.batch;
  $('f-product').textContent = t.product_name || (t.produced_on ? tx('إنتاج ', 'Made ') + t.produced_on : '-');
  $('f-checks').textContent = t.checks_left == null ? String(t.check_no) : `${t.check_no} ${tx('من', 'of')} ${t.check_no + t.checks_left}`;
  show('test-note', t.is_test);
  // صورة المنتج للدفعة، وإذا ما فيه، شعار التاجر
  const pic = t.image_url || d.brand.logo_url;
  if (pic) {
    $('product-img').src = pic;
    $('product-img').alt = t.product_name || d.brand.name;
    $('product').classList.toggle('is-logo', !t.image_url);
    show('product');
    show('seal', false);
  }
  if (d.brand.store_url) {
    $('store-link').href = d.brand.store_url;
    show('store-link');
  }
  if (t.expires_on) {
    $('f-exp').textContent = monthName(t.expires_on);
    show('f-exp-box');
    show('expired', t.expired);
  }
  if (t.details) { $('details').textContent = t.details; show('details'); }
  shareData = { name: t.product_name || '', brand: d.brand.name };
  show('ok');
  $('ok').classList.add('pop');
  if (d.level) setupLevel(d.level);
  if (d.voice_url) setupVoice(d.voice_url);
  resultSound('original');
  if (d.passport) setupPassport(d.passport, t);
  if (d.guarantee) setupGuarantee(d.guarantee);
  if (d.shop) setupShop(d.shop);
  if (d.loyalty) setupLoyalty(d.loyalty, d.brand);
  if (d.rating) setupRating(d.rating);
  if (d.contest) {
    if (d.contest.entered) return show('entered');
    $('c-title').textContent = d.contest.title || tx('شارك في المسابقة', 'Enter the contest');
    if (d.contest.ends_at) {
      const end = new Date(d.contest.ends_at * 1000).toLocaleDateString(EN ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long' });
      $('c-sub').textContent = tx(`مشاركة وحدة لكل علامة، وتنتهي المسابقة ${end}.`, `One entry per tag. The contest ends ${end}.`);
    }
    if (d.contest.terms_url) $('terms').href = d.contest.terms_url;
    else $('terms').removeAttribute('href');
    show('contest');
    // من ثالث فحص تنزل الصفحة للنموذج مباشرة
    if (t.check_no >= 3) $('contest').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---------- مستوى العميل ----------
function setupLevel(l) {
  $('lv-icon').textContent = l.icon;
  $('lv-title').textContent = tx(`مستواك ${l.name}`, `Your level: ${l.name_en}`);
  $('lv-sub').textContent = l.next
    ? tx(`تحققت من ${l.count} منتج أصلي · باقي ${l.next.need} للمستوى ${l.next.name} ${l.next.icon}`, `${l.count} original products verified · ${l.next.need} more for ${l.next.name_en} ${l.next.icon}`)
    : tx(`تحققت من ${l.count} منتج أصلي · أعلى مستوى 👑`, `${l.count} original products verified · top level 👑`);
  const span = l.next ? l.count + l.next.need : l.count;
  requestAnimationFrame(() => ($('lv-bar').style.width = Math.min(100, Math.round((l.count / span) * 100)) + '%'));
  show('level');
}

// ---------- الرسالة الصوتية ----------
function setupVoice(url) {
  const a = $('voice'), b = $('voice-btn');
  a.src = url;
  b.addEventListener('click', () => (a.paused ? a.play().catch(() => {}) : a.pause()));
  a.addEventListener('play', () => b.classList.add('playing'));
  for (const ev of ['pause', 'ended']) a.addEventListener(ev, () => b.classList.remove('playing'));
  show('voice-btn');
}

// ---------- جواز سفر المنتج ----------
const dateOf = (sec) => new Date(sec * 1000).toLocaleDateString(EN ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' });
function setupPassport(p, t) {
  const steps = [];
  if (/^\d{4}-\d{2}$/.test(p.produced_on || '')) steps.push(['🏭', tx('الإنتاج', 'Produced'), monthName(p.produced_on)]);
  if (p.issued_at) steps.push(['🔐', tx('أصدرت أصالة علامته الرقمية', 'Asalah issued its digital tag'), dateOf(p.issued_at)]);
  if (p.shipped_at) steps.push(['🚚', tx('انشحن للبيع', 'Shipped for sale'), dateOf(p.shipped_at)]);
  const firstYou = t.check_no === 1;
  if (p.first_check_at) steps.push(['✅', firstYou ? tx('أنت أول واحد تحقق منه', 'You are the first to verify it') : tx('أول تحقق منه', 'First verified'), firstYou ? tx('الحين', 'Just now') : dateOf(p.first_check_at), firstYou]);
  if (!firstYou) steps.push(['📍', tx('تحققت منه أنت', 'You verified it'), tx(`التحقق رقم ${t.check_no}`, `Check #${t.check_no}`), true]);
  const list = $('pp-steps');
  list.replaceChildren(...steps.map(([icon, title, sub, you]) => {
    const li = el('li', you ? 'you' : '');
    const box = el('div');
    box.append(el('b', '', title), el('small', '', sub));
    li.append(el('span', 'pp-dot', icon), box);
    return li;
  }));
  // العدد يشمل علامتك، فنطرحها
  const others = (p.batch_verified || 1) - 1;
  $('pp-sub').textContent = others > 0
    ? tx(`${others.toLocaleString('en-US')} غيرك تحققوا من منتجات هذي الدفعة`, `${others.toLocaleString('en-US')} others verified products from this batch`)
    : tx('أنت أول من يتحقق من هذي الدفعة', 'You are the first to verify from this batch');
  if (steps.length) show('passport');
}

// ---------- ضمان أصالة ----------
function setupGuarantee(g) {
  if (g.terms) $('g-terms').textContent = g.terms;
  if (g.claimed) {
    show('g-open', false);
    $('g-done').textContent = { new: tx('وصل طلب الضمان لصاحب العلامة، وبيتواصل معك.', 'Your claim reached the brand, they will contact you.'), approved: tx('تم قبول طلب الضمان ✅', 'Your claim was approved ✅'), rejected: tx('صاحب العلامة راجع طلبك ورفضه.', 'The brand reviewed and declined your claim.') }[g.claimed];
    show('g-done');
  }
  show('guarantee');
}
$('g-open').addEventListener('click', () => { show('g-open', false); show('g-form'); $('g-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('g-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const photo = await photoB64(f.get('photo'));
    const r = await post('/api/guarantee', { t: token, sid, name: f.get('name'), phone: f.get('phone'), city: f.get('city'), point_of_sale: f.get('point_of_sale'), note: f.get('note'), photo, consent: f.get('consent') === 'on' });
    show('g-form', false);
    $('g-done').textContent = EN ? 'Your claim reached the brand, they will contact you.' : r.message;
    show('g-done');
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

// صورة من الكاميرا: نصغّرها JPG قبل الإرسال
async function photoB64(file) {
  if (!file || !file.size) return null;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return null;
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.8);
  return url.slice(url.indexOf(',') + 1);
}

const monthName = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(EN ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// ---------- متاجر أصالة: اطلبه مرة ثانية ----------
const money = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + tx(' ر.س', ' SAR');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const img = (src, alt = '') => { const i = el('img'); i.src = src; i.alt = alt; i.loading = 'lazy'; return i; };
function setupShop(s) {
  const base = '/stores/' + (EN ? '?lang=en&' : '?');
  $('shop-all').href = base + 'm=' + encodeURIComponent(s.slug);
  if (EN) $('shop-all').textContent = 'All products';
  const p = s.product;
  if (p) {
    const a = $('shop-main');
    a.href = base + 'p=' + p.id;
    const info = el('div');
    info.append(el('small', 'muted', tx('نفس المنتج اللي معك', 'The same product you have')), el('b', '', p.title), el('span', 'price', money(p.price)));
    a.replaceChildren(...(p.image_url ? [img(p.image_url)] : []), info, el('span', 'go', tx('اطلبه ↗', 'Order ↗')));
    show('shop-main');
  } else $('shop-title').textContent = tx(`من متجر ${lastData.brand.name} 🛍️`, `From ${lastData.brand.name} 🛍️`);
  if (s.coupon) {
    const c = $('shop-coupon');
    const btn = el('button', 'btn btn-sm', tx('انسخ', 'Copy'));
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      await navigator.clipboard?.writeText(s.coupon.code).catch(() => {});
      btn.textContent = tx('تم النسخ ✅', 'Copied ✅');
      if (p) fetch('/api/public/store/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'coupon', id: p.id }) }).catch(() => {});
    });
    const code = el('b', 'ltr', s.coupon.code);
    c.replaceChildren(el('span', '', '🎟️'), el('span', '', s.coupon.note || tx('كود خصم لعملاء أصالة', 'Discount code for Asalah customers')), code, btn);
    show('shop-coupon');
  }
  if (s.reels.length) {
    $('shop-reels').replaceChildren(
      ...s.reels.map((r) => {
        const a = el('a', 'shop-reel');
        a.href = base + 'v=reels&r=' + r.id;
        if (r.poster_url || r.product_image) a.append(img(r.poster_url || r.product_image));
        a.append(el('span', '', r.title));
        return a;
      })
    );
    show('shop-reels');
  }
  if (s.more.length) {
    $('shop-more').replaceChildren(
      ...s.more.map((x) => {
        const a = el('a', 'shop-card');
        a.href = base + 'p=' + x.id;
        a.append(x.image_url ? img(x.image_url) : el('span', 'ph'), el('b', '', x.title), el('span', 'price', money(x.price)));
        return a;
      })
    );
    $('shop-more-h').textContent = tx(`منتجات أصلية ثانية من ${lastData.brand.name} 🛡️`, `More originals from ${lastData.brand.name} 🛡️`);
    show('shop-more-h');
    show('shop-more');
  }
  show('shop');
}

// ---------- مشاركة "اشتريت أصلي" ----------
let shareData = null;
$('share').addEventListener('click', async () => {
  const what = shareData.name ? tx(`${shareData.name} من ${shareData.brand}`, `${shareData.name} by ${shareData.brand}`) : tx(`منتج ${shareData.brand}`, `a ${shareData.brand} product`);
  const text = tx(`تأكدت إن ${what} أصلي ✅ عبر علامة أصالة. اشترِ الأصلي دايماً!`, `I verified ${what} is original ✅ with an Asalah tag. Always buy genuine!`);
  const link = location.origin + '/';
  if (navigator.share) {
    try { await navigator.share({ title: tx('اشتريت أصلي', 'I bought original'), text, url: link }); } catch { /* ألغى المشاركة */ }
  } else window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank', 'noopener');
});

// ---------- النقاط والكاش باك ----------
// الرقم يُحفظ في الجهاز لكل تاجر، عشان المرة الجاية يضاف الرصيد بضغطة
let loyalty = null, brandKey = '';
const fmt = (n) => (loyalty.mode === 'cashback' ? (n / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + tx(' ريال', ' SAR') : n.toLocaleString('en-US') + tx(' نقطة', ' points'));
const savedPhone = () => local?.getItem('asalah_phone_' + brandKey) || '';

function setupLoyalty(l, b) {
  loyalty = l;
  brandKey = b.name;
  $('l-title').textContent = l.mode === 'cashback' ? tx('كاش باك على مشترياتك', 'Cashback on your purchases') : tx('اجمع نقاطك', 'Collect your points');
  $('l-sub').textContent = EN
    ? `Every original product gives you ${fmt(l.per_tag)}${l.reward ? ', and at ' + fmt(l.min_redeem) + ' you get: ' + l.reward : ', redeem at ' + fmt(l.min_redeem)}.`
    : `كل منتج أصلي يعطيك ${fmt(l.per_tag)}${l.reward ? '، وعند ' + fmt(l.min_redeem) + ' تحصل على: ' + l.reward : '، وتستبدل عند ' + fmt(l.min_redeem)}.`;
  const phone = savedPhone();
  if (phone) $('claim-form').phone.value = phone;
  show('loyalty');
  // المكافأة تطلع للعميل أول ما يتأكد إن المنتج أصلي
  if (!l.claimed) {
    $('reward-title').textContent = tx(`🎉 حصلت على ${fmt(l.per_tag)}${l.mode === 'cashback' ? ' كاش باك' : ''}`, `🎉 You earned ${fmt(l.per_tag)}${l.mode === 'cashback' ? ' cashback' : ''}`);
    $('reward-sub').textContent = phone ? tx('جاري إضافتها لرصيدك…', 'Adding it to your balance…') : tx('اكتب رقم جوالك تحت عشان تنحفظ في رصيدك', 'Enter your mobile below to save it to your balance');
    show('reward');
    $('l-title').textContent = tx(`حصلت على ${fmt(l.per_tag)} 🎉`, `You earned ${fmt(l.per_tag)} 🎉`);
    $('claim-btn').textContent = tx('احفظها في رصيدي', 'Save to my balance');
    // الرقم محفوظ من قبل: تنضاف تلقائياً
    if (phone) claim(phone);
  }
  if (l.claimed) {
    show('claim-form', false);
    if (phone) loadWallet(phone);
    else { show('claim-form'); $('claim-btn').textContent = tx('اعرض رصيدي', 'Show my balance'); }
  }
}

function renderWallet(w, added) {
  show('wallet');
  show('claim-form', false);
  $('w-balance').textContent = fmt(w.balance);
  const pct = Math.min(100, Math.round((w.balance / w.min_redeem) * 100));
  $('w-progress-label').textContent = w.can_redeem ? tx('رصيدك يكفي للاستبدال', 'You can redeem now') : tx(`باقي ${fmt(w.min_redeem - w.balance)} للاستبدال`, `${fmt(w.min_redeem - w.balance)} to go`);
  requestAnimationFrame(() => ($('w-bar').style.width = pct + '%'));
  show('redeem-btn', w.can_redeem);
  if (added) {
    $('w-msg').textContent = tx(`انضاف لك ${fmt(added)} 🎉`, `${fmt(added)} added 🎉`);
    show('w-msg');
    $('wallet').classList.add('add-pop');
  }
  $('w-codes').replaceChildren(
    ...w.codes.map((c) => {
      const li = document.createElement('li');
      const code = document.createElement('b');
      code.className = 'ltr' + (c.status !== 'issued' ? ' used' : '');
      code.textContent = c.code;
      const st = document.createElement('span');
      st.textContent = c.status === 'issued' ? tx('جاهز للاستخدام', 'Ready to use') : c.status === 'used' ? tx('مستخدم', 'Used') : tx('ملغي', 'Cancelled');
      li.append(code, st);
      return li;
    })
  );
}

async function loadWallet(phone) {
  try {
    renderWallet((await post('/api/loyalty/wallet', { t: token, sid, phone })).wallet);
  } catch (err) {
    show('claim-form');
    $('claim-btn').textContent = tx('اعرض رصيدي', 'Show my balance');
    if (err.data?.code !== 'no_member') $('l-sub').textContent = err.message;
  }
}

async function claim(phone, manual) {
  const btn = $('claim-btn');
  btn.disabled = true;
  try {
    if (loyalty.claimed) await loadWallet(phone);
    else {
      const r = await post('/api/loyalty/claim', { t: token, sid, phone });
      loyalty.claimed = true;
      renderWallet(r.wallet, r.added);
      $('reward-sub').textContent = tx(`انضافت لرصيدك. رصيدك الحين ${fmt(r.wallet.balance)}`, `Added. Your balance is now ${fmt(r.wallet.balance)}`);
    }
    local?.setItem('asalah_phone_' + brandKey, phone);
  } catch (err) {
    if (err.data?.code === 'already_claimed') { loyalty.claimed = true; await loadWallet(phone); }
    else if (manual) alert(err.message);
    else $('reward-sub').textContent = tx('اكتب رقم جوالك تحت عشان تنحفظ في رصيدك', 'Enter your mobile below to save it to your balance');
  } finally {
    btn.disabled = false;
  }
}
$('claim-form').addEventListener('submit', (e) => {
  e.preventDefault();
  claim(e.target.phone.value.trim(), true);
});

$('redeem-btn').addEventListener('click', async () => {
  const phone = savedPhone() || $('claim-form').phone.value.trim();
  const what = loyalty.reward || fmt(loyalty.min_redeem);
  if (!confirm(tx(`تبي تستبدل ${fmt(loyalty.min_redeem)} مقابل: ${what}؟`, `Redeem ${fmt(loyalty.min_redeem)} for: ${what}?`))) return;
  $('redeem-btn').disabled = true;
  try {
    const r = await post('/api/loyalty/redeem', { t: token, sid, phone });
    renderWallet(r.wallet);
    $('w-code-val').textContent = r.code;
    $('w-code-reward').textContent = loyalty.reward || tx('قيمة ', 'Worth ') + fmt(loyalty.min_redeem);
    show('w-code');
    $('w-code').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    alert(err.message);
  } finally {
    $('redeem-btn').disabled = false;
  }
});

$('w-other').addEventListener('click', () => {
  local?.removeItem('asalah_phone_' + brandKey);
  $('claim-form').phone.value = '';
  show('wallet', false);
  show('w-code', false);
  show('claim-form');
  if (loyalty.claimed) $('claim-btn').textContent = tx('اعرض رصيدي', 'Show my balance');
});

// ---------- التقييم ----------
let stars = 0;
const paintStars = (n) => document.querySelectorAll('.stars button').forEach((b) => b.classList.toggle('on', Number(b.dataset.star) <= n));
function setupRating(r) {
  show('rating');
  if (r.done) {
    paintStars(r.stars);
    document.querySelector('.stars').setAttribute('aria-disabled', 'true');
    show('rated');
    return;
  }
  document.querySelectorAll('.stars button').forEach((b) =>
    b.addEventListener('click', () => {
      stars = Number(b.dataset.star);
      paintStars(stars);
      show('rate-form');
    })
  );
}
$('rate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    await post('/api/rate', { t: token, sid, stars, comment: e.target.comment.value.trim() || null });
  } catch (err) {
    if (err.data?.code !== 'already_rated') { alert(err.message); btn.disabled = false; return; }
  }
  show('rate-form', false);
  show('rated');
  document.querySelector('.stars').setAttribute('aria-disabled', 'true');
  document.querySelectorAll('.stars button').forEach((b) => (b.disabled = true));
});

function bad(result, message) {
  show('loading', false);
  $('bad-title').textContent = result === 'not_activated' ? tx('علامة غير مفعّلة', 'Tag not activated') : tx('قد يكون المنتج مقلّداً', 'This product may be counterfeit');
  $('bad-msg').textContent = message;
  show('bad');
  show('report');
  if (result !== 'not_activated') resultSound('fake');
}

$('entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    await post('/api/enter', { t: token, sid, name: f.name, phone: f.phone, city: f.city, point_of_sale: f.point_of_sale, consent: f.consent === 'on' });
    show('contest', false);
    show('entered');
  } catch (err) {
    alert(err.message);
    if (err.data?.code === 'already_entered') { show('contest', false); show('entered'); }
  } finally {
    btn.disabled = false;
  }
});

$('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  const label = btn.textContent;
  try {
    const photo = await photoB64(f.photo);
    if (photo) btn.textContent = tx('نحلل الصورة بالذكاء الصناعي…', 'Analysing the photo with AI…');
    const r = await post('/api/report', { t: token, reason: lastResult, city: f.city, point_of_sale: f.point_of_sale, phone: f.phone || null, note: f.note || null, photo });
    show('report', false);
    show('reported');
    if (r.ai?.verdict) {
      $('ai-verdict').textContent = r.ai.verdict;
      if (r.ai.score != null) {
        $('ai-score').textContent = tx(`احتمال إنه مقلّد: ${r.ai.score}٪`, `Likelihood it is fake: ${r.ai.score}%`);
        requestAnimationFrame(() => ($('ai-bar').style.insetInlineStart = `calc(${r.ai.score}% - 2px)`));
      }
      show('ai-box');
    }
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

run();

// صفحة التحقق: تقرأ رمز العلامة من الرابط، تشيله من شريط العنوان، وتسأل الخادم.
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
  const data = await res.json().catch(() => ({ ok: false, message: 'تعذر الاتصال، حاول مرة ثانية' }));
  if (!res.ok && res.status !== 200) throw Object.assign(new Error(data.message || 'صار خطأ'), { data, status: res.status });
  return data;
}

function applyBrand(b) {
  if (!b) return;
  $('b-name').textContent = b.name;
  document.title = `التحقق من ${b.name} - أصالة`;
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

let lastResult = 'unknown';
async function run() {
  const steps = scanSteps();
  if (!token) { await steps; return bad('unknown', 'ما لقينا رمز العلامة في الرابط. امسح العلامة مرة ثانية.'); }
  let d;
  try {
    [d] = await Promise.all([post('/api/verify', { t: token, sid }), steps]);
  } catch (e) {
    await steps;
    show('loading', false);
    show('bad');
    $('bad-title').textContent = e.status === 429 ? 'محاولات كثيرة' : 'تعذر التحقق';
    $('bad-msg').textContent = e.message;
    return;
  }
  show('loading', false);
  applyBrand(d.brand);
  lastResult = d.result;
  if (d.result === 'original') return ok(d);
  if (d.result === 'other_device') {
    $('other-msg').textContent = d.message;
    show('other');
    show('report');
    return;
  }
  bad(d.result, d.message);
}

function ok(d) {
  const t = d.tag;
  $('ok-sub').textContent = `تم التحقق من هذي العلامة وهي مسجلة باسم ${d.brand.name}`;
  $('f-id').textContent = t.public_id;
  $('f-batch').textContent = t.batch;
  $('f-product').textContent = t.product_name || (t.produced_on ? 'إنتاج ' + t.produced_on : '-');
  $('f-checks').textContent = t.checks_left == null ? String(t.check_no) : `${t.check_no} من ${t.check_no + t.checks_left}`;
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
  if (d.loyalty && !t.is_test) setupLoyalty(d.loyalty, d.brand);
  if (d.rating) setupRating(d.rating);
  if (d.contest) {
    if (d.contest.entered) return show('entered');
    $('c-title').textContent = d.contest.title || 'شارك في المسابقة';
    if (d.contest.ends_at) {
      const end = new Date(d.contest.ends_at * 1000).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long' });
      $('c-sub').textContent = `مشاركة وحدة لكل علامة، وتنتهي المسابقة ${end}.`;
    }
    if (d.contest.terms_url) $('terms').href = d.contest.terms_url;
    else $('terms').removeAttribute('href');
    show('contest');
    // من ثالث فحص تنزل الصفحة للنموذج مباشرة
    if (t.check_no >= 3) $('contest').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const monthName = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// ---------- مشاركة "اشتريت أصلي" ----------
let shareData = null;
$('share').addEventListener('click', async () => {
  const what = shareData.name ? `${shareData.name} من ${shareData.brand}` : `منتج ${shareData.brand}`;
  const text = `تأكدت إن ${what} أصلي ✅ عبر علامة أصالة. اشترِ الأصلي دايماً!`;
  const link = location.origin + '/';
  if (navigator.share) {
    try { await navigator.share({ title: 'اشتريت أصلي', text, url: link }); } catch { /* ألغى المشاركة */ }
  } else window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank', 'noopener');
});

// ---------- النقاط والكاش باك ----------
// الرقم يُحفظ في الجهاز لكل تاجر، عشان المرة الجاية يضاف الرصيد بضغطة
let loyalty = null, brandKey = '';
const fmt = (n) => (loyalty.mode === 'cashback' ? (n / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ريال' : n.toLocaleString('en-US') + ' نقطة');
const savedPhone = () => local?.getItem('asalah_phone_' + brandKey) || '';

function setupLoyalty(l, b) {
  loyalty = l;
  brandKey = b.name;
  $('l-title').textContent = l.mode === 'cashback' ? 'كاش باك على مشترياتك' : 'اجمع نقاطك';
  $('l-sub').textContent = `كل منتج أصلي يعطيك ${fmt(l.per_tag)}${l.reward ? '، وعند ' + fmt(l.min_redeem) + ' تحصل على: ' + l.reward : '، وتستبدل عند ' + fmt(l.min_redeem)}.`;
  const phone = savedPhone();
  if (phone) $('claim-form').phone.value = phone;
  show('loyalty');
  if (l.claimed) {
    show('claim-form', false);
    if (phone) loadWallet(phone);
    else { show('claim-form'); $('claim-btn').textContent = 'اعرض رصيدي'; }
  }
}

function renderWallet(w, added) {
  show('wallet');
  show('claim-form', false);
  $('w-balance').textContent = fmt(w.balance);
  const pct = Math.min(100, Math.round((w.balance / w.min_redeem) * 100));
  $('w-progress-label').textContent = w.can_redeem ? 'رصيدك يكفي للاستبدال' : `باقي ${fmt(w.min_redeem - w.balance)} للاستبدال`;
  requestAnimationFrame(() => ($('w-bar').style.width = pct + '%'));
  show('redeem-btn', w.can_redeem);
  if (added) {
    $('w-msg').textContent = `انضاف لك ${fmt(added)} 🎉`;
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
      st.textContent = c.status === 'issued' ? 'جاهز للاستخدام' : c.status === 'used' ? 'مستخدم' : 'ملغي';
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
    $('claim-btn').textContent = 'اعرض رصيدي';
    if (err.data?.code !== 'no_member') $('l-sub').textContent = err.message;
  }
}

$('claim-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = e.target.phone.value.trim();
  const btn = $('claim-btn');
  btn.disabled = true;
  try {
    if (loyalty.claimed) await loadWallet(phone);
    else {
      const r = await post('/api/loyalty/claim', { t: token, sid, phone });
      loyalty.claimed = true;
      renderWallet(r.wallet, r.added);
    }
    local?.setItem('asalah_phone_' + brandKey, phone);
  } catch (err) {
    if (err.data?.code === 'already_claimed') { loyalty.claimed = true; await loadWallet(phone); }
    else alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

$('redeem-btn').addEventListener('click', async () => {
  const phone = savedPhone() || $('claim-form').phone.value.trim();
  const what = loyalty.reward || fmt(loyalty.min_redeem);
  if (!confirm(`تبي تستبدل ${fmt(loyalty.min_redeem)} مقابل: ${what}؟`)) return;
  $('redeem-btn').disabled = true;
  try {
    const r = await post('/api/loyalty/redeem', { t: token, sid, phone });
    renderWallet(r.wallet);
    $('w-code-val').textContent = r.code;
    $('w-code-reward').textContent = loyalty.reward || 'قيمة ' + fmt(loyalty.min_redeem);
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
  if (loyalty.claimed) $('claim-btn').textContent = 'اعرض رصيدي';
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
  $('bad-title').textContent = result === 'not_activated' ? 'علامة غير مفعّلة' : 'قد يكون المنتج مقلّداً';
  $('bad-msg').textContent = message;
  show('bad');
  show('report');
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
  try {
    await post('/api/report', { t: token, reason: lastResult, city: f.city, point_of_sale: f.point_of_sale, phone: f.phone || null, note: f.note || null });
    show('report', false);
    show('reported');
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

run();

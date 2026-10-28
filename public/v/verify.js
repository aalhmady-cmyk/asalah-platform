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

let lastResult = 'unknown';
async function run() {
  if (!token) return bad('unknown', 'ما لقينا رمز العلامة في الرابط. امسح العلامة مرة ثانية.');
  let d;
  try {
    d = await post('/api/verify', { t: token, sid });
  } catch (e) {
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
  show('ok');
  $('ok').classList.add('pop');
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

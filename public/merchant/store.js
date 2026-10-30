// تبويب "متجري": التاجر يضيف منتجاته لمتاجر أصالة بالذكاء الاصطناعي، ويرفع ريلز بمقاس 9:16.
import { api, html, num, raw, render, toast } from '/assets/common.js';
import { clipReel, cutReel, reelDuration } from '/merchant/reel.js';
import { bindClip } from '/stores/clip.js';
import { confirmBox } from '/assets/dialog.js';

const $ = (id) => document.getElementById(id);
let S = null; // بيانات المتجر من الخادم
let draft = null; // المنتج اللي يتجهّز الحين
let busy = false;

const sar = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س');

// ---------- الصور ----------
async function shrink(blob, maxSide = 1200) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    if (b && b.size < 900 * 1024) return b;
  }
  throw new Error('الصورة كبيرة، جرّب صورة ثانية');
}
const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    r.readAsDataURL(blob);
  });
function pickFile(accept) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}
async function uploadImage(blob) {
  const d = await api('/api/m/store/image', { method: 'POST', body: blob });
  return { image_key: d.image_key, image_url: d.image_url };
}

// ---------- الواجهة ----------
export async function loadStore() {
  S = await api('/api/m/store');
  const root = $('store');
  if (!S.enabled) return renderLocked(root);
  render(root, html`
    <div class="page-head">
      <div><h1>متجري 🛍️</h1><p>منتجاتك تظهر في متاجر أصالة بشارة "أصلي موثّق"، والعميل يشتري من متجرك في سلة.</p></div>
      <a class="btn" href="/stores/?m=${S.slug}" target="_blank" rel="noopener">شوف متجرك ↗</a>
    </div>
    <div class="kpis" style="margin-top:24px">
      <div class="kpi"><span class="label">منتجاتك المعروضة</span><span class="value">${num(S.products.filter((p) => p.status === 'active').length)}</span></div>
      <div class="kpi"><span class="label">مشاهدات المنتجات</span><span class="value">${num(S.stats.views)}</span></div>
      <div class="kpi"><span class="label">ضغطات "اشتر الآن"</span><span class="value">${num(S.stats.clicks + S.stats.reel_clicks)}</span><span class="note">تحوّلت لمتجرك في سلة</span></div>
      <div class="kpi"><span class="label">مشاهدات الريلز</span><span class="value">${num(S.stats.reel_views)}</span></div>
    </div>
    <div class="card" style="margin-top:24px" id="st-stats"></div>
    <div class="row" style="margin-top:24px">
      <form class="card" id="st-sync">
        <div class="card-head"><h2>🔄 اسحب منتجاتك من سلة</h2></div>
        <p class="small muted" style="margin:0">الصق رابط متجرك كامل أو رابط منتج واحد. نقرأ المنتجات بصورها وأسعارها، وأنت تعلّم على اللي تبي تنشره.</p>
        <div class="st-inline"><input name="store_url" type="url" required class="ltr" value="${S.store_url || ''}" placeholder="https://your-store.salla.sa" aria-label="رابط متجرك أو رابط منتج"><button class="btn btn-primary" type="submit">اقرأ المنتجات</button></div>
        <label class="check owner-only"><input type="checkbox" name="auto" data-st="auto" ${S.auto_sync ? 'checked' : ''}> حدّث الأسعار تلقائياً من سلة (كل 12 ساعة)</label>
        <div id="st-sync-body"></div>
      </form>
      <form class="card owner-only" id="st-coupon">
        <div class="card-head"><h2>🎟️ كوبون متاجر أصالة</h2>${S.coupon.code ? html`<span class="small muted">انسخ ${num(S.coupon.copies)} مرة</span>` : ''}</div>
        <p class="small muted" style="margin:0">سوّ كود خصم في سلة خاص بعملاء أصالة، واكتبه هنا. يظهر للعميل مع زر "اشتر الآن"، وتعرف من سلة كم طلب جاك منا.</p>
        <div class="form-grid">
          <label class="field">الكود<input name="store_coupon" maxlength="30" class="ltr" value="${S.coupon.code || ''}" placeholder="ASALAH10" style="text-transform:uppercase"></label>
          <label class="field">وش يعطي؟<input name="store_coupon_note" maxlength="80" value="${S.coupon.note || ''}" placeholder="خصم 10٪ على كل الطلب"></label>
        </div>
        <div><button class="btn btn-primary" type="submit">حفظ الكوبون</button></div>
      </form>
    </div>
    <div class="card st-compose" style="margin-top:24px" id="st-compose"></div>
    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>منتجاتك (${num(S.products.length)})</h2></div>
      <div id="st-products"></div>
    </div>
    <div class="card" style="margin-top:24px">
      <div class="card-head"><h2>الريلز 🎬</h2>${S.media ? raw('<button class="btn btn-gold" type="button" data-st="reel-new">＋ ريل جديد</button>') : ''}</div>
      <div id="st-reels"></div>
    </div>`);
  renderCompose();
  renderProducts();
  renderReels();
  loadStats(STATS_DAYS);
}

// ---------- تقرير المتجر: رسم بياني للمشاهدات والضغطات ----------
let STATS_DAYS = 30;
async function loadStats(days) {
  STATS_DAYS = days;
  const el = $('st-stats');
  if (!el) return;
  let d;
  try { d = await api('/api/m/store/stats?days=' + days); } catch (e) { return render(el, html`<div class="empty">${e.message}</div>`); }
  // نعبّي الأيام الفاضية بصفر عشان الرسم يكون متصل
  const map = Object.fromEntries(d.daily.map((x) => [x.day, x]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() + 3 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
    series.push({ day, views: map[day]?.views || 0, clicks: map[day]?.clicks || 0 });
  }
  const tv = series.reduce((a, x) => a + x.views, 0), tc = series.reduce((a, x) => a + x.clicks, 0);
  const rate = tv ? ((tc / tv) * 100).toFixed(1) : '0';
  render(el, html`<div class="card-head"><h2>📈 أداء متجرك</h2>
      <div class="st-seg" role="group" aria-label="المدة">${[7, 30, 90].map((n) => html`<button type="button" data-st="stats" data-days="${n}" aria-pressed="${n === days}">${n === 7 ? 'أسبوع' : n === 30 ? 'شهر' : '3 شهور'}</button>`)}</div></div>
    <div class="st-stat-kpis">
      <div><small><span class="st-dot v"></span>مشاهدات</small><b>${num(tv)}</b></div>
      <div><small><span class="st-dot c"></span>ضغطات "اشتر"</small><b>${num(tc)}</b></div>
      <div><small>نسبة الشراء من المشاهدة</small><b>${rate}٪</b></div>
    </div>
    ${tv || tc ? chart(series) : html`<div class="empty">ما فيه زيارات في هالمدة للحين. شارك رابط متجرك في واتساب وانستقرام عشان تبدأ الأرقام 🚀</div>`}
    <div class="row st-tops">
      <div><h3>أكثر المنتجات جلباً للزباين</h3>${d.top.length ? html`<ol class="st-top">${d.top.map((p) => html`<li>${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : html`<span class="ph">🛍️</span>`}<span>${p.title}</span><small>👁 ${num(p.views)} · 🛒 ${num(p.clicks)}</small></li>`)}</ol>` : html`<p class="small muted">بيطلع هنا لما تجيك زيارات</p>`}</div>
      <div><h3>أكثر الريلز جلباً للزباين</h3>${d.top_reels.length ? html`<ol class="st-top">${d.top_reels.map((r) => html`<li>${r.poster_url ? html`<img src="${r.poster_url}" alt="" loading="lazy">` : html`<span class="ph">🎬</span>`}<span>${r.title}</span><small>👁 ${num(r.views)} · 🛒 ${num(r.clicks)}</small></li>`)}</ol>` : html`<p class="small muted">ارفع ريل وبيطلع أداؤه هنا</p>`}</div>
    </div>`);
}
// أعمدة المشاهدات وخط الضغطات (SVG داخل الصفحة)
function chart(series) {
  const W = 720, H = 200, P = 24, n = series.length;
  const bw = (W - P * 2) / n;
  const mv = Math.max(1, ...series.map((x) => x.views)), mc = Math.max(1, ...series.map((x) => x.clicks));
  const y = (v, m) => H - P - (v / m) * (H - P * 2);
  const pts = series.map((x, i) => `${(P + bw * i + bw / 2).toFixed(1)},${y(x.clicks, mc).toFixed(1)}`).join(' ');
  const label = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' });
  const step = Math.ceil(n / 6);
  return raw(`<div class="st-chart"><svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="المشاهدات والضغطات لكل يوم" preserveAspectRatio="none">
    ${series.map((x, i) => `<rect x="${(P + bw * i + bw * 0.15).toFixed(1)}" y="${y(x.views, mv).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(H - P - y(x.views, mv)).toFixed(1)}" rx="3" class="v"><title>${label(x.day)}: ${x.views} مشاهدة، ${x.clicks} ضغطة</title></rect>`).join('')}
    <polyline points="${pts}" class="c" fill="none"/>
    ${series.map((x, i) => (x.clicks ? `<circle cx="${(P + bw * i + bw / 2).toFixed(1)}" cy="${y(x.clicks, mc).toFixed(1)}" r="3.5" class="c"/>` : '')).join('')}
    ${series.map((x, i) => (i % step === 0 || i === n - 1 ? `<text x="${(P + bw * i + bw / 2).toFixed(1)}" y="${H + 12}" text-anchor="middle">${i === n - 1 ? 'اليوم' : label(x.day)}</text>` : '')).join('')}
  </svg></div>`);
}

function renderLocked(root) {
  render(root, html`
    <div class="st-locked">
      <div class="st-locked-art" aria-hidden="true">🛍️</div>
      <h1>اعرض منتجاتك في متاجر أصالة</h1>
      <p>سوق للمنتجات الأصلية بس. منتجاتك تظهر بشارة "أصلي موثّق"، والعميل يشتري من متجرك في سلة مباشرة.</p>
      <ul>
        <li>✨ تضيف المنتج بصورة أو رابط، والذكاء الاصطناعي يكتب البطاقة عنك</li>
        <li>🎬 ريلز قصيرة لمنتجاتك، يقصّها النظام بمقاس الجوال</li>
        <li>📈 تشوف المشاهدات وكم عميل راح لمتجرك</li>
      </ul>
      <button class="btn btn-gold" type="button" data-st="request">اطلب الاشتراك</button>
      <p class="small muted">الاشتراك مجاني حالياً، وأصالة تفعّله لك.</p>
    </div>`);
}

// ---------- إضافة منتج ----------
const WAYS = [
  ['photo', '📸', 'صوّر المنتج', 'الذكاء يكتب الاسم والوصف'],
  ['link', '🔗', 'الصق رابطه من سلة', 'نسحب الصورة والسعر والوصف'],
  ['text', '✍️', 'اكتب عنه كلمتين', 'والذكاء يكمل الباقي'],
  ['excel', '📥', 'استيراد من Excel', 'الصق الصفوف أو ارفع ملف CSV'],
];

function renderCompose() {
  const el = $('st-compose');
  if (!draft) {
    render(el, html`
      <div class="card-head"><h2>أضف منتج</h2>${S.ai ? raw('<span class="pill ok">✨ بالذكاء الاصطناعي</span>') : ''}</div>
      <div class="st-ways">${WAYS.map(([k, ic, t, s]) => html`<button type="button" class="st-way" data-st="way" data-way="${k}"><span class="ic" aria-hidden="true">${ic}</span><b>${t}</b><small>${s}</small></button>`)}</div>
      <div id="st-way-body"></div>`);
    return;
  }
  const d = draft;
  render(el, html`
    <div class="card-head"><h2>${d.id ? 'تعديل المنتج' : 'بطاقة المنتج'}</h2><button class="btn btn-sm" type="button" data-st="cancel">إلغاء</button></div>
    <form id="st-form" class="st-form">
      <div class="st-media">
        <button type="button" class="st-img" data-st="img" aria-label="${d.image_url ? 'تغيير الصورة' : 'إضافة صورة'}">
          ${d.image_url ? html`<img src="${d.image_url}" alt="">` : raw('<span>📷<br>أضف صورة</span>')}
        </button>
        ${S.ai ? html`<button type="button" class="btn btn-sm" data-st="rewrite" ${d.image_url || d.title ? '' : 'disabled'}>✨ اكتبها لي من جديد</button>` : ''}
      </div>
      <div class="st-fields">
        <label class="field">اسم المنتج<input name="title" required minlength="2" maxlength="120" value="${d.title || ''}"></label>
        <div class="form-grid">
          <label class="field">السعر (ريال)<input name="price" required inputmode="decimal" class="ltr" value="${d.price ?? ''}" placeholder="149"></label>
          <label class="field">قبل الخصم (اختياري)<input name="old_price" inputmode="decimal" class="ltr" value="${d.old_price ?? ''}" placeholder="199"></label>
        </div>
        <label class="field">الفئة<select name="category">${Object.entries(S.categories).map(([k, v]) => html`<option value="${k}" ${k === (d.category || 'other') ? 'selected' : ''}>${v}</option>`)}</select></label>
        <label class="field">رابط المنتج في متجرك (سلة) - اختياري<input name="buy_url" type="url" class="ltr" value="${d.buy_url || ''}" placeholder="https://your-store.salla.sa/p/..."><small class="muted">لو حطيته، "اشتر الآن" يودّي العميل لسلة. لو تركته فاضي، الطلب ينحفظ في متجرك الخاص 🏪 ويتأكد معك على واتساب.</small></label>
        <label class="field">الوصف<textarea name="description" rows="4" maxlength="1500">${d.description || ''}</textarea></label>
        <label class="check"><input type="checkbox" name="active" ${d.status === 'hidden' ? '' : 'checked'}> يظهر للعملاء</label>
        <div class="actions"><button class="btn btn-primary" type="submit">${d.id ? 'حفظ التعديل' : 'انشر المنتج 🚀'}</button></div>
      </div>
    </form>`);
}

function wayBody(way) {
  const el = $('st-way-body');
  document.querySelectorAll('.st-way').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.way === way)));
  if (way === 'photo') return startPhoto();
  if (way === 'link')
    render(el, html`<form class="st-inline" id="st-link"><input name="url" type="url" required class="ltr" placeholder="https://your-store.salla.sa/p/..." aria-label="رابط المنتج"><button class="btn btn-primary" type="submit">اسحب البيانات</button></form>`);
  if (way === 'text')
    render(el, html`<form id="st-text" class="st-text"><textarea name="text" rows="3" required maxlength="1500" placeholder="اكتب عن المنتج مثل ما تكلم عميل. مثال: عطر عود كمبودي 50 مل، ثباته عالي، سعره 289 بدل 349، ورابطه في سلة https://..." aria-label="وصف المنتج"></textarea><p class="small muted" style="margin:0">✨ لو كتبت السعر أو الرابط، الذكاء يحطهم في البطاقة لحاله.</p><div><button class="btn btn-primary" type="submit">${S.ai ? '✨ جهّز البطاقة' : 'التالي'}</button></div></form>`);
  if (way === 'excel')
    render(el, html`<form id="st-excel" class="st-text">
      <p class="small" style="margin:0">رتّب الأعمدة في Excel بهذا الترتيب: <b>الاسم، السعر، السعر قبل الخصم، الفئة، الوصف، رابط الشراء، رابط الصورة</b>. الاسم والسعر بس إجبارية. حدد الصفوف وانسخها (Ctrl+C) والصقها هنا، أو ارفع الملف محفوظ CSV.</p>
      <textarea name="rows" rows="6" placeholder="عطر عود كمبودي	289	349	عطور وبخور	ثبات عالي" aria-label="صفوف المنتجات" class="ltr" style="direction:rtl"></textarea>
      <div class="actions"><button class="btn btn-primary" type="submit">استورد</button><button class="btn" type="button" data-st="excel-file">📄 ارفع ملف CSV</button><button class="btn" type="button" data-st="excel-template">⬇️ نزّل النموذج</button></div>
      <div id="st-excel-out"></div>
    </form>`);
  el.querySelector('input,textarea')?.focus();
}

// ---------- استيراد من Excel: لصق مباشر (أعمدة بفاصل Tab) أو ملف CSV ----------
const XL_HEAD = ['الاسم', 'السعر', 'السعر قبل الخصم', 'الفئة', 'الوصف', 'رابط الشراء', 'رابط الصورة'];
function parseRows(text) {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const first = text.split('\n', 1)[0];
  const sep = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"' && !cell) q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some(Boolean));
}
const toNum = (v) => {
  const n = Number(String(v || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
function catOf(v) {
  v = String(v || '').trim();
  if (!v) return 'other';
  if (S.categories?.[v]) return v;
  const hit = Object.entries(S.categories || {}).find(([, l]) => l === v || l.includes(v) || v.includes(l.split(' ')[0]));
  return hit ? hit[0] : 'other';
}
async function importRows(text) {
  let rows = parseRows(text);
  if (rows.length && !toNum(rows[0][1])) rows = rows.slice(1); // سطر العناوين
  const out = $('st-excel-out');
  if (!rows.length) return toast('ما لقينا صفوف. تأكد إنك نسخت الخلايا من Excel', true);
  if (rows.length > 200) return toast('أقصى 200 منتج في المرة الوحدة', true);
  let done = 0;
  const errors = [];
  const step = () => render(out, html`<div class="st-progress"><div class="bar"><i style="width:${Math.round(((done + errors.length) / rows.length) * 100)}%"></i></div><span>${done + errors.length} من ${rows.length}${errors.length ? ` (تعذر ${errors.length})` : ''}</span></div>`);
  step();
  for (const [i, r] of rows.entries()) {
    const [title, price, old, cat, desc, buy, image] = r;
    try {
      if (!toNum(price)) throw new Error('السعر ناقص أو مو رقم');
      let img = {};
      if (/^https?:\/\//.test(image || '')) {
        try {
          const res = await fetch('/api/m/store/fetch-image?u=' + encodeURIComponent(image), { credentials: 'same-origin' });
          if (res.ok) img = await uploadImage(await shrink(await res.blob()));
        } catch { /* المنتج ينضاف بدون صورة */ }
      }
      await api('/api/m/store/products', { method: 'POST', body: { title, price: toNum(price), old_price: toNum(old), category: catOf(cat), description: desc || null, buy_url: buy || null, image_key: img.image_key ?? null, status: 'active', imported: true } });
      done++;
    } catch (e) {
      errors.push(`سطر ${i + 1}: ${title || '؟'} · ${e.message}`);
    }
    step();
  }
  toast(`انضاف ${done} منتج لمتجرك 🎉`);
  await loadStore();
  // نرجع لنفس الخطوة ونوري النتيجة والصفوف اللي ما انضافت
  wayBody('excel');
  render($('st-excel-out'), html`<p class="tip info" style="margin:0">✅ انضاف ${done} منتج${errors.length ? html`<br>تعذّر ${errors.length}:<br>${errors.slice(0, 10).map((x) => html`${x}<br>`)}` : ''}</p>`);
}
function excelTemplate() {
  const rows = [XL_HEAD, ['عطر عود كمبودي 50 مل', '289', '349', 'عطور وبخور', 'ثبات عالي وفوحان قوي', '', '']];
  const csv = rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'asalah-products.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function thinking(label) {
  render($('st-way-body'), html`<div class="st-thinking"><span class="st-dots" aria-hidden="true"><i></i><i></i><i></i></span>${label}</div>`);
}

async function aiDraft(body) {
  if (!S.ai) return {};
  try {
    return (await api('/api/m/store/ai', { method: 'POST', body })).draft;
  } catch (e) {
    toast(e.message, true);
    return {};
  }
}

async function startPhoto() {
  const file = await pickFile('image/*');
  if (!file) return;
  busy = true;
  try {
    thinking(S.ai ? 'الذكاء يشوف صورتك ويكتب البطاقة…' : 'نجهّز الصورة…');
    const blob = await shrink(file);
    const [img, ai] = await Promise.all([uploadImage(blob), S.ai ? toBase64(await shrink(file, 900)).then((b) => aiDraft({ image: b })) : {}]);
    draft = { ...img, ...ai, buy_url: S.store_url || '' };
    renderCompose();
    $('st-form').price.focus();
  } catch (e) {
    toast(e.message, true);
    wayBody(null);
  } finally {
    busy = false;
  }
}

async function fromLink(link) {
  thinking('نسحب بيانات المنتج من الرابط…');
  const p = (await api('/api/m/store/import', { method: 'POST', body: { url: link } })).product;
  let img = {};
  if (p.image) {
    try {
      const r = await fetch('/api/m/store/fetch-image?u=' + encodeURIComponent(p.image), { credentials: 'same-origin' });
      if (r.ok) img = await uploadImage(await shrink(await r.blob()));
    } catch {}
  }
  let ai = {};
  if (S.ai) {
    thinking('الذكاء يرتّب الوصف ويحدد الفئة…');
    ai = await aiDraft({ link: { title: p.title, description: p.description } });
  }
  draft = { title: ai.title || p.title, description: withHighlights(ai.description || p.description, ai.highlights), category: ai.category || 'other', price: p.price, old_price: p.old_price, buy_url: p.buy_url, ...img };
  renderCompose();
  if (!img.image_key) toast('ما قدرنا نجيب الصورة، أضفها بنفسك');
}

// مميزات قصيرة يقترحها الذكاء، تنضاف تحت الوصف
function withHighlights(desc, hl) {
  if (!hl?.length || !desc) return desc;
  return desc.trim() + '\n' + hl.map((x) => '✓ ' + x).join('\n');
}

async function fromText(text) {
  thinking('الذكاء يكتب البطاقة…');
  const ai = await aiDraft({ text });
  draft = { title: ai.title || text.slice(0, 60), description: withHighlights(ai.description || text, ai.highlights), category: ai.category || 'other', price: ai.price ?? undefined, old_price: ai.old_price ?? undefined, buy_url: ai.buy_url || S.store_url || '' };
  renderCompose();
}

async function saveDraft(form) {
  const f = Object.fromEntries(new FormData(form));
  const body = {
    title: f.title,
    price: f.price,
    old_price: f.old_price || null,
    category: f.category,
    buy_url: f.buy_url,
    description: f.description || null,
    status: f.active ? 'active' : 'hidden',
    image_key: draft.image_key ?? null,
  };
  if (draft.id) await api('/api/m/store/products/' + draft.id, { method: 'PATCH', body });
  else await api('/api/m/store/products', { method: 'POST', body });
  toast(draft.id ? 'تم حفظ المنتج' : 'تم نشر المنتج في متاجر أصالة 🎉');
  draft = null;
  await loadStore();
}

// ---------- سحب المنتجات من سلة: نقرأها، التاجر يعلّم، وبعدين ننشر ----------
const PRODUCT_LINK = /\/p\d{4,}(?:[/?#]|$)|\/products?\/[^/]+|\/product-[^/]+/i;
let pick = null; // { rows: [{ url, state: 'wait'|'load'|'ok'|'fail', p, on }], shown }
async function discover(input) {
  const el = $('st-sync-body');
  let u;
  try { u = new URL(input.trim()); } catch { return toast('الرابط غير صحيح', true); }
  render(el, html`<div class="st-thinking"><span class="st-dots" aria-hidden="true"><i></i><i></i><i></i></span>نقرأ ${PRODUCT_LINK.test(u.pathname) ? 'المنتج' : 'متجرك'}…</div>`);
  try {
    let links;
    if (PRODUCT_LINK.test(u.pathname)) links = [u.toString()];
    else {
      if (u.origin !== (S.store_url && new URL(S.store_url).origin)) await api('/api/m/store', { method: 'PATCH', body: { store_url: u.origin } });
      S.store_url = S.store_url || u.origin;
      const d = await api('/api/m/store/discover', { method: 'POST', body: { url: u.toString() } });
      links = d.links;
      if (!links.length) return render(el, html`<p class="tip good" style="margin:0">لقينا ${num(d.found)} منتج، وكلها مضافة عندك من قبل 👌</p>`);
    }
    pick = { rows: links.map((url) => ({ url, state: 'wait', p: null, on: true })), shown: 24 };
    drawPick();
    loadPick();
  } catch (e) {
    render(el, html`<p class="tip warn" style="margin:0">${e.message}</p>`);
  }
}
// نقرأ تفاصيل المنتجات الظاهرة، 4 مع بعض
async function loadPick() {
  const queue = pick.rows.slice(0, pick.shown).filter((r) => r.state === 'wait');
  const cur = pick;
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      if (cur !== pick) return;
      r.state = 'load';
      try {
        r.p = (await api('/api/m/store/import', { method: 'POST', body: { url: r.url } })).product;
        r.state = 'ok';
        if (!r.p.price) r.on = false;
      } catch {
        r.state = 'fail';
        r.on = false;
      }
      drawPick();
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
function drawPick() {
  const el = $('st-sync-body');
  if (!el || !pick) return;
  const vis = pick.rows.slice(0, pick.shown);
  const sel = pick.rows.filter((r) => r.on && r.state === 'ok').length;
  const loading = vis.filter((r) => r.state === 'wait' || r.state === 'load').length;
  render(el, html`<div class="st-pick">
    <div class="st-pick-bar"><b>${num(pick.rows.length)} منتج</b>${loading ? html`<span class="small muted">نقرأ… باقي ${num(loading)}</span>` : ''}
      <button class="btn btn-sm" type="button" data-st="pick-all">تحديد الكل</button><button class="btn btn-sm" type="button" data-st="pick-none">إلغاء التحديد</button></div>
    <div class="st-pick-list">${vis.map((r, i) => html`<label class="st-pick-row ${r.state}">
      <input type="checkbox" data-pick="${i}" ${raw(r.on ? 'checked' : '')} ${raw(r.state === 'ok' ? '' : 'disabled')}>
      <span class="st-pick-img">${r.p?.image ? html`<img src="${r.p.image}" alt="" loading="lazy" referrerpolicy="no-referrer">` : raw(r.state === 'fail' ? '⚠️' : '')}</span>
      <span class="st-pick-t"><b>${r.p?.title || (r.state === 'fail' ? 'ما قدرنا نقرأ هذا المنتج' : 'نقرأ…')}</b><small class="ltr">${decodeURI(r.url).replace(/^https?:\/\//, '').slice(0, 60)}</small></span>
      <span class="st-pick-p">${r.p?.price ? sar(r.p.price) : r.state === 'ok' ? html`<span class="small muted">بدون سعر</span>` : ''}</span>
    </label>`)}</div>
    ${pick.shown < pick.rows.length ? html`<button class="btn btn-sm" type="button" data-st="pick-more">اعرض ${num(Math.min(24, pick.rows.length - pick.shown))} منتج زيادة</button>` : ''}
    <div class="st-pick-go">
      ${S.ai ? html`<label class="check"><input type="checkbox" id="pick-ai" checked> ✨ الذكاء يرتّب الاسم والوصف ويحدد الفئة</label>` : ''}
      <button class="btn btn-gold" type="button" data-st="pick-publish" ${raw(sel ? '' : 'disabled')}>انشر المحدد (${num(sel)})</button>
    </div>
  </div>`);
}
async function publishPick() {
  const rows = pick.rows.filter((r) => r.on && r.state === 'ok');
  const useAi = S.ai && $('pick-ai')?.checked !== false;
  const el = $('st-sync-body');
  let done = 0, failed = 0;
  const step = () => render(el, html`<div class="st-progress"><div class="bar"><i style="width:${Math.round(((done + failed) / rows.length) * 100)}%"></i></div><span><b class="st-pct">${Math.round(((done + failed) / rows.length) * 100)}٪</b> ننشر المنتجات… ${done + failed} من ${rows.length}${failed ? ` (تعذر ${failed})` : ''}</span></div>`);
  step();
  for (const { p } of rows) {
    try {
      let img = {};
      if (p.image) {
        try {
          const r = await fetch('/api/m/store/fetch-image?u=' + encodeURIComponent(p.image), { credentials: 'same-origin' });
          if (r.ok) img = await uploadImage(await shrink(await r.blob()));
        } catch {}
      }
      const ai = useAi ? await aiDraft({ link: { title: p.title, description: p.description } }) : {};
      await api('/api/m/store/products', { method: 'POST', body: { title: ai.title || p.title, description: ai.description || p.description, category: ai.category || 'other', price: p.price, old_price: p.old_price || null, buy_url: p.buy_url, image_key: img.image_key ?? null, status: 'active', imported: true } });
      done++;
    } catch {
      failed++;
    }
    step();
  }
  pick = null;
  toast(`انضاف ${done} منتج لمتجرك 🎉`);
  await loadStore();
}

// ---------- القوائم ----------
// جدول المنتجات مثل لوحة سلة: بحث وفلترة وتحديد جماعي
const PF = { q: '', status: 'all', cat: 'all', sel: new Set() };
// جودة البطاقة: نصايح سريعة تخلي المنتج يبيع أكثر
function quality(p) {
  const tips = [];
  if (!p.image_url) tips.push('أضف صورة');
  if (!p.description || p.description.length < 60) tips.push('الوصف قصير');
  if (p.title.length < 8) tips.push('الاسم قصير');
  if (p.category === 'other') tips.push('حدد الفئة');
  if (!S.reels.some((r) => r.product_id === p.id)) tips.push('سوّ له ريل');
  return { score: Math.round(((5 - tips.length) / 5) * 100), tips };
}
function renderProducts() {
  const el = $('st-products');
  if (!S.products.length) return render(el, html`<div class="empty">ما أضفت منتجات للحين. اسحبها من سلة أو أضفها بصورة من فوق.</div>`);
  const cats = [...new Set(S.products.map((p) => p.category))];
  const weak = S.products.filter((p) => quality(p).tips.length > 1).length;
  const noReel = S.products.filter((p) => p.status === 'active' && !S.reels.some((r) => r.product_id === p.id)).length;
  render(el, html`${weak || noReel ? html`<div class="st-coach"><span aria-hidden="true">💡</span><div>
      ${weak ? html`<b>${num(weak)} منتج بطاقته تحتاج تحسين.</b> المنتج اللي وصفه كامل وصورته واضحة يجيب ضغطات أكثر. ` : ''}${noReel ? html`<span>${num(noReel)} منتج ما له ريل، والريل يضاعف المشاهدات.</span>` : ''}</div>
      ${weak ? html`<button class="btn btn-sm" type="button" data-st="show-weak">اعرضها</button>` : ''}</div>` : ''}
    <div class="st-tools">
      <input type="search" id="pf-q" placeholder="ابحث باسم المنتج…" value="${PF.q}" aria-label="ابحث في منتجاتك">
      <select id="pf-status" aria-label="الحالة"><option value="all">كل الحالات</option><option value="active" ${raw(PF.status === 'active' ? 'selected' : '')}>معروض</option><option value="hidden" ${raw(PF.status === 'hidden' ? 'selected' : '')}>مخفي</option><option value="tips" ${raw(PF.status === 'tips' ? 'selected' : '')}>يحتاج تحسين</option></select>
      <select id="pf-cat" aria-label="الفئة"><option value="all">كل الفئات</option>${cats.map((c) => html`<option value="${c}" ${raw(PF.cat === c ? 'selected' : '')}>${S.categories[c]}</option>`)}</select>
    </div>
    <div class="st-bulk" id="pf-bulk"></div>
    <div class="st-table" role="table" aria-label="منتجاتك">
      <div class="st-tr st-th" role="row"><span role="columnheader"><input type="checkbox" id="pf-all" aria-label="تحديد الكل"></span><span role="columnheader">المنتج</span><span role="columnheader">السعر</span><span role="columnheader">الأداء</span><span role="columnheader">البطاقة</span><span role="columnheader">معروض</span><span role="columnheader"></span></div>
      <div id="pf-rows"></div>
    </div>`);
  drawRows();
}
function drawRows() {
  const q = PF.q.trim().toLowerCase();
  const list = S.products.filter((p) => (!q || p.title.toLowerCase().includes(q)) && (PF.cat === 'all' || p.category === PF.cat) && (PF.status === 'all' || (PF.status === 'tips' ? quality(p).tips.length > 1 : p.status === PF.status)));
  render($('pf-rows'), list.length ? html`${list.map((p) => {
    const qy = quality(p);
    return html`<div class="st-tr ${p.status === 'hidden' ? 'off' : ''}" role="row">
      <span role="cell"><input type="checkbox" data-sel="${p.id}" ${raw(PF.sel.has(p.id) ? 'checked' : '')} aria-label="تحديد ${p.title}"></span>
      <span role="cell" class="st-td-p"><span class="st-td-img">${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : raw('🛍️')}</span><span><b>${p.title}</b><small class="muted">${S.categories[p.category]}${p.sync_error ? ' · ⚠️ ما تحدّث السعر' : ''}</small>${p.admin_blocked ? html`<small class="st-blocked">🚫 أوقفته إدارة أصالة، ما يظهر للعملاء</small>` : ''}</span></span>
      <span role="cell" class="st-td-price"><b>${sar(p.price)}</b>${p.old_price ? html`<s>${sar(p.old_price)}</s>` : ''}</span>
      <span role="cell" class="small muted">👁 ${num(p.views)} · 🛒 ${num(p.clicks)}${p.comments || p.rating_n ? html`<br><button class="st-link" type="button" data-st="p-comments" data-id="${p.id}">⭐ ${p.rating_n ? (p.rating_sum / p.rating_n).toFixed(1) : '–'} · 💬 ${num(p.comments)}</button>` : ''}</span>
      <span role="cell" class="st-q" title="${qy.tips.join('، ') || 'البطاقة كاملة'}"><i style="--q:${qy.score}%"></i><small>${qy.tips[0] || 'ممتازة ✓'}</small></span>
      <span role="cell"><label class="st-switch" aria-label="معروض في المتاجر"><input type="checkbox" data-live="${p.id}" ${raw(p.status === 'active' ? 'checked' : '')}><i></i></label></span>
      <span role="cell" class="st-td-acts"><button class="btn btn-sm" type="button" data-st="edit" data-id="${p.id}">تعديل</button>${S.ai ? html`<button class="btn btn-sm" type="button" data-st="ai-fix" data-id="${p.id}" title="الذكاء يحسّن الاسم والوصف">✨</button>` : ''}<button class="btn btn-sm btn-danger" type="button" data-st="del" data-id="${p.id}" aria-label="حذف">🗑</button></span>
    </div>`;
  })}` : html`<div class="empty">ما فيه منتجات بهالبحث</div>`);
  const n = PF.sel.size;
  render($('pf-bulk'), n ? html`<b>${num(n)} محدد</b><button class="btn btn-sm" type="button" data-st="bulk-show">إظهار</button><button class="btn btn-sm" type="button" data-st="bulk-hide">إخفاء</button>${S.ai ? html`<button class="btn btn-sm btn-gold" type="button" data-st="bulk-ai">✨ حسّن بالذكاء</button>` : ''}<button class="btn btn-sm btn-danger" type="button" data-st="bulk-del">حذف</button><button class="btn btn-sm" type="button" data-st="bulk-clear">إلغاء</button>` : raw(''));
  const all = $('pf-all');
  if (all) all.checked = list.length > 0 && list.every((p) => PF.sel.has(p.id));
}
// الذكاء يعيد كتابة الاسم والوصف والفئة لمنتج موجود
async function aiFix(p) {
  const ai = await aiDraft({ link: { title: p.title, description: p.description || '' } });
  if (!ai.title) return false;
  await api('/api/m/store/products/' + p.id, { method: 'PATCH', body: { title: ai.title, description: ai.description || p.description, category: ai.category || p.category } });
  return true;
}
async function bulk(act) {
  const ids = [...PF.sel];
  let n = 0;
  if (act === 'bulk-del' && !await confirmBox(`تحذف ${ids.length} منتج نهائياً؟`)) return;
  for (const id of ids) {
    const p = S.products.find((x) => x.id === id);
    if (!p) continue;
    toast(`نشتغل… ${++n} من ${ids.length}`);
    if (act === 'bulk-del') await api('/api/m/store/products/' + id, { method: 'DELETE' });
    else if (act === 'bulk-ai') await aiFix(p);
    else await api('/api/m/store/products/' + id, { method: 'PATCH', body: { status: act === 'bulk-show' ? 'active' : 'hidden' } });
  }
  PF.sel.clear();
  toast('تم ✅');
  await loadStore();
}

function renderReels() {
  const el = $('st-reels');
  if (!S.media) return render(el, html`<p class="tip info" style="margin:0">الريلز بتشتغل قريب. أصالة تجهّز مساحة تخزين الفيديو، وبعدها يطلع لك زر "ريل جديد".</p>`);
  if (!S.reels.length) return render(el, html`<div class="empty">ما رفعت ريلز للحين. ريل من 10 إلى ${S.reel_limits.max} ثانية عن منتجك يجيب لك مشاهدات أكثر 🔥</div>`);
  render(el, html`<div class="st-reels">${S.reels.map(
    (r) => html`<article class="st-reel ${r.status === 'hidden' ? 'off' : ''}">
      <div class="st-reel-media">${r.video_url ? html`<video data-rid="${r.id}" src="${r.video_url}${r.clip ? '#t=' + r.clip.start : ''}" poster="${r.poster_url || ''}" preload="${r.poster_url ? 'none' : 'metadata'}" playsinline></video><span class="st-tap" aria-hidden="true">▶</span>` : r.poster_url ? html`<img src="${r.poster_url}" alt="" loading="lazy">` : ''}<span class="st-dur">${r.duration} ث</span></div>
      ${r.admin_blocked ? html`<span class="small st-blocked">🚫 أوقفته إدارة أصالة</span>` : r.status === 'active' && r.publish_at && r.publish_at * 1000 > Date.now() ? html`<span class="small st-sched">⏰ ينزل ${new Date(r.publish_at * 1000).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} <button class="st-link" type="button" data-st="reel-now" data-id="${r.id}">انشره الحين</button></span>` : r.status === 'active' ? html`<a class="small" href="/stores/?v=reels&r=${r.id}" target="_blank" rel="noopener">✅ منشور في المتاجر ↗</a>` : r.status === 'uploading' ? html`<span class="small" style="color:var(--danger,#b42318)">⚠️ الفيديو ما وصل كامل. احذفه وارفعه مرة ثانية</span>` : html`<span class="small muted">مخفي عن المتاجر</span>`}
      <b>${r.title}</b>
      <div class="small muted">👁 ${num(r.views)} · 🛒 ${num(r.clicks)} · ❤️ ${num(r.likes || 0)} · 💬 ${num(r.comments || 0)}${r.rating ? ` · ⭐ ${r.rating.avg}` : ''}</div>
      <div class="actions">
        ${r.status === 'uploading' ? '' : html`<button class="btn btn-sm" type="button" data-st="reel-toggle" data-id="${r.id}">${r.status === 'hidden' ? 'إظهار' : 'إخفاء'}</button>`}
        ${r.comments || r.rating ? html`<button class="btn btn-sm" type="button" data-st="reel-comments" data-id="${r.id}">التعليقات</button>` : ''}
        <button class="btn btn-sm btn-danger" type="button" data-st="reel-del" data-id="${r.id}">حذف</button>
      </div>
    </article>`
  )}</div>`);
  for (const v of el.querySelectorAll('video[data-rid]')) {
    const r = S.reels.find((x) => x.id === Number(v.dataset.rid));
    bindClip(v, r.clip, r.duration);
    // ضغطة تشغّل وضغطة توقف
    v.parentElement.addEventListener('click', () => {
      if (v.paused) { v.muted = false; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); } else v.pause();
    });
    v.addEventListener('play', () => v.parentElement.classList.add('playing'));
    v.addEventListener('pause', () => v.parentElement.classList.remove('playing'));
  }
}

// ---------- محرر الريل ----------
function reelDialog(file, duration, original) {
  const dlg = Object.assign(document.createElement('dialog'), { className: 'st-reel-dlg' });
  const maxDur = Math.min(S.reel_limits.max, Math.floor(duration));
  render(dlg, html`<form method="dialog" class="st-editor">
    <div class="card-head"><h2>ريل جديد 🎬</h2><button class="btn btn-sm" type="button" data-x>إغلاق</button></div>
    <div class="st-ed-grid">
      <div class="st-stage-wrap">
        ${original ? html`<div class="st-stage st-clip" role="img" aria-label="معاينة الريل بمقاس 9:16"></div>` : html`<canvas class="st-stage" width="360" height="640" aria-label="معاينة الريل بمقاس 9:16"></canvas>`}
        <p class="small muted" style="margin:0;text-align:center">اسحب الفيديو بإصبعك عشان تختار الجزء اللي يظهر</p>
      </div>
      <div class="st-ed-side">
        <label class="field"><span>عنوان الريل ${S.ai ? html`<button class="btn btn-sm st-ai-mini" type="button" data-reel-ai>✨ اقترح لي</button>` : ''}</span><input name="title" required minlength="2" maxlength="90" placeholder="مثال: طريقة تحضير الشاي الأخضر"></label>
        <div class="st-ideas" data-ideas hidden></div>
        <label class="field">المنتج اللي يظهر تحت الريل<select name="product_id"><option value="">بدون منتج</option>${S.products.filter((p) => p.status === 'active').map((p) => html`<option value="${p.id}">${p.title}</option>`)}</select></label>
        <label class="field"><span>يبدأ من الثانية <b data-out="start">0</b></span><input name="start" type="range" min="0" max="${Math.max(0, Math.floor(duration - S.reel_limits.min))}" step="0.5" value="0"></label>
        <label class="field"><span>المدة <b data-out="dur">${maxDur}</b> ثانية <small class="muted">(من ${S.reel_limits.min} إلى ${S.reel_limits.max})</small></span><input name="dur" type="range" min="${S.reel_limits.min}" max="${maxDur}" step="1" value="${maxDur}"></label>
        <label class="field"><span>التكبير</span><input name="zoom" type="range" min="1" max="2.5" step="0.05" value="1"></label>
        <fieldset class="st-when"><legend>وقت النشر</legend>
          <label class="check"><input type="radio" name="when" value="now" checked> الحين</label>
          <label class="check"><input type="radio" name="when" value="later"> جدوله لوقت ثاني</label>
          <input name="at" type="datetime-local" class="ltr" hidden aria-label="وقت النشر">
        </fieldset>
        <div class="actions"><button class="btn" type="button" data-play>▶︎ شغّل المقطع</button><button class="btn btn-gold" type="submit">${original ? 'انشر الريل' : 'قص وانشر'}</button></div>
        <div class="st-progress" hidden><div class="bar"><i></i></div><span></span></div>
      </div>
    </div>
  </form>`);
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

async function newReel() {
  const file = await pickFile('video/*');
  if (!file) return;
  let duration;
  try {
    duration = await reelDuration(file);
  } catch {
    return toast('ما قدرنا نقرأ الفيديو، جرّب فيديو ثاني', true);
  }
  if (duration < S.reel_limits.min) return toast(`الفيديو لازم يكون ${S.reel_limits.min} ثواني على الأقل`, true);
  // الأساس: نرفع الفيديو الأصلي ونحفظ القص كأرقام (يشتغل على كل الجوالات).
  // لو الملف أكبر من الحد، نعيد تسجيله في المتصفح بحجم أصغر
  const original = file.size <= S.reel_limits.original_bytes;
  const dlg = reelDialog(file, duration, original);
  const form = dlg.querySelector('form');
  let editor;
  try {
    editor = await (original ? clipReel : cutReel)(file, dlg.querySelector('.st-stage'));
  } catch (err) {
    dlg.close(); dlg.remove();
    return toast(err.message || 'ما قدرنا نفتح الفيديو، جرّب فيديو ثاني', true);
  }
  const state = () => ({ start: Number(form.start.value), dur: Number(form.dur.value), zoom: Number(form.zoom.value) });
  const sync = () => {
    const s = state();
    if (s.start + s.dur > duration) form.start.value = Math.max(0, duration - s.dur);
    dlg.querySelector('[data-out=start]').textContent = Number(form.start.value).toFixed(1);
    dlg.querySelector('[data-out=dur]').textContent = s.dur;
    editor.set(state());
  };
  form.addEventListener('input', sync);
  sync();
  // جدولة: نقترح بكرة الساعة 8 المغرب (وقت ذروة المشاهدة)
  const at = form.at;
  const pad = (x) => String(x).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const tmr = new Date(Date.now() + 86400e3);
  tmr.setHours(20, 0, 0, 0);
  at.value = local(tmr);
  at.min = local(new Date(Date.now() + 5 * 60e3));
  at.max = local(new Date(Date.now() + 59 * 86400e3));
  form.addEventListener('change', (e) => { if (e.target.name === 'when') at.hidden = form.when.value !== 'later'; });
  let working = false;
  const close = () => { if (working) return; editor.dispose(); dlg.close(); dlg.remove(); };
  dlg.querySelector('[data-x]').addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.querySelector('[data-play]').addEventListener('click', () => editor.preview());
  // الذكاء يقترح عناوين من المنتج المختار
  dlg.querySelector('[data-reel-ai]')?.addEventListener('click', async (e) => {
    const p = S.products.find((x) => x.id === Number(form.product_id.value));
    if (!p) return toast('اختر المنتج اللي يظهر تحت الريل أول', true);
    const btn = e.currentTarget, box = dlg.querySelector('[data-ideas]');
    btn.disabled = true;
    btn.textContent = '✨ يفكر…';
    try {
      const { titles } = await api('/api/m/store/ai', { method: 'POST', body: { mode: 'reel', product: { title: p.title, description: p.description } } });
      render(box, html`${titles.map((x) => html`<button type="button" class="st-idea" data-idea>${x}</button>`)}`);
      box.hidden = !titles.length;
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
    btn.textContent = '✨ اقترح لي';
  });
  dlg.querySelector('[data-ideas]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-idea]');
    if (b) form.title.value = b.textContent;
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (working) return;
    if (!form.title.value.trim()) return form.title.focus();
    working = true;
    const btns = form.querySelectorAll('button');
    btns.forEach((b) => (b.disabled = true));
    const prog = dlg.querySelector('.st-progress');
    const bar = prog.querySelector('i'), label = prog.querySelector('span');
    prog.hidden = false;
    const step = (p, t) => { const n = Math.round(p * 100); bar.style.width = n + '%'; render(label, html`<b class="st-pct">${n}٪</b> ${t}`); };
    try {
      const s = state();
      let out;
      if (original) out = await editor.render(s);
      else {
        step(0, 'نقص الفيديو… خل الصفحة مفتوحة');
        out = await editor.render(s, (p) => step(p * 0.5, `نقص الفيديو… ${Math.round(p * s.dur)} من ${s.dur} ثانية`));
        if (out.video.size > S.reel_limits.bytes) throw new Error('الفيديو طلع كبير، قلل المدة');
      }
      const base = original ? 0 : 0.5;
      step(base, 'نجهّز الرفع…');
      let publish_at = null;
      if (form.when.value === 'later') {
        publish_at = Math.floor(new Date(form.at.value).getTime() / 1000);
        if (!publish_at || publish_at * 1000 < Date.now() + 60e3) throw new Error('اختر وقت نشر جاي');
      }
      const { id } = await api('/api/m/store/reels', { method: 'POST', body: { title: form.title.value, product_id: form.product_id.value ? Number(form.product_id.value) : null, duration: s.dur, poster: out.poster, clip: out.clip || null, publish_at } });
      const mb = (out.video.size / 1048576).toFixed(1);
      await upload(`/api/m/store/reels/${id}/video`, out.video, (p) => step(base + p * (1 - base) * 0.98, `نرفع الريل… ${(p * mb).toFixed(1)} من ${mb} ميجا. خل الصفحة مفتوحة`));
      step(1, 'تم! 🎉');
      working = false;
      close();
      toast(publish_at ? 'تمت الجدولة ⏰ الريل بينزل في وقته' : 'نُشر الريل في متاجر أصالة 🎬');
      await loadStore();
    } catch (err) {
      working = false;
      btns.forEach((b) => (b.disabled = false));
      // نخلي سبب الخطأ ظاهر داخل النافذة بدل ما ترجع كأن ما صار شي
      bar.style.width = '0';
      render(label, html`<span class="st-err">⚠️ ${err.message || 'صار خطأ، حاول مرة ثانية'}</span>`);
      toast(err.message || 'صار خطأ، حاول مرة ثانية', true);
    }
  });
}

// تعليقات الريل: التاجر يقراها ويحذف المسيء
async function reelComments(id, kind = 'reels') {
  const dlg = Object.assign(document.createElement('dialog'), { className: 'st-reel-dlg st-cm-dlg' });
  document.body.append(dlg);
  const draw = async () => {
    const { comments } = await api(`/api/m/store/${kind}/${id}/comments`);
    render(dlg, html`<div class="card-head"><h2>${kind === 'reels' ? 'تعليقات الريل' : 'تقييمات وتعليقات المنتج'} 💬</h2><button class="btn btn-sm" type="button" data-x>إغلاق</button></div>
      ${comments.length ? html`<div class="st-cm-list">${comments.map((c) => html`<div class="st-cm"><div><b>${c.name}</b> ${c.rating ? '⭐'.repeat(c.rating) : ''}<div class="small muted">${new Date(c.created_at * 1000).toLocaleString('ar-SA-u-nu-latn')}</div>${c.body ? html`<p>${c.body}</p>` : ''}
          ${c.reply ? html`<div class="st-reply"><b>ردك ✓</b> ${c.reply} <button class="st-link" type="button" data-unreply="${c.id}">حذف الرد</button></div>` : c.body ? html`<form class="st-reply-f" data-reply="${c.id}"><input name="reply" maxlength="300" required placeholder="اكتب ردك للعميل…" aria-label="ردك"><button class="btn btn-sm btn-primary" type="submit">رد</button></form>` : ''}</div>
        <button class="btn btn-sm btn-danger" type="button" data-del="${c.id}">حذف</button></div>`)}</div>` : html`<div class="empty">ما فيه تعليقات</div>`}`);
  };
  dlg.addEventListener('click', async (e) => {
    if (e.target.closest('[data-x]')) { dlg.close(); dlg.remove(); return loadStore(); }
    const d = e.target.closest('[data-del]');
    if (d && await confirmBox('تحذف التعليق؟')) { await api(`/api/m/store/${kind}/${id}/comments/${d.dataset.del}`, { method: 'DELETE' }); await draw(); }
    const u = e.target.closest('[data-unreply]');
    if (u && await confirmBox('تحذف ردك؟')) { await api(`/api/m/store/${kind}/${id}/comments/${u.dataset.unreply}`, { method: 'PATCH', body: { reply: null } }); await draw(); }
  });
  dlg.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-reply]');
    if (!f) return;
    e.preventDefault();
    f.querySelector('button').disabled = true;
    try {
      await api(`/api/m/store/${kind}/${id}/comments/${f.dataset.reply}`, { method: 'PATCH', body: { reply: f.reply.value } });
      toast('وصل ردك، ويظهر تحت تعليق العميل');
      await draw();
    } catch (err) { toast(err.message, true); f.querySelector('button').disabled = false; }
  });
  await draw();
  dlg.showModal();
}

function upload(path, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', path);
    x.setRequestHeader('Content-Type', /webm/.test(blob.type) ? 'video/webm' : 'video/mp4');
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText); } catch {}
      if (x.status >= 200 && x.status < 300) resolve(d);
      else reject(new Error(d.message || 'تعذر رفع الفيديو'));
    };
    x.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
    x.send(blob);
  });
}

// ---------- الأحداث ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-st]');
  if (!b || !$('store').contains(b) || busy) return;
  const act = b.dataset.st, id = Number(b.dataset.id);
  try {
    if (act === 'request') {
      b.disabled = true;
      toast((await api('/api/m/store/request', { method: 'POST' })).message);
    } else if (act === 'auto') {
      await api('/api/m/store', { method: 'PATCH', body: { store_auto_sync: b.checked } });
      toast(b.checked ? 'بنحدّث أسعارك تلقائياً من سلة' : 'وقفنا التحديث التلقائي');
    } else if (act === 'pick-all' || act === 'pick-none') {
      pick.rows.forEach((r) => { if (r.state === 'ok' && r.p.price) r.on = act === 'pick-all'; });
      drawPick();
    } else if (act === 'pick-more') {
      pick.shown += 24;
      drawPick();
      loadPick();
    } else if (act === 'pick-publish') await publishPick();
    else if (act === 'bulk-clear') { PF.sel.clear(); drawRows(); }
    else if (act === 'show-weak') {
      PF.status = 'tips';
      S.products.filter((p) => quality(p).tips.length > 1).forEach((p) => PF.sel.add(p.id));
      renderProducts();
    }
    else if (act.startsWith('bulk-')) await bulk(act);
    else if (act === 'ai-fix') {
      b.textContent = '…';
      if (await aiFix(S.products.find((x) => x.id === id))) toast('حسّنا البطاقة ✨');
      await loadStore();
    }
    else if (act === 'way') wayBody(b.dataset.way);
    else if (act === 'excel-template') excelTemplate();
    else if (act === 'excel-file') {
      const file = await pickFile('.csv,text/csv,text/plain');
      if (file) await importRows(await file.text());
    }
    else if (act === 'cancel') { draft = null; renderCompose(); }
    else if (act === 'img') {
      const file = await pickFile('image/*');
      if (!file) return;
      busy = true;
      Object.assign(draft, collect(), await uploadImage(await shrink(file)));
      renderCompose();
    } else if (act === 'rewrite') {
      busy = true;
      b.textContent = '✨ يكتب…';
      Object.assign(draft, collect());
      let body = { text: [draft.title, draft.description].filter(Boolean).join('\n') };
      if (draft.image_url) {
        const r = await fetch(draft.image_url);
        body.image = await toBase64(await shrink(await r.blob(), 900));
      }
      const ai = await aiDraft(body);
      Object.assign(draft, Object.fromEntries(Object.entries(ai).filter(([, v]) => v)));
      renderCompose();
    } else if (act === 'edit') {
      const p = S.products.find((x) => x.id === id);
      const key = p.image_url ? p.image_url.replace(/^\/img\//, '') : null;
      draft = { ...p, image_key: key };
      renderCompose();
      $('st-compose').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (act === 'toggle') {
      const p = S.products.find((x) => x.id === id);
      await api('/api/m/store/products/' + id, { method: 'PATCH', body: { status: p.status === 'hidden' ? 'active' : 'hidden' } });
      await loadStore();
    } else if (act === 'del') {
      if (!await confirmBox('تحذف المنتج نهائياً؟')) return;
      await api('/api/m/store/products/' + id, { method: 'DELETE' });
      toast('انحذف المنتج');
      await loadStore();
    } else if (act === 'stats') await loadStats(Number(b.dataset.days));
    else if (act === 'reel-now') {
      await api('/api/m/store/reels/' + id, { method: 'PATCH', body: { publish_at: null } });
      toast('نُشر الريل الحين 🎬');
      await loadStore();
    } else if (act === 'reel-new') await newReel();
    else if (act === 'reel-comments') await reelComments(id);
    else if (act === 'p-comments') await reelComments(id, 'products');
    else if (act === 'reel-toggle') {
      const r = S.reels.find((x) => x.id === id);
      await api('/api/m/store/reels/' + id, { method: 'PATCH', body: { status: r.status === 'hidden' ? 'active' : 'hidden' } });
      await loadStore();
    } else if (act === 'reel-del') {
      if (!await confirmBox('تحذف الريل نهائياً؟')) return;
      await api('/api/m/store/reels/' + id, { method: 'DELETE' });
      toast('انحذف الريل');
      await loadStore();
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    busy = false;
  }
});

// يحفظ اللي كتبه التاجر قبل ما نعيد رسم النموذج
function collect() {
  const form = $('st-form');
  if (!form) return {};
  const f = Object.fromEntries(new FormData(form));
  return { title: f.title, price: f.price, old_price: f.old_price, category: f.category, buy_url: f.buy_url, description: f.description, status: f.active ? 'active' : 'hidden' };
}

document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!$('store').contains(form)) return;
  e.preventDefault();
  if (busy) return;
  busy = true;
  const btn = form.querySelector('[type=submit]');
  if (btn) btn.disabled = true;
  try {
    if (form.id === 'st-salla') {
      await api('/api/m/store', { method: 'PATCH', body: { store_url: form.store_url.value } });
      toast('تم حفظ رابط متجرك');
      await loadStore();
    } else if (form.id === 'st-coupon') {
      await api('/api/m/store', { method: 'PATCH', body: { store_coupon: form.store_coupon.value.trim() || null, store_coupon_note: form.store_coupon_note.value.trim() || null } });
      toast('تم حفظ الكوبون');
      await loadStore();
    } else if (form.id === 'st-sync') await discover(form.store_url.value);
    else if (form.id === 'st-link') await fromLink(form.url.value);
    else if (form.id === 'st-text') await fromText(form.text.value);
    else if (form.id === 'st-excel') await importRows(form.rows.value);
    else if (form.id === 'st-form') await saveDraft(form);
  } catch (err) {
    toast(err.message, true);
    if (form.id === 'st-link' || form.id === 'st-text') wayBody(form.id === 'st-link' ? 'link' : 'text');
  } finally {
    busy = false;
    if (btn) btn.disabled = false;
  }
});

// تحديد المنتجات، والبحث والفلترة، ومفتاح العرض، وتحديد منتجات السحب
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (!$('store')?.contains(el)) return;
  if (el.dataset.pick != null && pick) { pick.rows[Number(el.dataset.pick)].on = el.checked; return drawPick(); }
  if (el.dataset.sel) { el.checked ? PF.sel.add(Number(el.dataset.sel)) : PF.sel.delete(Number(el.dataset.sel)); return drawRows(); }
  if (el.id === 'pf-all') {
    document.querySelectorAll('[data-sel]').forEach((c) => (el.checked ? PF.sel.add(Number(c.dataset.sel)) : PF.sel.delete(Number(c.dataset.sel))));
    return drawRows();
  }
  if (el.id === 'pf-status' || el.id === 'pf-cat') { PF[el.id === 'pf-status' ? 'status' : 'cat'] = el.value; return drawRows(); }
  if (el.dataset.live) {
    const p = S.products.find((x) => x.id === Number(el.dataset.live));
    try {
      await api('/api/m/store/products/' + p.id, { method: 'PATCH', body: { status: el.checked ? 'active' : 'hidden' } });
      p.status = el.checked ? 'active' : 'hidden';
      el.closest('.st-tr').classList.toggle('off', !el.checked);
      toast(el.checked ? 'المنتج معروض في المتاجر' : 'خفينا المنتج');
    } catch (err) { el.checked = !el.checked; toast(err.message, true); }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'pf-q') { PF.q = e.target.value; drawRows(); }
});

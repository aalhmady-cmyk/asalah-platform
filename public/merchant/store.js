// تبويب "متجري": التاجر يضيف منتجاته لمتاجر أصالة بالذكاء الاصطناعي، ويرفع ريلز بمقاس 9:16.
import { api, html, num, raw, render, toast } from '/assets/common.js';
import { cutReel, reelDuration } from '/merchant/reel.js';

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
    <div class="row" style="margin-top:24px">
      <form class="card" id="st-sync">
        <div class="card-head"><h2>🔄 اسحب كل منتجات متجرك</h2></div>
        <p class="small muted" style="margin:0">نقرأ منتجاتك من متجرك في سلة ونضيفها هنا مرة وحدة، مع الصور والأسعار. وتقدر تخلي الأسعار تتحدث لحالها.</p>
        <div class="st-inline"><input name="store_url" type="url" required class="ltr" value="${S.store_url || ''}" placeholder="https://your-store.salla.sa" aria-label="رابط متجرك"><button class="btn btn-primary" type="submit">ابحث عن منتجاتي</button></div>
        <label class="check"><input type="checkbox" name="auto" data-st="auto" ${S.auto_sync ? 'checked' : ''}> حدّث الأسعار تلقائياً من سلة (كل 12 ساعة)</label>
        <div id="st-sync-body"></div>
      </form>
      <form class="card" id="st-coupon">
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
        <label class="field">رابط المنتج في متجرك (سلة)<input name="buy_url" type="url" required class="ltr" value="${d.buy_url || ''}" placeholder="https://your-store.salla.sa/p/..."><small class="muted">لما يضغط العميل "اشتر الآن" يروح لهذا الرابط ويدفع في سلة.</small></label>
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
    render(el, html`<form id="st-text" class="st-text"><textarea name="text" rows="3" required maxlength="1500" placeholder="مثال: عطر عود كمبودي 50 مل، ثباته عالي، مناسب للمناسبات" aria-label="وصف المنتج"></textarea><div><button class="btn btn-primary" type="submit">${S.ai ? '✨ جهّز البطاقة' : 'التالي'}</button></div></form>`);
  el.querySelector('input,textarea')?.focus();
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
  draft = { title: ai.title || p.title, description: ai.description || p.description, category: ai.category || 'other', price: p.price, buy_url: p.buy_url, ...img };
  renderCompose();
  if (!img.image_key) toast('ما قدرنا نجيب الصورة، أضفها بنفسك');
}

async function fromText(text) {
  thinking('الذكاء يكتب البطاقة…');
  const ai = await aiDraft({ text });
  draft = { title: ai.title || text.slice(0, 60), description: ai.description || text, category: ai.category || 'other', buy_url: S.store_url || '' };
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

// ---------- سحب كل المنتجات ----------
let found = [];
async function discover(storeUrl) {
  const el = $('st-sync-body');
  render(el, html`<div class="st-thinking"><span class="st-dots" aria-hidden="true"><i></i><i></i><i></i></span>نقرأ متجرك…</div>`);
  try {
    if (storeUrl !== S.store_url) await api('/api/m/store', { method: 'PATCH', body: { store_url: storeUrl } });
    S.store_url = storeUrl;
    const d = await api('/api/m/store/discover', { method: 'POST', body: { url: storeUrl } });
    found = d.links;
    if (!found.length) return render(el, html`<p class="tip good" style="margin:0">لقينا ${num(d.found)} منتج، وكلها مضافة عندك من قبل 👌</p>`);
    render(el, html`<p class="tip info" style="margin:0">لقينا ${num(d.found)} منتج، منها ${num(found.length)} جديدة.</p>
      <div class="actions"><button class="btn btn-gold" type="button" data-st="import-all">أضف الـ ${num(found.length)} منتج</button></div>`);
  } catch (e) {
    render(el, html`<p class="tip warn" style="margin:0">${e.message}</p>`);
  }
}

async function importAll() {
  const el = $('st-sync-body');
  busy = true;
  let done = 0, failed = 0;
  const step = () => render(el, html`<div class="st-progress"><div class="bar"><i style="width:${Math.round(((done + failed) / found.length) * 100)}%"></i></div><span>نضيف المنتجات… ${done + failed} من ${found.length}${failed ? ` (تعذر ${failed})` : ''}</span></div>`);
  step();
  for (const link of found) {
    try {
      const p = (await api('/api/m/store/import', { method: 'POST', body: { url: link } })).product;
      if (!p.price) throw new Error('بدون سعر');
      let img = {};
      if (p.image) {
        try {
          const r = await fetch('/api/m/store/fetch-image?u=' + encodeURIComponent(p.image), { credentials: 'same-origin' });
          if (r.ok) img = await uploadImage(await shrink(await r.blob()));
        } catch {}
      }
      const ai = S.ai ? await aiDraft({ link: { title: p.title, description: p.description } }) : {};
      await api('/api/m/store/products', { method: 'POST', body: { title: ai.title || p.title, description: ai.description || p.description, category: ai.category || 'other', price: p.price, buy_url: p.buy_url, image_key: img.image_key ?? null, status: 'active', imported: true } });
      done++;
    } catch {
      failed++;
    }
    step();
  }
  busy = false;
  toast(`انضاف ${done} منتج لمتجرك 🎉`);
  found = [];
  await loadStore();
}

// ---------- القوائم ----------
function renderProducts() {
  const el = $('st-products');
  if (!S.products.length) return render(el, html`<div class="empty">ما أضفت منتجات للحين. ابدأ بصورة أو رابط من فوق.</div>`);
  render(el, html`<div class="st-grid">${S.products.map(
    (p) => html`<article class="st-card ${p.status === 'hidden' ? 'off' : ''}">
      <div class="st-thumb">${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : raw('<span aria-hidden="true">🛍️</span>')}${p.status === 'hidden' ? raw('<span class="pill">مخفي</span>') : ''}</div>
      <div class="st-body">
        <b>${p.title}</b>
        <div class="st-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s>` : ''}</div>
        <div class="small muted">${S.categories[p.category]} · 👁 ${num(p.views)} · 🛒 ${num(p.clicks)}</div>
        ${p.sync_error ? html`<div class="small" style="color:var(--red-ink)" title="${p.sync_error}">⚠️ ما قدرنا نحدّث السعر من سلة</div>` : ''}
        <div class="actions">
          <button class="btn btn-sm" type="button" data-st="edit" data-id="${p.id}">تعديل</button>
          <button class="btn btn-sm" type="button" data-st="toggle" data-id="${p.id}">${p.status === 'hidden' ? 'إظهار' : 'إخفاء'}</button>
          <button class="btn btn-sm btn-danger" type="button" data-st="del" data-id="${p.id}">حذف</button>
        </div>
      </div>
    </article>`
  )}</div>`);
}

function renderReels() {
  const el = $('st-reels');
  if (!S.media) return render(el, html`<p class="tip info" style="margin:0">الريلز بتشتغل قريب. أصالة تجهّز مساحة تخزين الفيديو، وبعدها يطلع لك زر "ريل جديد".</p>`);
  if (!S.reels.length) return render(el, html`<div class="empty">ما رفعت ريلز للحين. ريل من 10 إلى ${S.reel_limits.max} ثانية عن منتجك يجيب لك مشاهدات أكثر 🔥</div>`);
  render(el, html`<div class="st-reels">${S.reels.map(
    (r) => html`<article class="st-reel ${r.status === 'hidden' ? 'off' : ''}">
      <div class="st-reel-media">${r.poster_url ? html`<img src="${r.poster_url}" alt="" loading="lazy">` : ''}<span class="st-dur">${r.duration} ث</span></div>
      <b>${r.title}</b>
      <div class="small muted">👁 ${num(r.views)} · 🛒 ${num(r.clicks)}</div>
      <div class="actions">
        <button class="btn btn-sm" type="button" data-st="reel-toggle" data-id="${r.id}">${r.status === 'hidden' ? 'إظهار' : 'إخفاء'}</button>
        <button class="btn btn-sm btn-danger" type="button" data-st="reel-del" data-id="${r.id}">حذف</button>
      </div>
    </article>`
  )}</div>`);
}

// ---------- محرر الريل ----------
function reelDialog(file, duration) {
  const dlg = Object.assign(document.createElement('dialog'), { className: 'st-reel-dlg' });
  const maxDur = Math.min(S.reel_limits.max, Math.floor(duration));
  render(dlg, html`<form method="dialog" class="st-editor">
    <div class="card-head"><h2>ريل جديد 🎬</h2><button class="btn btn-sm" type="button" data-x>إغلاق</button></div>
    <div class="st-ed-grid">
      <div class="st-stage-wrap">
        <canvas class="st-stage" width="360" height="640" aria-label="معاينة الريل بمقاس 9:16"></canvas>
        <p class="small muted" style="margin:0;text-align:center">اسحب الفيديو بإصبعك عشان تختار الجزء اللي يظهر</p>
      </div>
      <div class="st-ed-side">
        <label class="field">عنوان الريل<input name="title" required minlength="2" maxlength="90" placeholder="مثال: طريقة تحضير الشاي الأخضر"></label>
        <label class="field">المنتج اللي يظهر تحت الريل<select name="product_id"><option value="">بدون منتج</option>${S.products.filter((p) => p.status === 'active').map((p) => html`<option value="${p.id}">${p.title}</option>`)}</select></label>
        <label class="field"><span>يبدأ من الثانية <b data-out="start">0</b></span><input name="start" type="range" min="0" max="${Math.max(0, Math.floor(duration - S.reel_limits.min))}" step="0.5" value="0"></label>
        <label class="field"><span>المدة <b data-out="dur">${maxDur}</b> ثانية <small class="muted">(من ${S.reel_limits.min} إلى ${S.reel_limits.max})</small></span><input name="dur" type="range" min="${S.reel_limits.min}" max="${maxDur}" step="1" value="${maxDur}"></label>
        <label class="field"><span>التكبير</span><input name="zoom" type="range" min="1" max="2.5" step="0.05" value="1"></label>
        <div class="actions"><button class="btn" type="button" data-play>▶︎ شغّل المقطع</button><button class="btn btn-gold" type="submit">قص وانشر</button></div>
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
  const dlg = reelDialog(file, duration);
  const form = dlg.querySelector('form');
  const editor = await cutReel(file, dlg.querySelector('.st-stage'));
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
  let working = false;
  const close = () => { if (working) return; editor.dispose(); dlg.close(); dlg.remove(); };
  dlg.querySelector('[data-x]').addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.querySelector('[data-play]').addEventListener('click', () => editor.preview());
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
    const step = (p, t) => { bar.style.width = Math.round(p * 100) + '%'; label.textContent = t; };
    try {
      const s = state();
      step(0, 'نقص الفيديو… خل الصفحة مفتوحة');
      const out = await editor.render(s, (p) => step(p * 0.7, `نقص الفيديو… ${Math.round(p * s.dur)} من ${s.dur} ثانية`));
      if (out.video.size > S.reel_limits.bytes) throw new Error('الفيديو طلع كبير، قلل المدة');
      step(0.72, 'نرفع الريل…');
      const { id } = await api('/api/m/store/reels', { method: 'POST', body: { title: form.title.value, product_id: form.product_id.value ? Number(form.product_id.value) : null, duration: s.dur, poster: out.poster } });
      await upload(`/api/m/store/reels/${id}/video`, out.video, (p) => step(0.72 + p * 0.28, `نرفع الريل… ${Math.round(p * 100)}٪`));
      step(1, 'تم! 🎉');
      working = false;
      close();
      toast('نُشر الريل في متاجر أصالة 🎬');
      await loadStore();
    } catch (err) {
      working = false;
      btns.forEach((b) => (b.disabled = false));
      prog.hidden = true;
      toast(err.message || 'صار خطأ، حاول مرة ثانية', true);
    }
  });
}

function upload(path, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', path);
    x.setRequestHeader('Content-Type', blob.type.split(';')[0] || 'video/mp4');
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
    } else if (act === 'import-all') await importAll();
    else if (act === 'way') wayBody(b.dataset.way);
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
      if (!confirm('تحذف المنتج نهائياً؟')) return;
      await api('/api/m/store/products/' + id, { method: 'DELETE' });
      toast('انحذف المنتج');
      await loadStore();
    } else if (act === 'reel-new') await newReel();
    else if (act === 'reel-toggle') {
      const r = S.reels.find((x) => x.id === id);
      await api('/api/m/store/reels/' + id, { method: 'PATCH', body: { status: r.status === 'hidden' ? 'active' : 'hidden' } });
      await loadStore();
    } else if (act === 'reel-del') {
      if (!confirm('تحذف الريل نهائياً؟')) return;
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
    else if (form.id === 'st-form') await saveDraft(form);
  } catch (err) {
    toast(err.message, true);
    if (form.id === 'st-link' || form.id === 'st-text') wayBody(form.id === 'st-link' ? 'link' : 'text');
  } finally {
    busy = false;
    if (btn) btn.disabled = false;
  }
});

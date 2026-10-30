// تبويب "متجري الخاص": مساعد يبني متجر التاجر برابط مستقل (بوت مجاني بالأزرار + ذكاء اصطناعي بالنقاط)،
// ومعاينة حية، ونشر وتراجع، ورابط وQR، وصفحات هبوط. وتبويب "طلبات العملاء" والسلات المتروكة.
import { api, html, num, raw, render, toast, when } from '/assets/common.js';
import qrcode from '/assets/vendor/qrcode.mjs';
import { confirmBox, formBox, promptBox } from '/assets/dialog.js';

const $ = (id) => document.getElementById(id);
let S = null; // بيانات المتجر من الخادم
let chat = []; // {role:'user'|'assistant', content, chips?}
let step = 'start';
let answers = {};
let busy = false;

const sar = (n) => (n == null ? '-' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س');

// ---------- قوالب البوت (بدون ذكاء اصطناعي) ----------
const PALETTES = {
  luxury: { label: 'فاخر 👑', colors: { primary: '#7a5a2b', accent: '#d9b45a', bg: '#15110c' }, card: 'glass' },
  modern: { label: 'عصري ⚡', colors: { primary: '#2563eb', accent: '#38bdf8', bg: '#0b1220' }, card: 'sharp' },
  simple: { label: 'بسيط وأنيق 🤍', colors: { primary: '#0e6b4e', accent: '#f2c94c', bg: '#1c2b26' }, card: 'soft' },
  soft: { label: 'ناعم 🌸', colors: { primary: '#b0688a', accent: '#f5c2d6', bg: '#2b1d27' }, card: 'soft' },
};
const AUDIENCE = { men: ['رجال 👔', 'للرجال'], women: ['نساء 👗', 'للنساء'], kids: ['أطفال 🧸', 'للأطفال'], all: ['الكل 👨‍👩‍👧', ''] };
const TEMPLATES = {
  perfume: {
    chip: 'عندي متجر عطور وبخور فاخر', theme: 'perfume', font: 'amiri', style: 'luxury',
    tagline: (a) => `عطور وبخور فاخرة ${a} بأصالة مضمونة`.replace(/\s+/g, ' '),
    announcement: '🎁 تغليف هدايا مجاني لكل طلب',
    titles: { perfume: 'العطور والبخور', beauty: 'العناية', accessories: 'الهدايا والإكسسوارات' },
    slides: (n) => [{ title: `${n}`, sub: 'روائح فاخرة تدوم، وكل زجاجة أصلية بعلامة أصالة', cta: 'اكتشف العطور' }, { title: 'دهن العود والبخور', sub: 'مختارة بعناية من أجود المصادر', cta: 'تسوّق البخور' }, { title: 'هدية تليق بمن تحب', sub: 'تغليف فاخر جاهز للإهداء', cta: 'اختر هديتك' }],
    about: (n) => `${n} متجر متخصص في العطور والبخور الفاخرة. كل منتج عندنا أصلي وموثّق بعلامة أصالة، تقدر تتحقق منه بلمسة جوال.`,
  },
  fashion: {
    chip: 'أبيع عبايات وملابس نسائية', theme: 'fashion', font: 'tajawal', style: 'soft',
    tagline: (a) => `أزياء وعبايات ${a || 'أنيقة'} بتفاصيل راقية`.replace(/\s+/g, ' '),
    announcement: '🚚 شحن سريع لكل مدن المملكة',
    titles: { fashion: 'العبايات والأزياء', accessories: 'الشنط والإكسسوارات', beauty: 'العناية' },
    slides: (n) => [{ title: 'تشكيلة الموسم', sub: 'قصّات راقية وخامات مريحة', cta: 'شوف التشكيلة' }, { title: n, sub: 'أصلية وموثّقة من أصالة', cta: 'تسوّقي الحين' }],
    about: (n) => `${n} يقدّم لك أزياء وعبايات بتصاميم أنيقة وخامات مختارة. كل قطعة أصلية وموثّقة بعلامة أصالة.`,
  },
  food: {
    chip: 'مطعم وأبي قائمة طلبات', theme: 'food', font: 'almarai', style: 'simple',
    tagline: () => 'اطلب أطباقك المفضلة بسهولة',
    announcement: '🛵 اطلب الحين وأكّد طلبك على واتساب',
    titles: { food: 'القائمة', coffee: 'المشروبات والقهوة' },
    slides: (n) => [{ title: `قائمة ${n}`, sub: 'أطباق طازجة كل يوم', cta: 'اطلب الحين' }, { title: 'عروض اليوم', sub: 'لا تفوّتها', cta: 'شوف العروض' }],
    about: (n) => `${n}: أطباق طازجة ومكونات مختارة. اختر طلبك وأكّده معنا على واتساب.`,
  },
  tech: {
    chip: 'أبيع إكسسوارات جوالات', theme: 'tech', font: 'almarai', style: 'modern',
    tagline: () => 'إكسسوارات أصلية لجوالك بضمان أصالة',
    announcement: '⚡ كل الشواحن والكيابل أصلية ومضمونة',
    titles: { electronics: 'الإكسسوارات', accessories: 'الكفرات والحماية', watches: 'الساعات الذكية' },
    slides: (n) => [{ title: 'شحن أسرع، حماية أقوى', sub: 'إكسسوارات أصلية بدون تقليد', cta: 'تسوّق الحين' }, { title: n, sub: 'كل منتج موثّق بعلامة أصالة', cta: 'شوف المنتجات' }],
    about: (n) => `${n} متخصص في إكسسوارات الجوالات الأصلية. ودّع الشواحن المقلّدة اللي تضر جوالك، كل منتج عندنا موثّق بعلامة أصالة.`,
  },
  general: {
    chip: null, theme: 'general', font: 'plex', style: 'simple',
    tagline: () => 'منتجات أصلية موثّقة من أصالة',
    announcement: '✅ كل منتجاتنا أصلية وموثّقة بعلامة أصالة',
    titles: {},
    slides: (n) => [{ title: n, sub: 'منتجات أصلية بضمان أصالة', cta: 'تسوّق الحين' }],
    about: (n) => `${n}: منتجات أصلية وموثّقة بعلامة أصالة، تتحقق منها بلمسة جوال.`,
  },
};
const HELP = [['العطور والجمال', 'perfume'], ['الموضة والأزياء', 'fashion'], ['الأكل والقهوة', 'food'], ['التقنية والجوالات', 'tech'], ['شي ثاني', 'general']];
const SHIPPING = ['🚚 شحن لكل مدن المملكة خلال 2 إلى 5 أيام', '🛵 توصيل داخل المدينة في نفس اليوم', '🏬 استلام من المحل', '🚚 شحن للمملكة + 🛵 توصيل داخل المدينة'];
const COUPONS = [['خصم 10٪ (OPEN10)', { code: 'OPEN10', percent: 10, note: 'خصم الافتتاح' }], ['خصم 15٪ (OPEN15)', { code: 'OPEN15', percent: 15, note: 'خصم الافتتاح' }], ['بدون كود', null]];
const IDLE_CHIPS = [['👀 افتح المعاينة', 'preview'], ['🎨 غيّر الألوان', 'style'], ['✏️ غيّر الاسم', 'name'], ['🚚 الشحن', 'shipping'], ['🎁 كود الخصم', 'coupon'], ['🔁 ابدأ من جديد', 'restart']];

function buildDraft() {
  const t = TEMPLATES[answers.kind] || TEMPLATES.general;
  const pal = PALETTES[answers.style || t.style];
  const name = answers.name || S.draft.name;
  const aud = AUDIENCE[answers.audience]?.[1] || '';
  const cats = [...new Set(S.products.map((p) => p.category))];
  const sections = cats.map((c) => ({ title: t.titles[c] || S.categories?.[c] || c, category: c }));
  return {
    name,
    tagline: t.tagline(aud),
    announcement: t.announcement,
    about: t.about(name),
    theme: t.theme,
    font: t.font,
    colors: pal.colors,
    card: pal.card,
    slides: t.slides(name),
    sections,
    checkout: answers.checkout || S.draft.checkout,
    whatsapp: answers.whatsapp ?? S.draft.whatsapp,
    shipping: answers.shipping ?? S.draft.shipping,
    payment: (answers.checkout || S.draft.checkout) === 'salla' ? 'الدفع في متجرنا على سلة (مدى، فيزا، Apple Pay، تمارا وتابي حسب المتاح)' : 'نأكد طلبك على واتساب ونرسل لك طريقة الدفع (تحويل أو دفع عند الاستلام حسب المتاح)',
    coupon: answers.coupon === undefined ? S.draft.coupon : answers.coupon,
    view: answers.view || S.draft.view,
  };
}

// ---------- المحادثة ----------
const bot = (content, chips = []) => chat.push({ role: 'assistant', content, chips });
const me = (content) => chat.push({ role: 'user', content });

function ask(next) {
  step = next;
  const n = S.merchant.name;
  if (next === 'start') bot(`هلا والله 👋 أنا مساعدك لبناء متجرك.\nقولي وش تبيع ولمين، وأنا أجهز لك المتجر كامل: الاسم والهوية والألوان، الأقسام، سلايدر بتصميم خاص، الشحن والدفع، وكود خصم للافتتاح.\nكل شيء تراجعه قبل ما يتطبق ✅`, [...Object.entries(TEMPLATES).filter(([, t]) => t.chip).map(([k, t]) => [t.chip, 'kind:' + k]), ['ما عندي فكرة، ساعدني أختار نشاط', 'help']]);
  if (next === 'help') bot('ولا يهمك 👌 وش أكثر مجال تحبه أو عندك فيه خبرة؟', HELP.map(([l, k]) => [l, 'kind:' + k]));
  if (next === 'name') bot('وش اسم متجرك؟ اكتبه تحت، أو استخدم اسمك المسجل.', [[`استخدم "${n}"`, 'name:' + n]]);
  if (next === 'audience') bot('مين عملاءك أكثر شي؟', Object.entries(AUDIENCE).map(([k, [l]]) => [l, 'aud:' + k]));
  if (next === 'style') bot('اختر الإحساس اللي تبيه لمتجرك:', Object.entries(PALETTES).map(([k, p]) => [p.label, 'style:' + k]));
  if (next === 'checkout') bot('لما يضغط العميل "شراء"، وين تبيه يروح؟\n(طلبه ينحفظ عندك في "طلبات العملاء" بكل الحالات)', [['💬 واتساب برقم الطلب', 'co:whatsapp'], ['🛒 متجري في سلة', 'co:salla']]);
  if (next === 'whatsapp') bot('اكتب رقم واتساب اللي تستقبل عليه الطلبات (مثال 05xxxxxxxx).', S.merchant.whatsapp ? [[`استخدم ${S.merchant.whatsapp}`, 'wa:' + S.merchant.whatsapp]] : []);
  if (next === 'shipping') bot('كيف توصّل طلباتك؟', SHIPPING.map((s, i) => [s, 'ship:' + i]));
  if (next === 'coupon') bot('تبي كود خصم للافتتاح؟ يشجع أول العملاء يطلبون 🎁', COUPONS.map(([l], i) => [l, 'cp:' + i]));
  if (next === 'view') bot('آخر سؤال: وش أول شي يشوفه العميل لما يدخل متجرك؟', [['🕶️ المعرض ثلاثي الأبعاد', 'view:3d'], ['▦ العرض العادي', 'view:grid']]);
  if (next === 'idle') bot('تبي تعدّل شي ثاني؟ اختر من تحت، أو اكتب طلبك بكلامك والذكاء الاصطناعي يتولى الأمر ✨', IDLE_CHIPS.map(([l, k]) => [l, 'edit:' + k]));
}

const FLOW = ['name', 'audience', 'style', 'checkout', 'shipping', 'coupon', 'view'];
let editing = false; // تعديل خطوة وحدة من وضع الانتظار

async function after(cur) {
  if (editing) {
    editing = false;
    await saveBuilt('تم التعديل ✅ شوف المعاينة.');
    return ask('idle');
  }
  if (cur === 'checkout' && answers.checkout === 'whatsapp') return ask('whatsapp');
  const from = cur === 'whatsapp' ? 'checkout' : cur;
  const i = FLOW.indexOf(from);
  if (i >= 0 && i < FLOW.length - 1) return ask(FLOW[i + 1]);
  await saveBuilt('جاهز 🎉 جهّزت لك المتجر كامل: الاسم والألوان والأقسام والسلايدر والشحن والخصم.\nشوف المعاينة، وإذا عجبك اضغط "🚀 انشر المتجر".');
  ask('idle');
}

async function saveBuilt(msg) {
  const d = await api('/api/m/site/draft', { method: 'PUT', body: { draft: buildDraft() } });
  S.draft = d.draft;
  S.can_undo = d.can_undo;
  S.dirty = true;
  bot(msg, [['👀 افتح المعاينة', 'preview'], ['🚀 انشر المتجر', 'publish']]);
  refreshPreview();
}

async function onChip(v) {
  if (busy) return;
  const [k, val] = [v.split(':')[0], v.slice(v.indexOf(':') + 1)];
  const label = chat.flatMap((m) => m.chips || []).find((c) => c[1] === v)?.[0];
  if (label && !['preview', 'publish'].includes(k)) me(label);
  try {
    busy = true;
    if (k === 'kind') { answers.kind = val; ask('name'); }
    else if (k === 'help') ask('help');
    else if (k === 'name') { answers.name = val; await after('name'); }
    else if (k === 'aud') { answers.audience = val; await after('audience'); }
    else if (k === 'style') { answers.style = val; await after('style'); }
    else if (k === 'co') { answers.checkout = val; if (val === 'salla' && !S.merchant.store_url) bot('ملاحظة: المنتجات اللي ما لها رابط سلة، طلبها يتأكد على واتساب تلقائياً.'); await after('checkout'); }
    else if (k === 'wa') { answers.whatsapp = val; await after('whatsapp'); }
    else if (k === 'ship') { answers.shipping = SHIPPING[Number(val)]; await after('shipping'); }
    else if (k === 'cp') { answers.coupon = COUPONS[Number(val)][1]; await after('coupon'); }
    else if (k === 'view') { answers.view = val; await after('view'); }
    else if (k === 'preview') window.open(`/s/${S.merchant.slug}?preview=1`, '_blank', 'noopener');
    else if (k === 'publish') await publish();
    else if (k === 'edit') {
      if (val === 'restart') { answers = {}; editing = false; ask('start'); }
      else { if (!answers.kind) answers.kind = S.draft.theme; editing = true; ask(val); }
    }
  } catch (e) {
    toast(e.message, true);
  } finally {
    busy = false;
    drawChat();
  }
}

// نص حر: لو البوت ينتظر جواب (اسم أو رقم) ياخذه مجاناً، وإلا يروح للذكاء الاصطناعي
async function onText(text) {
  if (busy) return;
  me(text);
  try {
    busy = true;
    if (step === 'name') { answers.name = text.slice(0, 60); await after('name'); return; }
    if (step === 'whatsapp') {
      const d = text.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
      if (!/^(9665\d{8}|05\d{8}|5\d{8})$/.test(d)) { bot('الرقم مو واضح 🤔 اكتبه بهالشكل: 05xxxxxxxx'); return; }
      answers.whatsapp = d;
      await after('whatsapp');
      return;
    }
    if (!S.ai_enabled) { bot('هذا الطلب يحتاج المساعد الذكي، وهو غير مفعّل حالياً. استخدم الأزرار أو "تعديل يدوي" تحت 👇', IDLE_CHIPS.map(([l, k]) => [l, 'edit:' + k])); return; }
    if (S.credits.balance < 1) { bot('خلصت نقاط المساعد الذكي 🙏 تقدر تكمل بالأزرار مجاناً، أو تشحن نقاط من تحت.', IDLE_CHIPS.map(([l, k]) => [l, 'edit:' + k])); return; }
    drawChat(true);
    const history = chat.slice(0, -1).filter((m) => m.content).map((m) => ({ role: m.role, content: m.content })).slice(-8);
    const d = await api('/api/m/site/ai', { method: 'POST', body: { message: text, history } });
    S.credits.balance = d.balance;
    S.draft = d.draft;
    S.can_undo = d.can_undo;
    if (d.changed) { S.dirty = true; refreshPreview(); }
    bot(d.reply, d.changed ? [['👀 افتح المعاينة', 'preview'], ['🚀 انشر المتجر', 'publish']] : []);
    step = 'idle';
  } catch (e) {
    chat.pop();
    toast(e.message, true);
  } finally {
    busy = false;
    drawChat();
    drawBar();
  }
}

function drawChat(typing) {
  const log = $('sb-log');
  if (!log) return;
  const lastBot = chat.map((m) => m.role).lastIndexOf('assistant');
  render(log, html`${chat.map((m, i) => html`<div class="sb-row ${m.role === 'user' ? 'me' : 'bot'}">${m.role === 'user' ? '' : raw('<span class="sb-ava">✦</span>')}<div class="sb-msg">${m.content}</div></div>
    ${m.chips?.length && i === lastBot && !typing ? html`<div class="sb-chips">${m.chips.map(([l, v]) => html`<button type="button" data-chip="${v}">${l}</button>`)}</div>` : ''}`)}
    ${typing ? raw('<div class="sb-row bot"><span class="sb-ava">✦</span><div class="sb-msg sb-typing"><i></i><i></i><i></i></div></div>') : ''}`);
  log.scrollTop = log.scrollHeight;
}

// ---------- الواجهة ----------
export async function loadSite() {
  S = await api('/api/m/site');
  S.categories = (await api('/api/m/store').catch(() => ({}))).categories || {};
  const root = $('site');
  if (!S.enabled) {
    render(root, html`<div class="page-head"><div><h1>متجري الخاص 🏪</h1><p>متجر برابط خاص فيك، بمعرض ثلاثي الأبعاد وطلبات تجيك على واتساب.</p></div></div>
      <div class="card" style="margin-top:24px;max-width:640px"><h2>فعّل متاجر أصالة أولاً</h2><p class="muted">المتجر الخاص يعرض منتجاتك اللي في متاجر أصالة. اطلب التفعيل من قسم «منتجاتي في متاجر أصالة 🛍️».</p><div><button class="btn btn-primary" type="button" data-go-tab="store">روح لقسم منتجاتي</button></div></div>`);
    root.querySelector('[data-go-tab]').onclick = () => document.querySelector('#nav [data-tab="store"]').click();
    return;
  }
  render(root, html`
    <div class="page-head">
      <div><h1>متجري الخاص 🏪</h1><p>متجرك برابطك الخاص ومعرض ثلاثي الأبعاد، ومنتجاتك تظهر بنفس الوقت في متاجر أصالة.</p></div>
      <div class="actions"><span id="sb-state"></span><a class="btn" id="sb-open" target="_blank" rel="noopener">👀 معاينة ↗</a></div>
    </div>
    <div class="sb-grid">
      <div class="card sb-chat">
        <div class="sb-log" id="sb-log" aria-live="polite"></div>
        <form class="sb-form" id="sb-form"><textarea name="q" rows="2" maxlength="800" placeholder="اكتب عن مشروعك… مثال: عندي متجر عطور وبخور فاخر للرجال"></textarea><button class="btn btn-primary" type="submit" aria-label="إرسال">➤</button></form>
        <div class="sb-credit" id="sb-credit"></div>
        <div class="sb-bar" id="sb-bar"></div>
      </div>
      <div class="sb-side">
        <div class="sb-phone"><iframe id="sb-frame" title="معاينة المتجر" loading="lazy"></iframe></div>
        <div class="card sb-can">
          <h2>ماذا يستطيع المساعد؟</h2>
          <ul><li>🏷️ اسم المتجر والوصف والنبذة وشريط الإعلان</li><li>🎨 الألوان والخط وشكل الهيدر والبطاقات</li><li>🗂️ الأقسام حسب منتجاتك</li><li>🖼️ سلايدر بتصميم خاص بألوان متجرك</li><li>🚚 الشحن، 💳 طريقة الشراء، 🎁 كود خصم للافتتاح</li><li>🕶️ معرض ثلاثي الأبعاد حسب نوع نشاطك</li><li>📄 صفحة هبوط لكل منتج تنفع للإعلانات</li></ul>
          <p class="small muted" style="margin:0">الأزرار مجانية. الكتابة الحرة يرد عليها الذكاء الاصطناعي بنقطة لكل رد.</p>
        </div>
      </div>
    </div>
    <div class="kpis sb-kpis" id="sb-kpis" style="margin-top:24px"></div>
    <div class="row" style="margin-top:24px">
      <div class="card" id="sb-share"></div>
      <details class="card wide sb-manual" id="sb-manual"><summary><h2 style="display:inline">✏️ تعديل يدوي (مجاني)</h2></summary><form id="sb-manual-form"></form></details>
    </div>
    <div class="card" style="margin-top:24px"><div class="card-head"><h2>📄 صفحات الهبوط</h2><span class="small muted">صفحة لكل منتج تنفع لإعلانات سناب وتيك توك وواتساب</span></div><div id="sb-landings"></div></div>`);

  $('sb-open').href = `/s/${S.merchant.slug}?preview=1`;
  $('sb-log').addEventListener('click', (e) => { const b = e.target.closest('[data-chip]'); if (b) onChip(b.dataset.chip); });
  const form = $('sb-form');
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = form.q.value.trim(); if (!q) return; form.q.value = ''; onText(q); });
  form.q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  if (!chat.length) {
    if (S.published || S.draft.theme !== 'general') { answers.kind = S.draft.theme; bot(`هلا ${S.merchant.name} 👋 متجرك ${S.published ? 'منشور' : 'جاهز كمسودة'}.`); ask('idle'); }
    else ask('start');
  }
  drawChat();
  drawBar();
  drawShare();
  drawManual();
  drawLandings();
  refreshPreview();
}

function drawBar() {
  const st = $('sb-state');
  if (!st) return;
  render(st, S.published ? html`<span class="pill ok">منشور</span>${S.dirty ? html` <span class="pill warn">تعديلات غير منشورة</span>` : ''}` : html`<span class="pill warn">مسودة، غير منشور</span>`);
  render($('sb-kpis'), html`
    <div class="kpi"><span class="label">زيارات متجرك</span><span class="value">${num(S.stats.views)}</span></div>
    <div class="kpi"><span class="label">الطلبات</span><span class="value">${num(S.stats.orders)}</span>${S.stats.new ? html`<span class="note">${num(S.stats.new)} جديد</span>` : ''}</div>
    <div class="kpi"><span class="label">سلات متروكة</span><span class="value">${num(S.stats.abandoned)}</span></div>
    <div class="kpi"><span class="label">منتجاتك المعروضة</span><span class="value">${num(S.products.length)}</span></div>`);
  render($('sb-credit'), html`<span>يستهلك كل رد من الذكاء الاصطناعي نقطة وحدة. رصيدك: <b>${num(S.credits.balance)}</b> نقطة</span><button type="button" class="btn btn-sm" id="sb-topup">⚡ اشحن نقاط</button>`);
  render($('sb-bar'), html`<button type="button" class="btn" id="sb-undo" ${raw(S.can_undo ? '' : 'disabled')}>↩️ تراجع</button><button type="button" class="btn btn-gold" id="sb-publish">🚀 ${S.published ? 'انشر التعديلات' : 'انشر المتجر'}</button>${S.published ? html`<button type="button" class="btn btn-danger btn-sm" id="sb-unpublish">إيقاف المتجر</button>` : ''}`);
  $('sb-undo').onclick = async () => {
    try {
      const d = await api('/api/m/site/undo', { method: 'POST' });
      S.draft = d.draft; S.can_undo = d.can_undo; S.dirty = true;
      toast('رجّعنا آخر تعديل');
      drawBar(); drawManual(); refreshPreview();
    } catch (e) { toast(e.message, true); }
  };
  $('sb-publish').onclick = () => publish().catch((e) => toast(e.message, true));
  if ($('sb-unpublish')) $('sb-unpublish').onclick = async () => {
    if (!await confirmBox('توقف متجرك الخاص؟ الرابط بيطلع للعملاء "غير متاح" لين تنشره مرة ثانية.')) return;
    try { toast((await api('/api/m/site/unpublish', { method: 'POST' })).message); S.published = false; drawBar(); drawShare(); } catch (e) { toast(e.message, true); }
  };
  $('sb-topup').onclick = topup;
}

async function publish() {
  if (!S.products.length && !await confirmBox('ما عندك منتجات معروضة للحين. تنشر المتجر فاضي؟ (أضف منتجاتك من قسم «منتجاتي في متاجر أصالة 🛍️»)')) return;
  const d = await api('/api/m/site/publish', { method: 'POST' });
  S.published = true;
  S.dirty = false;
  toast(d.message);
  bot(`تم النشر 🎉 رابط متجرك:\n${d.url}\nشاركه مع عملائك، وتلقى الـQR تحت للطباعة.`);
  drawChat(); drawBar(); drawShare();
}

function topup() {
  const dlg = document.createElement('dialog');
  dlg.className = 'sb-dialog';
  render(dlg, html`<form method="dialog"><h2>⚡ اشحن نقاط المساعد</h2><p class="small muted">اختر الباقة، ويوصل طلبك لإدارة أصالة يتواصلون معك للدفع ويضيفون النقاط. (لين يتوفر الدفع الإلكتروني في أصالة)</p>
    <div class="sb-packs">${S.credits.packs.map((p, i) => html`<label><input type="radio" name="pack" value="${i}" ${raw(i === 1 ? 'checked' : '')}><span><b>${num(p.points)} نقطة</b><small>${num(p.price)} ريال</small></span></label>`)}</div>
    <div class="actions"><button class="btn btn-gold" value="send">أرسل الطلب</button><button class="btn" value="cancel">إلغاء</button></div></form>`);
  document.body.append(dlg);
  dlg.addEventListener('close', async () => {
    const pack = dlg.querySelector('input[name=pack]:checked')?.value;
    if (dlg.returnValue === 'send' && pack != null) {
      try { toast((await api('/api/m/site/credits/request', { method: 'POST', body: { pack: Number(pack) } })).message); } catch (e) { toast(e.message, true); }
    }
    dlg.remove();
  });
  dlg.showModal();
}

let frameTimer;
function refreshPreview() {
  clearTimeout(frameTimer);
  frameTimer = setTimeout(() => {
    const f = $('sb-frame');
    if (f) f.src = `/s/${S.merchant.slug}?preview=1&embed=1&t=${Date.now()}`;
  }, 300);
}

function qrSvg(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
}

function drawShare() {
  const el = $('sb-share');
  if (!el) return;
  if (!S.published) {
    render(el, html`<h2>🔗 رابط متجرك</h2><p class="muted" style="margin:0">انشر المتجر أول، ويطلع لك الرابط والـQR هنا.</p><code class="ltr sb-url">${S.url}</code>`);
    return;
  }
  const wa = 'https://wa.me/?text=' + encodeURIComponent(`تسوّق من ${S.draft.name}، منتجات أصلية موثّقة من أصالة 👇\n${S.url}`);
  render(el, html`<h2>🔗 رابط متجرك</h2><code class="ltr sb-url">${S.url}</code>
    <div class="actions"><button type="button" class="btn btn-sm" id="sb-copy">📋 نسخ</button><a class="btn btn-sm" href="${wa}" target="_blank" rel="noopener">💬 شارك واتساب</a><a class="btn btn-sm" href="${S.url}" target="_blank" rel="noopener">فتح ↗</a></div>
    <div class="sb-qr" id="sb-qr">${raw(qrSvg(S.url))}</div>
    <div class="actions"><button type="button" class="btn btn-sm" id="sb-qr-dl">⬇️ نزّل الـQR</button><button type="button" class="btn btn-sm" id="sb-qr-print">🖨️ اطبع</button></div>`);
  $('sb-copy').onclick = () => navigator.clipboard.writeText(S.url).then(() => toast('تم النسخ'), () => toast(S.url));
  $('sb-qr-dl').onclick = () => {
    const blob = new Blob([$('sb-qr').innerHTML], { type: 'image/svg+xml' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `qr-${S.merchant.slug}.svg` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('sb-qr-print').onclick = () => {
    const w = window.open('', '_blank');
    if (!w) return toast('اسمح بالنوافذ المنبثقة', true);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>QR</title><body style="font-family:sans-serif;text-align:center;padding:40px" dir="rtl"><h1>${S.draft.name.replace(/</g, '')}</h1><div style="width:320px;margin:auto">${qrSvg(S.url)}</div><p style="font-size:20px">امسح وتسوّق منتجات أصلية موثّقة ✅</p><p dir="ltr">${S.url}</p></body>`);
    w.document.close();
    w.print();
  };
}

function drawManual() {
  const f = $('sb-manual-form');
  if (!f) return;
  const d = S.draft;
  const opt = (map, v) => Object.entries(map).map(([k, l]) => html`<option value="${k}" ${raw(k === v ? 'selected' : '')}>${l}</option>`);
  render(f, html`
    <div class="form-grid">
      <label class="field">اسم المتجر<input name="name" maxlength="60" required value="${d.name}"></label>
      <label class="field">الجملة تحت الاسم<input name="tagline" maxlength="140" value="${d.tagline || ''}"></label>
    </div>
    <label class="field">شريط الإعلان<input name="announcement" maxlength="140" value="${d.announcement || ''}"></label>
    <label class="field">نبذة عن المتجر<textarea name="about" rows="3" maxlength="1200">${d.about || ''}</textarea></label>
    <div class="form-grid">
      <label class="field">نوع المعرض<select name="theme">${opt(S.themes, d.theme)}</select></label>
      <label class="field">الخط<select name="font">${opt(S.fonts, d.font)}</select></label>
      <label class="field">شكل البطاقات<select name="card">${opt({ soft: 'ناعم', sharp: 'حاد', glass: 'زجاجي' }, d.card)}</select></label>
      <label class="field">أول ما يدخل العميل<select name="view">${opt({ '3d': 'المعرض ثلاثي الأبعاد', grid: 'العرض العادي' }, d.view)}</select></label>
    </div>
    <div class="form-grid sb-colors">
      <label class="field">اللون الأساسي<input type="color" name="primary" value="${d.colors.primary}"></label>
      <label class="field">لون التمييز<input type="color" name="accent" value="${d.colors.accent}"></label>
      <label class="field">لون الخلفية والمعرض<input type="color" name="bg" value="${d.colors.bg}"></label>
    </div>
    <div class="form-grid">
      <label class="field">عند الضغط على شراء<select name="checkout">${opt({ whatsapp: 'واتساب برقم الطلب', salla: 'متجري في سلة' }, d.checkout)}</select></label>
      <label class="field">رقم واتساب الطلبات<input name="whatsapp" class="ltr" inputmode="tel" value="${d.whatsapp || ''}" placeholder="05xxxxxxxx"></label>
    </div>
    <label class="field">الشحن والتوصيل<input name="shipping" maxlength="300" value="${d.shipping || ''}"></label>
    <label class="field">الدفع<input name="payment" maxlength="300" value="${d.payment || ''}"></label>
    <div class="form-grid">
      <label class="field">كود الخصم<input name="coupon_code" class="ltr" maxlength="20" value="${d.coupon?.code || ''}" placeholder="OPEN10"></label>
      <label class="field">نسبة الخصم ٪<input name="coupon_percent" type="number" min="1" max="90" class="ltr" value="${d.coupon?.percent || ''}"></label>
    </div>
    <fieldset class="sb-slides"><legend>السلايدر</legend>${[0, 1, 2].map((i) => html`<div class="form-grid"><input name="s${i}_title" maxlength="70" placeholder="عنوان الشريحة ${i + 1}" value="${d.slides[i]?.title || ''}"><input name="s${i}_sub" maxlength="140" placeholder="سطر تحته" value="${d.slides[i]?.sub || ''}"><input name="s${i}_cta" maxlength="30" placeholder="نص الزر" value="${d.slides[i]?.cta || ''}"></div>`)}</fieldset>
    <div><button class="btn btn-primary" type="submit">حفظ في المسودة</button></div>`);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const draft = {
      name: v.name, tagline: v.tagline, announcement: v.announcement, about: v.about, theme: v.theme, font: v.font, card: v.card, view: v.view,
      colors: { primary: v.primary, accent: v.accent, bg: v.bg }, checkout: v.checkout, whatsapp: v.whatsapp || null, shipping: v.shipping, payment: v.payment,
      coupon: v.coupon_code && v.coupon_percent ? { code: v.coupon_code, percent: Number(v.coupon_percent), note: 'خصم' } : null,
      slides: [0, 1, 2].map((i) => ({ title: v[`s${i}_title`], sub: v[`s${i}_sub`], cta: v[`s${i}_cta`] })).filter((s) => s.title),
    };
    try {
      const d = await api('/api/m/site/draft', { method: 'PUT', body: { draft } });
      S.draft = d.draft; S.can_undo = d.can_undo; S.dirty = true;
      toast('انحفظ في المسودة. اضغط "انشر" عشان يوصل للعملاء');
      drawBar(); refreshPreview();
    } catch (err) { toast(err.message, true); }
  };
}

function drawLandings() {
  const el = $('sb-landings');
  if (!el) return;
  if (!S.products.length) return render(el, html`<p class="muted">أضف منتجاتك من قسم «منتجاتي في متاجر أصالة 🛍️»، وبعدها تقدر تسوي لكل منتج صفحة هبوط.</p>`);
  render(el, html`<div class="sb-lp-list">${S.products.map((p) => html`<div class="sb-lp">
    ${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : raw('<span class="sb-lp-noimg">🛍️</span>')}
    <div class="sb-lp-info"><b>${p.title}</b><small>${sar(p.price)} · ${p.landing ? '✅ صفحة جاهزة' : 'بدون صفحة هبوط'}</small></div>
    <div class="actions">
      <button type="button" class="btn btn-sm btn-gold" data-lp-ai="${p.id}">✨ ${p.landing ? 'أعد كتابتها' : 'اكتبها بالذكاء'} (نقطة)</button>
      <button type="button" class="btn btn-sm" data-lp-edit="${p.id}">✏️ تعديل</button>
      ${p.landing ? html`<a class="btn btn-sm" href="/s/${S.merchant.slug}/p/${p.id}${S.published ? '' : '?preview=1'}" target="_blank" rel="noopener">فتح ↗</a><button type="button" class="btn btn-sm" data-lp-copy="${p.id}">📋</button>` : ''}
    </div></div>`)}</div>`);
  el.onclick = async (e) => {
    const ai = e.target.closest('[data-lp-ai]');
    const ed = e.target.closest('[data-lp-edit]');
    const cp = e.target.closest('[data-lp-copy]');
    if (cp) navigator.clipboard.writeText(`${S.url}/p/${cp.dataset.lpCopy}`).then(() => toast('تم نسخ الرابط'));
    if (ai) {
      if (S.credits.balance < 1) return topup();
      ai.disabled = true;
      ai.textContent = '… يكتب';
      try {
        const d = await api(`/api/m/site/landing/${ai.dataset.lpAi}/ai`, { method: 'POST' });
        S.credits.balance = d.balance;
        S.products.find((p) => p.id === Number(ai.dataset.lpAi)).landing = d.landing;
        toast('صفحة الهبوط جاهزة ✨');
        drawLandings(); drawBar();
      } catch (err) { toast(err.message, true); ai.disabled = false; ai.textContent = '✨ اكتبها بالذكاء (نقطة)'; }
    }
    if (ed) editLanding(S.products.find((p) => p.id === Number(ed.dataset.lpEdit)));
  };
}

function editLanding(p) {
  const l = p.landing || { headline: p.title, sub: '', bullets: [], faq: [], cta: 'اطلب الحين' };
  const dlg = document.createElement('dialog');
  dlg.className = 'sb-dialog wide';
  render(dlg, html`<form method="dialog"><h2>صفحة هبوط: ${p.title}</h2>
    <label class="field">العنوان<input name="headline" maxlength="90" required value="${l.headline || ''}"></label>
    <label class="field">السطر تحته<textarea name="sub" rows="2" maxlength="220">${l.sub || ''}</textarea></label>
    <label class="field">المزايا (كل سطر ميزة)<textarea name="bullets" rows="4">${(l.bullets || []).join('\n')}</textarea></label>
    <label class="field">أسئلة وأجوبة (سؤال؟ | جواب، كل سطر)<textarea name="faq" rows="4">${(l.faq || []).map((f) => f.q + ' | ' + f.a).join('\n')}</textarea></label>
    <div class="form-grid"><label class="field">نص الزر<input name="cta" maxlength="30" value="${l.cta || ''}"></label><label class="field">سطر تحفيز (اختياري)<input name="urgency" maxlength="80" value="${l.urgency || ''}"></label></div>
    <div class="actions"><button class="btn btn-primary" value="save">حفظ</button>${p.landing ? html`<button class="btn btn-danger" value="delete">حذف الصفحة</button>` : ''}<button class="btn" value="cancel" formnovalidate>إلغاء</button></div></form>`);
  document.body.append(dlg);
  dlg.addEventListener('close', async () => {
    const f = dlg.querySelector('form');
    if (dlg.returnValue === 'save' || dlg.returnValue === 'delete') {
      const landing = dlg.returnValue === 'delete' ? null : {
        headline: f.headline.value, sub: f.sub.value, cta: f.cta.value, urgency: f.urgency.value,
        bullets: f.bullets.value.split('\n').map((x) => x.trim()).filter(Boolean),
        faq: f.faq.value.split('\n').map((x) => x.split('|')).filter((x) => x.length >= 2).map(([q, ...a]) => ({ q: q.trim(), a: a.join('|').trim() })),
      };
      try {
        const d = await api(`/api/m/site/landing/${p.id}`, { method: 'PUT', body: { landing } });
        p.landing = d.landing;
        toast('تم الحفظ');
        drawLandings();
      } catch (e) { toast(e.message, true); }
    }
    dlg.remove();
  });
  dlg.showModal();
}

// ================= طلبات العملاء =================
let view = 'orders';
let O = null;
const STATUS_CLASS = { new: 'warn', confirmed: 'ok', shipped: 'ok', cancelled: 'err' };

export async function ordersBadge() {
  try {
    const d = await api('/api/m/site');
    const b = $('orders-badge');
    if (b && d.stats?.new) { b.textContent = d.stats.new; b.hidden = false; }
    else if (b) b.hidden = true;
  } catch { /* الموظف أو حساب بدون متجر */ }
}

export async function loadOrders() {
  const root = $('orders');
  try {
    O = await api('/api/m/orders?view=' + view);
  } catch (e) {
    render(root, html`<div class="page-head"><div><h1>طلبات العملاء 🧾</h1></div></div><div class="card" style="margin-top:24px"><p class="muted">${e.message}</p></div>`);
    return;
  }
  const s = O.stats;
  render(root, html`
    <div class="page-head"><div><h1>طلبات العملاء 🧾</h1><p>كل طلب من متجرك الخاص ينحفظ هنا برقمه، والسلات اللي ما كمّلها أصحابها.</p></div></div>
    <p class="tip info" style="margin:16px 0 0">💳 الدفع الإلكتروني عبر أصالة قريباً. حالياً العميل يأكد طلبه معك على واتساب أو يكمل الدفع في سلة.</p>
    <div class="kpis" style="margin-top:16px">
      <div class="kpi"><span class="label">كل الطلبات</span><span class="value">${num(s.orders)}</span></div>
      <div class="kpi"><span class="label">طلبات جديدة</span><span class="value">${num(s.new)}</span><span class="note">تحتاج تأكيد</span></div>
      <div class="kpi"><span class="label">قيمة الطلبات</span><span class="value">${sar(s.revenue)}</span><span class="note">بدون الملغية</span></div>
      <div class="kpi"><span class="label">سلات متروكة</span><span class="value">${num(s.abandoned)}</span><span class="note">${sar(s.abandoned_value)}</span></div>
    </div>
    <div class="seg" style="margin-top:20px"><button type="button" data-view="orders" ${raw(view === 'orders' ? 'aria-pressed="true"' : '')}>🧾 الطلبات</button><button type="button" data-view="carts" ${raw(view === 'carts' ? 'aria-pressed="true"' : '')}>🛒 السلات المتروكة</button></div>
    <div class="or-list" id="or-list" style="margin-top:16px">${O.orders.length ? O.orders.map(orderCard) : html`<div class="card"><p class="muted" style="margin:0">${view === 'orders' ? 'ما وصلتك طلبات للحين. شارك رابط متجرك الخاص مع عملائك 🚀' : 'ما فيه سلات متروكة 👌 (تظهر هنا السلة بعد 30 دقيقة من آخر تعديل)'}</p></div>`}</div>`);
  root.querySelector('.seg').onclick = (e) => { const b = e.target.closest('[data-view]'); if (b && b.dataset.view !== view) { view = b.dataset.view; loadOrders(); } };
  $('or-list').onchange = async (e) => {
    const sel = e.target.closest('[data-or-status]');
    if (!sel) return;
    try { await api('/api/m/orders/' + sel.dataset.orStatus, { method: 'PATCH', body: { status: sel.value } }); toast('تم تحديث الحالة'); loadOrders(); ordersBadge(); } catch (err) { toast(err.message, true); }
  };
  $('or-list').onclick = async (e) => {
    const wa = e.target.closest('[data-or-wa]');
    if (wa) return waReply(O.orders.find((x) => x.id === Number(wa.dataset.orWa)));
    const pr = e.target.closest('[data-or-print]');
    if (pr) return printOrder(O.orders.find((x) => x.id === Number(pr.dataset.orPrint)));
    const note = e.target.closest('[data-or-note]');
    const del = e.target.closest('[data-or-del]');
    if (note) {
      const o = O.orders.find((x) => x.id === Number(note.dataset.orNote));
      const v = await promptBox('ملاحظة داخلية على الطلب (ما يشوفها العميل)', o.merchant_note || '');
      if (v == null) return;
      try { await api('/api/m/orders/' + o.id, { method: 'PATCH', body: { merchant_note: v } }); loadOrders(); } catch (err) { toast(err.message, true); }
    }
    if (del && await confirmBox('تحذف هالسلة؟')) {
      try { await api('/api/m/orders/' + del.dataset.orDel, { method: 'DELETE' }); loadOrders(); } catch (err) { toast(err.message, true); }
    }
  };
}

// ردود واتساب جاهزة حسب حالة الطلب، والتاجر يعدّل النص قبل الإرسال
const WA_TEMPLATES = [
  ['confirm', '✅ تأكيد الطلب', (o, x) => `هلا ${x.name} 👋\nتم تأكيد طلبك رقم ${o.number} من ${x.store} ✅\n${x.items}\nالمجموع: ${x.total}\nبنجهّزه ونرسل لك رقم الشحنة أول ما يطلع.${x.track}`],
  ['address', '📍 طلب العنوان', (o, x) => `هلا ${x.name} 👋\nعشان نشحن طلبك رقم ${o.number}، أرسل لنا موقعك على الخريطة (📎 ← الموقع) أو العنوان الوطني المختصر.`],
  ['shipped', '🚚 تم الشحن', (o, x) => `هلا ${x.name} 👋\nطلبك رقم ${o.number} انشحن 🚚\nرقم الشحنة: \nيوصلك خلال 2 إلى 5 أيام عمل بإذن الله.${x.track}`],
  ['delay', '⏳ اعتذار عن تأخير', (o, x) => `هلا ${x.name} 🙏\nنعتذر منك، طلبك رقم ${o.number} بيتأخر شوي عن الموعد. بنحدّثك أول ما ينشحن، وشكراً على صبرك.`],
  ['thanks', '⭐ شكر بعد الاستلام', (o, x) => `هلا ${x.name} 🌟\nإن شاء الله وصلك طلبك رقم ${o.number} وعجبك.\nامسح شريحة أصالة على المنتج تتأكد إنه أصلي وتجمع نقاطك 🎁\nونسعد برأيك!`],
  ['cancel', '❌ إلغاء الطلب', (o, x) => `هلا ${x.name}\nحسب طلبك، تم إلغاء طلبك رقم ${o.number}. إذا تحتاج أي شي ثاني إحنا موجودين 🤍`],
];
const WA_DEFAULT = { new: 'confirm', confirmed: 'shipped', shipped: 'thanks', cancelled: 'cancel' };
async function waReply(o) {
  const x = {
    name: o.name || '',
    store: S?.draft?.name || 'متجرنا',
    items: o.items.map((it) => `• ${it.title} × ${it.qty}`).join('\n'),
    total: sar(o.total),
    track: o.track ? `\nتتبع طلبك من هنا: ${location.origin}${o.track}` : '',
  };
  const textOf = (k) => WA_TEMPLATES.find((t) => t[0] === k)[2](o, x);
  const first = WA_DEFAULT[o.status] || 'confirm';
  const f = await formBox({
    title: `رد على ${o.number}`,
    icon: '💬',
    ok: 'افتح واتساب',
    fields: [
      { name: 'tpl', options: WA_TEMPLATES.map(([k, l]) => [k, l]), value: first },
      { name: 'text', multiline: true, rows: 8, value: textOf(first) },
    ],
    onChange: (name, v, f) => { if (name === 'tpl') f.text.value = textOf(v); },
  });
  if (!f) return;
  window.open(`https://wa.me/${o.phone}?text=${encodeURIComponent(f.text)}`, '_blank', 'noopener');
}

// فاتورة A4 مبسطة وتحتها ملصق شحن بحجم 10×15 سم يتقص، فيه QR لتتبع الطلب
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function printOrder(o) {
  const store = S?.draft?.name || document.getElementById('merchant-name')?.textContent || 'متجرنا';
  const phone = o.phone ? '0' + String(o.phone).replace(/^966/, '') : '';
  const date = new Date((o.ordered_at || o.updated_at) * 1000).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  const track = o.track ? location.origin + o.track : '';
  const rows = o.items.map((it) => `<tr><td>${esc(it.title)}</td><td>${it.qty}</td><td>${esc(sar(it.price))}</td><td>${esc(sar(it.price * it.qty))}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) return toast('اسمح بالنوافذ المنبثقة عشان تطبع', true);
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(o.number)}</title><style>
    body{font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;color:#15211C;margin:0;padding:24px}
    h1{font-size:22px;margin:0}.muted{color:#5B6660}.row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:8px;border-bottom:1px solid #E3E1DA;text-align:start}th{color:#5B6660;font-weight:500}
    .total{font-size:20px;font-weight:700}.cut{border-top:2px dashed #999;margin:28px 0 18px;text-align:center;color:#999;font-size:12px}
    .label{width:10cm;height:15cm;border:2px solid #15211C;border-radius:8px;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;margin:auto}
    .label .to{font-size:24px;font-weight:700}.label .big{font-size:20px;direction:ltr;text-align:right}.label svg{width:3.2cm;height:3.2cm}
    .label .num{font-family:ui-monospace,monospace;font-size:22px;font-weight:700}
    @media print{body{padding:0}.label{page-break-inside:avoid;break-inside:avoid}}
  </style></head><body>
  <section class="page">
    <div class="row"><div><h1>${esc(store)}</h1><div class="muted">فاتورة طلب</div></div><div style="text-align:left"><div class="num" style="font-family:monospace;font-size:18px;font-weight:700">${esc(o.number)}</div><div class="muted">${esc(date)}</div></div></div>
    <p><b>العميل:</b> ${esc(o.name || '-')} · <span dir="ltr">${esc(phone)}</span> · ${esc(o.city || '')}</p>
    <table><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="row"><div class="muted">${o.coupon ? 'كود الخصم: ' + esc(o.coupon) : ''}</div><div class="total">الإجمالي: ${esc(sar(o.total))}</div></div>
    ${o.note ? `<p><b>ملاحظة العميل:</b> ${esc(o.note)}</p>` : ''}
    <p class="muted" style="margin-top:24px">✅ منتجاتنا أصلية وموثّقة بشريحة أصالة. امسحها بجوالك تتأكد وتجمع نقاطك.</p>
  </section>
  <div class="cut">✂️ ملصق الشحن</div>
  <section class="label">
    <div class="muted">إلى:</div>
    <div class="to">${esc(o.name || '-')}</div>
    <div class="big">${esc(phone)}</div>
    <div style="font-size:20px">📍 ${esc(o.city || '')}</div>
    <div class="row" style="margin-top:auto;align-items:flex-end"><div><div class="muted">رقم الطلب</div><div class="num">${esc(o.number)}</div><div class="muted" style="margin-top:6px">من: ${esc(store)}</div></div>${track ? qrSvg(track) : ''}</div>
  </section>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function orderCard(o) {
  const cart = o.status === 'cart';
  const items = o.items.map((it) => `${it.title} × ${it.qty}`).join('، ');
  const waText = cart ? `هلا ${o.name || ''} 👋 لاحظنا إن عندك منتجات في سلتك في ${S?.draft?.name || 'متجرنا'}: ${items}. تحتاج مساعدة تكمل طلبك؟` : `هلا ${o.name || ''} 👋 بخصوص طلبك رقم ${o.number}: ${items}. المجموع ${sar(o.total)}.${o.track ? `\nتتبع طلبك من هنا: ${location.origin}${o.track}` : ''}`;
  const wa = o.phone ? `https://wa.me/${o.phone}?text=${encodeURIComponent(waText)}` : null;
  return html`<div class="card or-card">
    <div class="or-head">
      <div><b class="mono">${cart ? '🛒 سلة' : o.number}</b> <span class="small muted">· ${when(o.ordered_at || o.updated_at)}</span></div>
      ${cart ? html`<span class="pill warn">متروكة</span>` : html`<select data-or-status="${o.id}" class="or-status ${STATUS_CLASS[o.status]}">${Object.entries(O.status).map(([k, l]) => html`<option value="${k}" ${raw(k === o.status ? 'selected' : '')}>${l}</option>`)}</select>`}
    </div>
    <ul class="or-items">${o.items.map((it) => html`<li><span>${it.title} × ${it.qty}</span><span>${sar(it.price * it.qty)}</span></li>`)}</ul>
    <div class="or-total"><span>${o.coupon ? html`كود ${o.coupon} · ` : ''}${o.channel === 'salla' ? 'حوّل لسلة' : o.channel === 'whatsapp' ? 'تأكيد واتساب' : ''}</span><b>${sar(o.total)}</b></div>
    <div class="or-cust"><span>👤 ${o.name || 'بدون اسم'}</span>${o.city ? html`<span>📍 ${o.city}</span>` : ''}${o.phone ? html`<span class="ltr">📱 ${o.phone}</span>` : cart ? html`<span class="muted">ما ترك رقمه</span>` : ''}</div>
    ${o.note ? html`<p class="small" style="margin:0">📝 ${o.note}</p>` : ''}
    ${o.merchant_note ? html`<p class="small muted" style="margin:0">🔒 ${o.merchant_note}</p>` : ''}
    <div class="actions">${wa ? (cart ? html`<a class="btn btn-sm btn-primary" href="${wa}" target="_blank" rel="noopener">💬 ذكّره يكمل طلبه</a>` : html`<button type="button" class="btn btn-sm btn-primary" data-or-wa="${o.id}">💬 رد واتساب جاهز</button>`) : ''}<button type="button" class="btn btn-sm" data-or-note="${o.id}">🔒 ملاحظة</button>${cart ? '' : html`<button type="button" class="btn btn-sm" data-or-print="${o.id}">🖨️ فاتورة وملصق</button>`}${cart ? html`<button type="button" class="btn btn-sm btn-danger" data-or-del="${o.id}">حذف</button>` : ''}</div>
  </div>`;
}

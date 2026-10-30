// مساعد أصالة للزوار: زر محادثة عائم يجاوب الأسئلة ويستقبل طلبات انضمام التجار.
// لو الذكاء الاصطناعي مو مفعّل، يشتغل بردود جاهزة وأسئلة الانضمام خطوة بخطوة.
import { html, render } from '/assets/common.js';

const FAQ = [
  ['هل أحتاج تطبيق؟', 'لا. أغلب الجوالات تقرأ علامات NFC مباشرة: قرّب جوالك من العلامة، وتفتح صفحة التحقق في المتصفح.'],
  ['كيف أعرف إن المنتج مقلّد؟', 'لو طلعت لك رسالة إن العلامة غير مسجلة أو موقوفة أو انفحصت من جهاز آخر، لا تستخدم المنتج، وبلّغ من نفس الصفحة. بلاغك يوصل للتاجر مباشرة.'],
  ['وش يصير لو أحد نسخ الرابط؟', 'لما تشتري المنتج اضغط «نعم، اشتريته · سجّله باسمي». بعدها أي أحد يمسح نسخة من العلامة يطلع له إن المنتج مسجّل لشخص آخر ومتى ووين انمسح، والعلامة تنقفل لو مسحتها جوالات كثيرة. وشرائح 424 DNA تولّد رابط جديد مع كل لمسة فالنسخ ما ينفع أصلاً.'],
  ['كيف أستبدل نقاطي؟', 'بعد التحقق اكتب رقم جوالك وينضاف لك الرصيد. لما يكمل الحد يطلع لك زر "استبدل الحين"، وتاخذ كود توريه للكاشير.'],
  ['وش تقدم للتاجر؟', 'لوحة تحكم فيها: مخزون العلامات وتنبيه قبل ما تخلص، المبيعات والمدن، بؤر التقليد، إيقاف أي علامة، المسابقات والسحب، النقاط والكاش باك، تقييمات العملاء، تقرير شهري، ومساعد ذكي يقرأ أرقامك.'],
  ['كم ياخذ التفعيل؟', 'نجهّز حسابك ولوحتك في نفس اليوم، ونصدر لك العلامات بعدد منتجاتك وتلصقها في المصنع أو المستودع.'],
];
const JOIN = 'أبي أحمي منتجي';
const QTY = ['أقل من 1000', '1000 إلى 10 آلاف', '10 آلاف إلى 50 ألف', 'أكثر من 50 ألف'];
const HELLO = 'هلا 👋 أنا مساعد أصالة. اسألني عن التحقق من المنتجات والنقاط، أو لو عندك علامة تجارية وتبي تحميها، أسجّل طلبك ويتواصل معك الفريق.';

function store() { try { const s = sessionStorage; s.setItem('__g', '1'); s.removeItem('__g'); return s; } catch { return null; } }
const ss = store();

let chat = false, busy = false, opened = false;
let log = [];
try { log = JSON.parse(ss?.getItem('asalah_guide') || '[]'); } catch {}
// خطوات الانضمام بدون ذكاء اصطناعي
let flow = null;

const root = document.createElement('div');
root.className = 'guide';
document.body.append(root);
render(root, html`
  <button class="guide-fab" type="button" aria-expanded="false" aria-controls="guide-panel"><span aria-hidden="true">💬</span><b>مساعد أصالة</b></button>
  <section class="guide-panel" id="guide-panel" role="dialog" aria-label="مساعد أصالة" hidden>
    <header><div class="g-av" aria-hidden="true">✨</div><div><b>مساعد أصالة</b><small>يرد عليك على طول</small></div><button type="button" class="g-x" aria-label="إغلاق">×</button></header>
    <div class="g-log" aria-live="polite"></div>
    <div class="g-chips"></div>
    <form class="g-form"><input name="q" autocomplete="off" placeholder="اكتب سؤالك…" maxlength="1000" aria-label="رسالتك"><button class="btn btn-primary" type="submit" aria-label="إرسال">➤</button></form>
  </section>`);
const $ = (s) => root.querySelector(s);
const fab = $('.guide-fab'), panel = $('.guide-panel'), logEl = $('.g-log'), chipsEl = $('.g-chips'), form = $('.g-form');

const save = () => ss?.setItem('asalah_guide', JSON.stringify(log.slice(-30)));
function draw(typing) {
  render(logEl, html`${[{ role: 'assistant', content: HELLO }, ...log].map((m) => html`<div class="g-msg ${m.role === 'user' ? 'me' : 'bot'}">${m.content}</div>`)}${typing ? html`<div class="g-msg bot typing"><i></i><i></i><i></i></div>` : ''}`);
  logEl.scrollTop = logEl.scrollHeight;
}
function chips(list) {
  render(chipsEl, html`${list.map((c) => html`<button type="button" data-chip="${c}">${c}</button>`)}`);
}
const defaultChips = () => chips(flow ? flow.chips || [] : [JOIN, ...FAQ.map((f) => f[0])]);
const say = (role, content) => { log.push({ role, content }); save(); };

export function openGuide(prefill) {
  if (!opened) { opened = true; draw(); defaultChips(); }
  panel.hidden = false;
  fab.setAttribute('aria-expanded', 'true');
  document.body.classList.add('guide-open');
  if (prefill) send(prefill);
  else setTimeout(() => form.q.focus(), 50);
}
function closeGuide() {
  panel.hidden = true;
  fab.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('guide-open');
}
fab.addEventListener('click', () => (panel.hidden ? openGuide() : closeGuide()));
$('.g-x').addEventListener('click', closeGuide);
document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && closeGuide());

// ---------- بدون ذكاء اصطناعي: ردود جاهزة وخطوات الانضمام ----------
const STEPS = [
  { key: 'name', ask: 'حياك 🌟 وش اسمك الكريم؟' },
  { key: 'brand', ask: 'وش اسم علامتك التجارية؟' },
  { key: 'phone', ask: 'رقم جوالك عشان يتواصل معك الفريق؟ (مثل 0551234567)' },
  { key: 'product', ask: 'وش نوع منتجك؟ (عطور، شاي، مكملات…)', chips: ['تخطي'] },
  { key: 'qty', ask: 'تقريباً كم منتج تبيع شهرياً؟', chips: [...QTY, 'تخطي'] },
];
async function scripted(text) {
  if (flow) {
    const step = STEPS[flow.i];
    if (step.key === 'phone' && !/^(?:\+?966|0)?5\d{8}$/.test(text.replace(/[\s-]/g, ''))) return 'الرقم ما يبدو صحيح. اكتب رقم جوال سعودي مثل 0551234567';
    flow.data[step.key] = text === 'تخطي' ? null : text;
    flow.i++;
    if (flow.i < STEPS.length) { flow.chips = STEPS[flow.i].chips; return STEPS[flow.i].ask; }
    const res = await fetch('/api/public/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flow.data) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { if (res.status === 400) { flow.i = 0; flow.chips = null; return (d.message || 'فيه خطأ في البيانات') + '. خلنا نعيد: وش اسمك الكريم؟'; } flow = null; return d.message || 'تعذر الإرسال، حاول بعد شوي.'; }
    flow = null;
    return '✅ وصلنا طلبك، وفريق أصالة بيتواصل معك قريب. فيه شي ثاني أقدر أساعدك فيه؟';
  }
  if (text === JOIN || /انضم|اشترك|سعر|أسعار|عرض|تواصل|علامتي|منتجي/.test(text)) {
    flow = { i: 0, data: {}, chips: null };
    return STEPS[0].ask;
  }
  const hit = FAQ.find((f) => f[0] === text) || FAQ.find((f) => f[0].replace(/[؟?]/g, '').split(' ').filter((w) => w.length > 2).some((w) => text.includes(w)));
  if (hit) return hit[1];
  return 'سؤال حلو! ما عندي جواب جاهز له، لكن لو تركت بياناتك فريق أصالة يرد عليك. اضغط "أبي أحمي منتجي"، أو اختر من الأسئلة تحت.';
}

// ---------- مع الذكاء الاصطناعي ----------
async function ai() {
  const res = await fetch('/api/public/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: log }) });
  const d = await res.json().catch(() => ({}));
  if (res.status === 503) { chat = false; return null; }
  if (!res.ok) throw new Error(d.message || 'تعذر الوصول للمساعد، حاول مرة ثانية');
  return d.answer;
}

async function send(text) {
  text = String(text || '').trim();
  if (!text || busy) return;
  busy = true;
  say('user', text);
  chips([]);
  draw(true);
  const wait = new Promise((r) => setTimeout(r, 450));
  let answer;
  try {
    // أسئلة الأزرار الجاهزة لها جواب فوري، والباقي يروح للمساعد الذكي لو مفعّل
    const faq = FAQ.find((f) => f[0] === text);
    if (chat && !faq && !flow) answer = await ai();
    if (answer == null) answer = await scripted(text);
  } catch (e) {
    answer = e.message;
  }
  await wait;
  say('assistant', answer);
  busy = false;
  draw();
  defaultChips();
}
form.addEventListener('submit', (e) => { e.preventDefault(); const q = form.q.value; form.q.value = ''; send(q); });
chipsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-chip]'); if (b) send(b.dataset.chip); });
// أي رابط عليه data-guide يفتح المساعد، ولو فيه نص يرسله
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-guide]');
  if (!a) return;
  e.preventDefault();
  openGuide(a.dataset.guide || '');
});

fetch('/api/public/assistant').then((r) => r.json()).then((d) => { chat = Boolean(d.chat); }).catch(() => {});
if (log.length) fab.classList.add('has-chat');

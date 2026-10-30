// تتبع طلب من المتجر الخاص: الرمز في # عشان ما يوصل لأي سجل خادم أو موقع ثاني
const $ = (id) => document.getElementById(id);
const show = (id, on = true) => ($(id).hidden = !on);
const sar = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س';
const when = (sec) => new Date(sec * 1000).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const STEPS = [['new', 'استلمنا طلبك', '🧾'], ['confirmed', 'تأكد', '✅'], ['shipped', 'انشحن', '🚚']];

async function load() {
  const tk = location.hash.slice(1);
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(tk)) { show('loading', false); return show('err'); }
  let d;
  try {
    const r = await fetch('/api/public/site-order/' + tk);
    d = await r.json();
    if (!r.ok) throw new Error(d.message);
  } catch (e) {
    show('loading', false);
    $('err-msg').textContent = e.message || 'تعذر جلب الطلب، جرّب بعد شوي';
    return show('err');
  }
  const o = d.order;
  document.title = `طلب ${o.number} · ${o.merchant.name}`;
  $('sname').textContent = o.merchant.name;
  $('store').href = $('back').href = o.merchant.store_url;
  if (o.merchant.logo_url) { const i = el('img'); i.src = o.merchant.logo_url; i.alt = ''; $('logo').replaceChildren(i); } else $('logo').textContent = o.merchant.name.charAt(0);
  $('no').textContent = o.number;
  $('status').textContent = o.status_label;
  $('status').classList.toggle('cancelled', o.status === 'cancelled');
  const at = STEPS.findIndex(([k]) => k === o.status);
  $('steps').replaceChildren(...(o.status === 'cancelled' ? [] : STEPS.map(([, label, ic], i) => {
    const li = el('li', i <= at ? 'done' + (i === at ? ' now' : '') : '');
    li.append(el('i', '', i <= at ? ic : String(i + 1)), el('span', '', label));
    return li;
  })));
  if (o.status === 'cancelled') $('steps').replaceChildren(el('li', '', 'تم إلغاء الطلب. تواصل مع المتجر لو عندك سؤال.'));
  $('updated').textContent = 'آخر تحديث: ' + when(o.updated_at || o.ordered_at);
  $('items').replaceChildren(...o.items.map((it) => { const li = el('li'); li.append(el('span', '', `${it.title} × ${it.qty}`), el('b', '', sar(it.price * it.qty))); return li; }));
  $('coupon').textContent = o.coupon ? `كود الخصم ${o.coupon}` : '';
  $('total').textContent = sar(o.total);
  show('loading', false);
  show('order');
}
addEventListener('hashchange', load);
// لو الطلب مفتوح، نحدّث الحالة كل دقيقة
setInterval(() => { if (!document.hidden && !$('order').hidden) load(); }, 60000);
load();

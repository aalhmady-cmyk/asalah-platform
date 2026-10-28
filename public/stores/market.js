// متاجر أصالة: منتجات التجار الحقيقية، الريلز، ومساعد التسوق. الشراء يكمل في متجر التاجر (سلة).
import { html, raw, render } from '/assets/common.js';

const $ = (s) => document.querySelector(s);
const view = $('#view'), sheet = $('#sheet');
const sar = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س');
const off = (p) => (p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0);

let D = null; // بيانات الصفحة الرئيسية
const cache = new Map(); // المنتجات اللي شفناها
let chatLog = [];
try { chatLog = JSON.parse(sessionStorage.getItem('asalah_market_chat') || '[]'); } catch {}
const saveChat = () => { try { sessionStorage.setItem('asalah_market_chat', JSON.stringify(chatLog.slice(-30))); } catch {} };

async function get(path) {
  const r = await fetch(path);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'تعذر التحميل، حاول مرة ثانية');
  return d;
}
const track = (type, id) => fetch('/api/public/store/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }), keepalive: true }).catch(() => {});

let toastT;
function toast(t) {
  const el = $('#toast');
  el.textContent = t;
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
  document.querySelectorAll('.mk-tabs [data-go]').forEach((b) => (b.dataset.go === (tab === 'merchant' || tab === 'search' ? 'home' : tab) ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  document.body.dataset.view = tab;
  try {
    if (tab === 'reels') await showReels(Number(p.get('r')) || null);
    else if (tab === 'chat') showChat();
    else if (tab === 'merchant') await showMerchant(p.get('m'));
    else if (tab === 'search') await showSearch(p.get('q'), p.get('cat'));
    else await showHome(p.get('cat'));
  } catch (e) {
    render(view, html`<div class="mk-empty"><b>صار خطأ</b><p>${e.message}</p><button class="mk-btn" type="button" data-go="home">رجوع للرئيسية</button></div>`);
  }
  if (p.get('p')) openProduct(Number(p.get('p')), true);
  else closeSheet(true);
}

// ---------- البطاقات ----------
const badge = raw('<span class="mk-verified" title="أصلي وموثّق من أصالة">🛡️ أصلي موثّق</span>');
function card(p) {
  cache.set(p.id, p);
  return html`<article class="mk-card" data-product="${p.id}" tabindex="0" role="button" aria-label="${p.title}، ${sar(p.price)}">
    <div class="mk-card-img">${p.image_url ? html`<img src="${p.image_url}" alt="" loading="lazy">` : raw('<span aria-hidden="true">🛍️</span>')}${off(p) ? html`<span class="mk-off">-${off(p)}٪</span>` : ''}</div>
    <div class="mk-card-b">
      <span class="mk-card-m">${p.merchant_name}</span>
      <b class="mk-card-t">${p.title}</b>
      <div class="mk-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s>` : ''}</div>
    </div>
  </article>`;
}
const grid = (list) => html`<div class="mk-grid">${list.map(card)}</div>`;
function reelTile(r, i) {
  return html`<button type="button" class="mk-reel-tile" data-reel="${r.id}" aria-label="ريل: ${r.title}" style="--i:${i}">
    ${r.poster_url ? html`<img src="${r.poster_url}" alt="" loading="lazy">` : ''}
    <span class="mk-play" aria-hidden="true">▶</span>
    <span class="mk-reel-cap"><b>${r.title}</b><small>${r.merchant_name}</small></span>
  </button>`;
}
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
  render(view, html`
    <section class="mk-hero">
      <div>
        <h1>تسوّق <em>الأصلي</em> وبس</h1>
        <p>كل منتج هنا من علامته التجارية مباشرة، ومحمي بعلامة أصالة. تدفع في متجر التاجر الرسمي.</p>
        <div class="mk-hero-cta"><button type="button" class="mk-btn gold" data-go="chat">✨ اسأل المساعد</button>${D.reels.length ? raw('<button type="button" class="mk-btn ghost" data-go="reels">🎬 شوف الريلز</button>') : ''}</div>
      </div>
      <div class="mk-hero-shield" aria-hidden="true">🛡️</div>
    </section>
    ${D.merchants.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>المتاجر</h2></div>
      <div class="mk-row">${D.merchants.map((m) => html`<button type="button" class="mk-store" data-merchant="${m.slug}">${logo(m)}<b>${m.name}</b><small>${m.products} منتج</small></button>`)}</div></section>` : ''}
    ${D.reels.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>ريلز 🔥</h2><button type="button" class="mk-link" data-go="reels">الكل</button></div>
      <div class="mk-row">${D.reels.map(reelTile)}</div></section>` : ''}
    <section class="mk-sec">
      <div class="mk-sec-h"><h2>${cat ? (cats.find((c) => c.key === cat)?.label ?? 'المنتجات') : 'وصل جديد'}</h2></div>
      ${cats.length > 1 ? html`<div class="mk-chips" role="list">
        <button type="button" role="listitem" class="mk-chip" data-cat="" aria-pressed="${!cat}">الكل</button>
        ${cats.map((c) => html`<button type="button" role="listitem" class="mk-chip" data-cat="${c.key}" aria-pressed="${c.key === cat}">${c.label}</button>`)}
      </div>` : ''}
      ${list.length ? grid(list) : html`<div class="mk-empty small">ما فيه منتجات في هذي الفئة حالياً</div>`}
    </section>`);
}

function skeleton() {
  return html`<div class="mk-skel">${Array.from({ length: 6 }, () => raw('<div class="mk-skel-card"></div>'))}</div>`;
}
function emptyStore() {
  return html`<div class="mk-empty big">
    <div class="mk-empty-art" aria-hidden="true">🛍️</div>
    <h1>المتاجر الأصلية في الطريق</h1>
    <p>قريب بتلقى هنا منتجات العلامات السعودية الموثّقة بعلامة أصالة.</p>
    <div class="mk-hero-cta"><a class="mk-btn gold" href="/stores/demo/">جرّب نسخة العرض</a><a class="mk-btn ghost-d" href="/#merchants">عندك علامة تجارية؟</a></div>
  </div>`;
}

// ---------- البحث والمتجر ----------
async function showSearch(q, cat) {
  $('#search').q.value = q || '';
  render(view, skeleton());
  const d = await get('/api/public/store/products?q=' + encodeURIComponent(q || '') + (cat ? '&cat=' + encodeURIComponent(cat) : ''));
  render(view, html`<section class="mk-sec">
    <div class="mk-sec-h"><h2>نتائج «${q}»</h2><span class="mk-muted">${d.products.length} منتج</span></div>
    ${d.products.length ? grid(d.products) : html`<div class="mk-empty"><b>ما لقينا شي بهالاسم</b><p>جرّب كلمة ثانية، أو خل المساعد يدوّر لك.</p><button type="button" class="mk-btn gold" data-ask="${q}">✨ اسأل المساعد عن «${q}»</button></div>`}
  </section>`);
}

async function showMerchant(slug) {
  render(view, skeleton());
  const d = await get('/api/public/store?m=' + encodeURIComponent(slug));
  const m = d.merchants.find((x) => x.slug === slug) || (d.products[0] && { name: d.products[0].merchant_name, slug, logo_url: d.products[0].merchant_logo });
  if (!m) throw new Error('المتجر غير متاح');
  d.products.forEach((p) => cache.set(p.id, p));
  render(view, html`
    <section class="mk-merchant">
      ${logo(m, 72)}
      <div><h1>${m.name}</h1><p>${badge} · ${d.products.length} منتج</p></div>
    </section>
    ${d.reels.length ? html`<section class="mk-sec"><div class="mk-sec-h"><h2>ريلز ${m.name}</h2></div><div class="mk-row">${d.reels.map(reelTile)}</div></section>` : ''}
    <section class="mk-sec">${d.products.length ? grid(d.products) : html`<div class="mk-empty small">ما فيه منتجات حالياً</div>`}</section>`);
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
    render(sheet, html`<div class="mk-sheet-in"><button type="button" class="mk-x" data-close aria-label="إغلاق">×</button><div class="mk-empty"><b>${e.message}</b></div></div>`);
  }
}
function drawProduct(p, d) {
  cache.set(p.id, p);
  render(sheet, html`<div class="mk-sheet-bg" data-close></div>
  <article class="mk-sheet-in" role="dialog" aria-modal="true" aria-label="${p.title}">
    <button type="button" class="mk-x" data-close aria-label="إغلاق">×</button>
    <div class="mk-p-img">${p.image_url ? html`<img src="${p.image_url}" alt="${p.title}">` : raw('<span aria-hidden="true">🛍️</span>')}</div>
    <div class="mk-p-b">
      <button type="button" class="mk-p-m" data-merchant="${p.merchant_slug}">${p.merchant_name} ›</button>
      <h1>${p.title}</h1>
      <div class="mk-p-price">${sar(p.price)}${p.old_price ? html` <s>${sar(p.old_price)}</s> <span class="mk-off inline">وفّر ${off(p)}٪</span>` : ''}</div>
      <div class="mk-trust">${badge}<span>الدفع والشحن من متجر ${p.merchant_name} الرسمي</span></div>
      ${p.description ? html`<p class="mk-p-desc">${p.description}</p>` : ''}
      <div class="mk-buy-bar">
        <a class="mk-btn gold big" href="${p.buy_url}" target="_blank" rel="noopener" data-buy="${p.id}">اشتر الآن من ${p.merchant_name} ↗</a>
        <button type="button" class="mk-btn ghost-d" data-share="${p.id}" aria-label="شارك المنتج">↗ شارك</button>
      </div>
      ${d && d.reels.length ? html`<h2>ريلز المنتج</h2><div class="mk-row">${d.reels.map(reelTile)}</div>` : ''}
      ${d && d.more.length ? html`<h2>ممكن يعجبك</h2><div class="mk-row cards">${d.more.map(card)}</div>` : ''}
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
let io = null, reelsList = [];
function stopReels() {
  io?.disconnect();
  io = null;
  document.querySelectorAll('.mk-reel video').forEach((v) => v.pause());
}
async function showReels(startId) {
  render(view, html`<div class="mk-reels-load">…</div>`);
  const d = await get('/api/public/store/reels');
  reelsList = d.reels;
  if (!reelsList.length) return render(view, html`<div class="mk-empty big"><div class="mk-empty-art" aria-hidden="true">🎬</div><h1>ما فيه ريلز للحين</h1><p>التجار بيبدون ينزلون ريلز منتجاتهم قريب.</p><button type="button" class="mk-btn gold" data-go="home">تصفّح المنتجات</button></div>`);
  render(view, html`<div class="mk-reels" id="reels">${reelsList.map(
    (r) => html`<section class="mk-reel" data-rid="${r.id}">
      <video src="${r.video_url}" poster="${r.poster_url || ''}" playsinline muted loop preload="metadata" aria-label="${r.title}"></video>
      <button type="button" class="mk-sound" data-sound aria-label="تشغيل الصوت">🔇</button>
      <div class="mk-reel-info">
        <button type="button" class="mk-reel-m" data-merchant="${r.merchant_slug}">${logo({ name: r.merchant_name, logo_url: r.merchant_logo }, 36)}<b>${r.merchant_name}</b>${badge}</button>
        <p>${r.title}</p>
        ${r.product_id ? html`<div class="mk-reel-p" data-product="${r.product_id}" data-from-reel="${r.id}" role="button" tabindex="0">
          ${r.product_image ? html`<img src="${r.product_image}" alt="">` : ''}
          <span><b>${r.product_title}</b><small>${sar(r.product_price)}</small></span>
          <a class="mk-btn gold" href="${r.product_buy_url}" target="_blank" rel="noopener" data-reel-buy="${r.id}" data-buy="${r.product_id}">اشتر</a>
        </div>` : ''}
      </div>
    </section>`
  )}</div>`);
  const box = $('#reels');
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
    { root: box, threshold: [0, 0.6, 1] }
  );
  box.querySelectorAll('.mk-reel').forEach((s) => io.observe(s));
  box.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sound]');
    const vid = e.target.closest('video');
    if (s || vid) {
      sound = !sound;
      box.querySelectorAll('video').forEach((v) => (v.muted = !sound));
      box.querySelectorAll('[data-sound]').forEach((b) => { b.textContent = sound ? '🔊' : '🔇'; b.setAttribute('aria-label', sound ? 'كتم الصوت' : 'تشغيل الصوت'); });
    }
  });
  if (startId) box.querySelector(`[data-rid="${startId}"]`)?.scrollIntoView({ block: 'start' });
}

// ---------- المساعد ----------
const SUGGEST = ['عطر فخم للمناسبات', 'هدية أقل من 200', 'قهوة مختصة', 'وش الجديد؟'];
function showChat() {
  render(view, html`<section class="mk-chat">
    <div class="mk-chat-log" id="chat-log" aria-live="polite"></div>
    <div class="mk-chat-sug" id="chat-sug">${SUGGEST.map((s) => html`<button type="button" class="mk-chip" data-ask="${s}">${s}</button>`)}</div>
    <form class="mk-chat-form" id="chat-form"><input name="q" autocomplete="off" maxlength="500" placeholder="قول لي وش تدوّر عليه…" aria-label="رسالتك للمساعد"><button type="submit" class="mk-btn gold" aria-label="إرسال">➤</button></form>
  </section>`);
  drawChat();
  setTimeout(() => $('#chat-form')?.q.focus({ preventScroll: true }), 50);
}
function drawChat(typing) {
  const el = $('#chat-log');
  if (!el) return;
  const hello = { role: 'assistant', content: 'هلا 👋 أنا مساعد متاجر أصالة. قول لي وش تبي (نوع المنتج، المناسبة، الميزانية) وأطلع لك الأصلي من المتاجر الموثّقة.' };
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
      const r = await fetch('/api/public/store/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: chatLog.map(({ role, content }) => ({ role, content })) }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { reply = d.reply; products = d.products; }
      else if (r.status !== 503) reply = d.message;
    }
    if (reply == null) {
      // بدون ذكاء اصطناعي: بحث بالكلمات في المنتجات
      const words = text.replace(/[؟?!.،,]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !/^(ابغى|ابي|أبي|أبغى|ودي|عندكم|فيه|ممكن|وش|ايش)$/.test(w));
      for (const w of words.length ? words : [text]) {
        products = (await get('/api/public/store/products?q=' + encodeURIComponent(w))).products;
        if (products.length) break;
      }
      products = products.slice(0, 6);
      reply = products.length ? 'هذي اللي لقيتها لك 👇' : 'ما لقيت شي يطابق طلبك. جرّب تكتب نوع المنتج، مثل: عطر أو قهوة أو تمر.';
    }
  } catch {
    reply = 'تعذر الاتصال، حاول مرة ثانية.';
  }
  products.forEach((p) => cache.set(p.id, p));
  chatLog.push({ role: 'assistant', content: reply, products });
  saveChat();
  asking = false;
  drawChat();
}

// ---------- الأحداث ----------
document.addEventListener('click', async (e) => {
  const t = e.target;
  const buy = t.closest('[data-buy]');
  if (buy) {
    track('click', Number(buy.dataset.buy));
    if (buy.dataset.reelBuy) track('reel_click', Number(buy.dataset.reelBuy));
    return; // الرابط يفتح متجر التاجر
  }
  const g = t.closest('[data-go]');
  if (g) { e.preventDefault(); closeSheet(true); return go(g.dataset.go === 'home' ? '' : 'v=' + g.dataset.go); }
  if (t.closest('[data-close]')) return closeSheet();
  const pr = t.closest('[data-product]');
  if (pr) return openProduct(Number(pr.dataset.product));
  const mr = t.closest('[data-merchant]');
  if (mr) { closeSheet(true); return go('m=' + encodeURIComponent(mr.dataset.merchant)); }
  const rl = t.closest('[data-reel]');
  if (rl) { closeSheet(true); return go('v=reels&r=' + rl.dataset.reel); }
  const c = t.closest('[data-cat]');
  if (c) return go(c.dataset.cat ? 'cat=' + encodeURIComponent(c.dataset.cat) : '', true);
  const a = t.closest('[data-ask]');
  if (a) return ask(a.dataset.ask);
  const sh = t.closest('[data-share]');
  if (sh) {
    const p = cache.get(Number(sh.dataset.share));
    const link = location.origin + '/stores/?p=' + p.id;
    const text = `${p.title} من ${p.merchant_name}، أصلي وموثّق في متاجر أصالة 🛡️`;
    if (navigator.share) navigator.share({ title: p.title, text, url: link }).catch(() => {});
    else { await navigator.clipboard?.writeText(text + '\n' + link).catch(() => {}); toast('نسخنا الرابط ✅'); }
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

route();

// البحث الشامل في اللوحة: زر 🔎 جنب الجرس، أو Ctrl+K. يبحث في الأقسام والطلبات والمنتجات والعملاء والدفعات
import { api, html, render } from '/assets/common.js';

const ICONS = { tab: '📂', order: '🧾', product: '🛍️', member: '🪙', batch: '📦', tag: '🏷️' };
const STYLE = `
.srch{border:0;border-radius:18px;padding:0;width:min(560px,calc(100vw - 24px));margin-top:10vh;color:var(--ink);background:var(--surface,#fff);box-shadow:0 24px 60px rgba(15,42,33,.3)}
.srch::backdrop{background:rgba(15,42,33,.45)}
.srch input{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--line);padding:18px 20px;font:inherit;font-size:17px;background:transparent;color:inherit;outline:none}
.srch ul{list-style:none;margin:0;padding:8px;max-height:60vh;overflow-y:auto}
.srch li button{width:100%;display:flex;gap:12px;align-items:center;text-align:start;border:0;background:none;padding:10px 12px;border-radius:12px;font:inherit;color:inherit;cursor:pointer}
.srch li button:hover,.srch li button[aria-selected=true]{background:var(--green-tint)}
.srch li small{display:block;color:var(--muted);font-size:13px}
.srch .srch-empty{padding:18px 20px;color:var(--muted);font-size:14px}`;

export function mountSearch({ go, onPick, tabsOnly = false }) {
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.append(s);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bell in-brand';
  btn.setAttribute('aria-label', 'بحث (Ctrl+K)');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  document.querySelector('.side .foot')?.prepend(btn);
  const d = document.createElement('dialog');
  d.className = 'srch';
  d.innerHTML = '<input type="search" placeholder="ابحث: رقم طلب، جوال عميل، منتج، رقم علامة…" aria-label="بحث"><ul role="listbox"></ul>';
  document.body.append(d);
  const input = d.querySelector('input');
  const list = d.querySelector('ul');
  let items = [], sel = 0, timer = 0, seq = 0;

  // أسماء الأقسام من القائمة نفسها، عشان «النقاط» أو «الأمان» توديك للقسم
  const tabs = () => [...document.querySelectorAll('#nav button[data-tab]')].filter((b) => !b.hidden).map((b) => ({ kind: 'tab', tab: b.dataset.tab, title: b.textContent.trim(), sub: 'قسم في اللوحة' }));
  const draw = () => {
    render(list, items.length
      ? html`${items.map((r, i) => html`<li><button type="button" role="option" data-i="${i}" aria-selected="${String(i === sel)}"><span aria-hidden="true">${ICONS[r.kind]}</span><span><b>${r.title}</b><small>${r.sub || ''}</small></span></button></li>`)}`
      : html`<li class="srch-empty">${input.value.trim().length < 2 ? 'اكتب حرفين أو أكثر' : 'ما لقينا شي بهالكلمة'}</li>`);
  };
  async function search() {
    const q = input.value.trim();
    const local = q ? tabs().filter((t) => t.title.includes(q)) : [];
    items = local;
    sel = 0;
    draw();
    if (q.length < 2 || tabsOnly) return;
    const my = ++seq;
    try {
      const { results } = await api('/api/m/search?q=' + encodeURIComponent(q));
      if (my !== seq) return;
      items = [...local, ...results];
      draw();
    } catch { /* نخلي نتائج الأقسام */ }
  }
  function pick(r) {
    if (!r) return;
    d.close();
    go(r.tab);
    onPick?.(r);
  }
  const open = () => { input.value = ''; items = []; draw(); d.showModal(); input.focus(); };
  btn.addEventListener('click', open);
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); } });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 250); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); draw(); }
    if (e.key === 'Enter') { e.preventDefault(); pick(items[sel]); }
  });
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) pick(items[Number(b.dataset.i)]); });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}

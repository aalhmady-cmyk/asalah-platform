// جرس التنبيهات في اللوحتين: كل التنبيهات في مكان واحد، مع عدد غير المقروء
import { api, html, render, toast, when } from '/assets/common.js';

const ICON = {
  new_order: '🧾', low_stock: '📦', report: '🚩', tag_anomaly: '⚠️', new_login: '🔐', unknown_wave: '🚨', weekly_summary: '📊', monthly_report: '📅',
  credit_request: '✨', credits_added: '✨', join_request: '📥', password_request: '🔑', staff_password: '🔑', guarantee: '🛡️', tag_request: '🏷️', store_request: '🛍️',
};

export function mountBell({ list, read, routes = {}, go }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bell';
  btn.setAttribute('aria-label', 'التنبيهات');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="bell-n" hidden></span>';
  const panel = document.createElement('div');
  panel.className = 'bell-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'التنبيهات');
  // الجرس جنب اسم اللوحة في القائمة (فوق في الجوال)، ولو ما فيه قائمة يطفو في الزاوية
  const host = document.querySelector('.side .brand');
  if (host) { btn.classList.add('in-brand'); host.append(btn); } else document.body.append(btn);
  document.body.append(panel);
  const badge = btn.querySelector('.bell-n');
  let data = { alerts: [], unread: 0 };

  const draw = () => {
    badge.hidden = !data.unread;
    badge.textContent = data.unread > 9 ? '9+' : data.unread;
    render(panel, html`
      <div class="bell-head"><b>التنبيهات</b>${data.unread ? html`<button type="button" class="link" data-read>تحديد الكل كمقروء</button>` : ''}</div>
      ${data.alerts.length
        ? html`<ul class="bell-list">${data.alerts.map((a) => html`<li class="${a.read_at ? '' : 'unread'}" data-kind="${a.kind}">
            <span class="bell-ic">${ICON[a.kind] || '🔔'}</span>
            <div><p>${a.message}</p><small>${a.merchant_name ? a.merchant_name + ' · ' : ''}${when(a.created_at)}</small></div></li>`)}</ul>`
        : html`<div class="bell-empty">ما فيه تنبيهات للحين 👌</div>`}`);
  };
  const load = async () => {
    try { data = await api(list); draw(); } catch { /* الصلاحية أو الشبكة: نسكت */ }
  };
  const open = (on) => {
    panel.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) load();
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(panel.hidden); });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target)) open(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
  panel.addEventListener('click', async (e) => {
    if (e.target.closest('[data-read]')) {
      try { await api(read, { method: 'POST', body: {} }); toast('تم'); await load(); } catch (err) { toast(err.message, true); }
      return;
    }
    const li = e.target.closest('li[data-kind]');
    if (li && routes[li.dataset.kind]) { open(false); go(routes[li.dataset.kind]); }
  });
  load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
  return { refresh: load };
}

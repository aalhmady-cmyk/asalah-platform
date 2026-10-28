// أدوات الواجهة المشتركة: طلبات الـ API، الهروب من HTML، التنسيق، الرسائل.

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ ok: false, message: 'رد غير متوقع من الخادم' }));
  if (res.status === 401 && data.code === 'unauthenticated' && !location.pathname.startsWith('/login')) {
    location.href = '/login/';
    throw new Error(data.message);
  }
  if (!res.ok) throw Object.assign(new Error(data.message || 'صار خطأ'), { status: res.status, data });
  return data;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// قالب HTML آمن: كل قيمة تنهرب إلا اللي ملفوفة بـ raw()
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s) });
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (Array.isArray(v)) out += v.map((x) => (x && x[RAW] != null ? x[RAW] : esc(x))).join('');
      else out += v && v[RAW] != null ? v[RAW] : esc(v);
    }
  });
  return raw(out);
}
export const render = (el, tpl) => { el.innerHTML = tpl[RAW]; };

export const num = (n) => (n == null ? '-' : Number(n).toLocaleString('en-US'));
export function when(sec) {
  if (!sec) return '-';
  const d = Math.floor(Date.now() / 1000) - sec;
  if (d < 0) return new Date(sec * 1000).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' });
  if (d < 60) return 'الآن';
  if (d < 3600) return `قبل ${Math.floor(d / 60)} دقيقة`;
  if (d < 86400) return `قبل ${Math.floor(d / 3600)} ساعة`;
  return new Date(sec * 1000).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric' });
}
export const dayLabel = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' });

export const RESULT = {
  original: ['أصلي', 'ok'],
  unknown: ['كود مزيّف', 'err'],
  blocked: ['موقوفة', 'err'],
  not_activated: ['غير مفعّلة', 'warn'],
  locked: ['مقفلة تلقائياً', 'err'],
  other_device: ['جهاز آخر', 'warn'],
};
export const TAG_STATUS = {
  active: ['مفعّلة', 'ok'],
  blocked_merchant: ['موقوفة من التاجر', 'err'],
  blocked_admin: ['موقوفة من الإدارة', 'err'],
  auto_locked: ['مقفلة تلقائياً', 'warn'],
};
export const BATCH_STATUS = { pending: ['بانتظار الشحن', ''], active: ['مفعّلة', 'ok'], blocked: ['موقوفة', 'err'] };
export const pill = (map, key) => {
  const [label, cls] = map[key] || [key, ''];
  return html`<span class="pill ${cls}">${label}</span>`;
};

let toastTimer;
export function toast(message, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = 'toast' + (isError ? ' err' : '');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4000);
}

// يربط نموذج بدالة: يمنع الإرسال المزدوج ويعرض الخطأ
export function onSubmit(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btns = form.querySelectorAll('[type=submit]');
    const data = Object.fromEntries(new FormData(form, e.submitter));
    btns.forEach((b) => (b.disabled = true));
    try {
      await fn(data, form);
    } catch (err) {
      toast(err.message, true);
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  });
}

export function bars(daily) {
  // آخر 14 يوم بتوقيت الرياض، والأيام الفاضية صفر
  const days = [];
  const today = new Date(Date.now() + 3 * 3600e3);
  for (let i = 13; i >= 0; i--) days.push(new Date(today - i * 86400e3).toISOString().slice(0, 10));
  const map = Object.fromEntries(daily.map((d) => [d.day, d.n]));
  const max = Math.max(1, ...days.map((d) => map[d] || 0));
  return html`<div class="bars" role="img" aria-label="المسحات اليومية لآخر 14 يوم">${days.map(
    (d, i) => html`<div class="bar ${i === 13 ? 'today' : ''}" title="${dayLabel(d)}: ${num(map[d] || 0)}"><span>${compact(map[d] || 0)}</span><i style="height:${Math.round(((map[d] || 0) / max) * 150)}px"></i></div>`
  )}</div>
  <div class="small muted" style="display:flex;justify-content:space-between"><span>${dayLabel(days[0])}</span><span>اليوم</span></div>`;
}
export const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));

export function hbars(rows) {
  if (!rows.length) return html`<div class="empty">ما فيه مسحات خلال آخر 7 أيام</div>`;
  const max = Math.max(...rows.map((r) => r.n));
  return html`${rows.map(
    (r) => html`<div class="hbar"><div class="top"><b>${r.city}</b><span class="muted">${num(r.n)}</span></div><div class="track"><div class="fill" style="width:${Math.round((r.n / max) * 100)}%"></div></div></div>`
  )}`;
}

export const LOGO = raw(
  '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="10" fill="none" stroke="#D9B45A" stroke-width="2"/><path d="M12 21l5 5 11-12" fill="none" stroke="#D9B45A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
);

// تبويبات اللوحة: الأزرار في القائمة الجانبية تعرض قسماً واحداً
export function tabs(nav, sections, onShow) {
  const show = (id) => {
    nav.querySelectorAll('button[data-tab]').forEach((b) => (b.dataset.tab === id ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    for (const s of sections) s.hidden = s.id !== id;
    history.replaceState(null, '', '#' + id);
    onShow(id);
  };
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) show(b.dataset.tab);
  });
  const start = location.hash.slice(1);
  show(sections.some((s) => s.id === start) ? start : sections[0].id);
  return show;
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/login/';
}

// الحرف الأول من اسم التاجر بدون "ال" التعريف، للشعار المؤقت
export const initial = (name) => name.trim().replace(/^ال(?=\S{2})/, '').charAt(0);

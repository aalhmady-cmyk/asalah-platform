// خريطة التقليد الحية: نقاط حمراء على مدن السعودية تتحدث كل 30 ثانية.
// ?mine=1 للتاجر (تقليد منتجاته بس)، ?admin=1 للوحة الأم. بدونهم: الخريطة العامة.
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const scope = q.get('mine') ? 'm' : q.get('admin') ? 'admin' : 'public';
const API = { m: '/api/m/fakes-map', admin: '/api/admin/fakes-map', public: '/api/public/fakes-map' }[scope];
let hours = Number(q.get('h')) || 168;
let lastTop = 0;

// حدود السعودية مبسّطة (خط عرض، خط طول)
const BORDER = [
  [29.36, 34.96], [29.19, 36.07], [29.87, 36.75], [30.5, 37.67], [31.5, 37.0], [32.15, 39.2], [31.37, 41.44], [30.0, 44.7], [29.1, 46.55],
  [28.53, 48.42], [27.4, 49.3], [26.8, 49.95], [26.3, 50.15], [25.6, 50.55], [24.75, 50.8], [24.6, 51.1], [24.25, 51.6], [22.7, 55.13],
  [20.0, 55.0], [19.0, 52.0], [18.6, 49.1], [17.3, 47.6], [17.05, 47.0], [17.4, 45.5], [17.3, 44.0], [16.7, 43.2], [16.37, 42.79],
  [16.9, 42.55], [18.2, 41.55], [19.7, 40.6], [20.5, 39.8], [21.49, 39.15], [22.8, 39.0], [24.09, 38.06], [25.0, 37.25], [26.24, 36.47],
  [27.35, 35.69], [28.0, 35.2], [28.85, 34.75],
];
const LABELS = [['الرياض', 24.71, 46.68], ['جدة', 21.49, 39.19], ['مكة', 21.39, 39.86], ['المدينة', 24.47, 39.61], ['الدمام', 26.42, 50.09], ['تبوك', 28.38, 36.57], ['أبها', 18.22, 42.5], ['حائل', 27.52, 41.69], ['بريدة', 26.33, 43.97], ['جازان', 16.89, 42.55], ['نجران', 17.49, 44.13], ['عرعر', 30.98, 41.02]];
const W = 600, H = 470, LON0 = 34, LON1 = 56, LAT0 = 16, LAT1 = 32.6, PAD = 18;
const xy = (lat, lon) => [PAD + ((lon - LON0) / (LON1 - LON0)) * (W - 2 * PAD), PAD + ((LAT1 - lat) / (LAT1 - LAT0)) * (H - 2 * PAD)];
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const svg = $('map');
const layer = svgEl('g', {});

function drawBase() {
  for (let x = 0; x <= W; x += 50) svg.append(svgEl('line', { x1: x, y1: 0, x2: x, y2: H, class: 'grid-l' }));
  for (let y = 0; y <= H; y += 50) svg.append(svgEl('line', { x1: 0, y1: y, x2: W, y2: y, class: 'grid-l' }));
  svg.append(svgEl('path', { d: 'M' + BORDER.map((p) => xy(...p).map((n) => n.toFixed(1)).join(',')).join('L') + 'Z', class: 'land' }));
  for (const [name, lat, lon] of LABELS) {
    const [x, y] = xy(lat, lon);
    svg.append(svgEl('circle', { cx: x, cy: y, r: 2.5, class: 'city-dot' }), svgEl('text', { x, y: y + 14, class: 'city-name', 'text-anchor': 'middle' }, name));
  }
  svg.append(layer);
}

const ago = (sec) => {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - sec);
  if (d < 60) return 'الحين';
  if (d < 3600) return `قبل ${Math.floor(d / 60)} د`;
  if (d < 86400) return `قبل ${Math.floor(d / 3600)} س`;
  return `قبل ${Math.floor(d / 86400)} يوم`;
};
const KIND = { unknown: 'كود مزيّف', blocked: 'علامة موقوفة', locked: 'علامة مقفلة', report: 'بلاغ عميل' };
const li = (cls, ...kids) => { const e = document.createElement('li'); if (cls) e.className = cls; e.append(...kids); return e; };
const tagEl = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };

// العداد يعدّ لين يوصل الرقم
function count(el, to) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to.toLocaleString('en-US'); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 900);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3)).toLocaleString('en-US');
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function load() {
  let d;
  try {
    const r = await fetch(`${API}?h=${hours}`, { credentials: 'same-origin' });
    if (r.status === 401) { location.href = scope === 'admin' ? '/admin/login/' : '/merchant/login/'; return; }
    d = await r.json();
    if (!d.ok) throw new Error(d.message);
  } catch {
    $('updated').textContent = 'تعذر التحديث، بنحاول مرة ثانية';
    return;
  }
  count($('s-ok'), d.totals.original);
  count($('s-bad'), d.totals.fake + (d.totals.reports || 0));
  count($('s-cities'), d.points.filter((p) => p.fakes + p.reports > 0).length);
  const max = Math.max(1, ...d.points.map((p) => p.fakes + p.reports));
  const nowS = Date.now() / 1000;
  const placed = [];
  layer.replaceChildren(...d.points.map((p) => {
    const [x, y] = xy(p.lat, p.lon);
    const n = p.fakes + p.reports;
    const r = 5 + Math.sqrt(n / max) * 20;
    const rep = p.reports > p.fakes ? ' rep' : '';
    const fresh = nowS - p.last < 3600 ? ' fresh' : '';
    const g = svgEl('g', { tabindex: 0, 'aria-label': `${p.city}: ${n}` });
    // إذا فيه اسم مدينة قريب (جدة ومكة مثلاً) ننزّل الاسم تحت النقطة
    let ly = y - r - 4;
    if (placed.some(([px, py]) => Math.abs(px - x) < 60 && Math.abs(py - ly) < 16)) ly = y + r + 14;
    placed.push([x, ly]);
    g.append(svgEl('circle', { cx: x, cy: y, r, class: 'pulse' + rep + fresh }), svgEl('circle', { cx: x, cy: y, r: Math.max(4, r * 0.55), class: 'hot' + rep }), svgEl('text', { x, y: ly, class: 'hot-label', 'text-anchor': 'middle' }, `${p.city} ${n}`));
    g.append(svgEl('title', {}, `${p.city}: ${p.fakes} تقليد، ${p.reports} بلاغ`));
    return g;
  }));
  const top = d.points.slice(0, 6);
  $('top').replaceChildren(...(top.length ? top.map((p) => { const bar = tagEl('div', null, 'bar'); const i = tagEl('i'); i.style.width = Math.round(((p.fakes + p.reports) / max) * 100) + '%'; bar.append(i); return li('', tagEl('b', p.city), bar, tagEl('span', String(p.fakes + p.reports))); }) : [li('mp-empty', 'ما فيه تقليد في هالمدة 👏')]));
  const newest = d.recent[0]?.at || 0;
  $('feed').replaceChildren(...(d.recent.length ? d.recent.map((e) => li(e.at > lastTop && lastTop ? 'new' : '', tagEl('i'), tagEl('span', `${KIND[e.result] || 'تقليد'} · ${e.city || 'مدينة غير معروفة'}`), tagEl('small', ago(e.at)))) : [li('mp-empty', 'ما فيه شي للحين')]));
  lastTop = Math.max(lastTop, newest);
  $('updated').textContent = 'آخر تحديث ' + new Date().toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
}

if (scope === 'm') { $('mp-title').textContent = 'خريطة تقليد منتجاتك'; $('home-link').href = '/merchant/#reports'; $('mp-sub').textContent = 'وين ينكشف تقليد منتجاتك لحظة بلحظة: أكواد مزيّفة باسمك، علامات موقوفة، وبلاغات العملاء.'; }
if (scope === 'admin') { $('mp-title').textContent = 'خريطة التقليد لكل التجار'; $('home-link').href = '/admin/'; }
document.querySelectorAll('.mp-range button').forEach((b) => {
  b.setAttribute('aria-selected', String(Number(b.dataset.h) === hours));
  b.addEventListener('click', () => {
    hours = Number(b.dataset.h);
    document.querySelectorAll('.mp-range button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    load();
  });
});
drawBase();
load();
setInterval(() => { if (!document.hidden) load(); }, 30000);

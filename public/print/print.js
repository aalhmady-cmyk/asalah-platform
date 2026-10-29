// يطبع ملصقات QR لدفعة: المدير بـ ?b=<رقم الدفعة>، والتاجر بـ ?code=<رمز الدفعة>
import { api, html, raw, render, toast } from '/assets/common.js';
import qrcode from '/assets/vendor/qrcode.mjs';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const base = q.get('b') ? `/api/admin/batches/${encodeURIComponent(q.get('b'))}/links` : `/api/m/batches/${encodeURIComponent((q.get('code') || '').toUpperCase())}/links`;
const form = $('pr-form');
let data = null;

const svg = (url) => {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
};

async function load(from, to) {
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  try {
    data = await api(base + (p.size ? '?' + p : ''));
  } catch (e) {
    $('pr-sub').textContent = e.message;
    render($('sheet'), html`<div class="pr-empty"><b>${e.message}</b></div>`);
    return;
  }
  form.from.value = data.from;
  form.to.value = data.to;
  form.from.max = form.to.max = data.batch.size;
  $('pr-title').textContent = `ملصقات ${data.batch.code}${data.batch.product_name ? ' · ' + data.batch.product_name : ''}`;
  $('pr-sub').textContent = `${data.merchant.name} · ${data.links.length} ملصق (من ${data.from} إلى ${data.to} من أصل ${data.batch.size})${data.batch.status !== 'active' ? ' · ⚠️ الدفعة موقوفة: فعّلها قبل ما تلصقها' : ''}`;
  draw();
}

function draw() {
  if (!data) return;
  const w = Number(form.size.value) / 10;
  const brand = form.brand.checked;
  $('sheet').style.setProperty('--w', w + 'cm');
  render($('sheet'), html`${data.links.map((l) => html`<div class="pr-label">${brand ? html`<span class="b">${data.merchant.name}</span>` : ''}${raw(svg(l.url))}<span class="c"><i>✓</i>امسح للتحقق</span><span class="n">${l.id}</span></div>`)}`);
}

form.size.addEventListener('change', draw);
form.brand.addEventListener('change', draw);
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const from = Number(form.from.value) || 1;
  let to = Number(form.to.value) || from;
  if (to - from + 1 > 1000) { to = from + 999; toast('أقصى 1000 ملصق بالمرة، اطبعها على دفعات'); }
  load(from, to);
});
$('pr-print').addEventListener('click', () => window.print());
load();

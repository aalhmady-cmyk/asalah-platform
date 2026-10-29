// شهادة "بائع معتمد" للطباعة: QR يفتح صفحة التحقق من المحل
import { api, html, raw, render } from '/assets/common.js';
import qrcode from '/assets/vendor/qrcode.mjs';

const $ = (id) => document.getElementById(id);
const id = Number(new URLSearchParams(location.search).get('id'));
const svg = (url) => { const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); return qr.createSvgTag({ cellSize: 1, margin: 1, scalable: true }); };

try {
  const d = await api(`/api/m/sellers/${id}/cert`);
  $('pr-sub').textContent = `${d.seller.name} · ${d.seller.city}`;
  render($('sheet'), html`<div class="cert">
    <span class="k">✅ بائع معتمد</span>
    <h2>${d.seller.name}</h2>
    <span class="pl">${d.seller.online ? 'متجر إلكتروني' : [d.seller.city, d.seller.address].filter(Boolean).join(' · ')}</span>
    <div class="qr">${raw(svg(d.url))}</div>
    <span class="scan">امسح وتأكد إننا نبيع الأصلي</span>
    <div class="brand">${d.merchant.logo_url ? html`<img src="${d.merchant.logo_url}" alt="">` : ''}<div><small>نقطة بيع رسمية لـ</small><b>${d.merchant.name}</b></div></div>
    <span class="foot">محمي بواسطة أصالة المنتجات الأصلية · alsalah-sa.com</span>
  </div>`);
} catch (e) {
  $('pr-sub').textContent = e.message;
}
$('pr-print').addEventListener('click', () => window.print());

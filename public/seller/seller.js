// صفحة "بائع معتمد": العميل يمسح QR المحل ويتأكد إنه نقطة بيع رسمية للعلامة
const $ = (id) => document.getElementById(id);
const s = new URLSearchParams(location.search).get('s') || '';
const show = (id, on = true) => ($(id).hidden = !on);

async function run() {
  let d;
  try {
    d = await (await fetch('/api/public/seller?s=' + encodeURIComponent(s))).json();
  } catch {
    d = { valid: false, message: 'تعذر الاتصال، حاول مرة ثانية' };
  }
  show('loading', false);
  if (!d.valid) {
    if (d.message) $('bad-msg').textContent = d.message;
    return show('bad');
  }
  $('s-name').textContent = d.seller.name;
  $('s-place').textContent = d.seller.online ? 'متجر إلكتروني' : [d.seller.city, d.seller.address].filter(Boolean).join(' · ');
  $('b-name').textContent = d.brand.name;
  if (d.brand.logo_url) { const i = document.createElement('img'); i.src = d.brand.logo_url; i.alt = ''; $('b-logo').replaceChildren(i); }
  else $('b-logo').textContent = d.brand.name.replace(/^ال(?=\S{2})/, '').charAt(0);
  if (d.seller.map_url) { $('s-map').href = d.seller.map_url; show('s-map'); }
  $('b-page').href = '/brand/?s=' + encodeURIComponent(d.brand.slug);
  document.title = `${d.seller.name} · بائع معتمد لـ ${d.brand.name}`;
  show('ok');
}
run();

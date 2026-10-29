// صفحات تفهمها محركات البحث وواتساب: صفحة لكل منتج ولكل متجر بصورته وسعره، وخريطة الموقع.
// الصفحة نفسها خفيفة (بدون سكربت)، وفيها زر يفتح التجربة الكاملة في متاجر أصالة.
import { imageUrl } from '../lib/images.js';
import { CATEGORIES } from '../lib/store.js';

const LIVE = "m.store_enabled=1 AND m.status='active' AND p.status='active' AND p.admin_blocked=0";
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const sar = (h) => (h / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const short = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));
// JSON داخل وسم script: نهرب < عشان ما يقفل الوسم
const ld = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const CSP = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function page({ origin, path, title, desc, image, body, jsonld, type = 'website' }) {
  const url = origin + path;
  const img = image ? (image.startsWith('http') ? image : origin + image) : origin + '/stores/icons/icon-512.png';
  return new Response(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title><meta name="description" content="${e(desc)}"><link rel="canonical" href="${e(url)}">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="متاجر أصالة"><meta property="og:locale" content="ar_SA">
<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0F2A21">
<link rel="icon" href="/stores/icons/icon-192.png"><link rel="manifest" href="/stores/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap">
${jsonld ? `<script type="application/ld+json">${ld(jsonld)}</script>` : ''}
<style>
*{box-sizing:border-box}body{margin:0;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;background:#F6F4EE;color:#13231C;line-height:1.6}
a{color:inherit}header{background:#0F2A21;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px}
header a{text-decoration:none;display:flex;align-items:center;gap:10px}header b{font-size:17px}header small{display:block;color:#D9B45A;font-size:12px}
main{max-width:960px;margin:0 auto;padding:20px 16px 48px}.p{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
.img{background:#fff;border-radius:20px;overflow:hidden;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:64px}
.img img{width:100%;height:100%;object-fit:cover}.m{color:#0E6B4E;font-weight:600;text-decoration:none}h1{font-size:26px;margin:6px 0 10px;line-height:1.3}
.price{font-size:24px;font-weight:700}.price s{color:#7A867F;font-size:16px;font-weight:400;margin-inline-start:8px}
.badge{display:inline-flex;gap:6px;align-items:center;background:#E7F2EC;color:#0B5A42;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600;margin:12px 0}
.desc{white-space:pre-line;color:#33453D}.btns{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border-radius:14px;font-weight:700;text-decoration:none;font-size:16px}
.gold{background:#D9B45A;color:#0F2A21}.dark{background:#0F2A21;color:#fff}.stars{color:#B8892A;font-weight:600}
h2{font-size:19px;margin:36px 0 12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.card{background:#fff;border-radius:16px;overflow:hidden;text-decoration:none;display:flex;flex-direction:column}.card .ci{aspect-ratio:1;background:#EEE9DD;display:flex;align-items:center;justify-content:center;font-size:36px}
.card img{width:100%;height:100%;object-fit:cover}.card span{padding:10px 12px 2px;font-weight:600;font-size:14px}.card b{padding:0 12px 12px;font-size:14px;color:#0E6B4E}
.mh{display:flex;align-items:center;gap:14px}.mh img,.mh .lg{width:72px;height:72px;border-radius:18px;object-fit:cover;background:#0F2A21;color:#D9B45A;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700}
footer{text-align:center;color:#7A867F;font-size:13px;padding:20px}
@media(max-width:720px){.p{grid-template-columns:minmax(0,1fr)}h1{font-size:22px}.btn{flex:1 1 100%}}
</style></head><body>
<header><a href="/stores/"><svg aria-hidden="true" width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#163A2D"/><path d="M24 26v-3a8 8 0 0 1 16 0v3" fill="none" stroke="#D9B45A" stroke-width="3.5" stroke-linecap="round"/><path d="M15 26h34l-3 24a4 4 0 0 1-4 3.5H22a4 4 0 0 1-4-3.5Z" fill="#D9B45A"/><path d="M25 39l5 5 9-10" fill="none" stroke="#0F2A21" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span><b>متاجر أصالة</b><small>كل منتج أصلي وموثّق</small></span></a></header>
<main>${body}</main><footer>متاجر أصالة · منتجات أصلية موثّقة من علامات سعودية</footer></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Content-Security-Policy': CSP } }
  );
}

const notFound = (origin) =>
  new Response(null, { status: 302, headers: { Location: origin + '/stores/' } });

const cardHtml = (p) =>
  `<a class="card" href="/stores/p/${p.id}"><div class="ci">${p.image_key ? `<img src="${e(imageUrl(p.image_key))}" alt="" loading="lazy">` : '🛍️'}</div><span>${e(short(p.title, 50))}</span><b>${p.price != null ? sar(p.price) + ' ر.س' : ''}</b></a>`;

async function productPage(env, origin, id) {
  const db = env.DB;
  const p = await db
    .prepare(`SELECT p.*,m.name AS merchant_name,m.slug AS merchant_slug FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=? AND ${LIVE}`)
    .bind(id)
    .first();
  if (!p) return notFound(origin);
  const more = (
    await db
      .prepare(`SELECT p.id,p.title,p.price,p.image_key FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.id<>? AND (p.merchant_id=? OR p.category=?) ORDER BY (p.merchant_id=?) DESC, p.clicks DESC LIMIT 8`)
      .bind(p.id, p.merchant_id, p.category, p.merchant_id)
      .all()
  ).results;
  const img = imageUrl(p.image_key);
  const price = p.price != null ? `${sar(p.price)} ر.س` : '';
  const rating = p.rating_n ? Math.round((p.rating_sum / p.rating_n) * 10) / 10 : null;
  const desc = short(`${p.title}${price ? ' بسعر ' + price : ''} من ${p.merchant_name}. أصلي وموثّق في متاجر أصالة. ${p.description || ''}`, 200);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: short(p.description || p.title, 500),
    image: img ? [origin + img] : undefined,
    brand: { '@type': 'Brand', name: p.merchant_name },
    category: CATEGORIES[p.category] || undefined,
    url: origin + '/stores/p/' + p.id,
    offers: p.price != null ? { '@type': 'Offer', price: (p.price / 100).toFixed(2), priceCurrency: 'SAR', availability: 'https://schema.org/InStock', url: p.buy_url } : undefined,
    aggregateRating: rating ? { '@type': 'AggregateRating', ratingValue: rating, reviewCount: p.rating_n } : undefined,
  };
  const body = `<article class="p">
  <div class="img">${img ? `<img src="${e(img)}" alt="${e(p.title)}">` : '🛍️'}</div>
  <div>
    <a class="m" href="/stores/m/${e(p.merchant_slug)}">${e(p.merchant_name)} ›</a>
    <h1>${e(p.title)}</h1>
    ${price ? `<div class="price">${price}${p.old_price && p.old_price > p.price ? `<s>${sar(p.old_price)} ر.س</s>` : ''}</div>` : ''}
    ${rating ? `<div class="stars">★ ${rating} <small>(${p.rating_n} تقييم)</small></div>` : ''}
    <div class="badge">🛡️ أصلي موثّق من أصالة</div>
    <div class="btns"><a class="btn gold" href="/stores/?p=${p.id}">افتح في متاجر أصالة</a><a class="btn dark" href="${e(p.buy_url)}" rel="noopener">اشتر الآن من ${e(p.merchant_name)} ↗</a></div>
    ${p.description ? `<p class="desc">${e(p.description)}</p>` : ''}
  </div></article>
  ${more.length ? `<h2>منتجات أصلية ممكن تعجبك</h2><div class="grid">${more.map(cardHtml).join('')}</div>` : ''}`;
  return page({ origin, path: '/stores/p/' + p.id, title: `${p.title}${price ? ' | ' + price : ''} | ${p.merchant_name}`, desc, image: img, body, jsonld, type: 'product' });
}

async function merchantPage(env, origin, slug) {
  const db = env.DB;
  const m = await db.prepare("SELECT id,name,slug,logo_key,about FROM merchants WHERE slug=? AND store_enabled=1 AND status='active'").bind(slug).first();
  if (!m) return notFound(origin);
  const items = (
    await db.prepare(`SELECT p.id,p.title,p.price,p.image_key FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} AND p.merchant_id=? ORDER BY p.id DESC LIMIT 120`).bind(m.id).all()
  ).results;
  const logo = imageUrl(m.logo_key);
  const desc = short(`تسوّق منتجات ${m.name} الأصلية والموثّقة في متاجر أصالة. ${m.about || ''}`, 200);
  const body = `<div class="mh">${logo ? `<img src="${e(logo)}" alt="">` : `<span class="lg">${e(m.name.trim()[0])}</span>`}<div><h1>${e(m.name)}</h1><div class="badge">🛡️ متجر موثّق في أصالة</div></div></div>
  ${m.about ? `<p class="desc">${e(m.about)}</p>` : ''}
  <div class="btns"><a class="btn gold" href="/stores/?m=${e(m.slug)}">افتح المتجر في متاجر أصالة</a></div>
  <h2>المنتجات (${items.length})</h2><div class="grid">${items.map(cardHtml).join('')}</div>`;
  return page({
    origin,
    path: '/stores/m/' + m.slug,
    title: `${m.name} | متاجر أصالة`,
    desc,
    image: logo || (items[0]?.image_key ? imageUrl(items[0].image_key) : null),
    body,
    jsonld: { '@context': 'https://schema.org', '@type': 'Store', name: m.name, url: origin + '/stores/m/' + m.slug, image: logo ? origin + logo : undefined },
  });
}

async function sitemap(env, origin) {
  const db = env.DB;
  const [ps, ms] = await Promise.all([
    db.prepare(`SELECT p.id,p.updated_at FROM store_products p JOIN merchants m ON m.id=p.merchant_id WHERE ${LIVE} ORDER BY p.id DESC LIMIT 20000`).all(),
    db.prepare("SELECT slug FROM merchants WHERE store_enabled=1 AND status='active'").all(),
  ]);
  const day = (t) => new Date((t || 0) * 1000).toISOString().slice(0, 10);
  const urls = [
    `<url><loc>${origin}/</loc></url>`,
    `<url><loc>${origin}/stores/</loc><changefreq>daily</changefreq></url>`,
    `<url><loc>${origin}/privacy/</loc></url>`,
    `<url><loc>${origin}/terms/</loc></url>`,
    ...ms.results.map((m) => `<url><loc>${origin}/stores/m/${e(m.slug)}</loc><changefreq>daily</changefreq></url>`),
    ...ps.results.map((p) => `<url><loc>${origin}/stores/p/${p.id}</loc><lastmod>${day(p.updated_at)}</lastmod></url>`),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function handleSeo(req, env, path) {
  const origin = env.PUBLIC_ORIGIN || new URL(req.url).origin;
  if (path === '/robots.txt')
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /merchant/\nDisallow: /login/\nDisallow: /api/\nDisallow: /report/\nDisallow: /print/\nDisallow: /seller/\nSitemap: ${origin}/sitemap.xml\n`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    });
  if (path === '/sitemap.xml') return sitemap(env, origin);
  let match;
  if ((match = path.match(/^\/stores\/p\/(\d{1,9})\/?$/))) return productPage(env, origin, Number(match[1]));
  if ((match = path.match(/^\/stores\/m\/([a-z0-9-]{2,40})\/?$/))) return merchantPage(env, origin, match[1]);
  return null;
}

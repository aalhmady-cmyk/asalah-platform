// متاجر أصالة: الفئات، تجهيز بيانات المنتج، وسحب بيانات منتج من رابط متجر التاجر (سلة غالباً).
import { fail, str, url } from './util.js';

export const CATEGORIES = {
  perfume: 'عطور وبخور',
  coffee: 'قهوة وشاي',
  food: 'تمور وأغذية',
  health: 'صحة ومكملات',
  beauty: 'عناية وتجميل',
  fashion: 'أزياء',
  accessories: 'شنط وإكسسوارات',
  watches: 'ساعات',
  home: 'المنزل',
  kids: 'أطفال',
  electronics: 'إلكترونيات',
  other: 'أخرى',
};

export const REEL_MIN = 10;
export const REEL_MAX = 30;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
// الفيديو الأصلي (بدون إعادة تسجيل) يكون أكبر. حد طلب Workers 100 ميجا
export const ORIGINAL_MAX_BYTES = 95 * 1024 * 1024;

// السعر يجي بالريال (ويقبل كسور)، ويتخزن بالهللة
export function halalas(v, label, { optional = false } = {}) {
  if (v == null || v === '') {
    if (optional) return null;
    fail(400, 'أدخل ' + label);
  }
  const n = Number(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,،\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) fail(400, 'تحقق من ' + label);
  return Math.round(n * 100);
}

export function productFields(b, partial) {
  const f = {};
  const has = (k) => !partial || k in b;
  if (has('title')) f.title = str(b.title, 'اسم المنتج', { min: 2, max: 120 });
  if (has('description')) f.description = str(b.description, 'الوصف', { max: 1500, optional: true });
  if (has('category')) {
    f.category = b.category || 'other';
    if (!CATEGORIES[f.category]) fail(400, 'الفئة غير معروفة');
  }
  if (has('price')) f.price = halalas(b.price, 'السعر');
  if (has('old_price')) f.old_price = halalas(b.old_price, 'السعر قبل الخصم', { optional: true });
  if (has('buy_url')) f.buy_url = url(b.buy_url, 'المنتج في متجرك', { optional: false });
  if (has('status')) {
    f.status = b.status || 'active';
    if (!['active', 'hidden'].includes(f.status)) fail(400, 'الحالة غير معروفة');
  }
  if (f.old_price != null && f.price != null && f.old_price <= f.price) f.old_price = null;
  return f;
}

// ---------- سحب بيانات منتج من رابطه ----------
const decode = (s) =>
  String(s ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();

function meta(html, names) {
  for (const n of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${n}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return decode(m[1]);
  }
  return null;
}

// يدوّر على منتج في JSON-LD (سلة وزد وشوبيفاي يحطونه)
function jsonLdProduct(html) {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b.replace(/^<script[^>]*>|<\/script>$/gi, '')); } catch { continue; }
    const list = [data, ...(Array.isArray(data) ? data : []), ...(Array.isArray(data?.['@graph']) ? data['@graph'] : [])];
    for (const d of list) {
      const t = d && d['@type'];
      if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return d;
    }
  }
  return null;
}

async function readCapped(res, max) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); break; }
    chunks.push(value);
  }
  const out = new Uint8Array(Math.min(size, max));
  let o = 0;
  for (const c of chunks) { out.set(c.subarray(0, out.length - o), o); o += c.length; if (o >= out.length) break; }
  return out;
}

export async function importLink(link) {
  const u = url(link, 'المنتج', { optional: false });
  let res;
  try {
    res = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AsalahBot/1.0)', Accept: 'text/html' }, signal: AbortSignal.timeout(9000) });
  } catch {
    fail(502, 'ما قدرنا نفتح الرابط. تأكد إنه رابط منتج يفتح عندك');
  }
  if (!res.ok) fail(502, 'الرابط ما فتح (' + res.status + ')');
  const html = new TextDecoder().decode(await readCapped(res, 1_500_000));
  const ld = jsonLdProduct(html);
  const offer = ld && (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers);
  const ldImage = ld && (Array.isArray(ld.image) ? ld.image[0] : ld.image);
  let title = (ld && decode(ld.name)) || meta(html, ['og:title', 'twitter:title']) || decode((html.match(/<title[^>]*>([^<]*)/i) || [])[1]);
  const description = (ld && decode(ld.description)) || meta(html, ['og:description', 'description', 'twitter:description']);
  const priceRaw = (offer && (offer.price ?? offer.lowPrice)) ?? meta(html, ['product:price:amount', 'og:price:amount', 'twitter:data1']);
  const price = Number(String(priceRaw ?? '').replace(/[^\d.]/g, ''));
  let image = (typeof ldImage === 'string' ? ldImage : ldImage?.url) || meta(html, ['og:image', 'og:image:secure_url', 'twitter:image']);
  if (image) {
    try { image = new URL(image, res.url).toString(); } catch { image = null; }
    if (image && !image.startsWith('https:')) image = null;
  }
  if (title) title = title.replace(/\s*[|\-–]\s*[^|\-–]{2,40}$/, '').slice(0, 120);
  if (!title) fail(422, 'ما لقينا بيانات منتج في الرابط. جرّب رابط صفحة المنتج نفسها');
  return {
    title,
    description: description ? description.slice(0, 1500) : null,
    price: price > 0 && price < 1_000_000 ? price : null,
    image,
    buy_url: res.url && res.url.startsWith('https:') ? res.url : u,
  };
}

// يجيب صورة خارجية للتاجر عشان المتصفح يصغّرها ويرفعها (المتصفح ما يقدر يقرأها مباشرة بسبب CORS)
export async function proxyImage(link) {
  const u = url(link, 'الصورة', { optional: false });
  let res;
  try {
    res = await fetch(u, { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(9000) });
  } catch {
    fail(502, 'ما قدرنا نجيب الصورة');
  }
  const type = (res.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!res.ok || !/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) fail(415, 'الرابط مو صورة');
  const buf = await readCapped(res, 8 * 1024 * 1024 + 1);
  if (buf.length > 8 * 1024 * 1024) fail(413, 'الصورة كبيرة جداً');
  return new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" } });
}

// ---------- الفيديو ----------
// MP4 و MOV (فيديو الآيفون) يبدأون بصندوق ftyp، وبعض MOV القديمة بـ moov أو wide أو mdat
const MP4_BOXES = new Set(['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip']);
export function videoType(buf) {
  if (buf.length > 12 && MP4_BOXES.has(String.fromCharCode(buf[4], buf[5], buf[6], buf[7]))) return { type: 'video/mp4', ext: 'mp4' };
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { type: 'video/webm', ext: 'webm' };
  return null;
}

const MEDIA_RE = /^reels\/[0-9]+\/[a-f0-9]{24}\.(mp4|webm)$/;

// يقدّم الفيديو من R2 مع دعم Range (سفاري ما يشغّل الفيديو بدونه)
export async function serveMedia(req, env, path) {
  const key = path.slice('/media/'.length);
  if (!env.MEDIA || !MEDIA_RE.test(key)) return new Response('Not found', { status: 404 });
  // نقرأ Range بأنفسنا: bytes=a-b أو bytes=a- أو bytes=-n
  const m = (req.headers.get('Range') || '').match(/^bytes=(\d*)-(\d*)$/);
  let range;
  if (m && m[1]) range = m[2] ? { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 } : { offset: Number(m[1]) };
  else if (m && m[2]) range = { suffix: Number(m[2]) };
  if (range && (range.length <= 0 || range.suffix === 0)) range = undefined;
  let obj;
  try {
    obj = await env.MEDIA.get(key, range ? { range } : {});
  } catch {
    return new Response('Range Not Satisfiable', { status: 416 });
  }
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers({
    'Content-Type': obj.httpMetadata?.contentType || (key.endsWith('.mp4') ? 'video/mp4' : 'video/webm'),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: obj.httpEtag,
  });
  if (range) {
    const offset = 'suffix' in range ? Math.max(0, obj.size - range.suffix) : Math.min(range.offset, obj.size);
    const end = 'length' in range ? Math.min(obj.size, offset + range.length) - 1 : obj.size - 1;
    headers.set('Content-Range', `bytes ${offset}-${end}/${obj.size}`);
    headers.set('Content-Length', String(end - offset + 1));
  } else headers.set('Content-Length', String(obj.size));
  const ranged = !!range;
  return new Response(req.method === 'HEAD' ? null : obj.body, { status: ranged ? 206 : 200, headers });
}

// ---------- سحب كل منتجات المتجر من خريطة الموقع (سلة وزد وشوبيفاي ينشرونها) ----------
const PRODUCT_URL = /\/p\d{4,}(?:[/?#]|$)|\/products?\/[^/]+|\/product-[^/]+/i;

async function fetchText(u, max = 3_000_000) {
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AsalahBot/1.0)' }, redirect: 'follow', signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    return new TextDecoder().decode(await readCapped(res, max));
  } catch {
    return null;
  }
}
const locs = (xml) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decode(m[1]));

export async function discoverProducts(storeUrl) {
  const base = new URL(url(storeUrl, 'متجرك في سلة', { optional: false }));
  const origin = base.origin;
  const queue = [origin + '/sitemap.xml', origin + '/sitemap_index.xml'];
  const robots = await fetchText(origin + '/robots.txt', 100_000);
  if (robots) for (const m of robots.matchAll(/^sitemap:\s*(\S+)/gim)) queue.unshift(m[1]);
  const seen = new Set(), products = new Set();
  // نقرأ 8 خرائط كحد أقصى، ونبدأ باللي اسمها فيه product
  while (queue.length && seen.size < 8 && products.size < 300) {
    queue.sort((a, b) => /product/i.test(b) - /product/i.test(a));
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const xml = await fetchText(u);
    if (!xml) continue;
    for (const l of locs(xml)) {
      let lu;
      try { lu = new URL(l); } catch { continue; }
      if (lu.protocol !== 'https:') continue;
      if (/\.xml(\.gz)?$/i.test(lu.pathname)) { if (!seen.has(l)) queue.push(l); }
      else if (lu.origin === origin && PRODUCT_URL.test(lu.pathname)) products.add(lu.toString());
    }
  }
  if (!products.size) fail(422, 'ما لقينا منتجات في خريطة متجرك. تأكد من رابط المتجر، أو أضف المنتجات بروابطها وحدة وحدة');
  return [...products];
}

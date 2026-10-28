// صور المنتجات والشعارات في R2. الرفع يجي كملف خام (مو multipart)، والواجهة تصغّر الصورة قبل الرفع.
import { fail, randomHex } from './util.js';

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { ext: 'webp', magic: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 },
};
const KEY_RE = /^(logos|products)\/[0-9]+\/[a-f0-9]{24}\.(jpg|png|webp)$/;

export const imageUrl = (key) => (key ? '/img/' + key : null);

function bucket(env) {
  if (!env.IMAGES) fail(503, 'تخزين الصور غير مرتبط باسم IMAGES');
  return env.IMAGES;
}

// يحفظ الصورة ويرجع مفتاحها. kind = logos أو products
export async function saveImage(env, req, kind, merchantId) {
  const type = (req.headers.get('Content-Type') || '').split(';')[0].trim();
  const t = TYPES[type];
  if (!t) fail(415, 'الصورة لازم تكون JPG أو PNG أو WEBP');
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BYTES) fail(413, 'حجم الصورة أكبر من 2 ميجا');
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length) fail(400, 'الصورة فاضية');
  if (buf.length > MAX_BYTES) fail(413, 'حجم الصورة أكبر من 2 ميجا');
  if (!t.magic(buf)) fail(415, 'الملف مو صورة صالحة');
  const key = `${kind}/${merchantId}/${randomHex(12)}.${t.ext}`;
  await bucket(env).put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  return key;
}

export async function deleteImage(env, key) {
  if (key && KEY_RE.test(key)) await bucket(env).delete(key);
}

export async function serveImage(env, path) {
  const key = path.slice('/img/'.length);
  if (!KEY_RE.test(key)) return new Response('Not found', { status: 404 });
  const obj = await bucket(env).get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      ETag: obj.httpEtag,
    },
  });
}

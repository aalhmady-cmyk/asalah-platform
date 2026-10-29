// تشفير الإشعارات: نفك الرسالة كأننا الجوال (RFC 8291) ونتأكد إنها نفسها
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { b64u, encryptPayload, unb64u, validEndpoint } from '../src/lib/push.js';

const subtle = crypto.subtle;
const hkdf = async (salt, ikm, info, n) => new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
const enc = new TextEncoder();
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

test('الإشعار ينفك عند المشترك بنفس النص', async () => {
  const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = new Uint8Array(await subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const msg = JSON.stringify({ title: 'عرض 🔥', body: 'خصم 20%' });
  const buf = await encryptPayload(b64u(uaPub), b64u(auth), msg);
  const salt = buf.slice(0, 16), idlen = buf[20], asPub = buf.slice(21, 21 + idlen), ct = buf.slice(21 + idlen);
  assert.equal(new DataView(buf.buffer).getUint32(16), 4096);
  const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
  assert.equal(pt[pt.length - 1], 2);
  assert.equal(new TextDecoder().decode(pt.slice(0, -1)), msg);
  assert.deepEqual(unb64u(b64u(uaPub)), uaPub);
});

test('روابط خدمات الإشعارات المسموحة بس', () => {
  assert.ok(validEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
  assert.ok(validEndpoint('https://web.push.apple.com/QH'));
  assert.ok(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(!validEndpoint('http://fcm.googleapis.com/x'));
  assert.ok(!validEndpoint('https://evil.com/fcm.googleapis.com'));
  assert.ok(!validEndpoint('https://fcm.googleapis.com.evil.com/x'));
  assert.ok(!validEndpoint('https://169.254.169.254/'));
});

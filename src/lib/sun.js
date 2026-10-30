// شرائح NTAG 424 DNA (SUN): كل لمسة تولّد رابط جديد فيه عدّاد مشفّر وتوقيع AES-CMAC.
//
// الرابط: <origin>/v/?t=<token>&e=<PICCData 32hex>&c=<CMAC 16hex>
//   e = AES-128-CBC(K_meta, IV=0)  ← [0xC7][UID 7 bytes][SDMReadCtr 3 bytes LE][عشوائي]
//   c = CMAC(K_ses, "") بعد أخذ البايتات الفردية، و K_ses = CMAC(K_file, 3CC3 0001 0080 ‖ UID ‖ Ctr)
// المفاتيح لكل دفعة، مشتقة من TAG_SECRET، فما نخزّن أي مفتاح في القاعدة.
import { signText } from './tags.js';

const HEX_RE = /^[0-9a-fA-F]+$/;
const ZERO = new Uint8Array(16);
const fromHex = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
export const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const xor = (a, b) => a.map((x, i) => x ^ b[i]);

const aesKey = (raw) => crypto.subtle.importKey('raw', raw, 'AES-CBC', false, ['encrypt', 'decrypt']);
// تشفير بلوك واحد (ECB) = أول بلوك من CBC بمتجه صفري
async function encBlock(key, block) {
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ZERO }, key, block)).slice(0, 16);
}
// فك بلوك واحد بدون حشو: نضيف بلوك حشو صحيح عشان WebCrypto يقبله
async function decBlock(key, block) {
  const pad = await encBlock(key, xor(new Uint8Array(16).fill(16), block));
  const both = new Uint8Array(32);
  both.set(block);
  both.set(pad, 16);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ZERO }, key, both));
}

function shift(b) {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = ((b[i] << 1) | (i < 15 ? b[i + 1] >> 7 : 0)) & 0xff;
  if (b[0] & 0x80) out[15] ^= 0x87;
  return out;
}

// AES-CMAC (RFC 4493)
export async function cmac(rawKey, msg) {
  const key = await aesKey(rawKey);
  const k1 = shift(await encBlock(key, ZERO));
  const k2 = shift(k1);
  const n = Math.max(1, Math.ceil(msg.length / 16));
  const full = msg.length > 0 && msg.length % 16 === 0;
  let x = new Uint8Array(16);
  for (let i = 0; i < n; i++) {
    let blk = new Uint8Array(16);
    blk.set(msg.slice(i * 16, i * 16 + 16));
    if (i === n - 1) {
      if (full) blk = xor(blk, k1);
      else { blk[msg.length - i * 16] = 0x80; blk = xor(blk, k2); }
    }
    x = await encBlock(key, xor(x, blk));
  }
  return x;
}

// مفاتيح الدفعة (للمصنع وللتحقق): 16 بايت لكل مفتاح
export async function batchKeys(env, batch) {
  const derive = async (label) => {
    const s = await signText(env, `sun:${label}:${batch.id}:${batch.salt}`, 43);
    const b = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0));
    return b.slice(0, 16);
  };
  return { meta: await derive('meta'), file: await derive('file') };
}

// يرجع {uid, ctr} لو الرابط من الشريحة نفسها، و null لو التوقيع غلط أو الصيغة خربانة
export async function readSun(env, batch, e, c) {
  if (typeof e !== 'string' || typeof c !== 'string' || e.length !== 32 || c.length !== 16 || !HEX_RE.test(e) || !HEX_RE.test(c)) return null;
  return readSunWith(await batchKeys(env, batch), e, c);
}

export async function readSunWith(keys, e, c) {
  const plain = await decBlock(await aesKey(keys.meta), fromHex(e));
  if (plain[0] !== 0xc7) return null;
  const uid = plain.slice(1, 8);
  const ctrBytes = plain.slice(8, 11);
  const sv2 = new Uint8Array(16);
  sv2.set([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]);
  sv2.set(uid, 6);
  sv2.set(ctrBytes, 13);
  const ses = await cmac(keys.file, sv2);
  const full = await cmac(ses, new Uint8Array(0));
  const mac = Uint8Array.from({ length: 8 }, (_, i) => full[i * 2 + 1]);
  const given = fromHex(c);
  let diff = 0;
  for (let i = 0; i < 8; i++) diff |= mac[i] ^ given[i];
  if (diff) return null;
  return { uid: toHex(uid), ctr: ctrBytes[0] | (ctrBytes[1] << 8) | (ctrBytes[2] << 16) };
}

// للاختبارات: يولّد e و c مثل اللي تولّدها الشريحة. المفاتيح hex أو بايتات
export async function makeSun(keys, uidHex, ctr) {
  keys = { meta: typeof keys.meta === 'string' ? fromHex(keys.meta) : keys.meta, file: typeof keys.file === 'string' ? fromHex(keys.file) : keys.file };
  const plain = new Uint8Array(16);
  plain[0] = 0xc7;
  plain.set(fromHex(uidHex), 1);
  plain.set([ctr & 0xff, (ctr >> 8) & 0xff, (ctr >> 16) & 0xff], 8);
  crypto.getRandomValues(plain.subarray(11));
  const e = await encBlock(await aesKey(keys.meta), plain);
  const sv2 = new Uint8Array(16);
  sv2.set([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]);
  sv2.set(plain.slice(1, 11), 6);
  const full = await cmac(await cmac(keys.file, sv2), new Uint8Array(0));
  return { e: toHex(e), c: toHex(Uint8Array.from({ length: 8 }, (_, i) => full[i * 2 + 1])) };
}

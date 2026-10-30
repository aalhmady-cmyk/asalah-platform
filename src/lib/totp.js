// رموز تطبيق المصادقة (TOTP، 6 أرقام كل 30 ثانية) مثل Google Authenticator
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = '', out = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret) {
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  return Uint8Array.from(bits.match(/.{8}/g) || [], (b) => parseInt(b, 2));
}

export async function codeAt(secret, counter) {
  const key = await crypto.subtle.importKey('raw', decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[19] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

// يرجع رقم الفترة اللي طابق (عشان ما ينقبل نفس الرمز مرتين)، أو 0. نسمح بفرق 30 ثانية للساعة
export async function checkCode(secret, code, last = 0, t = Date.now() / 1000) {
  if (!/^\d{6}$/.test(String(code || ''))) return 0;
  const now = Math.floor(t / 30);
  for (const c of [now, now - 1, now + 1]) {
    if (c > last && (await codeAt(secret, c)) === code) return c;
  }
  return 0;
}

export const otpauthUrl = (secret, account) =>
  `otpauth://totp/${encodeURIComponent('Asalah:' + account)}?secret=${secret}&issuer=Asalah&digits=6&period=30`;

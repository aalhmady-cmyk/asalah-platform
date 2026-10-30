// Cloudflare Turnstile: تأكيد إن اللي يرسل النموذج إنسان مو بوت.
// يشتغل بس إذا أضاف المدير TURNSTILE_SITE_KEY و TURNSTILE_SECRET في Cloudflare، وإلا يعدّي بدون فحص.
import { fail, ipOf } from './util.js';

export const turnstileKey = (env) => (env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET ? env.TURNSTILE_SITE_KEY : null);

export async function requireHuman(env, req, token) {
  if (!turnstileKey(env)) return;
  if (typeof token !== 'string' || !token || token.length > 2048) fail(403, 'حدّث الصفحة وجرّب مرة ثانية (تأكيد إنك مو برنامج آلي)', 'human_check');
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  form.append('remoteip', ipOf(req));
  let ok = false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    ok = Boolean((await r.json()).success);
  } catch (e) {
    // لو خدمة Cloudflare نفسها ما ردّت، ما نوقف الناس
    console.error('ASALAH_TURNSTILE', e?.stack || e);
    return;
  }
  if (!ok) fail(403, 'ما قدرنا نتأكد إنك مو برنامج آلي، حدّث الصفحة وجرّب', 'human_check');
}

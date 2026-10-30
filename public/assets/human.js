// Turnstile من Cloudflare: يطلع رمز يثبت إن المرسل إنسان. لو المدير ما فعّله يرجع null والنموذج يمشي عادي.
let keyP = null, scriptP = null, box = null;

const siteKey = () => (keyP ||= fetch('/api/public/human').then((r) => r.json()).then((d) => d.site_key || null).catch(() => null));

function loadScript() {
  return (scriptP ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { scriptP = null; reject(new Error('تعذر تحميل التحقق، تأكد من الاتصال')); };
    document.head.append(s);
  }));
}

// نطلب الرمز وقت الإرسال. في الغالب ما يشوف العميل شي، وإذا احتاج Cloudflare تأكيد يطلع مربع صغير
export async function humanToken() {
  const key = await siteKey();
  if (!key) return null;
  const ts = await loadScript();
  if (!box) {
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset-inline:0;bottom:16px;display:flex;justify-content:center;z-index:9999;pointer-events:none';
    document.body.append(box);
  }
  box.replaceChildren();
  const slot = document.createElement('div');
  slot.style.pointerEvents = 'auto';
  box.append(slot);
  return new Promise((resolve, reject) => {
    ts.render(slot, {
      sitekey: key,
      appearance: 'interaction-only',
      language: document.documentElement.lang === 'en' ? 'en' : 'ar',
      callback: (t) => { resolve(t); setTimeout(() => slot.remove(), 300); },
      'error-callback': () => { reject(new Error('ما قدرنا نتأكد إنك مو برنامج آلي، حدّث الصفحة وجرّب')); slot.remove(); },
      'timeout-callback': () => { reject(new Error('انتهت مهلة التأكيد، جرّب مرة ثانية')); slot.remove(); },
    });
  });
}

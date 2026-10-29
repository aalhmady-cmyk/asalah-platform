// تثبيت اللوحة (التاجر أو الأم) كتطبيق على الجوال، وتفعيل تنبيهاتها كإشعارات
import { api, html, raw, render, toast } from '/assets/common.js';

const ua = navigator.userAgent;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const iosSafari = isIOS && !/CriOS|FxiOS|EdgiOS/i.test(ua);
// متصفحات أندرويد غير Chrome تبني التطبيق بنفسها وحماية جوجل تحظره، فنوجّه لـ Chrome
const otherAndroid = /android/i.test(ua) && /SamsungBrowser|MiuiBrowser|HuaweiBrowser|HeyTapBrowser|OppoBrowser|VivoBrowser|UCBrowser|YaBrowser|OPR\/|EdgA|; wv\)/i.test(ua);
const pushOk = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const store = {
  get: (k) => { try { return Number(localStorage.getItem(k) || 0); } catch { return 0; } },
  set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} },
};
const b64ToBytes = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0)); };

export function initPanelApp({ scope, title, what }) {
  const KEY = 'asalah_install_x' + scope, PKEY = 'asalah_push_x' + scope;
  const chromeUrl = `intent://${location.host}${scope}?src=chrome#Intent;scheme=https;package=com.android.chrome;end`;
  let evt = null, subscribed = false;
  const reg = 'serviceWorker' in navigator ? navigator.serviceWorker.register(scope + 'sw.js', { scope }).catch(() => null) : Promise.resolve(null);

  async function currentSub() {
    const r = await reg;
    return r?.pushManager ? r.pushManager.getSubscription() : null;
  }
  async function enable() {
    try {
      if (await Notification.requestPermission() !== 'granted') { store.set(PKEY, Date.now()); return draw(); }
      const r = await reg;
      const { key } = await api('/api/public/push/key');
      const sub = (await r.pushManager.getSubscription()) || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      const j = sub.toJSON();
      await api('/api/u/push/subscribe', { method: 'POST', body: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } });
      subscribed = true;
      const t = await api('/api/u/push/test', { method: 'POST', body: { endpoint: j.endpoint } }).catch(() => ({}));
      toast(t.sent ? 'تم ✅ أرسلنا لك إشعار تجربة' : 'تم تفعيل التنبيهات ✅');
    } catch (e) {
      toast(e.message || 'ما قدرنا نفعّل التنبيهات، جرّب بعدين', true);
    }
    draw();
  }

  function draw() {
    const box = document.getElementById('app-install');
    if (!box) return;
    const mobile = matchMedia('(max-width: 900px)').matches || isIOS || /android/i.test(ua);
    const hide = (k) => Date.now() - store.get(k) < 14 * 86400e3;
    let card = null;
    if (!standalone() && mobile && !hide(KEY) && (evt || isIOS || otherAndroid)) {
      let how, btn = '';
      if (otherAndroid) {
        how = 'افتحها في Chrome وثبّتها من هناك، عشان حماية جوجل تقبل التطبيق.';
        btn = html`<a class="btn btn-primary" href="${chromeUrl}">افتح في Chrome وثبّت</a>`;
      } else if (isIOS) {
        how = iosSafari
          ? html`في سفاري: اضغط زر المشاركة <b>⬆️</b> تحت، بعدها <b>«إضافة إلى الشاشة الرئيسية»</b>، ثم <b>«إضافة»</b>.`
          : 'افتح هذي الصفحة في سفاري، بعدها اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية».';
      } else {
        how = 'ثبّتها على شاشة جوالك، وتفتح بضغطة مثل أي تطبيق بدون ما تكتب الرابط.';
        btn = html`<button type="button" class="btn btn-primary" data-app-install>ثبّت التطبيق</button>`;
      }
      card = [`📲 نزّل ${title} كتطبيق`, how, btn, 'data-app-x'];
    } else if (pushOk && !subscribed && (standalone() || !isIOS) && Notification.permission !== 'denied' && !hide(PKEY)) {
      card = ['🔔 فعّل تنبيهات الجوال', `يوصلك إشعار على جوالك ${what}.`, html`<button type="button" class="btn btn-primary" data-push-on>فعّل التنبيهات</button>`, 'data-push-later'];
    }
    box.hidden = !card;
    if (!card) return render(box, html``);
    const [h, p, btn, later] = card;
    render(box, html`<div class="card app-install">
      <img src="${scope}icons/icon-192.png" alt="" width="52" height="52">
      <div class="app-install-t"><b>${h}</b><p class="small muted">${p}</p></div>
      <div class="app-install-a">${btn}<button type="button" class="btn btn-sm" ${raw(later)}>لاحقاً</button></div>
    </div>`);
  }

  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); evt = e; draw(); });
  addEventListener('appinstalled', () => { evt = null; draw(); });
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-app-x]')) { store.set(KEY, Date.now()); return draw(); }
    if (e.target.closest('[data-push-later]')) { store.set(PKEY, Date.now()); return draw(); }
    if (e.target.closest('[data-push-on]')) return enable();
    if (e.target.closest('[data-app-install]') && evt) {
      evt.prompt();
      await evt.userChoice.catch(() => {});
      evt = null;
      draw();
    }
  });
  // جوال مشترك من قبل: نحدّث ربطه بالحساب الحالي
  if (pushOk && Notification.permission === 'granted') {
    currentSub().then((s) => {
      if (!s) return;
      subscribed = true;
      const j = s.toJSON();
      api('/api/u/push/subscribe', { method: 'POST', body: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } }).catch(() => {});
      draw();
    }).catch(() => {});
  }
  draw();
}

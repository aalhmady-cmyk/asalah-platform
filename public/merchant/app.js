// تثبيت لوحة التاجر كتطبيق على الجوال (أندرويد وآيفون)
import { html, render } from '/assets/common.js';

const ua = navigator.userAgent;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const iosSafari = isIOS && !/CriOS|FxiOS|EdgiOS/i.test(ua);
// متصفحات أندرويد غير Chrome تبني التطبيق بنفسها وحماية جوجل تحظره، فنوجّه لـ Chrome
const otherAndroid = /android/i.test(ua) && /SamsungBrowser|MiuiBrowser|HuaweiBrowser|HeyTapBrowser|OppoBrowser|VivoBrowser|UCBrowser|YaBrowser|OPR\/|EdgA|; wv\)/i.test(ua);
const chromeUrl = `intent://${location.host}/merchant/?src=chrome#Intent;scheme=https;package=com.android.chrome;end`;
const KEY = 'asalah_m_install_x';
let evt = null;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/merchant/sw.js', { scope: '/merchant/' }).catch(() => {});

function hidden() {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 14 * 86400e3; } catch { return false; }
}

function draw() {
  const box = document.getElementById('app-install');
  if (!box) return;
  const mobile = matchMedia('(max-width: 900px)').matches || isIOS || /android/i.test(ua);
  if (standalone() || hidden() || !mobile || (!evt && !isIOS && !otherAndroid)) { box.hidden = true; return; }
  let how, btn = '';
  if (otherAndroid) {
    how = 'افتح اللوحة في Chrome وثبّتها من هناك، عشان حماية جوجل تقبل التطبيق.';
    btn = html`<a class="btn btn-primary" href="${chromeUrl}">افتح في Chrome وثبّت</a>`;
  } else if (isIOS) {
    how = iosSafari
      ? html`في سفاري: اضغط زر المشاركة <b>⬆️</b> تحت، بعدها <b>«إضافة إلى الشاشة الرئيسية»</b>، ثم <b>«إضافة»</b>.`
      : 'افتح هذي الصفحة في سفاري، بعدها اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية».';
  } else {
    how = 'ثبّت اللوحة على شاشة جوالك، وتفتح بضغطة مثل أي تطبيق بدون ما تكتب الرابط.';
    btn = html`<button type="button" class="btn btn-primary" data-app-install>ثبّت التطبيق</button>`;
  }
  box.hidden = false;
  render(box, html`<div class="card app-install">
    <img src="/merchant/icons/icon-192.png" alt="" width="52" height="52">
    <div class="app-install-t"><b>📲 نزّل لوحة التاجر كتطبيق</b><p class="small muted">${how}</p></div>
    <div class="app-install-a">${btn}<button type="button" class="btn btn-sm" data-app-x>لاحقاً</button></div>
  </div>`);
}

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  evt = e;
  draw();
});
addEventListener('appinstalled', () => { evt = null; draw(); });
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-app-x]')) {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    return draw();
  }
  if (e.target.closest('[data-app-install]') && evt) {
    evt.prompt();
    await evt.userChoice.catch(() => {});
    evt = null;
    draw();
  }
});
draw();

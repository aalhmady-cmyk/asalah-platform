// تحقق بالكاميرا: يقرأ QR ملصق أصالة ويفتح صفحة التحقق. BarcodeDetector لو موجود، وإلا jsQR.
const $ = (id) => document.getElementById(id);
const video = $('video'), root = document.querySelector('.sc');
const HOSTS = new Set([location.host, 'alsalah-sa.com', 'www.alsalah-sa.com', 'asalah-platform.infinx202030.workers.dev']);
let stream = null, detector = null, busy = false, done = false;
const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });

function say(h, p, cls) {
  $('msg').textContent = h;
  $('sub').textContent = p || '';
  root.classList.toggle('bad', cls === 'bad');
  root.classList.toggle('ok', cls === 'ok');
}

// نقبل بس روابط تحقق أصالة، وغيرها نحذّر منها
function handle(text) {
  if (done || !text) return;
  let u;
  try { u = new URL(text.trim()); } catch { return say('هذا الرمز مو من أصالة', 'الملصق ما فيه رابط تحقق. انتبه: ممكن يكون مقلّد.', 'bad'); }
  if (!HOSTS.has(u.host) || !u.pathname.startsWith('/v/') || !(u.searchParams.get('t') || u.searchParams.get('code'))) {
    return say('هذا الرمز مو من أصالة ⚠️', 'الرابط يودّي لموقع ثاني (' + u.host + '). لا تفتحه، وممكن يكون المنتج مقلّد.', 'bad');
  }
  done = true;
  say('لقينا الرمز ✅', 'نفتح لك صفحة التحقق…', 'ok');
  navigator.vibrate?.(60);
  stop();
  location.href = '/v/' + u.search;
}

async function decode(src, w, h) {
  if (detector) {
    const r = await detector.detect(src).catch(() => []);
    return r[0]?.rawValue || null;
  }
  if (!window.jsQR) return null;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(src, 0, 0, w, h);
  return window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data || null;
}

async function loop() {
  if (!stream || done) return;
  if (!busy && video.readyState >= 2) {
    busy = true;
    const k = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const txt = await decode(video, Math.round(video.videoWidth * k), Math.round(video.videoHeight * k));
    busy = false;
    if (txt) handle(txt);
  }
  requestAnimationFrame(loop);
}

async function engine() {
  if ('BarcodeDetector' in window) {
    try {
      const f = await BarcodeDetector.getSupportedFormats();
      if (f.includes('qr_code')) { detector = new BarcodeDetector({ formats: ['qr_code'] }); return; }
    } catch {}
  }
  if (!window.jsQR) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/assets/vendor/jsQR.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
}

async function start() {
  $('start').hidden = true;
  say('وجّه الكاميرا على الملصق', 'خلّه داخل المربع، ونقرأه تلقائياً');
  try {
    await engine();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = stream;
    await video.play().catch(() => {});
    loop();
  } catch (e) {
    $('start').hidden = false;
    say('ما قدرنا نشغّل الكاميرا', 'اسمح للموقع يستخدم الكاميرا من إعدادات المتصفح، أو صوّر الرمز بالزر تحت. وفي الآيفون تقدر تفتح كاميرا الجوال نفسها وتوجهها على الملصق.', 'bad');
  }
}
function stop() { stream?.getTracks().forEach((t) => t.stop()); stream = null; }

$('start').addEventListener('click', start);
$('pick').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  await engine().catch(() => {});
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return say('ما قدرنا نقرأ الصورة', 'جرّب صورة أوضح', 'bad');
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const txt = await decode(bmp, Math.round(bmp.width * k), Math.round(bmp.height * k));
  if (txt) handle(txt);
  else say('ما لقينا رمز في الصورة', 'قرّب الجوال من الملصق وخلّ الإضاءة زينة', 'bad');
});
addEventListener('pagehide', stop);
// لو الكاميرا مسموحة من قبل، نشغّلها على طول
navigator.permissions?.query({ name: 'camera' }).then((p) => { if (p.state === 'granted') start(); }).catch(() => {});

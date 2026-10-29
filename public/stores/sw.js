// تطبيق متاجر أصالة: نحفظ واجهة المتاجر عشان تفتح بسرعة وتشتغل حتى لو النت ضعيف.
// البيانات (/api) والفيديو (/media) دائماً من الشبكة.
const CACHE = 'asalah-stores-v7';
const SHELL = ['/stores/', '/stores/market.css', '/stores/market.js', '/stores/theme.js', '/stores/clip.js', '/assets/common.js', '/stores/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return;
  // الصفحة: من الشبكة أول (عشان التحديثات توصل)، ولو ما فيه نت من المحفوظ
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/stores/')));
    return;
  }
  // ملفات الواجهة: من الشبكة أول ونحفظ نسخة، والصور: من المحفوظ فوراً ونحدّثها بالخلفية
  const shell = url.pathname.startsWith('/stores/') || url.pathname.startsWith('/assets/');
  if (!shell && !url.pathname.startsWith('/img/')) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const net = fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') c.put(req, res.clone());
        return res;
      });
      if (shell) return net.catch(() => c.match(req));
      const hit = await c.match(req);
      if (hit) { net.catch(() => {}); return hit; }
      return net;
    })
  );
});

// ---------- الإشعارات ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'متاجر أصالة', {
      body: d.body || '',
      icon: '/stores/icons/icon-192.png',
      badge: '/stores/icons/badge-96.png',
      image: d.image,
      tag: d.tag,
      renotify: !!d.tag,
      silent: false,
      vibrate: [200, 100, 200],
      dir: 'auto',
      data: { url: d.url, c: d.c },
    })
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { url, c } = e.notification.data || {};
  let to = new URL(url || '/stores/', location.origin);
  if (to.origin !== location.origin) to = new URL('/stores/', location.origin);
  e.waitUntil(
    (async () => {
      if (c) fetch('/api/public/push/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ c }) }).catch(() => {});
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const w = wins.find((x) => new URL(x.url).pathname.startsWith('/stores/'));
      if (w) { await w.focus(); return w.navigate(to.href).catch(() => {}); }
      return self.clients.openWindow(to.href);
    })()
  );
});

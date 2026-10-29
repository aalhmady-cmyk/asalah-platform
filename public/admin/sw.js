// تطبيق اللوحة الأم: الصفحات دايماً من الشبكة (البيانات حية)، وإذا انقطع النت نعرض صفحة بسيطة
const SCOPE = '/admin/';
const CACHE = 'asalah-admin-v2';
const OFFLINE = '/admin/offline.html';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/admin/icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('asalah-admin-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'أصالة', { body: d.body || '', icon: SCOPE + 'icons/icon-192.png', badge: '/stores/icons/badge-96.png', tag: d.tag, renotify: !!d.tag, silent: false, vibrate: [200, 100, 200], dir: 'auto', data: { url: d.url || SCOPE } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const to = new URL(e.notification.data?.url || SCOPE, self.location.origin);
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((x) => new URL(x.url).pathname.startsWith(SCOPE));
    if (w) { await w.focus(); return w.navigate(to.href).catch(() => {}); }
    return self.clients.openWindow(to.href);
  })());
});

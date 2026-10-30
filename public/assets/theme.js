// الوضع الليلي للوحات: يتبع الجوال تلقائياً، ويقدر صاحب اللوحة يثبّته من زر 🌙
(() => {
  const KEY = 'asalah_theme';
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const sys = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const dark = (get() || (sys.matches ? 'dark' : 'light')) === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const btn = document.getElementById('theme-btn');
    if (btn) { btn.textContent = dark ? '☀️ الوضع النهاري' : '🌙 الوضع الليلي'; btn.setAttribute('aria-pressed', String(dark)); }
  };
  apply();
  sys.addEventListener?.('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const foot = document.querySelector('.side .foot');
    if (!foot) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'theme-btn';
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch {}
      apply();
    });
    foot.insertBefore(btn, document.getElementById('logout'));
    apply();
  });
})();

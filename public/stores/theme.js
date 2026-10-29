// يشتغل قبل الرسم عشان ما يومض الوضع النهاري: الليلي هو الافتراضي
(() => {
  let t = 'dark';
  try { t = localStorage.getItem('asalah_theme') || 'dark'; } catch {}
  document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
})();

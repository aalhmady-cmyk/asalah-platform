// عرض الريل "الأصلي": الفيديو نفسه ما ينقص، نعرض جزء منه (من start لمدة duration)
// ونقصّه بصرياً داخل إطاره: zoom للتكبير، و x و y من 0 إلى 1 لمكان القص.

// يحط الفيديو داخل أبوه (لازم يكون position:relative و overflow:hidden) بنفس حساب المحرر
export function fitClip(v, clip) {
  const box = v.parentElement;
  const bw = box.clientWidth, bh = box.clientHeight;
  if (!v.videoWidth || !bw || !bh) return;
  const a = v.videoWidth / v.videoHeight / (bw / bh);
  const z = clip.zoom || 1;
  const w = (a >= 1 ? a : 1) * z * 100, h = (a >= 1 ? 1 : 1 / a) * z * 100;
  Object.assign(v.style, {
    position: 'absolute', maxWidth: 'none', objectFit: 'fill',
    width: w + '%', height: h + '%',
    left: (100 - w) * (clip.x ?? 0.5) + '%', top: (100 - h) * (clip.y ?? 0.5) + '%',
  });
}

// يربط الفيديو بالقص: يبدأ من start ويرجع له بعد duration، ويعيد الحساب لو تغيّر المقاس
export function bindClip(v, clip, duration) {
  if (!clip) return;
  v.loop = false;
  const start = clip.start || 0, end = start + duration;
  const fit = () => fitClip(v, clip);
  const toStart = () => { try { v.currentTime = start; } catch {} };
  v.addEventListener('loadedmetadata', () => { fit(); if (v.currentTime < start || v.currentTime > end) toStart(); });
  v.addEventListener('timeupdate', () => { if (v.currentTime >= end || v.currentTime < start - 0.3) toStart(); });
  v.addEventListener('ended', () => { toStart(); v.play().catch(() => {}); });
  if (window.ResizeObserver) new ResizeObserver(fit).observe(v.parentElement);
  if (v.readyState >= 1) { fit(); toStart(); }
}

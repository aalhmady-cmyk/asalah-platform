// قص الريل في المتصفح: نختار جزء بمقاس 9:16 ومدة محددة، ونعيد تسجيله بـ canvas + MediaRecorder.
// الناتج 720×1280 بحجم معقول (تقريباً 8 ميجا لكل 30 ثانية)، فما نحتاج سيرفر لمعالجة الفيديو.

import { fitClip } from '/stores/clip.js';

const OUT_W = 720, OUT_H = 1280;

export function reelDuration(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(v.src); Number.isFinite(d) && d > 0 ? resolve(d) : reject(new Error('bad')); };
    v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error('bad')); };
    v.src = URL.createObjectURL(file);
  });
}

function pickMime() {
  const list = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

const seek = (v, t) =>
  new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 0.01 && v.readyState >= 2) return resolve();
    v.addEventListener('seeked', () => resolve(), { once: true });
    v.currentTime = t;
  });

export async function cutReel(file, stage) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('متصفحك ما يدعم قص الفيديو. جرّب Chrome أو Safari بآخر تحديث');
  const v = document.createElement('video');
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  // بعض الجوالات (خصوصاً أندرويد) ما ترسم إطارات فيديو مو موجود في الصفحة، فيطلع الريل أسود.
  // نحطه في الصفحة صغير وشبه شفاف بدل ما يكون معلّق برا
  v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1';
  document.body.append(v);
  v.src = URL.createObjectURL(file);
  await new Promise((resolve, reject) => { v.onloadeddata = resolve; v.onerror = () => reject(new Error('ما قدرنا نفتح الفيديو')); });
  const sctx = stage.getContext('2d');
  // cx و cy من 0 إلى 1: وين نوقف القص أفقياً وعمودياً
  const st = { start: 0, dur: 10, zoom: 1, cx: 0.5, cy: 0.5 };
  let previewing = false, raf = 0, audio = null;

  const draw = (ctx, W, H) => {
    const vw = v.videoWidth, vh = v.videoHeight;
    const s = Math.max(W / vw, H / vh) * st.zoom;
    const dw = vw * s, dh = vh * s;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(v, (W - dw) * st.cx, (H - dh) * st.cy, dw, dh);
  };
  const paint = () => draw(sctx, stage.width, stage.height);

  // السحب لتحريك القص
  let drag = null;
  stage.style.touchAction = 'none';
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = stage.getBoundingClientRect();
    const s = Math.max(r.width / v.videoWidth, r.height / v.videoHeight) * st.zoom;
    const spareX = v.videoWidth * s - r.width, spareY = v.videoHeight * s - r.height;
    // canvas اتجاهه يسار لليمين حتى لو الصفحة RTL
    if (spareX > 1) st.cx = Math.min(1, Math.max(0, drag.cx - (e.clientX - drag.x) / spareX));
    if (spareY > 1) st.cy = Math.min(1, Math.max(0, drag.cy - (e.clientY - drag.y) / spareY));
    paint();
  });
  const end = () => (drag = null);
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  const stopPreview = () => { previewing = false; cancelAnimationFrame(raf); v.pause(); };

  const api = {
    async set(next) {
      const moved = next.start !== st.start;
      Object.assign(st, next);
      if (previewing) stopPreview();
      if (moved || v.currentTime < st.start || v.currentTime > st.start + st.dur) await seek(v, st.start);
      paint();
    },
    async preview() {
      if (previewing) return stopPreview();
      await seek(v, st.start);
      previewing = true;
      v.muted = false;
      await v.play().catch(() => { v.muted = true; return v.play(); });
      const loop = () => {
        if (!previewing) return;
        if (v.currentTime >= st.start + st.dur || v.ended) { stopPreview(); seek(v, st.start).then(paint); return; }
        paint();
        raf = requestAnimationFrame(loop);
      };
      loop();
    },
    // يرجع { video: Blob, poster: base64 }
    async render(opts, onProgress) {
      Object.assign(st, opts);
      stopPreview();
      const out = Object.assign(document.createElement('canvas'), { width: OUT_W, height: OUT_H });
      const octx = out.getContext('2d');
      await seek(v, st.start);
      draw(octx, OUT_W, OUT_H);
      const poster = await posterOf(out);
      const stream = out.captureStream(30);
      // الصوت: نوجهه للتسجيل بس، عشان ما يطلع من السماعة أثناء القص
      try {
        if (!audio) {
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          const dest = ac.createMediaStreamDestination();
          ac.createMediaElementSource(v).connect(dest);
          audio = { ac, dest };
        }
        await audio.ac.resume();
        audio.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch {}
      const mime = pickMime();
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 96_000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise((resolve) => (rec.onstop = resolve));
      v.muted = false;
      rec.start(500);
      await v.play().catch(() => { v.muted = true; return v.play(); });
      // نرسم كل ~33 ملي ثانية بمؤقت، لأن requestVideoFrameCallback أحياناً ما يشتغل والفيديو مخفي
      let bright = brightness(out), lastT = -1, stuck = 0;
      await new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          const t = v.currentTime - st.start;
          draw(octx, OUT_W, OUT_H);
          onProgress?.(Math.min(1, Math.max(0, t) / st.dur));
          if (Math.floor(t) !== Math.floor(lastT)) bright = Math.max(bright, brightness(out));
          stuck = t === lastT ? stuck + 1 : 0;
          lastT = t;
          if (t >= st.dur || v.ended) { clearInterval(timer); resolve(); }
          // الفيديو واقف أكثر من 8 ثواني: المتصفح وقفه (غالباً الصفحة صارت بالخلفية)
          else if (stuck > 240) { clearInterval(timer); reject(new Error('القص وقف. خل الصفحة مفتوحة قدامك وحاول مرة ثانية')); }
        }, 33);
      }).catch((e) => { v.pause(); rec.stop(); throw e; });
      v.pause();
      rec.stop();
      await done;
      stream.getVideoTracks().forEach((t) => t.stop());
      const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
      const video = new Blob(chunks, { type });
      if (bright < 6) throw new Error('الفيديو طلع أسود بعد القص. جرّب متصفح Chrome أو Safari بآخر تحديث، أو فيديو ثاني');
      if (video.size < 20_000) throw new Error('ما انحفظ الفيديو بشكل صحيح. حاول مرة ثانية');
      await playable(video);
      return { video, poster };
    },
    dispose() { stopPreview(); audio?.ac.close(); URL.revokeObjectURL(v.src); v.removeAttribute('src'); v.load(); v.remove(); },
  };
  paint();
  return api;
}

// متوسط إضاءة الصورة (0 أسود تماماً، 255 أبيض)
function brightness(canvas) {
  const c = Object.assign(document.createElement('canvas'), { width: 16, height: 28 });
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, 16, 28);
  const d = x.getImageData(0, 0, 16, 28).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
  return sum / (d.length / 4) / 3;
}

// نتأكد إن المتصفح يقدر يفتح الفيديو الناتج قبل ما نرفعه
function playable(blob) {
  return new Promise((resolve, reject) => {
    const t = document.createElement('video');
    t.muted = true;
    t.preload = 'auto';
    const url = URL.createObjectURL(blob);
    const end = (ok) => { clearTimeout(to); URL.revokeObjectURL(url); t.removeAttribute('src'); t.load(); ok ? resolve() : reject(new Error('الفيديو الناتج ما يشتغل. حاول مرة ثانية أو جرّب متصفح ثاني')); };
    const to = setTimeout(() => end(true), 6000);
    t.onloadeddata = () => end(t.videoWidth > 0);
    t.onerror = () => end(false);
    t.src = url;
  });
}

async function posterOf(canvas) {
  const c = Object.assign(document.createElement('canvas'), { width: 360, height: 640 });
  c.getContext('2d').drawImage(canvas, 0, 0, 360, 640);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.readAsDataURL(blob);
  });
}

// المحرر بدون إعادة تسجيل: نعرض الفيديو نفسه داخل إطار 9:16 ونحفظ القص كأرقام.
// هذا اللي يشتغل على الآيفون، لأن سفاري ما يرسم الفيديو على canvas بشكل موثوق.
export async function clipReel(file, box) {
  const v = document.createElement('video');
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.muted = true;
  v.preload = 'auto';
  box.replaceChildren(v);
  v.src = URL.createObjectURL(file);
  await new Promise((resolve, reject) => { v.onloadedmetadata = resolve; v.onerror = () => reject(new Error('ما قدرنا نفتح الفيديو')); });
  const st = { start: 0, dur: 10, zoom: 1, x: 0.5, y: 0.5 };
  const fit = () => fitClip(v, st);
  const ro = new ResizeObserver(fit);
  ro.observe(box);
  let previewing = false;
  // الآيفون ما يعرض أول صورة إلا بعد ما يشتغل الفيديو لحظة
  await v.play().then(() => v.pause()).catch(() => {});
  await seek(v, 0);
  fit();

  let drag = null;
  box.style.touchAction = 'none';
  box.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: st.x, cy: st.y }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = box.getBoundingClientRect(), vr = v.getBoundingClientRect();
    const spareX = vr.width - r.width, spareY = vr.height - r.height;
    if (spareX > 1) st.x = Math.min(1, Math.max(0, drag.cx - (e.clientX - drag.x) / spareX));
    if (spareY > 1) st.y = Math.min(1, Math.max(0, drag.cy - (e.clientY - drag.y) / spareY));
    fit();
  });
  const end = () => (drag = null);
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  v.addEventListener('timeupdate', () => {
    if (previewing && v.currentTime >= st.start + st.dur) { v.pause(); previewing = false; seek(v, st.start); }
  });
  const stop = () => { previewing = false; v.pause(); };

  return {
    async set(next) {
      const moved = next.start !== st.start;
      Object.assign(st, { start: next.start, dur: next.dur, zoom: next.zoom });
      if (previewing) stop();
      if (moved) await seek(v, st.start);
      fit();
    },
    async preview() {
      if (previewing) return stop();
      await seek(v, st.start);
      previewing = true;
      v.muted = false;
      await v.play().catch(() => { v.muted = true; return v.play(); }).catch(() => (previewing = false));
    },
    // ما فيه قص فعلي: نرجع الملف الأصلي مع أرقام القص، وغلاف لو قدرنا نرسمه
    async render(opts, onProgress) {
      Object.assign(st, { start: opts.start, dur: opts.dur, zoom: opts.zoom });
      stop();
      await seek(v, st.start);
      onProgress?.(1);
      let poster = null;
      try {
        const c = Object.assign(document.createElement('canvas'), { width: 360, height: 640 });
        const ctx = c.getContext('2d');
        const vw = v.videoWidth, vh = v.videoHeight, s = Math.max(360 / vw, 640 / vh) * st.zoom;
        ctx.drawImage(v, (360 - vw * s) * st.x, (640 - vh * s) * st.y, vw * s, vh * s);
        if (brightness(c) >= 6) poster = await posterOf(c);
      } catch {}
      return { video: file, poster, clip: { start: st.start, zoom: st.zoom, x: st.x, y: st.y } };
    },
    dispose() { stop(); ro.disconnect(); URL.revokeObjectURL(v.src); v.removeAttribute('src'); v.load(); },
  };
}

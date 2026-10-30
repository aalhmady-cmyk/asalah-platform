// المعرض ثلاثي الأبعاد: ممر فيه منتجات التاجر على منصات أو علّاقات أو رفوف حسب نوع النشاط.
// العميل يسحب ليتجول، ولما يقرب من منتج يرتفع ويلف، ولما يضغط عليه يطير له ويطلع قدامه.
import * as THREE from '/assets/vendor/three.module.min.js';

// مقاسات الممر: في الجوال (شاشة طولية) الممر أضيق عشان المنتجات تبين على الجانبين
const PORTRAIT = innerHeight > innerWidth;
const GAP = PORTRAIT ? 2.3 : 2.5; // المسافة بين المنتجات على نفس الجدار
const WALL = PORTRAIT ? 2.3 : 3.4; // بعد الجدار عن منتصف الممر
const SHELF = PORTRAIT ? 1.45 : 2.55; // مكان المنتج من المنتصف
const VIEW = PORTRAIT ? 2.6 : 2.3; // بعد الكاميرا عن المنتج لما يختاره العميل
const EYE = 1.6;
const MAX = 60;
const FONT = { plex: 'IBM Plex Sans Arabic', tajawal: 'Tajawal', cairo: 'Cairo', amiri: 'Amiri', almarai: 'Almarai' };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a, b, t) => a + (b - a) * t;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, max) {
  let t = text;
  while (t.length > 3 && ctx.measureText(t).width > max) t = t.slice(0, -2);
  return t === text ? t : t.trim() + '…';
}

// بطاقة المنتج: الصورة فوق، والاسم والسعر تحت بألوان المتجر
function cardTexture(img, p, c, font) {
  const W = 512, H = 660;
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  if (img) {
    const k = Math.max(W / img.width, 512 / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, 512);
    ctx.clip();
    ctx.drawImage(img, (W - w) / 2, (512 - h) / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = '#f1efe9';
    ctx.fillRect(0, 0, W, 512);
    ctx.font = '160px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛍️', W / 2, 320);
  }
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 512, W, H - 512);
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, 512, W, 6);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 40px '${font}', sans-serif`;
  ctx.fillText(fitText(ctx, p.title, W - 40), W / 2, 572);
  ctx.fillStyle = c.accent;
  ctx.font = `800 44px '${font}', sans-serif`;
  ctx.fillText(Number(p.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س', W / 2, 632);
  // شارة أصلي
  ctx.fillStyle = 'rgba(255,255,255,.93)';
  roundRect(ctx, W - 150, 18, 132, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#0a5a41';
  ctx.font = `700 26px '${font}', sans-serif`;
  ctx.fillText('✅ أصلي', W - 84, 50);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(lines, c, font, { w = 1024, h = 256, bg = c.bg, size = 96 } = {}) {
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, w, h, 36);
  ctx.fill();
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 10;
  roundRect(ctx, 8, 8, w - 16, h - 16, 30);
  ctx.stroke();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    ctx.fillStyle = i ? '#ffffff' : c.accent;
    ctx.font = `${i ? 600 : 800} ${i ? size * 0.5 : size}px '${font}', sans-serif`;
    const y = lines.length === 1 ? h / 2 : i === 0 ? h * 0.4 : h * 0.75;
    ctx.fillText(fitText(ctx, l, w - 60), w / 2, y);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTexture(c) {
  const cv = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const ctx = cv.getContext('2d');
  const base = new THREE.Color(c.bg).multiplyScalar(0.75);
  ctx.fillStyle = '#' + base.getHexString();
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function softDot() {
  const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export async function mountShowroom({ canvas, products, config: c, merchant, sections, onPick, onNear }) {
  const font = FONT[c.font] || FONT.plex;
  await document.fonts?.ready?.catch?.(() => {});
  const colors = { bg: c.colors.bg, accent: c.colors.accent, primary: c.colors.primary };
  const accent = new THREE.Color(colors.accent);
  const bg = new THREE.Color(colors.bg);
  const mobile = matchMedia('(max-width: 760px)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = bg.clone().multiplyScalar(0.55);
  scene.fog = new THREE.Fog(scene.background, 12, 34);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 80);
  camera.rotation.order = 'YXZ';

  // ترتيب المنتجات حسب الأقسام، يمين ويسار الممر
  // كل قسم يبدأ بصف جديد، فالخانة الفاضية null
  const slots = [];
  const secStart = [];
  for (const s of sections) {
    if (slots.length % 2) slots.push(null);
    secStart.push(slots.length);
    for (const p of s.items) if (slots.filter(Boolean).length < MAX) slots.push(p);
  }
  const ordered = slots.filter(Boolean);
  const rows = Math.max(1, Math.ceil(slots.length / 2));
  const z0 = 0;
  const zEnd = -(rows - 1) * GAP - 5;
  const LEN = -zEnd + 12;
  const zMid = (z0 + 6 + zEnd) / 2;

  // ---------- المكان ----------
  scene.add(new THREE.HemisphereLight(0xffffff, bg.clone().multiplyScalar(0.5), 1.1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const lights = Math.min(6, Math.ceil(rows / 2) + 1);
  for (let i = 0; i < lights; i++) {
    const l = new THREE.PointLight(0xfff1d6, 14, 9, 1.6);
    l.position.set(0, 3.4, mix(z0 + 2, zEnd + 2, lights === 1 ? 0.5 : i / (lights - 1)));
    scene.add(l);
  }

  const floorTex = floorTexture(colors);
  floorTex.repeat.set(7 / 1.6, LEN / 1.6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, LEN), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 0.86 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zMid);
  floor.renderOrder = 1;
  scene.add(floor);
  // انعكاس خفيف تحت الأرضية: نسخة مقلوبة من المنتجات تبين من خلال الأرض الشفافة شوي
  const reflect = new THREE.Group();
  reflect.scale.y = -1;
  scene.add(reflect);

  const wallMat = new THREE.MeshStandardMaterial({ color: bg.clone().multiplyScalar(0.9), roughness: 0.9 });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(LEN, 4), wallMat);
    w.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    w.position.set(side * WALL, 2, zMid);
    scene.add(w);
    // شريط إضاءة على طول الجدار
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, LEN), new THREE.MeshBasicMaterial({ color: accent }));
    strip.position.set(side * (WALL - 0.03), 0.08, zMid);
    scene.add(strip);
    const strip2 = strip.clone();
    strip2.position.y = 3.2;
    scene.add(strip2);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, LEN), new THREE.MeshStandardMaterial({ color: bg.clone().multiplyScalar(0.6), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 3.9, zMid);
  scene.add(ceil);
  for (let z = z0 + 4; z > zEnd - 2; z -= 3) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.18), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
    lamp.position.set(0, 3.87, z);
    scene.add(lamp);
  }

  // لوحة اسم المتجر في آخر الممر
  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, 4), wallMat);
  endWall.position.set(0, 2, zEnd - 3);
  scene.add(endWall);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signTexture([c.name, '✅ منتجات أصلية موثّقة من أصالة'], colors, font, { size: 92 }), transparent: true }));
  sign.position.set(0, 2.3, zEnd - 2.95);
  scene.add(sign);
  if (merchant.logo_url) {
    const logoImg = await loadImage(merchant.logo_url);
    if (logoImg) {
      const lt = new THREE.Texture(logoImg);
      lt.colorSpace = THREE.SRGBColorSpace;
      lt.needsUpdate = true;
      const logo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ map: lt }));
      logo.position.set(0, 3.25, zEnd - 2.94);
      scene.add(logo);
    }
  }
  // لوحة العروض عند المدخل
  if (c.coupon) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(PORTRAIT ? 2.4 : 2.8, PORTRAIT ? 0.82 : 0.95), new THREE.MeshBasicMaterial({ map: signTexture([`🎁 خصم ${c.coupon.percent}٪`, `بكود ${c.coupon.code}`], colors, font, { size: 100 }), transparent: true }));
    board.position.set(0, 1.15, zEnd - 2.94); // تحت لوحة اسم المتجر في آخر الممر
    scene.add(board);
  }
  // لافتات الأقسام معلّقة من السقف
  const secZ = secStart.map((i) => -Math.floor(i / 2) * GAP + 0.9);
  sections.forEach((s, i) => {
    if (secStart[i] >= slots.length) return;
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55), new THREE.MeshBasicMaterial({ map: signTexture([s.title], colors, font, { h: 230, size: 110 }), transparent: true, side: THREE.DoubleSide }));
    ban.position.set(0, 3.35, secZ[i]);
    scene.add(ban);
    for (const dx of [-1.05, 1.05]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3), new THREE.MeshBasicMaterial({ color: 0x999999 }));
      wire.position.set(dx, 3.75, secZ[i]);
      scene.add(wire);
    }
  });

  // ---------- المنتجات ----------
  const cardGeo = new THREE.BoxGeometry(1.0, 1.29, 0.05);
  const sideMat = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
  const theme = c.theme;
  const pedMat = theme === 'perfume'
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide })
    : theme === 'food'
      ? new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.7, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: bg.clone().lerp(new THREE.Color(0xffffff), 0.18), roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ color: accent });
  const edgeMat = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide });

  function stand(side) {
    const g = new THREE.Group();
    if (theme === 'fashion') {
      // علّاقة: عمود الراك على الجدار والشماعة
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, GAP * 0.9), edgeMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = 2.75;
      g.add(rail);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20, Math.PI * 1.4), edgeMat);
      hook.position.y = 2.66;
      hook.rotation.y = Math.PI / 2;
      g.add(hook);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85), edgeMat);
      bar.rotation.x = Math.PI / 2;
      bar.rotation.y = 0;
      bar.position.y = 2.45;
      const hanger = new THREE.Group();
      for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48), edgeMat);
        arm.position.set(0, 2.53, s * 0.2);
        arm.rotation.x = s * 1.1;
        hanger.add(arm);
      }
      g.add(hanger, bar);
    } else if (theme === 'food') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), pedMat);
      top.position.y = 0.95;
      g.add(top);
      for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.07), pedMat);
        leg.position.set(x, 0.47, z);
        g.add(leg);
      }
    } else {
      const ped = theme === 'perfume' ? new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.9), pedMat) : new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 1.0, 40), pedMat);
      ped.position.y = 0.5;
      g.add(ped);
      const ring = theme === 'perfume' ? new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.03, 0.94), glowMat) : new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.018, 8, 48), glowMat);
      if (theme !== 'perfume') ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.01;
      g.add(ring);
      if (theme === 'perfume') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.04, 0.94), edgeMat);
        base.position.y = 0.02;
        g.add(base);
      }
    }
    g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    return g;
  }

  const items = [];
  const images = await Promise.all(slots.map((p) => loadImage(p?.image_url)));
  slots.forEach((p, i) => {
    if (!p) return;
    const side = i % 2 === 0 ? 1 : -1; // أول منتج على اليمين (الاتجاه العربي)
    const z = -Math.floor(i / 2) * GAP;
    const x = side * SHELF;
    const tex = cardTexture(images[i], p, colors, font);
    const face = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32, roughness: 0.5, side: THREE.DoubleSide });
    const card = new THREE.Mesh(cardGeo, [sideMat, sideMat, sideMat, sideMat, face, face]);
    const baseY = theme === 'fashion' ? 1.62 : theme === 'food' ? 1.65 : 1.72;
    const holder = new THREE.Group();
    holder.position.set(x, baseY, z);
    holder.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    holder.add(card);
    card.userData.id = p.id;
    scene.add(holder);
    const st = stand(side);
    st.position.set(x, 0, z);
    scene.add(st);
    const stM = st.clone();
    reflect.add(stM);
    const cardM = holder.clone();
    reflect.add(cardM);
    items.push({ p, card, holder, mirror: cardM, side, x, z, baseY, baseRot: holder.rotation.y, lift: 0, spin: 0, pop: 0 });
  });

  // ذرات ضوء تطفو في المكان، ودخان بخور لمعرض العطور
  const dot = softDot();
  const N = mobile ? 160 : 300;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * WALL * 2, Math.random() * 3.6, z0 + 6 - Math.random() * LEN], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dot, color: accent, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);
  let smoke = null;
  if (theme === 'perfume' && items.length) {
    const S = Math.min(items.length, 20) * 10;
    const sp = new Float32Array(S * 3);
    const seed = new Float32Array(S);
    for (let i = 0; i < S; i++) {
      const it = items[i % Math.min(items.length, 20)];
      sp.set([it.x * 0.92, 1.05 + Math.random() * 2, it.z + (Math.random() - 0.5) * 0.4], i * 3);
      seed[i] = Math.random() * 10;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    smoke = new THREE.Points(sg, new THREE.PointsMaterial({ map: dot, color: 0xffffff, size: 0.55, transparent: true, opacity: 0.08, depthWrite: false }));
    smoke.userData = { seed, items: items.slice(0, 20) };
    scene.add(smoke);
  }

  // ---------- الحركة ----------
  const cam = { x: 0, z: z0 + 7, yaw: 0, pitch: -0.04 };
  const vel = { move: 0, yaw: 0 };
  let fly = null; // {from, to, t0, dur}
  let picked = null;
  let near = null;
  const clampCam = () => {
    const lim = WALL - 0.7;
    cam.x = Math.max(-lim, Math.min(lim, cam.x));
    cam.z = Math.max(zEnd - 1, Math.min(z0 + 7, cam.z));
    cam.pitch = Math.max(-0.5, Math.min(0.4, cam.pitch));
  };
  function flyTo(to, dur = 1000) {
    let dy = to.yaw - cam.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    fly = { from: { ...cam }, to: { ...to, yaw: cam.yaw + dy }, t0: performance.now(), dur };
  }
  // دخول: الكاميرا تمشي من الباب لداخل المعرض
  flyTo({ x: 0, z: z0 + (PORTRAIT ? 4.6 : 3.2), yaw: 0, pitch: -0.04 }, 1800);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    vel.move = vel.yaw = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (fly && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) fly = null;
    if (fly) return;
    // يمين ويسار يلف، فوق وتحت يمشي
    vel.yaw = dx * 0.005;
    vel.move = Math.max(-0.12, Math.min(0.12, dy * 0.018));
    cam.yaw += vel.yaw;
    walk(vel.move);
    if (picked && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 24) release();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8 && performance.now() - drag.t < 400;
    drag = null;
    if (!tap) return;
    vel.move = vel.yaw = 0;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(items.map((it) => it.card), false)[0];
    if (hit) focus(hit.object.userData.id);
    else if (picked) release();
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); fly = null; walk(-e.deltaY * 0.004); }, { passive: false });
  const keys = new Set();
  const kd = (e) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd'].includes(e.key)) { keys.add(e.key); fly = null; } };
  const ku = (e) => keys.delete(e.key);
  addEventListener('keydown', kd);
  addEventListener('keyup', ku);

  function walk(d) {
    cam.x -= Math.sin(cam.yaw) * d;
    cam.z -= Math.cos(cam.yaw) * d;
    clampCam();
  }

  function focus(id) {
    const it = items.find((x) => x.p.id === id);
    if (!it) return;
    if (picked && picked !== it) picked.pop = 0;
    picked = it;
    it.spin = 0;
    // الكاميرا تقف قدام المنتج وتطالعه
    flyTo({ x: it.x - it.side * VIEW, z: it.z, yaw: it.side > 0 ? -Math.PI / 2 : Math.PI / 2, pitch: -0.2 }, 1000);
    onPick?.(it.p);
    onNear?.(null);
  }
  function release() {
    if (!picked) return;
    picked = null;
    onPick?.(null);
  }
  function goSection(i) {
    release();
    const z = secZ[i];
    if (z == null) return;
    flyTo({ x: 0, z: z + (PORTRAIT ? 2.8 : 2.2), yaw: 0, pitch: -0.04 }, 1200);
  }

  // ---------- الرسم ----------
  let running = true;
  let raf = 0;
  let last = performance.now();
  const resize = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 84 : 66;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const fwd = new THREE.Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (fly) {
      const k = Math.min(1, (now - fly.t0) / fly.dur);
      const e = ease(k);
      for (const key of ['x', 'z', 'yaw', 'pitch']) cam[key] = mix(fly.from[key], fly.to[key], e);
      if (k >= 1) fly = null;
    } else if (!drag) {
      // تكملة الحركة بعد السحب (قصور ذاتي)
      if (Math.abs(vel.move) > 0.0005 || Math.abs(vel.yaw) > 0.0001) {
        walk(vel.move);
        cam.yaw += vel.yaw;
        vel.move *= 0.86;
        vel.yaw *= 0.88;
      }
      if (keys.size) {
        if (keys.has('ArrowUp') || keys.has('w')) walk(3 * dt);
        if (keys.has('ArrowDown') || keys.has('s')) walk(-3 * dt);
        if (keys.has('ArrowLeft') || keys.has('a')) cam.yaw += 1.6 * dt;
        if (keys.has('ArrowRight') || keys.has('d')) cam.yaw -= 1.6 * dt;
      }
    }
    camera.position.set(cam.x, EYE + Math.sin(t * 1.2) * 0.008, cam.z);
    camera.rotation.set(cam.pitch, cam.yaw, 0);

    // أقرب منتج قدام العميل
    camera.getWorldDirection(fwd);
    let best = null, bestD = 3.2;
    if (!picked) {
      for (const it of items) {
        const dx = it.x - cam.x, dz = it.z - cam.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && (dx * fwd.x + dz * fwd.z) / d > 0.35) { best = it; bestD = d; }
      }
    }
    if (best !== near) { near = best; onNear?.(near?.p || null); }

    for (const it of items) {
      const isNear = it === near;
      const isPick = it === picked;
      it.lift += ((isNear || isPick ? 1 : 0) - it.lift) * Math.min(1, dt * 5);
      it.pop += ((isPick ? 1 : 0) - it.pop) * Math.min(1, dt * 4);
      if (isPick) it.spin = Math.min(1, it.spin + dt / 1.1);
      else it.spin = 0;
      const h = it.holder;
      // المنتج يطلع من الرف لجهة العميل ويلف لفة كاملة ثم يتمايل
      h.position.x = it.x - it.side * it.pop * VIEW * 0.18;
      h.position.y = it.baseY + it.lift * 0.14 + it.pop * 0.05 + (isNear || isPick ? Math.sin(t * 2) * 0.03 : 0) + (theme === 'fashion' ? 0 : 0);
      const sway = theme === 'fashion' ? Math.sin(t * 1.3 + it.z) * 0.06 : 0;
      h.rotation.y = it.baseRot + (isPick ? ease(it.spin) * Math.PI * 2 + Math.sin(t * 1.5) * 0.18 * it.spin : isNear ? Math.sin(t * 1.8) * 0.35 * it.lift : sway);
      const sc = 1 + it.pop * 0.06 + it.lift * 0.04;
      h.scale.setScalar(sc);
      it.mirror.position.copy(h.position);
      it.mirror.rotation.copy(h.rotation);
      it.mirror.scale.copy(h.scale);
    }
    // ذرات الضوء
    const pa = dustGeo.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = pa.getY(i) + dt * 0.08;
      if (y > 3.7) y = 0.1;
      pa.setY(i, y);
    }
    pa.needsUpdate = true;
    if (smoke) {
      const a = smoke.geometry.attributes.position;
      const { seed, items: si } = smoke.userData;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + dt * 0.25;
        const it = si[i % si.length];
        if (y > 3.4) { y = 1.05; a.setZ(i, it.z + (Math.random() - 0.5) * 0.3); }
        a.setY(i, y);
        a.setX(i, it.x * 0.92 + Math.sin(t + seed[i]) * 0.12 * (y - 1));
      }
      a.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    focus,
    release,
    goSection,
    pause() { running = false; },
    resume() { running = true; last = performance.now(); resize(); },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener('keydown', kd);
      removeEventListener('keyup', ku);
      renderer.dispose();
    },
  };
}

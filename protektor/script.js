/* ПРОТЕКТОР — всё движение в одном requestAnimationFrame.
   Анимируются только transform и opacity. Размеры кэшируются при resize, в кадре не меряем. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  vw: innerWidth, vh: innerHeight,
  y: scrollY, sy: scrollY,          // реальный и сглаженный скролл
  mx: .5, my: .5, smx: .5, smy: .5,  // курсор 0..1 и сглаженный
  t: 0,
};

/* ---------- Прелоадер: процент по реально загруженным файлам, линейно, не дольше 4 с ---------- */
const pre = $('#preloader');
const preCount = $('#preCount');
document.body.classList.add('is-loading');
const loadJobs = [];
$$('img').forEach(img => {
  loadJobs.push(img.complete && img.naturalWidth ? Promise.resolve() :
    new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }));
});
loadJobs.push(document.fonts.ready);
let loaded = 0;
let tireReady = null;
const tireJob = new Promise(res => (tireReady = res));
loadJobs.push(tireJob);
loadJobs.forEach(p => p.then(() => loaded++));
let shown = 0;
let preStart = performance.now();
let preDone = false;
function preTick(now, dt) {
  if (preDone) return;
  const real = loaded / loadJobs.length * 100;
  const elapsed = (now - preStart) / 1000;
  const target = elapsed > 2.6 ? 100 : real;            // страховка: прелоадер не держит дольше 4 с
  shown = Math.min(target, shown + dt * 100 / 1.1);       // линейная скорость счёта: 0→100 не быстрее 1,1 с
  preCount.textContent = Math.floor(shown);
  if (shown >= 100) {
    preDone = true;
    pre.classList.add('is-done');
    document.body.classList.remove('is-loading');
    setTimeout(() => { pre.style.display = 'none'; }, 1000);
    startReveals();
  }
}

/* ---------- Появление при прокрутке ---------- */
function startReveals() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  // соседние элементы одного блока появляются лесенкой
  $$('[data-reveal]').forEach(el => {
    const sib = [...el.parentElement.children].filter(c => c.hasAttribute('data-reveal'));
    el.style.setProperty('--d', `${Math.min(sib.indexOf(el), 4) * 0.08}s`);
    io.observe(el);
  });
}

/* ---------- Размеры (кэш) ---------- */
const header = $('#header');
const bgLight = $('#bgLight');
const heroBg = $('#heroBg');
const heroUI = $$('.hero__corner, .hero__bottom, .hero__scroll');
const stage = $('#stage');
const speed = $('#speed');
const steps = $$('#steps li');
const clockNum = $('#clockNum');
const works = $('#works');
const track = $('#worksTrack');
const cards = $$('.card', track);
const worksNow = $('#worksNow');
const worksHead = $('.works__head');
const lounge = $('#loungeImg');
const loungeBox = lounge.parentElement;
const footer = $('#contacts');
const footTire = $('#footTire');
const sections = $$('[data-theme]');

const geo = { speedTop: 0, speedLen: 1, worksTop: 0, worksLen: 1, loungeTop: 0, loungeH: 1, footTop: 0, secs: [], cardX: [] };

function measure() {
  state.vw = innerWidth; state.vh = innerHeight;
  const top = el => el.getBoundingClientRect().top + scrollY;
  // горизонтальная галерея: высота секции = длина ленты + экран
  const trackW = track.scrollWidth;
  const run = Math.max(0, trackW - state.vw);
  works.style.height = `${run + Math.max(state.vh, 820)}px`;
  geo.worksRun = run;
  geo.speedTop = top(speed);
  geo.speedLen = speed.offsetHeight - Math.max(state.vh, 820);
  geo.worksTop = top(works);
  geo.worksLen = Math.max(1, run);
  geo.loungeTop = top(loungeBox);
  geo.loungeH = loungeBox.offsetHeight;
  geo.footTop = top(footer);
  geo.secs = sections.map(s => ({ top: top(s), h: s.offsetHeight, theme: s.dataset.theme }));
  geo.cardX = cards.map(c => c.offsetLeft + c.offsetWidth / 2);
  fitFooterLogo();
  if (tire) tire.resize();
}

/* ---------- Тема по скроллу (как у Radian): тёмная ⇄ светлая ---------- */
let theme = 'dark';
function updateTheme(y) {
  const probe = y + state.vh * 0.5;
  let t = 'dark';
  for (const s of geo.secs) if (probe >= s.top && probe < s.top + s.h) t = s.theme;
  if (t !== theme) {
    theme = t;
    document.body.classList.toggle('theme-light', t === 'light');
  }
  // шапка меняет цвет вместе с темой страницы
  header.classList.toggle('is-light', theme === 'light');
}

/* ---------- Услуги: фото проявляется за курсором ---------- */
const srv = $('#srv');
const reveal = $('#srvReveal');
const rows = $$('.srv__row', srv);
const revImgs = rows.map(r => {
  const img = new Image(); img.src = r.dataset.img; img.alt = ''; reveal.appendChild(img); return img;
});
const rv = { x: 0, y: 0, tx: 0, ty: 0, rot: 0 };
rows.forEach((row, i) => {
  row.addEventListener('mouseenter', () => {
    rows.forEach(r => r.classList.toggle('is-hover', r === row));
    revImgs.forEach((im, j) => im.classList.toggle('is-on', j === i));
    srv.classList.add('is-hover');
    reveal.classList.add('is-on');
  });
});
srv.addEventListener('mouseleave', () => {
  srv.classList.remove('is-hover');
  rows.forEach(r => r.classList.remove('is-hover'));
  reveal.classList.remove('is-on');
});

/* ---------- Футер: огромный логотип по ширине строки, буквы тянутся к курсору ---------- */
const footLogo = $('#footLogo');
const word = 'ПРОТЕКТОР';
footLogo.innerHTML = [...word].map((ch, i) => `<span${i === 4 ? ' class="is-red"' : ''}>${ch}</span>`).join('');
const letters = $$('span', footLogo);
const lt = letters.map(() => ({ v: 0 }));
let letterX = [];
function fitFooterLogo() {
  // подбираем кегль так, чтобы слово заняло всю ширину строки
  footLogo.style.fontSize = '100px';
  footLogo.style.justifyContent = 'flex-start';
  const w = letters.reduce((s, l) => s + l.offsetWidth, 0);
  const avail = footLogo.clientWidth;
  const size = 100 * avail / w * 0.985;
  footLogo.style.fontSize = `${size}px`;
  footLogo.style.justifyContent = 'space-between';
  const fr = footLogo.getBoundingClientRect();
  letterX = letters.map(l => { const r = l.getBoundingClientRect(); return r.left - fr.left + r.width / 2; });
}
let footHover = false;
footer.addEventListener('mouseenter', () => (footHover = true));
footer.addEventListener('mouseleave', () => (footHover = false));
let tireSpin = 0, tireVel = 0, lastMx = .5;

/* ---------- Форма: только имя и телефон ---------- */
const form = $('#bookForm');
const phone = form.elements.phone;
phone.addEventListener('input', () => {
  let d = phone.value.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  let out = '+7';
  if (p[0]) out += ' ' + p[0];
  if (p[1]) out += ' ' + p[1];
  if (p[2]) out += '-' + p[2];
  if (p[3]) out += '-' + p[3];
  phone.value = out;
});
form.addEventListener('submit', e => {
  e.preventDefault();
  const nameOk = form.elements.name.value.trim().length > 1;
  const phoneOk = phone.value.replace(/\D/g, '').length === 11;
  form.elements.name.closest('.field').classList.toggle('is-error', !nameOk);
  phone.closest('.field').classList.toggle('is-error', !phoneOk);
  if (nameOk && phoneOk) form.classList.add('is-sent');
});

/* ---------- Объёмная шина на three.js ---------- */
let tire = null;
async function initTire() {
  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    tire = buildTire(THREE);
    await tire.ready;
  } catch (err) {
    stage.classList.add('no-webgl');
    tire = null;
  }
  tireReady();
}

function buildTire(THREE) {
  const canvas = $('#tireCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  camera.position.set(0, 0, 6.4);

  // свет: мягкий общий, белый ключ слева спереди, тёмно-красный контровой справа сзади (как у Refive)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-3, 2.5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd7261e, 6); rim.position.set(4, 1, -2.5); scene.add(rim);
  const rim2 = new THREE.PointLight(0xb01810, 14, 9, 1.6); rim2.position.set(2.6, -1.2, 1.2); scene.add(rim2);

  const loader = new THREE.TextureLoader();
  const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));

  const R = 1;            // внешний радиус
  const W = 0.68;         // ширина профиля
  const RIM = 0.755;      // радиус обода (из фото: край диска на 0.75 R)
  const RS = 0.94;        // где боковина переходит в плечо
  const group = new THREE.Group();   // поворот «к зрителю»
  const roll = new THREE.Group();    // качение вокруг своей оси
  group.add(roll); scene.add(group);

  const ready = Promise.all([load('assets/img/tire-cut.png'), load('assets/img/tread.jpg')]).then(([side, tread]) => {
    side.colorSpace = THREE.SRGBColorSpace;
    side.anisotropy = 8;
    tread.colorSpace = THREE.SRGBColorSpace;
    tread.wrapS = THREE.RepeatWrapping;
    tread.repeat.set(5, 1);
    tread.anisotropy = 8;

    const planarUV = (geom, mirror = false) => {
      const p = geom.attributes.position, uv = geom.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        uv.setXY(i, (mirror ? -x : x) / R * .5 + .5, y / R * .5 + .5);
      }
      uv.needsUpdate = true;
    };
    const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: .72, metalness: .05, bumpMap: side, bumpScale: 1.4 });
    const treadMat = new THREE.MeshStandardMaterial({ map: tread, roughness: .85, metalness: 0, bumpMap: tread, bumpScale: 3 });
    const rimMat = new THREE.MeshStandardMaterial({ map: side, roughness: .55, metalness: 0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: .9, side: THREE.DoubleSide });

    // боковины: кольцо с лёгкой выпуклостью
    const makeSide = sign => {
      const g = new THREE.RingGeometry(RIM, RS, 160, 10);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y);
        const k = (r - RIM) / (RS - RIM);
        p.setZ(i, sign * (W / 2 - 0.05 + Math.sin(Math.PI * k) * 0.055 + k * 0.02));
      }
      planarUV(g, sign < 0);
      g.computeVertexNormals();
      if (sign < 0) g.scale(1, 1, 1), g.index && g.setIndex([...g.index.array].reverse());
      return new THREE.Mesh(g, sideMat);
    };
    roll.add(makeSide(1), makeSide(-1));

    // протектор с плечами: профиль вращения
    const prof = [];
    const sh = 0.11; // радиус скругления плеча
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 * (i / 10); prof.push(new THREE.Vector2(R - sh + Math.sin(a) * sh, -(W / 2 - sh) - Math.cos(a) * sh + 0.03)); }
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 * (i / 10); prof.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, (W / 2 - sh) + Math.sin(a) * sh - 0.03)); }
    prof.unshift(new THREE.Vector2(RS - 0.004, -(W / 2 - 0.03)));
    prof.push(new THREE.Vector2(RS - 0.004, W / 2 - 0.03));
    const tg = new THREE.LatheGeometry(prof, 220);
    tg.rotateX(Math.PI / 2);
    tg.computeVertexNormals();
    roll.add(new THREE.Mesh(tg, treadMat));

    // диск: лицевой и задний, утоплен внутрь
    const disc = (z, mirror) => {
      const g = new THREE.CircleGeometry(RIM + 0.004, 120);
      planarUV(g, mirror);
      const m = new THREE.Mesh(g, rimMat);
      m.position.z = z;
      if (mirror) m.rotation.y = Math.PI;
      return m;
    };
    roll.add(disc(W / 2 - 0.08, false), disc(-W / 2 + 0.08, true));
    // внутренняя полка обода
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(RIM, RIM, W - 0.16, 120, 1, true), darkMat);
    barrel.rotation.x = Math.PI / 2;
    roll.add(barrel);
  });

  function resize() {
    renderer.setSize(state.vw, state.vh, false);
    camera.aspect = state.vw / state.vh;
    camera.updateProjectionMatrix();
  }
  resize();

  const cur = { ry: 0, rx: 0, x: 0, y: 0, s: 1 };
  function render(y, dt) {
    const vh = state.vh;
    const hp = clamp(y / Math.max(vh, 820));                         // первый экран → второй
    const sp = clamp((y - geo.speedTop) / Math.max(1, geo.speedLen)); // прогресс «25 минут»
    const e = easeInOut(hp);
    // половина ширины видимой области на расстоянии камеры
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const target = {
      ry: -0.95 * e - 0.42 * sp + (state.smx - .5) * 0.22 * (1 - hp),
      rx: 0.1 * e + (state.smy - .5) * 0.16 * (1 - hp),
      x: lerp(0, halfW * 0.46, e),
      y: lerp(0.1, -0.02, e) + sp * 0.06,
      s: lerp(1, 1.12, e),
    };
    const k = 1 - Math.pow(0.0016, dt);
    for (const key in target) cur[key] += (target[key] - cur[key]) * k;
    group.rotation.set(cur.rx, cur.ry, 0);
    group.position.set(cur.x, cur.y, 0);
    group.scale.setScalar(cur.s);
    roll.rotation.z = -y * 0.0016 - state.t * 0.06;
    renderer.render(scene, camera);
  }
  return { ready, resize, render };
}

/* ---------- Главный цикл ---------- */
let last = performance.now();
let hoverX = 0, hoverY = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  state.t += dt;
  preTick(now, dt);

  const k = reduced ? 1 : 1 - Math.pow(0.0016, dt);
  state.sy += (state.y - state.sy) * k;
  if (Math.abs(state.y - state.sy) < 0.05) state.sy = state.y;
  state.smx += (state.mx - state.smx) * k * 0.6;
  state.smy += (state.my - state.smy) * k * 0.6;
  const y = state.sy;
  const vh = state.vh;

  updateTheme(state.y);

  // переход 1→2: интерфейс первого экрана уходит вверх и гаснет раньше, чем сменится тема
  const hf = clamp(y / (vh * 0.45));
  if (hf < 1 || heroUI[0].style.opacity !== '0') heroUI.forEach(el => {
    el.style.opacity = 1 - hf;
    el.style.translate = `0 ${-hf * 60}px`;
  });

  // фон первого экрана: параллакс
  if (y < vh * 1.4) heroBg.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(1.08)`;

  // сцена с шиной видна на первых двух экранах, потом уезжает
  const stageEnd = geo.speedTop + geo.speedLen;
  const out = clamp((y - stageEnd + vh * 0.15) / (vh * 0.5));
  stage.style.opacity = 1 - out;
  stage.style.transform = `translate3d(0, ${-out * vh * 0.25}px, 0)`;
  if (tire && out < 1) tire.render(y, dt);

  // «25 минут»: счётчик и шаги
  const sp = clamp((y - geo.speedTop) / Math.max(1, geo.speedLen));
  const mins = String(Math.round(sp * 25)).padStart(2, '0');
  if (clockNum.textContent !== mins) clockNum.textContent = mins;
  const idx = Math.min(steps.length - 1, Math.floor(sp * steps.length * 0.999));
  steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));

  // галерея: вертикальный скролл двигает ленту по горизонтали
  const wp = clamp((y - geo.worksTop) / geo.worksLen);
  const tx = -wp * geo.worksRun;
  track.style.transform = `translate3d(${tx}px, 0, 0)`;
  const wf = clamp((-tx - 120) / 380);
  worksHead.style.opacity = 1 - wf;
  worksHead.style.transform = `translate3d(${-wf * 60}px, 0, 0)`;
  cards.forEach((c, i) => {
    const center = geo.cardX[i] + tx;
    const rel = (center - state.vw / 2) / state.vw; // -1..1
    c.firstElementChild.firstElementChild.style.transform = `translate3d(${rel * -48}px, 0, 0)`;
  });
  let n = 1;
  geo.cardX.forEach((x, i) => { if (x + tx < state.vw * 0.62) n = i + 1; });
  const nn = String(n).padStart(2, '0');
  if (worksNow.textContent !== nn) worksNow.textContent = nn;

  // фото комнаты ожидания: параллакс
  const lp = (y + vh - geo.loungeTop) / (vh + geo.loungeH);
  if (lp > -0.1 && lp < 1.1) lounge.style.transform = `translate3d(0, ${(lp - .5) * -90}px, 0)`;

  // фото услуг за курсором
  rv.x += (hoverX - rv.x) * k * 0.9;
  rv.y += (hoverY - rv.y) * k * 0.9;
  const vel = clamp((hoverX - rv.x) * 0.04, -8, 8);
  rv.rot += (vel - rv.rot) * k;
  reveal.style.transform = `translate3d(${rv.x}px, ${rv.y}px, 0) rotate(${rv.rot}deg) scale(${reveal.classList.contains('is-on') ? 1 : .85})`;

  // футер: шина крутится от скролла и от движения курсора, буквы тянутся к курсору
  const fp = y + vh - geo.footTop;
  if (fp > 0) {
    tireVel += (state.mx - lastMx) * 900;
    tireVel *= Math.pow(0.04, dt);
    tireSpin += tireVel * dt;
    footTire.style.transform = `rotate(${y * 0.12 + tireSpin}deg)`;
    const fr = footLogo.offsetLeft;
    letters.forEach((l, i) => {
      const dx = state.mx * state.vw - (fr + letterX[i]);
      const target = footHover ? Math.exp(-(dx * dx) / (2 * 150 * 150)) : 0;
      lt[i].v += (target - lt[i].v) * k * 0.8;
      const v = lt[i].v;
      l.style.transform = `translateY(${-v * 4}%) scaleY(${1 + v * 0.22}) skewX(${-9 - v * 6}deg)`;
    });
  }
  lastMx = state.mx;

  requestAnimationFrame(frame);
}

addEventListener('scroll', () => { state.y = scrollY; }, { passive: true });
addEventListener('mousemove', e => {
  state.mx = e.clientX / state.vw; state.my = e.clientY / state.vh;
  hoverX = e.clientX; hoverY = e.clientY;
}, { passive: true });
addEventListener('resize', () => measure());
new ResizeObserver(() => measure()).observe(document.body);
document.fonts.ready.then(measure);
addEventListener('load', measure);

measure();
rv.x = hoverX = state.vw / 2; rv.y = hoverY = state.vh / 2;
initTire();
requestAnimationFrame(frame);

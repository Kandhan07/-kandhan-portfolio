/* Portfolio front-end: theme, nav, scroll animations, contact form, 3D background */

const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

/* ---------- Theme ---------- */
function setTheme(t) {
  root.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch (e) { /* private mode */ }
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#e8e9e5' : '#07080a');
}
$('#theme').addEventListener('click', () => {
  setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
});

/* ---------- Misc UI ---------- */
$('#year').textContent = new Date().getFullYear();

const nav = $('#nav');
const onScrollNav = () => nav.classList.toggle('is-stuck', window.scrollY > 40);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

let lenis = null;
const menuBtn = $('#menuBtn');
function toggleMenu(open) {
  const state = typeof open === 'boolean' ? open : !document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open', state);
  menuBtn.setAttribute('aria-expanded', String(state));
  $('#menu').setAttribute('aria-hidden', String(!state));
  if (lenis) state ? lenis.stop() : lenis.start();
  else document.body.style.overflow = state ? 'hidden' : '';
}
menuBtn.addEventListener('click', () => toggleMenu());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });

/* smooth anchor links */
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 ? $(id) : null;
    if (!target && id !== '#home') return;
    e.preventDefault();
    toggleMenu(false);
    const dest = id === '#home' ? 0 : target;
    setTimeout(() => {
      if (lenis) lenis.scrollTo(dest, { offset: id === '#home' ? 0 : -10, duration: 1.4 });
      else (id === '#home' ? window.scrollTo({ top: 0, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
    }, 60);
    history.replaceState(null, '', id);
  });
});

/* project filter */
$$('.filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.filter').forEach((b) => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    $$('.project').forEach((card) => { card.hidden = !(f === 'all' || card.dataset.cat === f); });
    if (hasGsap) window.ScrollTrigger.refresh();
  });
});

/* 3D tilt on project cards (pointer devices only) */
if (window.matchMedia('(hover: hover)').matches && !reduceMotion) {
  $$('.project').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/* ---------- Contact form ---------- */
(function contactForm() {
  const form = $('#contactForm');
  const status = $('#status');
  const send = $('#send');
  const msg = $('#f-message');
  const count = $('#count');
  msg.addEventListener('input', () => { count.textContent = `${msg.value.length} / 2000`; });

  const setStatus = (text, kind) => { status.textContent = text; status.className = 'form__status ' + (kind || ''); };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    $$('.field', form).forEach((f) => f.classList.remove('is-invalid'));

    const problems = [];
    if ((data.name || '').trim().length < 2) problems.push(['f-name', 'Please enter your name.']);
    if (!EMAIL_RE.test((data.email || '').trim())) problems.push(['f-email', 'Please enter a valid email address.']);
    if ((data.message || '').trim().length < 10) problems.push(['f-message', 'Your message should be at least 10 characters.']);
    if (problems.length) {
      problems.forEach(([id]) => $('#' + id).closest('.field').classList.add('is-invalid'));
      setStatus(problems[0][1], 'err');
      $('#' + problems[0][0]).focus();
      return;
    }

    send.disabled = true;
    setStatus('Sending...', '');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(), email: data.email.trim(), subject: (data.subject || '').trim(),
          message: data.message.trim(), website: data.website || '',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        form.reset();
        count.textContent = '0 / 2000';
        setStatus('Thanks! Your message was sent. I will reply soon.', 'ok');
      } else if (res.status === 429) {
        setStatus(body.detail || 'Too many messages. Please try again later.', 'err');
      } else if (res.status === 422) {
        setStatus('Please check your details and try again.', 'err');
      } else {
        setStatus('Something went wrong. Please email me directly.', 'err');
      }
    } catch (err) {
      setStatus('Network error. Please check your connection and try again.', 'err');
    } finally {
      send.disabled = false;
    }
  });
})();

/* ---------- Hero name: fit "KANDHAN" to the full width ---------- */
function fitHeroName() {
  const word = $('.hero__word'), h1 = $('.hero__name'), hero = $('.hero');
  if (!word || !h1 || !hero) return;
  word.style.fontSize = '100px';
  const w = word.getBoundingClientRect().width;
  if (!w) return;
  const fs = 100 * h1.clientWidth / w;
  word.style.fontSize = fs + 'px';
  /* very wide screens: squash the height a little so the name never swallows the hero */
  const CAP = 0.86; // Anton cap-height in em
  const maxH = hero.clientHeight * (window.innerWidth <= 767 ? 0.30 : 0.42);
  h1.style.setProperty('--sy', Math.max(0.7, Math.min(1, maxH / (fs * CAP))).toFixed(3));
  /* tell the CSS where the lime block starts, so the role + stack list always sit just above it */
  hero.style.setProperty('--name-top', (word.getBoundingClientRect().top - hero.getBoundingClientRect().top).toFixed(1) + 'px');
}
window.addEventListener('resize', fitHeroName);
window.addEventListener('load', fitHeroName);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeroName);
fitHeroName();

/* ---------- GSAP + Lenis ---------- */
if (hasGsap) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  if (!reduceMotion && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* progress bar */
  gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });

  if (!reduceMotion) {
    /* hero name: split into letters */
    const word = $('[data-split]');
    const text = word.textContent.trim();
    word.textContent = '';
    word.setAttribute('aria-hidden', 'true');
    [...text].forEach((c) => {
      const clip = document.createElement('span'); clip.className = 'clip';
      const ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c;
      clip.appendChild(ch); word.appendChild(clip);
    });
    fitHeroName(); // letters are split now, re-measure
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero__word .ch', { yPercent: 115, rotate: 5, duration: 1.2, stagger: 0.06 })
      .from('.hero__photo', { y: 70, opacity: 0, duration: 1.3 }, '-=0.9')
      .from('.hero__role, .hero__list li, .hero__cta .btn, .scroll-hint', { y: 24, opacity: 0, duration: 0.9, stagger: 0.08 }, '-=0.8')
      .from('.nav', { y: -30, opacity: 0, duration: 0.8 }, 0.2);

    /* hero scroll: the big name slides sideways, portrait drifts down */
    gsap.to('.hero__word', { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__photo', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    /* marquee moves with scroll */
    gsap.fromTo('.marquee__track', { xPercent: 0 }, { xPercent: -50, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });

    /* reveal on scroll */
    gsap.set('.reveal', { opacity: 0, y: 44 });
    ScrollTrigger.batch('.reveal', {
      start: 'top 90%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', overwrite: true }),
    });

    /* timeline line draws as you scroll */
    gsap.to('.timeline__line span', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 60%', scrub: true } });

    /* experience card: contributions slide in, tech chips pop in once the card is on screen */
    $$('.xp__card').forEach((card) => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: card, start: 'top 70%', once: true } });
      tl.from(card.querySelector('.xp__dot'), { scale: 0, duration: 0.7, ease: 'back.out(2.4)' }, 0)
        .from(card.querySelector('.xp__no'), { scale: 0.4, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, 0.1)
        .from(card.querySelectorAll('.xp__stats > div'), { y: 18, opacity: 0, duration: 0.7, stagger: 0.12 }, 0.3)
        .from(card.querySelectorAll('.xp__list li'), { x: -18, opacity: 0, duration: 0.7, stagger: 0.1 }, 0.35)
        .from(card.querySelectorAll('.xp__chips li'), { y: 14, scale: 0.9, opacity: 0, duration: 0.55, stagger: 0.06 }, 0.8);
    });

    /* count-up numbers */
    $$('[data-count]').forEach((el) => {
      const end = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } }),
      });
    });

    /* ---------- About: collage + headline ---------- */
    const aboutTitle = $('.about__title');
    if (aboutTitle) {
      /* split the headline into words, each inside its own mask (keeps the lime span intact) */
      const splitWords = (node) => {
        [...node.childNodes].forEach((n) => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
              const i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
              w.appendChild(i); frag.appendChild(w);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1) splitWords(n);
        });
      };
      aboutTitle.setAttribute('aria-label', aboutTitle.textContent.trim());
      splitWords(aboutTitle);
    }

    if ($('.collage')) {
      /* entrance: brackets draw, photos wipe in, badge pops, captions slide up, headline words rise */
      const wipe = (sel, from, at) => tl.fromTo(sel, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out', clearProps: 'clipPath' }, at);
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: '.about__grid', start: 'top 72%', once: true } });
      tl.from('.corner--tl', { scale: 0, duration: 0.8 }, 0)
        .from('.corner--br', { scale: 0, duration: 0.8 }, 0.2);
      wipe('.ph--one .ph__frame', 'inset(100% 0% 0% 0%)', 0.1);
      tl.from('.ph--one img', { scale: 1.4, duration: 1.6, ease: 'expo.out', clearProps: 'transform' }, 0.1);
      wipe('.ph--two .ph__frame', 'inset(0% 0% 0% 100%)', 0.5);
      tl.from('.ph--two img', { scale: 1.4, duration: 1.6, ease: 'expo.out', clearProps: 'transform' }, 0.5)
        .from('.badge', { scale: 0.4, opacity: 0, rotate: -10, transformOrigin: '0% 50%', duration: 1, ease: 'back.out(1.8)' }, 0.9)
        .from('.cap', { y: 14, opacity: 0, duration: 0.7, stagger: 0.25 }, 1.1);
      if ($('.about__title .wi')) tl.from('.about__title .wi', { yPercent: 115, duration: 1.1, stagger: 0.08, ease: 'expo.out' }, 0.2);

      /* idle: photos and badge float gently, each at its own pace */
      gsap.to('.ph--one .ph__float', { y: -10, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to('.ph--two .ph__float', { y: 12, duration: 4.1, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.6 });
      gsap.to('.badge', { y: -9, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.4 });

      /* scroll: the two photos drift in opposite directions */
      const st = { trigger: '.collage', start: 'top bottom', end: 'bottom top', scrub: 0.8 };
      gsap.fromTo('.ph--one', { yPercent: 5 }, { yPercent: -5, ease: 'none', scrollTrigger: st });
      gsap.fromTo('.ph--two', { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: st });

      /* pointer: the whole collage tilts a few degrees toward the cursor */
      if (window.matchMedia('(hover: hover)').matches) {
        const c = $('.collage');
        gsap.set(c, { transformPerspective: 1100 });
        const rx = gsap.quickTo(c, 'rotationX', { duration: 0.8, ease: 'power3.out' });
        const ry = gsap.quickTo(c, 'rotationY', { duration: 0.8, ease: 'power3.out' });
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 7);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 7);
        });
        c.addEventListener('pointerleave', () => { rx(0); ry(0); });
      }
    }
  }

  /* active nav link */
  ['about', 'skills', 'experience', 'projects', 'contact'].forEach((id) => {
    ScrollTrigger.create({
      trigger: '#' + id, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => $$(`.nav__links a[href="#${id}"]`).forEach((a) => a.classList.toggle('is-active', self.isActive)),
    });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* ---------- 3D background (Three.js) ---------- */
async function initScene() {
  const THREE = await import('three');
  const canvas = $('#bg');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  const mobile = window.innerWidth < 768;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7;

  const C = (hex) => new THREE.Color(hex);
  const palette = {
    lime: C('#d4ff3a'), cyan: C('#22d3ee'), pink: C('#ff3da6'), violet: C('#7c5cff'), blue: C('#2f6bff'),
  };

  /* --- liquid blob --- */
  const uniforms = {
    uTime: { value: 0 }, uAmp: { value: 0.22 },
    uA: { value: palette.lime.clone() }, uB: { value: palette.cyan.clone() }, uC: { value: palette.pink.clone() },
    uAlpha: { value: 0.95 },
  };
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, mobile ? 12 : 20),
    new THREE.ShaderMaterial({
      uniforms, transparent: true,
      vertexShader: `
        uniform float uTime; uniform float uAmp;
        varying vec3 vN; varying vec3 vV; varying float vD;
        void main() {
          vec3 p = position;
          float n = sin(p.x*2.1 + uTime*0.9) * sin(p.y*2.3 + uTime*0.7) * sin(p.z*1.9 + uTime*0.8);
          n += 0.5 * sin(p.x*4.3 - uTime*1.1 + p.y*3.1) * sin(p.z*4.1 + uTime);
          float d = n * uAmp;
          vec3 pos = p + normal * d;
          vD = d;
          vN = normalize(normalMatrix * (normal + vec3(sin(p.y*3.0+uTime), cos(p.x*3.0+uTime), sin(p.z*3.0))*uAmp*0.6));
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uAlpha;
        varying vec3 vN; varying vec3 vV; varying float vD;
        void main() {
          vec3 n = normalize(vN);
          float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.2);
          float t = n.y * 0.5 + 0.5 + vD * 1.2;
          vec3 col = mix(uA, uB, smoothstep(0.15, 0.85, t));
          col = mix(col, uC, smoothstep(0.55, 1.0, n.x * 0.5 + 0.5) * 0.55);
          col *= 0.6 + 0.4 * (n.z * 0.5 + 0.5);
          col += fres * uC * 0.8;
          gl_FragColor = vec4(col, uAlpha);
        }`,
    })
  );
  scene.add(blob);

  /* --- orbit rings --- */
  const ringMat = new THREE.MeshBasicMaterial({ color: palette.lime, transparent: true, opacity: 0.55 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.01, 8, 200), ringMat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.008, 8, 200), ringMat.clone());
  ring1.rotation.x = 1.2; ring2.rotation.set(0.4, 0.6, 0);
  blob.add(ring1, ring2);

  /* --- particles --- */
  const N = mobile ? 500 : 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 2] = -9 + Math.random() * 11;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.035, color: 0xffffff, transparent: true, opacity: 0.75, sizeAttenuation: true, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  /* --- theme-aware tuning --- */
  function applyTheme() {
    const light = root.getAttribute('data-theme') === 'light';
    pMat.color.set(light ? 0x1b2200 : 0xffffff);
    pMat.opacity = light ? 0.55 : 0.75;
    uniforms.uAlpha.value = light ? 0.9 : 0.95;
    ringMat.opacity = light ? 0.7 : 0.55;
    ring2.material.opacity = light ? 0.7 : 0.4;
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* --- one keyframe per section: where the blob sits + its colours --- */
  const ids = ['home', 'about', 'skills', 'experience', 'projects', 'education', 'contact'];
  const keys = [
    { x: 1.7, y: 0.1, z: -0.5, s: 1.0, ny: 0.3, a: 'lime', b: 'cyan', c: 'pink' },
    { x: 3.2, y: 0.0, z: -1, s: 0.95, a: 'cyan', b: 'violet', c: 'lime' },
    { x: -3.4, y: -0.2, z: -1.5, s: 0.9, a: 'pink', b: 'violet', c: 'cyan' },
    { x: 3.4, y: 0.0, z: -1, s: 0.95, a: 'lime', b: 'blue', c: 'pink' },
    { x: 0.0, y: 0.2, z: -4, s: 1.5, a: 'violet', b: 'cyan', c: 'lime' },
    { x: -3.3, y: 0.0, z: -1.5, s: 0.9, a: 'cyan', b: 'lime', c: 'violet' },
    { x: 0.6, y: 0.0, z: -1, s: 1.3, a: 'lime', b: 'pink', c: 'cyan' },
  ];
  let tops = [];
  const measure = () => {
    tops = ids.map((id) => { const el = document.getElementById(id); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
  };

  const cur = { x: 1.7, y: 0, z: -0.5, s: 1.0 };
  const tmpA = new THREE.Color(), tmpB = new THREE.Color(), tmpC = new THREE.Color();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / window.innerWidth - 0.5;
    mouse.ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    measure();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('load', measure);
  resize();

  const clock = new THREE.Clock();
  let lastY = window.scrollY, vel = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = reduceMotion ? 0 : clock.elapsedTime;
    const y = window.scrollY;
    vel += ((y - lastY) - vel) * 0.1; lastY = y;

    /* which section are we in, as a fractional index */
    const probe = y + window.innerHeight * 0.45;
    let i = 0;
    while (i < tops.length - 1 && probe >= tops[i + 1]) i++;
    const next = Math.min(i + 1, keys.length - 1);
    const span = Math.max((tops[next] || tops[i] + 1) - tops[i], 1);
    let f = i === next ? 0 : Math.min(Math.max((probe - tops[i]) / span, 0), 1);
    f = f * f * (3 - 2 * f); // smoothstep
    const k0 = keys[i], k1 = keys[next];
    const narrow = window.innerWidth / window.innerHeight < 0.9;
    const xScale = narrow ? 0.28 : 1;
    const target = {
      x: (k0.x + (k1.x - k0.x) * f) * xScale,
      y: (k0.y + (k1.y - k0.y) * f) + (narrow ? (k0.ny ?? 1.6) + ((k1.ny ?? 1.6) - (k0.ny ?? 1.6)) * f : 0),
      z: (k0.z + (k1.z - k0.z) * f) - (narrow ? 1.5 : 0),
      s: (k0.s + (k1.s - k0.s) * f) * (narrow ? 0.7 : 1),
    };
    const ease = 1 - Math.pow(0.0015, dt);
    cur.x += (target.x - cur.x) * ease; cur.y += (target.y - cur.y) * ease;
    cur.z += (target.z - cur.z) * ease; cur.s += (target.s - cur.s) * ease;

    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;

    blob.position.set(cur.x + mouse.x * 0.6, cur.y - mouse.y * 0.4, cur.z);
    blob.scale.setScalar(cur.s);
    blob.rotation.y = t * 0.15 + y * 0.0008;
    blob.rotation.x = Math.sin(t * 0.2) * 0.2 + y * 0.0004;
    ring1.rotation.z = t * 0.25; ring2.rotation.y = -t * 0.18;

    uniforms.uTime.value = t;
    uniforms.uAmp.value = 0.2 + Math.min(Math.abs(vel) * 0.012, 0.22); // wobbles harder when you scroll fast
    tmpA.copy(palette[k0.a]).lerp(palette[k1.a], f); uniforms.uA.value.copy(tmpA);
    tmpB.copy(palette[k0.b]).lerp(palette[k1.b], f); uniforms.uB.value.copy(tmpB);
    tmpC.copy(palette[k0.c]).lerp(palette[k1.c], f); uniforms.uC.value.copy(tmpC);
    ringMat.color.copy(tmpA); ring2.material.color.copy(tmpB);

    points.rotation.y = t * 0.012 + y * 0.00012;
    points.position.y = y * 0.0016;   // parallax: particles drift up as you scroll
    points.position.x = -mouse.x * 0.5;

    camera.position.x = mouse.x * 0.3;
    camera.position.y = -mouse.y * 0.2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}

initScene().catch((err) => {
  /* No WebGL? The page still works with the plain themed background. */
  console.warn('3D background disabled:', err);
  const c = $('#bg'); if (c) c.remove();
});

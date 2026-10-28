// Lace curtain split in two halves, tied with a satin bow. Pull the ribbon (or tap the
// bow) to untie it: the bow falls away and the curtain parts like cloth.
import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { pictureHTML } from './stage.js';

/* global __BOW_PNG__ */
const USE_PNG = typeof __BOW_PNG__ !== 'undefined' && __BOW_PNG__;

// Bow geometry, in SVG units (viewBox 200×340). The knot sits at (100,70); the pearl at y≈300.
const KNOT = '100 70';
const RIBBON_TOP = '101 78';
const RIBBON_LEN = 206;
const VIEW_W = 200;

const STITCH = 'class="bw-stitch"';
const LOOP_OUTLINE = 'M99 64C86 50 62 28 36 24C20 22 8 30 6 44C5 56 12 68 26 74C46 82 76 80 99 74';
const LOOP = `
  <path d="${LOOP_OUTLINE}Z" fill="url(#bw-satin)"/>
  <path d="M36 24C20 22 8 30 6 44C5 56 12 68 26 74C18 64 16 52 20 42C24 33 30 27 36 24Z" fill="url(#bw-fold)" opacity=".85"/>
  <path d="M99 72C80 77 52 77 32 71C48 65 76 65 99 68Z" fill="url(#bw-fold)" opacity=".7"/>
  <path d="M97 69C80 60 56 51 24 49" fill="none" stroke="#8c4b48" stroke-opacity=".28" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M92 58C76 44 55 33 36 31" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>
  <path d="${LOOP_OUTLINE}" ${STITCH}/>`;
const TAIL = `
  <path d="M92 77C84 98 70 122 52 146L63 146L67 158C84 132 98 106 106 80Z" fill="url(#bw-band)"/>
  <path d="M99 80C91 102 78 126 61 151" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.6"/>
  <path d="M92 77C84 98 70 122 52 146M106 80C98 106 84 132 67 158" ${STITCH}/>`;
const KNOT_PATH = 'M91 59C96 55 105 55 110 59C113 65 113 77 109 83C104 86 96 86 91 83C87 77 87 65 91 59Z';

export const BOW_SVG = `
<svg class="bow-svg" viewBox="0 0 200 340" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="bw-satin" x1="0" y1="0" x2=".35" y2="1">
      <stop offset="0" stop-color="#f8e2dc"/><stop offset=".32" stop-color="#f3d2cc"/>
      <stop offset=".64" stop-color="#d5968f"/><stop offset="1" stop-color="#ad6763"/>
    </linearGradient>
    <linearGradient id="bw-fold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bb7671"/><stop offset="1" stop-color="#8c4b48"/>
    </linearGradient>
    <linearGradient id="bw-band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#b16b66"/><stop offset=".38" stop-color="#f3d2cc"/>
      <stop offset=".64" stop-color="#d59a93"/><stop offset="1" stop-color="#a05b57"/>
    </linearGradient>
    <radialGradient id="bw-knot" cx=".4" cy=".35" r=".75">
      <stop offset="0" stop-color="#f7ddd6"/><stop offset=".55" stop-color="#d4948d"/><stop offset="1" stop-color="#a05b57"/>
    </radialGradient>
    <radialGradient id="bw-pearl" cx=".36" cy=".3" r=".75">
      <stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#fbf3ea"/>
      <stop offset=".8" stop-color="#e8d5c4"/><stop offset="1" stop-color="#c6a994"/>
    </radialGradient>
  </defs>
  <g class="bw-tail-l">${TAIL}</g>
  <g class="bw-tail-r"><g transform="matrix(-1 0 0 1 200 0) rotate(-5 100 76)">${TAIL}</g></g>
  <g class="bw-pull">
    <g class="bw-ribbon">
      <path d="M94 78C90 130 104 192 94 284L108 284C117 192 103 130 108 78Z" fill="url(#bw-band)"/>
      <path d="M101 82C98 132 111 192 101 282" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.8"/>
      <path d="M94 78C90 130 104 192 94 284M108 78C103 130 117 192 108 284" ${STITCH}/>
    </g>
    <g class="bw-pearl"><g class="bw-bob">
      <path d="M94.5 283h13l-2 6h-9z" fill="#c9a06f" stroke="#9d7346" stroke-width=".6"/>
      <circle cx="101" cy="299.5" r="10" fill="url(#bw-pearl)"/>
      <circle cx="97.6" cy="295.8" r="2.6" fill="#fff" opacity=".85"/>
    </g></g>
  </g>
  <g class="bw-loop-l">${LOOP}</g>
  <g class="bw-loop-r"><g transform="matrix(-1 0 0 1 200 0)">${LOOP}</g></g>
  <g class="bw-knot">
    <path d="${KNOT_PATH}" fill="url(#bw-knot)"/>
    <path d="M95 60C98 68 98 74 95 83M105 60C102 68 102 74 105 83" fill="none" stroke="#9c5753" stroke-opacity=".45" stroke-width="1.2"/>
    <path d="${KNOT_PATH}" ${STITCH}/>
  </g>
</svg>`;

const CHEVRON = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createCurtain({ reduced, zoom, dim, onUntie, onOpened }) {
  const root = document.getElementById('curtain');
  const art = pictureHTML(CONFIG.curtain, '', { priority: 'high' });
  root.innerHTML = `
    <div class="frame">
      <div class="stage">
        <div class="half half--l"><div class="half-img">${art}</div></div>
        <div class="half half--r"><div class="half-img">${art}</div></div>
        <button class="bow${USE_PNG ? ' bow--png' : ''}" type="button" aria-label="Untie the ribbon to open the invitation">
          ${USE_PNG ? '<img class="bow-png" src="/images/bow.png" alt="" draggable="false">' : BOW_SVG}
        </button>
        <p class="pull-hint ui-caps" aria-hidden="true"><span>Pull the ribbon to open</span>${CHEVRON}</p>
      </div>
    </div>`;

  const halves = [...root.querySelectorAll('.half')];
  const bow = root.querySelector('.bow');
  const hint = root.querySelector('.pull-hint');
  const q = (s) => root.querySelector(s);
  const parts = USE_PNG ? null : {
    loopL: q('.bw-loop-l'), loopR: q('.bw-loop-r'), knot: q('.bw-knot'),
    tailL: q('.bw-tail-l'), tailR: q('.bw-tail-r'),
    pull: q('.bw-pull'), ribbon: q('.bw-ribbon'), pearl: q('.bw-pearl'), bob: q('.bw-bob'),
  };
  const png = USE_PNG ? q('.bow-png') : null;

  let ready = false;
  let opened = false;
  let idle = null;
  let drag = null;
  let suppressClick = false;
  const pull = { p: 0 };

  // Scroll lock while the curtain is up (iOS ignores overflow:hidden for touch scrolling).
  const block = (e) => e.preventDefault();
  root.addEventListener('touchmove', block, { passive: false });
  root.addEventListener('wheel', block, { passive: false });

  const stageH = () => root.querySelector('.stage').getBoundingClientRect().height;
  const maxPull = () => stageH() * 0.22; // rubber-band asymptote
  const threshold = () => Math.min(110, maxPull() * 0.55);

  function setPull(p) {
    pull.p = p;
    const k = Math.min(1, p / threshold());
    if (USE_PNG) {
      gsap.set(png, { y: p * 0.6, scaleX: 1 - 0.08 * k });
      return;
    }
    const u = VIEW_W / bow.getBoundingClientRect().width; // px → SVG units
    gsap.set(parts.ribbon, { scaleY: 1 + (p * u) / RIBBON_LEN, svgOrigin: RIBBON_TOP });
    gsap.set(parts.pearl, { y: p * u });
    gsap.set([parts.loopL, parts.loopR], { scaleX: 1 - 0.08 * k, svgOrigin: KNOT });
    gsap.set(parts.knot, { scaleY: 1 - 0.06 * k, svgOrigin: KNOT });
  }

  function startIdle() {
    if (reduced || opened) return;
    idle?.kill();
    if (USE_PNG) {
      idle = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 0.8 })
        .to(png, { rotation: 1.5, duration: 0.9, ease: 'sine.inOut' })
        .to(png, { rotation: 0, duration: 0.9, ease: 'sine.inOut' });
      return;
    }
    idle = gsap.timeline({ repeat: -1, repeatDelay: 0.9, delay: 0.8 })
      .to(parts.pull, { rotation: 2.2, svgOrigin: RIBBON_TOP, duration: 0.8, ease: 'sine.inOut' })
      .to(parts.pull, { rotation: -1.6, svgOrigin: RIBBON_TOP, duration: 0.9, ease: 'sine.inOut' })
      .to(parts.pull, { rotation: 0, svgOrigin: RIBBON_TOP, duration: 0.7, ease: 'sine.inOut' })
      .to(parts.bob, { y: 5, duration: 0.55, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.35);
  }

  function stopIdle() {
    idle?.kill();
    idle = null;
    if (USE_PNG) gsap.to(png, { rotation: 0, duration: 0.25 });
    else gsap.to([parts.pull, parts.bob], { rotation: 0, y: 0, svgOrigin: RIBBON_TOP, duration: 0.25 });
  }

  function springBack() {
    gsap.to(pull, {
      p: 0, duration: 0.9, ease: 'elastic.out(1, 0.6)',
      onUpdate: () => setPull(pull.p),
      onComplete: startIdle,
    });
  }

  // ── pointer: drag the ribbon down ─────────────────────────────────────────
  bow.addEventListener('pointerdown', (e) => {
    if (!ready || opened || e.button > 0) return;
    gsap.killTweensOf(pull);
    stopIdle();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dy: 0, moved: false };
    try { bow.setPointerCapture(e.pointerId); } catch { /* some WebViews refuse capture; dragging still works */ }
  });
  bow.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    drag.dy = Math.max(0, dy);
    const D = maxPull();
    setPull(D * Math.tanh(drag.dy / D));
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) { if (pull.p) springBack(); else startIdle(); return; } // a tap: click unties
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 350);
    if (e.type === 'pointerup' && d.dy >= threshold()) untie();
    else springBack();
  };
  bow.addEventListener('pointerup', release);
  bow.addEventListener('pointercancel', release);
  // Tap, Enter or Space.
  bow.addEventListener('click', () => {
    if (suppressClick) return;
    untie();
  });

  // ── the untie sequence ────────────────────────────────────────────────────
  function untie() {
    if (!ready || opened) return;
    opened = true;
    idle?.kill();
    gsap.killTweensOf(pull);
    bow.setAttribute('aria-disabled', 'true');
    // Haptic tick (Android); only inside a real gesture, otherwise Chrome logs an error.
    if (navigator.userActivation?.isActive !== false) navigator.vibrate?.(12);
    onUntie?.(knotPoint()); // starts the music: must stay synchronous inside the gesture

    const tl = gsap.timeline({ onComplete: finish });
    if (reduced) {
      tl.to(root, { autoAlpha: 0, duration: 0.8, ease: 'sine.inOut' }, 0)
        .to(dim, { opacity: 0, duration: 0.8, ease: 'sine.inOut' }, 0);
      return;
    }

    tl.to(hint, { autoAlpha: 0, duration: 0.35, ease: 'sine.out' }, 0);
    if (USE_PNG) {
      tl.to(png, { scaleX: 0.9, scaleY: 1.04, y: 6, duration: 0.15, ease: 'power2.out' }, 0)
        .to(png, { scale: 1.12, duration: 0.2, ease: 'power2.out' }, 0.15)
        .to(png, { y: '+=260', rotation: 12, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.35);
    } else {
      const { loopL, loopR, knot, tailL, tailR, pull: pullG, ribbon } = parts;
      tl.to(ribbon, { scaleY: 1, svgOrigin: RIBBON_TOP, duration: 0.2, ease: 'power2.out' }, 0)
        // loops spring open and slide apart, the knot loosens…
        .to(loopL, { rotation: -16, x: -30, y: -4, scaleX: 1.04, svgOrigin: KNOT, duration: 0.5, ease: 'power3.out' }, 0)
        .to(loopR, { rotation: 16, x: 30, y: -4, scaleX: 1.04, svgOrigin: KNOT, duration: 0.5, ease: 'power3.out' }, 0)
        .to(knot, { scale: 1.16, svgOrigin: KNOT, duration: 0.3, ease: 'power2.out' }, 0)
        .to(tailL, { rotation: 14, svgOrigin: KNOT, duration: 0.4, ease: 'power2.out' }, 0)
        .to(tailR, { rotation: -14, svgOrigin: KNOT, duration: 0.4, ease: 'power2.out' }, 0)
        // …then everything drops with gravity and fades.
        .to(pullG, { y: 230, rotation: 7, svgOrigin: RIBBON_TOP, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.05)
        .to([loopL, loopR, knot, tailL, tailR], {
          y: '+=150',
          rotation: (i) => [-38, 38, 12, 30, -30][i],
          svgOrigin: KNOT,
          opacity: 0,
          duration: 0.7,
          ease: 'power2.in',
          stagger: 0.03,
        }, 0.3);
    }

    // The curtain parts like cloth: slide, a slight skew and a gather.
    const S = 0.35;
    const [left, right] = halves;
    gsap.set(halves, { willChange: 'transform' });
    tl.to(left, { xPercent: -105, duration: 1.8, ease: 'power3.inOut' }, S)
      .to(right, { xPercent: 105, duration: 1.8, ease: 'power3.inOut' }, S + 0.05)
      .to(left, { keyframes: { skewY: [0, 1.5, 0], scaleX: [1, 0.95, 1], easeEach: 'sine.inOut' }, duration: 1.8, ease: 'none' }, S)
      .to(right, { keyframes: { skewY: [0, -1.5, 0], scaleX: [1, 0.95, 1], easeEach: 'sine.inOut' }, duration: 1.8, ease: 'none' }, S + 0.05)
      // The cover settles underneath.
      .to(zoom, { scale: 1, duration: 2.2, ease: 'power2.inOut' }, S)
      .to(dim, { opacity: 0, duration: 2.2, ease: 'power1.inOut' }, S);
  }

  function finish() {
    root.remove();
    document.documentElement.classList.remove('is-locked');
    onOpened?.();
  }

  function knotPoint() {
    const r = bow.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * (USE_PNG ? 0.5 : 70 / 340) };
  }

  return {
    image: halves[0].querySelector('img'),
    setReady() {
      if (ready) return;
      ready = true;
      root.classList.add('is-ready');
      gsap.to(hint, { autoAlpha: 1, duration: 0.9, ease: 'sine.out' });
      startIdle();
    },
  };
}

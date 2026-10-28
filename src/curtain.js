// Lace curtain split in two halves, with two pearl strands hanging over the seam as
// pull-cords. Pull a strand down (or tap them) and the curtain parts like cloth; each
// strand rides away with its half.
import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import manifest from './images.json';
import { pictureHTML } from './stage.js';

const CHEVRON = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const strandHTML = (side) => {
  const s = manifest.strands[side];
  return `<img class="strand strand--${side}" data-src="${s.src}" width="${s.w}" height="${s.h}" alt="" draggable="false">`;
};

export function createCurtain({ reduced, zoom, dim, onUntie, onReveal, onOpened }) {
  const root = document.getElementById('curtain');
  const art = pictureHTML(CONFIG.curtain, '', { priority: 'high' });
  root.innerHTML = `
    <div class="frame">
      <div class="stage">
        <div class="half half--l"><div class="half-img">${art}</div>${strandHTML('l')}</div>
        <div class="half half--r"><div class="half-img">${art}</div>${strandHTML('r')}</div>
        <button class="pull" type="button" aria-label="Pull the pearl strings to open the invitation"></button>
        <p class="pull-hint ui-caps" aria-hidden="true"><span>Pull the strings to open</span>${CHEVRON}</p>
      </div>
    </div>`;

  const stage = root.querySelector('.stage');
  const halves = [...root.querySelectorAll('.half')];
  const strands = [...root.querySelectorAll('.strand')];
  const pullBtn = root.querySelector('.pull');
  const hint = root.querySelector('.pull-hint');
  gsap.set(strands, { xPercent: -50, transformOrigin: '50% 0%' });

  let ready = false;
  let opened = false;
  let idle = null;
  let drag = null;
  let suppressClick = false;
  const pull = { p: 0, side: 0 }; // side: 0 = left strand, 1 = right strand

  // Scroll lock while the curtain is up (iOS ignores overflow:hidden for touch scrolling).
  const block = (e) => e.preventDefault();
  root.addEventListener('touchmove', block, { passive: false });
  root.addEventListener('wheel', block, { passive: false });

  const stageBox = () => stage.getBoundingClientRect();
  const maxPull = () => stageBox().height * 0.1; // rubber-band asymptote; the strand tops stay off-screen
  const threshold = () => Math.min(90, maxPull() * 0.75); // finger travel that opens the curtain

  // The pulled strand slides down; its partner follows a little, as if tied above the seam.
  function setPull(p) {
    pull.p = p;
    gsap.set(strands[pull.side], { y: p });
    gsap.set(strands[1 - pull.side], { y: p * 0.3 });
  }

  function startIdle() {
    if (reduced || opened || !ready) return;
    idle?.kill();
    const [l, r] = strands;
    idle = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 0.6 })
      .to(l, { rotation: 0.9, duration: 1.4, ease: 'sine.inOut' }, 0)
      .to(r, { rotation: -0.7, duration: 1.4, ease: 'sine.inOut' }, 0.25)
      .to(l, { rotation: 0, duration: 1.4, ease: 'sine.inOut' }, 1.4)
      .to(r, { rotation: 0, duration: 1.4, ease: 'sine.inOut' }, 1.65)
      // a small tug every few seconds invites the gesture
      .to(strands, { y: 6, duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.5);
  }

  function stopIdle() {
    idle?.kill();
    idle = null;
    gsap.to(strands, { rotation: 0, duration: 0.25 });
  }

  function springBack() {
    gsap.to(pull, {
      p: 0, duration: 0.9, ease: 'elastic.out(1, 0.6)',
      onUpdate: () => setPull(pull.p),
      onComplete: startIdle,
    });
  }

  // ── pointer: pull a strand down ─────────────────────────────────────────────
  // Paint the book underneath as soon as the guest reaches for the strings.
  const uncover = () => document.documentElement.classList.remove('is-curtained');
  pullBtn.addEventListener('focus', uncover);
  pullBtn.addEventListener('pointerdown', (e) => {
    uncover();
    if (!ready || opened || e.button > 0) return;
    gsap.killTweensOf(pull);
    stopIdle();
    const box = stageBox();
    pull.side = e.clientX < box.left + box.width / 2 ? 0 : 1;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dy: 0, moved: false };
    try { pullBtn.setPointerCapture(e.pointerId); } catch { /* some WebViews refuse capture; dragging still works */ }
  });
  pullBtn.addEventListener('pointermove', (e) => {
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
    if (!d.moved) { if (pull.p) springBack(); else startIdle(); return; } // a tap: click opens
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 350);
    if (e.type === 'pointerup' && d.dy >= threshold()) open();
    else springBack();
  };
  pullBtn.addEventListener('pointerup', release);
  pullBtn.addEventListener('pointercancel', release);
  // Tap, Enter or Space.
  pullBtn.addEventListener('click', () => {
    if (suppressClick) return;
    open();
  });

  // ── opening ──────────────────────────────────────────────────────────────────
  function open() {
    if (!ready || opened) return;
    opened = true;
    uncover();
    idle?.kill();
    gsap.killTweensOf(pull);
    pullBtn.setAttribute('aria-disabled', 'true');
    // Haptic tick (Android); only inside a real gesture, otherwise Chrome logs an error.
    if (navigator.userActivation?.isActive !== false) navigator.vibrate?.(12);
    onUntie?.(strandEnds()); // starts the music: must stay synchronous inside the gesture

    const tl = gsap.timeline({ onComplete: finish });
    if (reduced) {
      tl.to(root, { autoAlpha: 0, duration: 0.8, ease: 'sine.inOut' }, 0)
        .to(dim, { opacity: 0, duration: 0.8, ease: 'sine.inOut' }, 0)
        .add(() => onReveal?.(), 0.4);
      return;
    }

    // The cords give: a last short tug, then they spring back up as the curtain releases.
    const pulled = pull.p;
    tl.to(hint, { autoAlpha: 0, duration: 0.35, ease: 'sine.out' }, 0)
      .to(strands, { y: (i) => (i === pull.side ? pulled + 10 : pulled * 0.3 + 6), duration: 0.16, ease: 'power2.out' }, 0)
      .to(strands, { y: 0, duration: 0.7, ease: 'power3.out' }, 0.16);

    // The curtain parts like cloth: slide, a slight skew and a gather. The strands lag and swing.
    const S = 0.25;
    const [left, right] = halves;
    gsap.set(halves, { willChange: 'transform' });
    tl.to(left, { xPercent: -105, duration: 1.8, ease: 'power3.inOut' }, S)
      .to(right, { xPercent: 105, duration: 1.8, ease: 'power3.inOut' }, S + 0.05)
      .to(left, { keyframes: { skewY: [0, 1.5, 0], scaleX: [1, 0.95, 1], easeEach: 'sine.inOut' }, duration: 1.8, ease: 'none' }, S)
      .to(right, { keyframes: { skewY: [0, -1.5, 0], scaleX: [1, 0.95, 1], easeEach: 'sine.inOut' }, duration: 1.8, ease: 'none' }, S + 0.05)
      .to(strands[0], { keyframes: { rotation: [0, -5, 2.5, 0], easeEach: 'sine.inOut' }, duration: 1.8, ease: 'none' }, S)
      .to(strands[1], { keyframes: { rotation: [0, 5, -2.5, 0], easeEach: 'sine.inOut' }, duration: 1.8, ease: 'none' }, S + 0.05)
      // The cover settles underneath, then its monogram is written in.
      .to(zoom, { scale: 1, duration: 2.2, ease: 'power2.inOut' }, S)
      .to(dim, { opacity: 0, duration: 2.2, ease: 'power1.inOut' }, S)
      .add(() => onReveal?.(), S + 1.1);
  }

  function finish() {
    root.remove();
    document.documentElement.classList.remove('is-locked');
    onOpened?.();
  }

  // Viewport points at the bottom pearl of each strand (for the sparkle burst).
  function strandEnds() {
    return strands.map((s) => {
      const r = s.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.bottom - r.width * 0.45 };
    });
  }

  return {
    image: halves[0].querySelector('img'),
    // The strands load right after the curtain is painted and drop gently into place.
    load() {
      strands.forEach((s) => {
        s.addEventListener('load', () => gsap.fromTo(s, { autoAlpha: 0, y: -24 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power2.out' }), { once: true });
        s.src = s.dataset.src;
        s.removeAttribute('data-src');
      });
    },
    setReady() {
      if (ready) return;
      ready = true;
      root.classList.add('is-ready');
      gsap.to(hint, { autoAlpha: 1, duration: 0.9, ease: 'sine.out' });
      startIdle();
    },
  };
}

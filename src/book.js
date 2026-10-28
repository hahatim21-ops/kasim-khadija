// The book: a pinned ScrollTrigger section whose timeline turns one page per 100vh of
// scroll. Gestures (swipe, wheel, keys) are converted into exactly one page per gesture
// by driving the scroll position ourselves, so the page follows the finger and always
// comes to rest flat on a page.
//
// Each page is two layers of the same (text-free) artwork: the background, with a hole where
// the paper page sits, and the "leaf" — just the paper page (or cover board), hinged at the
// spine — which carries the animated text and is the only thing that turns.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from './config.js';
import manifest from './images.json';
import { pictureHTML, loadPicture } from './stage.js';
import { createPageText } from './pagetext.js';

const VISIBLE = 0.84; // share of a flip spent on 0° → -90°; the back half happens off-stage
const PERSPECTIVE = 1800;
const clamp = (min, max, v) => Math.min(max, Math.max(min, v));

// The background keeps everything except the leaf: a rectangle with a rectangular hole.
const holeClip = ([l, t, r, b]) =>
  `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l}% ${t}%, ${r}% ${t}%, ${r}% ${b}%, ${l}% ${b}%, ${l}% ${t}%)`;
const leafClip = ([l, t, r, b]) => `inset(${t}% ${100 - r}% ${100 - b}% ${l}%)`;

function textHTML(lines = []) {
  return lines.map((l) => `<img class="tx tx--${l.kind}" data-kind="${l.kind}" data-src="${l.src}" alt="" width="${l.w}" height="${l.h}"`
    + ` style="left:${l.x}%;top:${l.y}%;width:${l.width}%" draggable="false" aria-hidden="true">`).join('');
}

function pageHTML(p, i, N) {
  const m = manifest[p.id];
  const art = (alt) => pictureHTML(p.id, alt, { deferred: true, priority: i === 0 ? 'high' : 'low' });
  if (!m.leaf) {
    return `<div class="page" style="z-index:${N + 1 - i}"><div class="pg-bg">${art(p.alt)}</div></div>`;
  }
  const [l, t, r, b] = m.leaf;
  return `
    <div class="page${i === 0 ? ' page--cover' : ''}" style="z-index:${N + 1 - i}">
      <div class="pg-bg" style="clip-path:${holeClip(m.leaf)}">${art(p.alt)}</div>
      <div class="leaf" style="transform-origin:${l}% 50%">
        <div class="leaf-face" style="clip-path:${leafClip(m.leaf)}">
          ${art('')}
          ${textHTML(m.text)}
          ${i === 0 ? '<i class="glint" aria-hidden="true"><i></i></i>' : ''}
          ${i > 0 ? '<i class="cast"></i>' : ''}
          <i class="shade" style="left:${l}%;width:${r - l}%"></i>
          <i class="gloss" style="left:${l}%;width:${r - l}%"></i>
        </div>
        ${i === 0 ? `<i class="edge" style="left:${r}%;top:${t}%;height:${b - t}%"></i>` : ''}
      </div>
    </div>`;
}

export function createBook({ reduced }) {
  const pagesCfg = CONFIG.pages;
  const N = pagesCfg.length - 1; // number of flips (the back cover stays at the bottom)
  const root = document.getElementById('book');

  root.innerHTML = `
    <div class="frame">
      <div class="book-zoom">
        <div class="stage">
          <div class="pages">${pagesCfg.map((p, i) => pageHTML(p, i, N)).join('')}</div>
          <div class="shimmer-wrap" aria-hidden="true"><i class="shimmer"></i></div>
          <div class="bc-slot"></div>
        </div>
      </div>
      <i class="dim" aria-hidden="true"></i>
    </div>`;

  const pages = [...root.querySelectorAll('.page')];
  const leaves = pages.map((p) => p.querySelector('.leaf'));
  const bgs = pages.map((p) => p.querySelector('.pg-bg'));
  const leafRects = pagesCfg.map((p) => manifest[p.id].leaf);
  const images = [...root.querySelectorAll('.pg-bg img')];
  const lazy = [...root.querySelectorAll('.page img')]; // backgrounds, leaves and text layers
  const zoom = root.querySelector('.book-zoom');
  const dim = root.querySelector('.dim');
  const text = createPageText(pages, { reduced });
  if (!reduced) gsap.set(zoom, { scale: 1.08 });

  let tl, st;
  let index = 0; // the page we rest on, or are heading to
  let enabled = false;
  let dragging = false;
  let navTween = null;
  let atRest = true;
  let lastRest = 0;
  let lastTop = 0;
  const handlers = { arrive: [], depart: [], move: [] };
  const emit = (type, v) => handlers[type].forEach((fn) => fn(v));

  // ── timeline ────────────────────────────────────────────────────────────────
  function buildTimeline() {
    tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: sync });
    for (let i = 0; i < N; i++) {
      if (reduced) {
        tl.to(pages[i], { autoAlpha: 0, duration: 1 }, i); // crossfade instead of a 3D turn
        continue;
      }
      const leaf = leaves[i];
      const shade = leaf.querySelector('.shade');
      const gloss = leaf.querySelector('.gloss');
      const heavy = i === 0; // the cover board turns with more weight

      tl.fromTo(leaf, { rotationY: 0 }, { rotationY: -90, duration: VISIBLE, ease: heavy ? 'power2.inOut' : 'sine.inOut' }, i)
        .to(leaf, { rotationY: -180, duration: 1 - VISIBLE }, i + VISIBLE)
        .fromTo(leaf, { z: 0 }, { z: 30, duration: 0.5, ease: 'sine.out' }, i)
        .to(leaf, { z: 0, duration: 0.5, ease: 'sine.in' }, i + 0.5)
        // Paper curve: the turning page darkens toward the spine, a highlight band sweeps across it.
        .fromTo(shade, { opacity: 0 }, { opacity: 0.45, duration: VISIBLE, ease: 'sine.in' }, i)
        .fromTo(gloss, { xPercent: 70 }, { xPercent: -80, duration: VISIBLE }, i)
        .fromTo(gloss, { opacity: 0 }, { opacity: 0.5, duration: VISIBLE * 0.45, ease: 'sine.out' }, i)
        .to(gloss, { opacity: 0, duration: VISIBLE * 0.55, ease: 'sine.in' }, i + VISIBLE * 0.45)
        // The surroundings (lace, flowers, the rest of the book) ease over to the next page's.
        .fromTo(bgs[i], { opacity: 1 }, { opacity: 0, duration: 1, ease: 'sine.inOut' }, i);
    }
  }

  // Shadow cast on the page underneath: it hugs the projected fore-edge of the turning
  // leaf and fades as the leaf stands up and leaves.
  const casts = pages.map((p) => p.querySelector('.cast'));
  let castOn = null;
  let stageW = 0; // cached on refresh so the frame loop never reads layout
  function placeCast(top, turning) {
    const cast = turning ? casts[top + 1] : null;
    if (castOn && castOn !== cast) castOn.style.opacity = '0';
    castOn = cast;
    if (!cast) return;
    const leaf = leaves[top];
    const deg = -gsap.getProperty(leaf, 'rotationY');
    if (deg >= 90) { cast.style.opacity = '0'; return; }
    const W = stageW || (stageW = pages[0].offsetWidth);
    const [l, , r] = leafRects[top];
    const hinge = (l / 100) * W, width = ((r - l) / 100) * W;
    const a = (deg * Math.PI) / 180;
    const s = PERSPECTIVE / (PERSPECTIVE - (width * Math.sin(a) + gsap.getProperty(leaf, 'z')));
    const edge = W / 2 + (hinge + width * Math.cos(a) - W / 2) * s;
    cast.style.transform = `translate3d(${edge.toFixed(1)}px,0,0)`;
    cast.style.opacity = String(0.5 * Math.min(1, (90 - deg) / 30) * Math.min(1, deg / 6));
  }

  // Only the top two pages are painted; only the turning leaf is promoted.
  const layerState = pages.map(() => ({ vis: null, wc: null }));
  function sync() {
    const t = tl.time();
    const top = Math.min(N, Math.floor(t + 1e-4));
    const turning = t - top > 1e-4;
    if (!reduced) {
      pages.forEach((p, j) => {
        const s = layerState[j];
        const vis = j === top || j === top + 1;
        if (s.vis !== vis) { p.style.visibility = vis ? '' : 'hidden'; s.vis = vis; }
        const wc = turning && j === top;
        if (s.wc !== wc && leaves[j]) { leaves[j].style.willChange = wc ? 'transform' : ''; s.wc = wc; }
      });
      placeCast(top, turning);
    }
    // Passing over a page without stopping (a jump via the pearls): it turns with its text printed.
    if (top !== lastTop) {
      lastTop = top;
      if (turning) text.showNow(top);
    }
    emit('move', t);
    const r = Math.round(t);
    if (Math.abs(t - r) < 1e-3) {
      if (!atRest || r !== lastRest) {
        atRest = true;
        lastRest = r;
        text.resetAfter(r);
        if (r > 0) text.play(r);
        emit('arrive', r);
      }
    } else if (atRest && Math.abs(t - lastRest) > 0.01) {
      atRest = false;
      emit('depart', lastRest);
    }
  }

  // ── scroll ↔ page mapping ─────────────────────────────────────────────────
  const scrollFor = (i) => st.start + ((st.end - st.start) * i) / N;
  const position = () => (window.scrollY - st.start) / ((st.end - st.start) / N);

  function goTo(i, { ease = 'power2.inOut', duration } = {}) {
    i = clamp(0, N, Math.round(i));
    const from = window.scrollY;
    const to = scrollFor(i);
    const dist = Math.abs(position() - i);
    index = i;
    if (navTween) navTween.kill();
    navTween = null;
    if (Math.abs(to - from) < 1) { window.scrollTo(0, to); return; }
    const weight = Math.min(position(), i) < 1 ? 1.2 : 1; // the cover is heavier
    const d = duration ?? (reduced ? 0.4 : Math.min(3.2, (0.55 + 0.55 * dist) * weight));
    const proxy = { y: from };
    navTween = gsap.to(proxy, {
      y: to, duration: d, ease,
      onUpdate: () => window.scrollTo(0, proxy.y),
      onComplete: () => { navTween = null; },
    });
  }

  const step = (dir) => goTo((navTween ? index : Math.round(position())) + dir);

  // ── gestures ────────────────────────────────────────────────────────────────
  let touch = null;
  function onTouchStart(e) {
    if (!enabled || e.touches.length !== 1) { touch = null; return; }
    if (navTween) { navTween.kill(); navTween = null; }
    const y = e.touches[0].clientY;
    touch = { y0: y, s0: window.scrollY, base: clamp(0, N, Math.round(position())), moved: false, samples: [[e.timeStamp, y]] };
  }
  function onTouchMove(e) {
    if (!enabled || e.touches.length !== 1) return; // leave pinch-zoom alone
    e.preventDefault();
    if (!touch) return;
    const y = e.touches[0].clientY;
    const dy = touch.y0 - y; // positive = swipe up = forward
    if (!touch.moved) {
      if (Math.abs(dy) < 6) return;
      touch.moved = true;
      dragging = true;
    }
    // Half a screen of finger travel turns one full page; never more than one page per gesture.
    const k = (st.end - st.start) / N / (window.innerHeight * 0.5);
    const lo = scrollFor(Math.max(0, touch.base - 1));
    const hi = scrollFor(Math.min(N, touch.base + 1));
    window.scrollTo(0, clamp(lo, hi, touch.s0 + dy * k));
    touch.samples.push([e.timeStamp, y]);
    if (touch.samples.length > 5) touch.samples.shift();
  }
  function onTouchEnd(e) {
    if (!touch) return;
    const t = touch;
    touch = null;
    dragging = false;
    if (!t.moved) return;
    const [t0, y0] = t.samples[0];
    const [t1, y1] = t.samples[t.samples.length - 1];
    const stale = e.timeStamp - t1 > 90;
    const v = !stale && t1 > t0 ? (y0 - y1) / (t1 - t0) : 0; // px/ms, positive = forward
    const frac = position() - t.base;
    let target = t.base;
    if (frac > 0.15 || (v > 0.4 && frac > 0.05)) target = t.base + 1;
    else if (frac < -0.15 || (v < -0.4 && frac < -0.05)) target = t.base - 1;
    goTo(target, { ease: 'power2.out' });
  }

  // Wheel / trackpad: one page per gesture; inertia is absorbed until the wheel goes quiet.
  let wheelAcc = 0, wheelLocked = false, wheelQuiet;
  function onWheel(e) {
    if (!enabled || e.ctrlKey) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    clearTimeout(wheelQuiet);
    wheelQuiet = setTimeout(() => { wheelLocked = false; wheelAcc = 0; }, 200);
    if (wheelLocked) return;
    wheelAcc += dy;
    if (Math.abs(wheelAcc) >= 30) {
      wheelLocked = true;
      step(Math.sign(wheelAcc));
      wheelAcc = 0;
    }
  }

  function onKey(e) {
    if (!enabled || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    const tag = e.target?.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    const onControl = /^(BUTTON|A)$/.test(tag);
    let dir = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onControl)) dir = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey && !onControl)) dir = -1;
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); return; }
    else if (e.key === 'End') { e.preventDefault(); goTo(N); return; }
    if (!dir) return;
    e.preventDefault();
    step(dir);
  }

  // ── cover intro: the monogram is written in, then a glint crosses the oval ─────
  function intro() {
    const glint = leaves[0]?.querySelector('.glint > i');
    text.play(0, {
      onLogo: () => {
        if (reduced || !glint) return;
        gsap.fromTo(glint, { xPercent: -120, opacity: 1 }, { xPercent: 120, duration: 1.5, ease: 'sine.inOut', onComplete: () => gsap.set(glint, { opacity: 0 }) });
      },
    });
  }

  // ── public ──────────────────────────────────────────────────────────────────
  function setup() {
    buildTimeline();
    st = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: () => `+=${window.innerHeight * N}`,
      pin: true,
      scrub: reduced ? true : 0.6,
      animation: tl,
    });
    // Snap safety net for native scrolling (scrollbar, find-in-page, assistive tech). Gestures are
    // handled above; ScrollTrigger's own snap is not used because its inertia projection would
    // carry a fast flick past more than one page.
    ScrollTrigger.addEventListener('scrollEnd', () => {
      if (!enabled || dragging || navTween) return;
      const p = position();
      if (Math.abs(p - Math.round(p)) > 0.002) goTo(Math.round(p), { duration: reduced ? 0.4 : 0.7 });
    });
    ScrollTrigger.addEventListener('refresh', () => {
      stageW = pages[0].offsetWidth;
      if (!dragging && !navTween) window.scrollTo(0, scrollFor(index));
    });
    sync();

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
  }

  return {
    N,
    pages,
    images,
    lazy,
    zoom,
    dim,
    root,
    shimmer: root.querySelector('.shimmer'),
    backSlot: root.querySelector('.bc-slot'),
    setup,
    goTo,
    intro,
    // Cover first (high priority, earliest in the DOM), then the pages and their text.
    load() {
      lazy.forEach((img) => {
        if (img.classList.contains('tx')) { img.src = img.dataset.src; img.removeAttribute('data-src'); } else loadPicture(img);
      });
    },
    enable() { enabled = true; },
    get index() { return index; },
    on(type, fn) { handlers[type].push(fn); },
  };
}

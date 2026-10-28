// The book: a pinned ScrollTrigger section whose timeline turns one page per 100vh of
// scroll. Gestures (swipe, wheel, keys) are converted into exactly one page per gesture
// by driving the scroll position ourselves, so the page follows the finger and always
// comes to rest flat on a page.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from './config.js';
import { pictureHTML, loadPicture } from './stage.js';

const VISIBLE = 0.84; // share of a flip spent on 0° → -90°; the back half happens off-stage
const PERSPECTIVE = 1800;
const clamp = (min, max, v) => Math.min(max, Math.max(min, v));

export function createBook({ reduced }) {
  const pagesCfg = CONFIG.pages;
  const N = pagesCfg.length - 1; // number of flips (the back cover stays at the bottom)
  const root = document.getElementById('book');

  root.innerHTML = `
    <div class="frame">
      <div class="book-zoom">
        <div class="stage">
          <div class="pages">
            ${pagesCfg.map((p, i) => `
            <div class="page${i === 0 ? ' page--cover' : ''}" style="z-index:${N + 1 - i}">
              <div class="face">
                ${pictureHTML(p.id, p.alt, { deferred: true, priority: i === 0 ? 'high' : 'low' })}
                ${i > 0 ? '<i class="cast"></i>' : ''}
                ${i < N ? '<i class="shade"></i><i class="gloss"></i>' : ''}
              </div>
              ${i === 0 ? '<i class="edge"></i>' : ''}
            </div>`).join('')}
          </div>
          <div class="shimmer-wrap" aria-hidden="true"><i class="shimmer"></i></div>
          <div class="bc-slot"></div>
        </div>
      </div>
      <i class="dim" aria-hidden="true"></i>
    </div>`;

  const pages = [...root.querySelectorAll('.page')];
  const images = pages.map((p) => p.querySelector('img'));
  const zoom = root.querySelector('.book-zoom');
  const dim = root.querySelector('.dim');
  if (!reduced) gsap.set(zoom, { scale: 1.08 });

  let tl, st;
  let index = 0; // the page we rest on, or are heading to
  let enabled = false;
  let dragging = false;
  let navTween = null;
  let atRest = true;
  let lastRest = 0;
  const handlers = { arrive: [], depart: [], move: [] };
  const emit = (type, v) => handlers[type].forEach((fn) => fn(v));

  // ── timeline ────────────────────────────────────────────────────────────────
  function buildTimeline() {
    tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: sync });
    for (let i = 0; i < N; i++) {
      const page = pages[i];
      if (reduced) {
        tl.to(page, { autoAlpha: 0, duration: 1 }, i); // crossfade instead of a 3D turn
        continue;
      }
      const shade = page.querySelector('.shade');
      const gloss = page.querySelector('.gloss');
      const heavy = i === 0; // the cover board turns with more weight

      tl.fromTo(page, { rotationY: 0 }, { rotationY: -90, duration: VISIBLE, ease: heavy ? 'power2.inOut' : 'sine.inOut' }, i)
        .to(page, { rotationY: -180, duration: 1 - VISIBLE }, i + VISIBLE)
        .fromTo(page, { z: 0 }, { z: 30, duration: 0.5, ease: 'sine.out' }, i)
        .to(page, { z: 0, duration: 0.5, ease: 'sine.in' }, i + 0.5)
        // Paper curve: the turning page darkens toward the spine, a highlight band sweeps across it.
        .fromTo(shade, { opacity: 0 }, { opacity: 0.45, duration: VISIBLE, ease: 'sine.in' }, i)
        .fromTo(gloss, { xPercent: 70 }, { xPercent: -80, duration: VISIBLE }, i)
        .fromTo(gloss, { opacity: 0 }, { opacity: 0.5, duration: VISIBLE * 0.45, ease: 'sine.out' }, i)
        .to(gloss, { opacity: 0, duration: VISIBLE * 0.55, ease: 'sine.in' }, i + VISIBLE * 0.45);
    }
  }

  // Shadow cast on the page underneath: it hugs the projected fore-edge of the turning
  // page (spine side) and fades as the page stands up and leaves.
  const casts = pages.map((p) => p.querySelector('.cast'));
  let castOn = null;
  let pageW = 0; // cached on refresh so the frame loop never reads layout
  function placeCast(top, turning) {
    const cast = turning ? casts[top + 1] : null;
    if (castOn && castOn !== cast) castOn.style.opacity = '0';
    castOn = cast;
    if (!cast) return;
    const page = pages[top];
    const deg = -gsap.getProperty(page, 'rotationY');
    if (deg >= 90) { cast.style.opacity = '0'; return; }
    const W = pageW || (pageW = page.offsetWidth);
    const a = (deg * Math.PI) / 180;
    const s = PERSPECTIVE / (PERSPECTIVE - (W * Math.sin(a) + gsap.getProperty(page, 'z')));
    const edge = W / 2 + (W * Math.cos(a) - W / 2) * s;
    cast.style.transform = `translate3d(${edge.toFixed(1)}px,0,0)`;
    cast.style.opacity = String(0.5 * Math.min(1, (90 - deg) / 30) * Math.min(1, deg / 6));
  }

  // Only the top two pages are painted; only the turning page is promoted.
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
        if (s.wc !== wc) { p.style.willChange = wc ? 'transform' : ''; s.wc = wc; }
      });
      placeCast(top, turning);
    }
    emit('move', t);
    const r = Math.round(t);
    if (Math.abs(t - r) < 1e-3) {
      if (!atRest || r !== lastRest) { atRest = true; lastRest = r; emit('arrive', r); }
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
      pageW = pages[0].offsetWidth;
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
    zoom,
    dim,
    root,
    shimmer: root.querySelector('.shimmer'),
    backSlot: root.querySelector('.bc-slot'),
    setup,
    goTo,
    load() { images.forEach(loadPicture); }, // cover first (high priority), then the pages
    enable() { enabled = true; },
    get index() { return index; },
    on(type, fn) { handlers[type].push(fn); },
  };
}

// Boot: preload, build the layers, orchestrate curtain → book → back cover.
import './styles.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from './config.js';
import { initStage, onLayout, blurURL } from './stage.js';
import { createBook } from './book.js';
import { createCurtain } from './curtain.js';
import { createBackCover } from './backcover.js';
import { createMusic } from './music.js';
import { createSparkles, shimmer } from './effects.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  || new URLSearchParams(location.search).has('reduced-motion'); // ?reduced-motion previews it
document.documentElement.classList.toggle('reduced-motion', reduced);

initStage();

const $ = (s) => document.querySelector(s);
const ui = {
  canvas: $('.sparkles'),
  dots: $('.dots'),
  hint: $('.scroll-hint'),
  mute: $('.mute'),
  backdrop: $('#backdrop'),
  loader: $('#loader'),
};

// ── layers ────────────────────────────────────────────────────────────────────
const book = createBook({ reduced });
const back = createBackCover(book.backSlot, {
  reduced,
  onAgain: () => book.goTo(0, { duration: reduced ? 0.4 : 2.6 }),
});
const music = createMusic(ui.mute);
const sparkles = createSparkles(ui.canvas, { reduced });
const curtain = createCurtain({
  reduced,
  zoom: book.zoom,
  dim: book.dim,
  onUntie: (ends) => {
    music.play(); // synchronous: still inside the pull / tap gesture
    ends.forEach((p) => sparkles.burst(p.x, p.y));
    setBackdrop(CONFIG.pages[0].id);
  },
  onReveal: () => book.intro(),
  onOpened,
});

// Blurred copy of the current artwork: fills letterbox bands and frames the stage on desktop.
const ids = [CONFIG.curtain, ...CONFIG.pages.map((p) => p.id)];
ui.backdrop.innerHTML = ids.map((id, i) => `<img ${i < 2 ? '' : 'data-'}src="${blurURL(id)}" alt="" data-id="${id}">`).join('');
function setBackdrop(id) {
  ui.backdrop.querySelectorAll('img').forEach((img) => img.classList.toggle('is-on', img.dataset.id === id));
}
setBackdrop(CONFIG.curtain);

// Page indicator: a column of pearls.
ui.dots.innerHTML = CONFIG.pages.map((p, i) =>
  `<button type="button" class="dot" aria-label="Page ${i + 1}: ${p.label}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('');
const dots = [...ui.dots.children];
dots.forEach((d, i) => d.addEventListener('click', () => book.goTo(i)));

if (import.meta.env.DEV) Object.assign(window, { gsap, ScrollTrigger, book }); // QA hooks, stripped from builds
onLayout(() => {
  sparkles.resize();
  ScrollTrigger.refresh();
});

// ── book events ─────────────────────────────────────────────────────────────
let opened = false;
let hintShown = false;
let hintTimer = 0;
let navigated = false;

book.on('move', (t) => {
  if (!navigated && t > 0.02) {
    navigated = true;
    clearTimeout(hintTimer);
    if (hintShown) gsap.to(ui.hint, { autoAlpha: 0, duration: 0.4 });
  }
});
book.on('arrive', (i) => {
  dots.forEach((d, j) => (j === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
  setBackdrop(CONFIG.pages[i].id);
  if (!reduced && opened) shimmer(book.shimmer);
  if (i === book.N) back.show();
});
book.on('depart', (i) => {
  if (i === book.N) back.hide();
});

function onOpened() {
  opened = true;
  book.enable();
  ScrollTrigger.refresh();
  gsap.to(ui.dots, { autoAlpha: 1, duration: 0.8, ease: 'sine.out' });
  if (!reduced) shimmer(book.shimmer);
  hintTimer = setTimeout(() => {
    if (navigated) return;
    hintShown = true;
    gsap.to(ui.hint, { autoAlpha: 1, duration: 0.8, ease: 'sine.out' });
  }, 800);
}

// ── preload ────────────────────────────────────────────────────────────────────
function decode(img) {
  const loaded = img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
  // decode() can stall in background tabs; never let it hold the invitation hostage.
  const decoded = () => Promise.race([img.decode ? img.decode() : null, new Promise((r) => setTimeout(r, 2500))]);
  return loaded.then(decoded).catch(() => {});
}

// Resolves once the first artwork has actually been painted (LCP), so background downloads
// start only after the first impression is on screen. Safari has no LCP API: short delay instead.
function afterFirstPaint(timeout = 1500) {
  return new Promise((resolve) => {
    if (!PerformanceObserver?.supportedEntryTypes?.includes('largest-contentful-paint')) {
      setTimeout(resolve, 300);
      return;
    }
    let timer = 0;
    const po = new PerformanceObserver((list) => {
      if (!list.getEntries().some((e) => e.element?.closest?.('#curtain, #book'))) return;
      po.disconnect();
      clearTimeout(timer);
      setTimeout(resolve, 120);
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
    timer = setTimeout(() => { po.disconnect(); resolve(); }, timeout);
  });
}

async function boot() {
  const bar = ui.loader.querySelector('.loader-line span');
  gsap.to(bar, { scaleX: 0.85, duration: 2.5, ease: 'power2.out' });

  // The page-turn machinery (pin, timeline) is built in its own task, off the first paint's critical path.
  await new Promise((r) => setTimeout(r, 0));
  book.setup();

  // The curtain first (preloaded from <head>); nothing else competes for bandwidth.
  await decode(curtain.image);
  gsap.to(bar, { scaleX: 1, duration: 0.25, overwrite: true });
  gsap.to(ui.loader, { autoAlpha: 0, duration: 0.6, delay: 0.15, ease: 'sine.inOut', onComplete: () => ui.loader.remove() });

  // Then the pearl strands, the cover, the rest of the book, the backdrops and the song.
  await afterFirstPaint();
  curtain.load();
  book.load();
  ui.backdrop.querySelectorAll('img[data-src]').forEach((img) => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
  music.load();

  // The strings can be pulled once every page and its text is decoded (or after a generous timeout).
  const rest = Promise.all(book.lazy.map(decode));
  await Promise.race([rest, new Promise((r) => setTimeout(r, 15000))]);
  curtain.setReady();
}

boot();

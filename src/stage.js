// 9:16 "cover" stage sizing. Every artwork layer and overlay sits in a stage of the
// same size, so anything positioned in % of the stage stays locked to the artwork.
import manifest from './images.json';

const RATIO = 9 / 16;
const MAX_CROP = 0.1; // never crop more than 10% of the artwork per side
const DESKTOP_MIN = 601; // wider than this: framed, phone-sized stage
const FRAME_MAX_W = 460;

export const SIZES = `(min-width: ${DESKTOP_MIN}px) ${FRAME_MAX_W}px, 56.25vh`;

let layout = null;
const listeners = new Set();

export function computeLayout() {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const desktop = vw >= DESKTOP_MIN;
  const frameW = desktop ? Math.min(FRAME_MAX_W, Math.round(vh * RATIO), vw) : vw;
  const frameH = vh;

  // object-fit: cover…
  let w = Math.max(frameW, frameH * RATIO);
  let h = w / RATIO;
  // …with a crop guard: past 10% per side, fit instead and let the backdrop fill the bands.
  const maxW = frameW / (1 - 2 * MAX_CROP);
  const maxH = frameH / (1 - 2 * MAX_CROP);
  if (w > maxW) { w = maxW; h = w / RATIO; }
  if (h > maxH) { h = maxH; w = h * RATIO; }
  // Even, whole pixels keep the two curtain halves seamless; round up so a cover fit never leaves a hairline.
  w = Math.ceil(w / 2 - 0.01) * 2;
  if (w > maxW) w -= 2; // …but never past the crop guard
  h = Math.ceil(w / RATIO - 0.01);

  return {
    desktop, vw, vh, frameW, frameH,
    stageW: w, stageH: h,
    stageX: Math.round((frameW - w) / 2),
    stageY: Math.round((frameH - h) / 2),
    landscapePhone: !desktop && vw > vh,
  };
}

function apply() {
  layout = computeLayout();
  const s = document.documentElement.style;
  s.setProperty('--vh', `${layout.vh / 100}px`);
  s.setProperty('--app-h', `${layout.vh}px`);
  s.setProperty('--frame-w', `${layout.frameW}px`);
  s.setProperty('--stage-w', `${layout.stageW}px`);
  s.setProperty('--stage-h', `${layout.stageH}px`);
  s.setProperty('--stage-x', `${layout.stageX}px`);
  s.setProperty('--stage-y', `${layout.stageY}px`);
  document.documentElement.classList.toggle('is-desktop', layout.desktop);
  listeners.forEach((fn) => fn(layout));
}

export function initStage() {
  apply();
  let t;
  const onResize = () => { clearTimeout(t); t = setTimeout(apply, 120); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(apply, 250));
  return layout;
}

export const getLayout = () => layout;
export const onLayout = (fn) => listeners.add(fn);

// <picture> markup for one artwork: WebP srcset + JPEG fallback. `deferred` pictures keep their
// URLs in data-* attributes until loadPicture() is called, so they never compete with the curtain.
export function pictureHTML(id, alt, { priority = 'low', deferred = false } = {}) {
  const widths = manifest[id].widths;
  const big = widths[widths.length - 1];
  const srcset = widths.map((w) => `/images/${id}-${w}.webp ${w}w`).join(', ');
  const d = deferred ? 'data-' : '';
  return `<picture class="art">` +
    `<source type="image/webp" ${d}srcset="${srcset}" sizes="${SIZES}">` +
    `<img ${d}src="/images/${id}-${big}.jpg" alt="${alt.replace(/"/g, '&quot;')}" width="${big}" height="${Math.round(big / RATIO)}"` +
    ` decoding="async" fetchpriority="${priority}" draggable="false">` +
    `</picture>`;
}

export function loadPicture(img) {
  const source = img.previousElementSibling;
  if (source?.dataset.srcset) { source.srcset = source.dataset.srcset; delete source.dataset.srcset; }
  if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
}

export const blurURL = (id) => `/images/${id}-blur.jpg`;

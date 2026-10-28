// Ambient sparkles (one canvas), the untie burst, and the shimmer sweep on page arrival.
import { gsap } from 'gsap';

const TAU = Math.PI * 2;
const TONES = ['255,246,232', '247,228,198', '255,251,246', '238,212,176']; // pearl & champagne
const AMBIENT = 20;

export function createSparkles(canvas, { reduced }) {
  if (reduced || !canvas?.getContext) {
    canvas?.remove();
    return { burst() {}, resize() {} };
  }
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, raf = 0, last = 0;
  const ambient = Array.from({ length: AMBIENT }, (_, i) => ({ glint: i % 3 === 0 }));
  const sparks = [];

  // Ambient glints live in the side margins so nothing drifts across the printed text.
  function spawn(p, anywhere) {
    const left = Math.random() < 0.5;
    p.x = left ? Math.random() * w * 0.2 : w * (0.8 + Math.random() * 0.2);
    p.y = anywhere ? Math.random() * h : h + 8;
    p.vx = (Math.random() - 0.5) * 3;
    p.vy = -(5 + Math.random() * 10);
    p.r = p.glint ? 2.2 + Math.random() * 2.6 : 0.8 + Math.random() * 1.2;
    p.tw = 0.35 + Math.random() * 0.6;
    p.ph = Math.random() * TAU;
    p.c = TONES[(Math.random() * TONES.length) | 0];
    p.a = 0.35 + Math.random() * 0.45;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ambient.forEach((p) => spawn(p, true));
  }

  function glint(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
  function dot(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // Ambient-only frames run at ~30fps; bursts get the full rate.
    if (!sparks.length && now - last < 32) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);

    for (const p of ambient) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < -8) spawn(p, false);
      const tw = 0.5 + 0.5 * Math.sin((now / 1000) * p.tw * TAU + p.ph);
      ctx.fillStyle = `rgba(${p.c},${(p.a * tw * tw).toFixed(3)})`;
      if (p.glint) glint(p.x, p.y, p.r * (0.7 + 0.3 * tw));
      else dot(p.x, p.y, p.r);
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life >= s.max) { sparks.splice(i, 1); continue; }
      s.vx *= 1 - 1.8 * dt;
      s.vy = s.vy * (1 - 1.4 * dt) + 220 * s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = 1 - s.life / s.max;
      ctx.fillStyle = `rgba(${s.c},${(s.a * k).toFixed(3)})`;
      if (s.glint) glint(s.x, s.y, s.r * (0.5 + 0.5 * k));
      else dot(s.x, s.y, s.r * (0.6 + 0.4 * k));
    }
  }

  const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else start();
  });

  resize();
  start();

  return {
    resize,
    // A small burst of gold and pearl from a point in viewport coordinates.
    burst(cx, cy) {
      const r = canvas.getBoundingClientRect();
      const x = cx - r.left, y = cy - r.top;
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * TAU;
        const v = 60 + Math.random() * 190;
        const isGlint = Math.random() < 0.45;
        sparks.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 40,
          r: isGlint ? 2.5 + Math.random() * 3.5 : 1 + Math.random() * 1.6,
          glint: isGlint,
          c: Math.random() < 0.5 ? '232,196,140' : TONES[(Math.random() * TONES.length) | 0],
          a: 0.7 + Math.random() * 0.3,
          g: 0.6 + Math.random() * 0.6,
          life: 0,
          max: 0.9 + Math.random() * 0.8,
        });
      }
    },
  };
}

// A soft diagonal band of light glides once across the page.
export function shimmer(el) {
  gsap.killTweensOf(el);
  gsap.fromTo(el,
    { xPercent: -110, opacity: 1 },
    { xPercent: 170, duration: 1.4, ease: 'sine.inOut', onComplete: () => gsap.set(el, { opacity: 0 }) });
}

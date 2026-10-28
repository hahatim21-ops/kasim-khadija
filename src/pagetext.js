// Animated text on the book pages. Each printed line is its own transparent layer (made by
// scripts/optimize-images.mjs); a page's lines animate in when the page settles, and reset
// once the page is covered again so they play again next time it is revealed.
import { gsap } from 'gsap';

// How each kind of line enters, and how long the next line waits before following.
const STYLES = {
  caps: { from: { autoAlpha: 0, yPercent: 38 }, to: { autoAlpha: 1, yPercent: 0, duration: 0.95, ease: 'power2.out' }, next: 0.2 },
  title: { from: { autoAlpha: 0, yPercent: 10, scale: 0.965 }, to: { autoAlpha: 1, yPercent: 0, scale: 1, duration: 1.3, ease: 'power2.out' }, next: 0.45 },
  script: { wipe: 1.5, next: 0.7 }, // written left → right
  arabic: { wipe: 1.6, next: 0.75 }, // written right → left
  logo: { wipe: 2.4, next: 0 },
};

export function createPageText(pageEls, { reduced }) {
  const pages = pageEls.map((el) => [...el.querySelectorAll('.tx')]);
  const shown = pages.map(() => false);
  const running = pages.map(() => null);

  function hide(i) {
    running[i]?.kill();
    running[i] = null;
    shown[i] = false;
    for (const el of pages[i]) {
      el.classList.remove('is-written');
      gsap.set(el, { autoAlpha: 0, '--wipe': '0%' });
    }
  }

  function showNow(i) {
    if (shown[i]) return;
    shown[i] = true;
    for (const el of pages[i]) {
      gsap.set(el, { autoAlpha: 1, yPercent: 0, scale: 1, '--wipe': '118%' });
      el.classList.add('is-written');
    }
  }

  function play(i, { onLogo } = {}) {
    if (shown[i]) return;
    shown[i] = true;
    const tl = gsap.timeline({ onComplete: () => { running[i] = null; } });
    running[i] = tl;
    let at = 0.15;
    for (const el of pages[i]) {
      const kind = el.dataset.kind;
      const s = STYLES[kind];
      if (reduced) {
        tl.to(el, { autoAlpha: 1, duration: 0.4 }, at);
        at += 0.12;
        continue;
      }
      if (s.wipe) {
        tl.set(el, { autoAlpha: 1 }, at)
          .fromTo(el, { '--wipe': '0%' }, { '--wipe': '118%', duration: s.wipe, ease: kind === 'logo' ? 'sine.inOut' : 'power1.inOut', immediateRender: false }, at)
          .add(() => el.classList.add('is-written'), at + s.wipe);
        if (kind === 'logo' && onLogo) tl.add(onLogo, at + s.wipe - 0.4);
      } else {
        tl.fromTo(el, s.from, { ...s.to, immediateRender: false }, at);
      }
      at += s.next;
    }
  }

  // Every line starts hidden through CSS (.tx), so nothing is written to the DOM at start-up.
  return {
    play,
    showNow,
    // Pages beyond `i` are covered: reset them so they animate again when revealed.
    resetAfter(i) { for (let j = i + 1; j < pages.length; j++) if (shown[j]) hide(j); },
    isShown: (i) => shown[i],
  };
}

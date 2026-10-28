// Back cover: countdown (always in IST, via absolute instants), map buttons, "open again".
import { gsap } from 'gsap';
import { CONFIG } from './config.js';

const UNITS = [
  { key: 'd', label: 'Days' },
  { key: 'h', label: 'Hours' },
  { key: 'm', label: 'Mins' },
  { key: 's', label: 'Secs' },
];

const PIN = '<svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.5s-6.5-6.2-6.5-11.4A6.5 6.5 0 0 1 12 3.6a6.5 6.5 0 0 1 6.5 6.5c0 5.2-6.5 11.4-6.5 11.4z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10.2" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

// Map button: "Event · Venue" from the config, shown as two short lines so it fits narrow phones.
function pillHTML({ label, mapUrl }) {
  const [event, venue = ''] = label.split(' · ');
  return `<a class="pill" href="${mapUrl}" target="_blank" rel="noopener" aria-label="${label}: open in Google Maps">${PIN}`
    + `<span class="pill-text"><span class="pill-event ui-caps">${event}</span><span class="pill-venue ui-caps">${venue}</span></span></a>`;
}

// `?now=2026-12-10T19:00:00+05:30` previews other countdown states.
function clockOffset() {
  const raw = new URLSearchParams(location.search).get('now');
  if (!raw) return 0;
  const t = Date.parse(raw.replace(' ', '+'));
  return Number.isNaN(t) ? 0 : t - Date.now();
}

export function createBackCover(slot, { reduced, onAgain }) {
  const { nikah, reception, countdown } = CONFIG;
  const offset = clockOffset();
  const now = () => Date.now() + offset;
  // ISO strings carry +05:30, so these are absolute instants: the guest's timezone never matters.
  const nikahAt = Date.parse(nikah.start);
  const receptionAt = Date.parse(reception.start);

  slot.innerHTML = `
    <div class="bc" role="group" aria-label="Countdown and directions">
      <p class="bc-label ui-caps"></p>
      <div class="bc-count" role="timer" aria-live="off">
        ${UNITS.map((u) => `
        <div class="bc-box">
          <span class="bc-num" data-unit="${u.key}"><span>00</span></span>
          <span class="bc-unit">${u.label}</span>
        </div>`).join('')}
      </div>
      <p class="bc-done ui-caps" hidden>${countdown.doneMessage}</p>
      <div class="bc-maps">${[nikah, reception].map(pillHTML).join('')}</div>
      <button type="button" class="bc-again ui-caps"><span aria-hidden="true">↺</span> ${countdown.againLabel}</button>
    </div>`;

  const el = slot.querySelector('.bc');
  const label = el.querySelector('.bc-label');
  const count = el.querySelector('.bc-count');
  const done = el.querySelector('.bc-done');
  const nums = Object.fromEntries([...el.querySelectorAll('.bc-num')].map((n) => [n.dataset.unit, n]));
  el.querySelector('.bc-again').addEventListener('click', () => onAgain?.());
  gsap.set(el, { autoAlpha: 0 });

  let visible = false;
  let timer = 0;

  function setNum(node, value, animate) {
    const text = String(value).padStart(2, '0');
    if (node.dataset.v === text) return;
    node.dataset.v = text;
    const old = node.lastElementChild;
    if (!animate || reduced || !old) {
      node.innerHTML = `<span>${text}</span>`;
      return;
    }
    const next = document.createElement('span');
    next.textContent = text;
    node.appendChild(next);
    gsap.fromTo(next, { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, ease: 'power2.out' });
    gsap.to(old, { yPercent: -70, opacity: 0, duration: 0.55, ease: 'power2.out', onComplete: () => old.remove() });
  }

  function update(animate = visible) {
    const t = now();
    const target = t < nikahAt ? nikahAt : t < receptionAt ? receptionAt : 0;
    const finished = !target;
    count.hidden = finished;
    done.hidden = !finished;
    label.hidden = finished;
    if (finished) return;
    label.textContent = target === nikahAt ? countdown.nikahLabel : countdown.receptionLabel;
    const s = Math.max(0, Math.floor((target - t) / 1000));
    setNum(nums.d, Math.floor(s / 86400), animate);
    setNum(nums.h, Math.floor((s % 86400) / 3600), animate);
    setNum(nums.m, Math.floor((s % 3600) / 60), animate);
    setNum(nums.s, s % 60, animate);
  }

  function startTicking() {
    stopTicking();
    // Tick on the second boundary so the seconds change evenly.
    const tick = () => {
      update(true);
      timer = setTimeout(tick, 1000 - ((Date.now() + offset) % 1000) + 5);
    };
    timer = setTimeout(tick, 1000 - ((Date.now() + offset) % 1000) + 5);
  }
  const stopTicking = () => clearTimeout(timer);

  update(false);

  return {
    show() {
      if (visible) return;
      visible = true;
      update(false);
      startTicking();
      const items = [...el.children].filter((c) => !c.hidden).flatMap((c) => (c.classList.contains('bc-maps') ? [...c.children] : [c]));
      gsap.killTweensOf([el, ...items]);
      gsap.set(el, { autoAlpha: 1 });
      if (reduced) {
        gsap.fromTo(items, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
      } else {
        gsap.fromTo(items, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.12, delay: 0.1 });
      }
    },
    hide() {
      if (!visible) return;
      visible = false;
      stopTicking();
      gsap.killTweensOf(el);
      gsap.to(el, { autoAlpha: 0, duration: 0.25, ease: 'sine.out' });
    },
  };
}

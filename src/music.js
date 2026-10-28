// Background music: starts on the ribbon pull (a user gesture), fades in, floating mute button.
// A missing or unplayable file hides the button and never interrupts the invitation.
import { gsap } from 'gsap';
import { CONFIG } from './config.js';

// iOS ignores audio.volume, so the fade goes through a Web Audio gain node there.
const canSetVolume = (() => {
  try { const a = document.createElement('audio'); a.volume = 0.5; return a.volume === 0.5; } catch { return false; }
})();

/* global __HAS_MUSIC__ */
const HAS_MUSIC = typeof __HAS_MUSIC__ === 'undefined' || __HAS_MUSIC__; // set at build time by vite.config.js

export function createMusic(button) {
  const { src, volume = 0.6 } = CONFIG.music;
  let missing = !src || !HAS_MUSIC;
  let state = 'off'; // off | playing | muted | blocked
  let resumeOnShow = false;
  let ctx = null;
  let gain = null;
  let pauseCall = null;
  let audio = null;

  if (!missing) {
    audio = document.createElement('audio');
    audio.loop = true;
    audio.preload = 'metadata';
    audio.addEventListener('error', () => { if (audio.getAttribute('src')) { missing = true; render(); } });
  }
  // The file is attached after the first artwork has loaded, so it never delays the curtain.
  const load = () => { if (audio && !audio.getAttribute('src')) audio.src = src; };

  function render() {
    button.hidden = missing || state === 'off';
    button.dataset.state = state;
    button.setAttribute('aria-pressed', String(state !== 'playing'));
  }

  function setupGain() {
    if (canSetVolume || ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
    } catch {
      ctx = null;
      gain = null;
    }
  }

  function fadeTo(v, dur) {
    if (gain) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(v, t + dur);
    } else if (canSetVolume) {
      gsap.to(audio, { volume: v, duration: dur, ease: 'sine.inOut', overwrite: true });
    }
  }

  function retryOnNextTap() {
    const events = ['touchend', 'click', 'keydown'];
    const retry = () => {
      events.forEach((t) => document.removeEventListener(t, retry, true));
      if (state === 'blocked') play();
    };
    events.forEach((t) => document.addEventListener(t, retry, true));
  }

  // Must be called synchronously inside a user gesture handler.
  function play() {
    if (missing || !audio) return;
    load();
    pauseCall?.kill();
    setupGain();
    if (ctx?.state === 'suspended') ctx.resume();
    if (gain) gain.gain.value = 0;
    else if (canSetVolume) audio.volume = 0;
    let p;
    try { p = audio.play(); } catch (err) { p = Promise.reject(err); }
    Promise.resolve(p)
      .then(() => {
        state = 'playing';
        fadeTo(volume, 2);
        render();
      })
      .catch((err) => {
        if (audio.error || err?.name === 'NotSupportedError') missing = true;
        else if (state !== 'playing') { state = 'blocked'; retryOnNextTap(); }
        render();
      });
  }

  function mute() {
    state = 'muted';
    render();
    fadeTo(0, 0.35);
    pauseCall = gsap.delayedCall(0.36, () => audio.pause());
  }

  button.addEventListener('click', () => {
    if (state === 'playing') mute();
    else play();
  });

  document.addEventListener('visibilitychange', () => {
    if (!audio || missing) return;
    if (document.hidden) {
      resumeOnShow = state === 'playing' && !audio.paused;
      audio.pause();
    } else if (resumeOnShow) {
      resumeOnShow = false;
      ctx?.resume?.();
      audio.play().catch(() => {});
    }
  });

  render();
  return { play, load };
}

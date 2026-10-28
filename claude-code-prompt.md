# Build: Kasim & Khadija — Scroll-Animated Wedding Invitation (mobile-first)

You are building a mobile-first wedding invitation website. The experience: a lace curtain tied with a satin bow → guest pulls the ribbon → bow unties and the curtain splits open → a book is revealed → scrolling turns each page with a 3D page-flip → the book ends on its back cover with a live countdown and map buttons. Background music starts when the ribbon is pulled.

This must feel luxurious, soft and calm — like handling a real keepsake book. Every motion should be slow, eased and physical. No bouncy, techy or flashy effects.

Work in milestones (listed at the end). After each milestone, run the dev server and check it at phone size (screenshots via Playwright at 390×844 if available). Only ask me if you are truly blocked.

---

## 1. Tech stack

- **Vite + vanilla JavaScript** (no framework needed), plain CSS with custom properties.
- **GSAP + ScrollTrigger** (npm `gsap`, latest stable) for all timelines and scroll-driven animation.
- **sharp** (dev dependency) for a one-time image optimisation script.
- Output is a static site in `dist/` for Vercel. No backend.

Project structure:

```
/
  index.html
  src/
    main.js          // boot, preload, orchestrate sections
    config.js        // all editable content: dates, venues, map links, music, site URL
    stage.js         // 9:16 "cover" stage sizing helper
    curtain.js       // curtain + bow + pull interaction
    book.js          // pinned scroll page-flip
    backcover.js     // countdown + map buttons + replay
    music.js         // audio + mute button
    effects.js       // sparkles, shimmer sweeps
    styles.css
  public/
    images/          // optimised outputs (generated)
    audio/song.mp3   // I will provide
    og-image.jpg     // generated
    favicon.png, apple-touch-icon.png  // generated
  assets-src/        // my original artwork (I will place it here)
  scripts/optimize-images.mjs
  vercel.json
  README.md
```

---

## 2. Assets (my artwork — already designed, text is baked into the images)

All artwork is portrait **9:16 (1449×2576)** except the back cover (941×1672, same ratio). I will put the originals in `assets-src/`. My filenames may differ, so **open each image to identify it by content** and map it to these output names:

| Output name | Content | Role |
|---|---|---|
| `00-curtain` | Blush-pink lace curtain with pearl strands, two panels meeting at a vertical seam in the exact centre | Intro curtain |
| `01-cover` | Closed dusty-rose book, spine on the left, ornate gold oval frame with Arabic monogram, pearls and lace | Front cover (first page to turn) |
| `02-bismillah` | Open book page: Bismillah calligraphy, Arabic monogram, "خديجة و قاسم" | Page 1 |
| `03-invitation` | "We cordially invite you to the Nikah & Reception of Kasim … with Khadija …", pink satin bow top-left | Page 2 |
| `04-nikah` | "Nikkah — Friday, 10th December …" | Page 3 |
| `05-reception` | "Reception — Saturday, 11th December …" | Page 4 |
| `06-awaiting` | "Awaiting your presence — Sopariwala's" | Page 5 (last inner page) |
| `07-back-cover` | Closed book seen from the back (spine on the right), blank dusty-rose panel in the middle | Back cover / final screen |

`scripts/optimize-images.mjs` (run via `npm run images`):
- For each image output WebP at **1080×1920 (q≈80)** and **720×1280 (q≈78)**, plus a JPEG fallback at 1080×1920 (q≈82). Use `<picture>` + `srcset`.
- Target ≤ 350 KB per 1080 WebP. Total image payload ≤ 3 MB.
- Generate `og-image.jpg` (1200×630): blush background `#c99a8b` with the front cover centred and slightly scaled, soft shadow.
- Generate `favicon.png` (48×48) and `apple-touch-icon.png` (180×180) from a crop of the oval monogram on the cover.
- The back cover is lower resolution; do not upscale beyond its native size in the script — it will be scaled by CSS.

**Do not overlay any text that repeats what is printed in the artwork. Do not edit, recolour or crop away the artwork's text or the `@BESPOKEDESIGNS._` watermark.**

### Alt text (text is baked into images, so screen readers need it)
- Cover: "Dusty-rose book cover with a gold oval frame and the couple's Arabic monogram."
- Bismillah: "Bismillah ir-Rahman ir-Raheem. Khadija and Kasim, written in Arabic."
- Invitation: "We cordially invite you to the Nikah and Reception of Kasim, son of Arifa and Shabbir Darbar, with Khadija, daughter of Nazia and Farman Sopariwala."
- Nikah: "Nikah. Friday, 10th December, 1 Rajab 1448 AH. After Salat ul Maghrib, 6:15 PM, at Al Madina Masjid, Agripada."
- Reception: "Reception. Saturday, 11th December, 2 Rajab 1448 AH. 8:30 PM onwards, at Islam Gymkhana, Marine Drive, Mumbai."
- Awaiting: "Awaiting your presence. The Sopariwala family."
- Back cover: "Back cover of the invitation book."

---

## 3. Design tokens

```css
--blush-bg:   #c99a8b;   /* backdrop behind artwork, letterbox fill */
--rose:       #c98580;   /* ribbon mid-tone */
--rose-light: #f3d2cc;   /* ribbon highlight */
--cream:      #f6e6dc;   /* paper / UI fills */
--maroon:     #6e2f2f;   /* UI text, matches the cards' lettering */
--gold:       #b8895a;   /* hairlines, stitching, icons */
--pearl:      #fbf3ea;
```

Fonts (Google Fonts, `display=swap`, preconnect):
- **Cormorant Garamond** 500/600 — UI labels in uppercase with `letter-spacing: .18em` (matches the cards' serif caps).
- **Pinyon Script** — sparing script accents only.

---

## 4. The stage system (critical — every layer must line up)

All artwork layers (curtain, pages, back cover, and any overlays positioned on them) sit inside a **9:16 stage** that behaves like `object-fit: cover`:

```css
.stage {
  position: absolute; left: 50%; top: 50%;
  width:  max(100vw, calc(100svh * 9 / 16));
  height: max(100svh, calc(100vw * 16 / 9));
  transform: translate(-50%, -50%);
}
```
- Use `100svh` with a JS fallback (`--vh` from `window.innerHeight`) for older WebViews.
- Overlays (bow, countdown, buttons) are positioned in **% of the stage**, so they stay locked to the artwork on every phone.
- **Crop guard:** on very tall phones the stage crops the sides. Never crop more than **10% per side** — the printed text spans roughly 30%–88% of the width. If a viewport would crop more, switch that viewport to fit-width and fill the top/bottom with `--blush-bg` (or a blurred copy of the current image). Verify at 360×780, 375×667, 390×844, 412×915.
- **Desktop / tablet (> 600px wide):** show a centred phone-sized stage (height 100svh, max-width ~440px) on a blurred, slightly darkened copy of the current page. Same experience, just framed.
- No horizontal scrolling ever (`overflow-x: hidden` on html/body).

---

## 5. Experience flow

### 5.1 Loader
- Preload `00-curtain` and `01-cover` first (`<link rel="preload">`), then the rest in the background; `await img.decode()` for all book images before the ribbon can be pulled.
- While loading: blush background with a slowly rotating ring of small pearls and a thin progress line. Fade the loader out (0.6s) to reveal the curtain.
- `history.scrollRestoration = 'manual'`; always start at the top.

### 5.2 Curtain + bow (the first impression)
**Layout**
- Full-screen fixed layer above everything, scroll locked (see §7).
- The curtain image is split into **two halves**: two containers, each 50% of the stage width with `overflow: hidden`, each holding the full curtain image positioned so the seam lines up perfectly at the centre. Add a very soft inner shadow gradient along each half's inner edge for depth.
- The book cover (`01-cover`) is already rendered underneath, scaled to 1.08 with a 25% dark overlay (animate the overlay's opacity, **not** a CSS `filter` — filters are slow on Android).

**The bow** (matches the pink satin bow in my invitation page)
- Build it as an **inline SVG** with separate groups: left loop, right loop, knot, two short tails, and one longer **pull ribbon** hanging from the knot.
- Style: satin gradient (`--rose-light` → `--rose` → deeper rose in folds), a thin gold "stitched" edge (`--gold`, 1px dashed stroke) along ribbon edges, soft drop shadow so it sits on the lace. A small pearl drop at the end of the pull ribbon is the handle.
- Position: knot centred on the seam at ~40% stage height, ties the two halves together visually. Pull ribbon hangs to ~64%; pearl handle at its end.
- **Optional override:** if `public/images/bow.png` exists, use it instead of the SVG (animate it as one piece: tighten → pop → fall).
- Hint text below the handle at ~72%: **"PULL THE RIBBON TO OPEN"** in Cormorant Garamond caps, `--cream` with a soft maroon text-shadow for legibility on lace, plus a tiny downward chevron. The pull ribbon gently sways and the pearl bobs every ~3s to invite the gesture.

**Interaction**
- The pearl/ribbon is draggable downward with Pointer Events (`touch-action: none` on the handle). The ribbon stretches with resistance (rubber-band easing) as the finger moves; the bow loops tighten slightly (scaleX → 0.92).
- Release before the threshold (~110px or 35% of max pull) → elastic spring back.
- Past the threshold → **untie sequence**:
  1. Haptic tick (`navigator.vibrate?.(12)`), start the music (see §6) — call `audio.play()` synchronously inside this gesture handler.
  2. Bow loops spring open and slide apart, knot loosens, ribbon and pearl drop with gravity and fade (0.7s). A small burst of gold/pearl sparkles from the knot.
  3. **Split slide:** left half → `x: -105%`, right half → `x: 105%` over ~1.8s, `power3.inOut`, the right half starting 0.05s later for an organic feel. During the slide add a fabric ripple: `skewY` ±1.5° and `scaleX` 1 → 0.95 → 1, so it feels like cloth, not a door.
  4. Simultaneously the cover settles: scale 1.08 → 1.0 and the dark overlay fades out (2.2s).
  5. Remove the curtain from the DOM, unlock scroll, then after 0.8s show a scroll hint at the bottom: **"SCROLL TO OPEN THE BOOK"** with a gently bouncing chevron. Hide it on the first scroll.
- Also make the bow a `<button aria-label="Untie the ribbon to open the invitation">`: a **tap** on the bow and Enter/Space trigger the same untie sequence (fallback for anyone who doesn't drag).

### 5.3 The book — scroll-driven 3D page flip
- A `.book` section pinned with ScrollTrigger. Pages stacked in one stage (top = cover):
  `01-cover → 02-bismillah → 03-invitation → 04-nikah → 05-reception → 06-awaiting`, with `07-back-cover` fixed at the bottom of the stack.
- That's **6 flips**. Pin length ≈ `6 × 100%` of viewport height.
- Container `perspective: 1800px`; each page `transform-style: preserve-3d`, `transform-origin: left center` (the spine is at the left edge of the artwork), `backface-visibility: hidden`.
- Per flip (one segment of the timeline):
  - `rotateY: 0 → -180deg`, with a slight lift (`translateZ` 0 → 30px → 0).
  - **Turning-page shade:** a gradient overlay on the turning page whose opacity rises to ~0.45 at 90° (darker toward the spine), plus a faint highlight band that sweeps across it — sells the paper curve.
  - **Cast shadow on the page underneath:** a gradient from the spine side, opacity ~0.5 → 0 as the turning page leaves.
  - The **cover** flip is a little heavier: slower ease and a visible board thickness on its edge (pseudo-element).
- `scrub: 0.6` so the page follows the finger smoothly, and **snap** so it always comes to rest on a page:
  `snap: { snapTo: 1/6, duration: { min: 0.25, max: 0.7 }, ease: 'power2.inOut', delay: 0.08 }`.
- Only the actively turning page gets `will-change: transform`; remove it afterwards.
- When a page comes to rest, play a one-time **shimmer sweep**: a soft diagonal light band (white, ~20% opacity, `mix-blend-mode: soft-light`) glides across the page in 1.4s — makes the gold details glint.
- **Page indicator:** a slim vertical column of 7 tiny pearls on the right edge (gold outline, current one filled), fades in after the curtain opens. Tapping a pearl scrolls to that page.

### 5.4 Back cover — countdown + maps
When the last inner page turns, the back cover is revealed. Then overlays rise and fade in (staggered 0.12s), placed inside the blank panel of the back cover — roughly **left 24%–right 78%, top 33%–bottom 66%** of the stage, avoiding the floral corners (verify visually and adjust):
1. Small label **"COUNTING DOWN TO THE NIKAH"** (Cormorant caps, `--maroon`).
2. **Countdown**: four boxes — Days / Hours / Mins / Secs. Numbers in Cormorant Garamond 600, labels in small caps; boxes `--cream` at ~75% opacity with a 1px `--gold` hairline and soft rounded corners, like embossed plaques. Numbers change with a subtle vertical slide.
   - Target: **Nikah — 2026-12-10T18:15:00+05:30**. After that passes, switch the label to "COUNTING DOWN TO THE RECEPTION" and target **2026-12-11T20:30:00+05:30**. After the reception, replace the countdown with "JAZAKALLAH KHAIR FOR CELEBRATING WITH US".
   - Always compute in Asia/Kolkata time regardless of the guest's device timezone.
3. Two **map buttons** (pill shape, cream fill, gold hairline, small map-pin icon):
   - "NIKAH · AL MADINA MASJID" → Google Maps
   - "RECEPTION · ISLAM GYMKHANA" → Google Maps
   - Open in a new tab (`target="_blank" rel="noopener"`).
4. Small text link **"↺ OPEN AGAIN"** → smooth-scroll to the top of the book (don't replay the curtain).

---

## 6. Music
- `public/audio/song.mp3` — I will provide it (≈2–3 min, 128 kbps). `<audio loop preload="metadata">`.
- Start on the ribbon pull (it's a user gesture, so iOS/Android allow it). Fade volume 0 → 0.6 over 2s.
- Floating round **mute/unmute button**, top-right, safe-area aware (`env(safe-area-inset-top)`): pearl-white disc with a thin gold ring and three tiny animated equaliser bars in `--maroon` while playing; static note icon when muted. `aria-pressed` reflects state.
- If `play()` rejects (some in-app browsers), show the button in a gently pulsing "tap for music" state.
- Pause on `visibilitychange` when hidden; resume when visible only if it was playing.
- If the audio file is missing, hide the button and continue silently — never break the experience.

---

## 7. Mobile & in-app browser robustness (most guests will open this from WhatsApp)
- Must work smoothly in **WhatsApp and Instagram in-app browsers**, iOS Safari 15+, and Chrome on mid-range Android.
- `ScrollTrigger.config({ ignoreMobileResize: true })`. Try `ScrollTrigger.normalizeScroll(true)` on iOS; keep it only if it removes address-bar jank without breaking the snap.
- Scroll lock while the curtain is up: `overflow: hidden` on html/body, plus a non-passive `touchmove` `preventDefault` on the curtain layer for iOS.
- Respect safe areas (notch, home indicator) for all fixed UI.
- Disable double-tap zoom on interactive elements (`touch-action: manipulation`), no text selection on the stage, no image dragging/long-press save menus on artwork (`-webkit-touch-callout: none`).
- Handle orientation change: recompute the stage and `ScrollTrigger.refresh()`. In landscape on phones, show a small centred note "Please rotate your phone" over the blush background.

---

## 8. Ambient motion effects (subtle — less is more)
- **Sparkles:** one `<canvas>` overlay with ~20 tiny 4-point glints and soft dots in champagne/pearl tones that twinkle (sine opacity) and drift slowly upward. Render at device pixel ratio capped at 2. Pause when the tab is hidden.
- **Shimmer sweep** on each page arrival (see §5.3).
- **Sparkle burst** when the bow unties (see §5.2).
- Nothing else moving on top of the text. No parallax that would misalign the book.

---

## 9. Accessibility & reduced motion
- `prefers-reduced-motion: reduce` → curtain simply fades out after the tap/pull, page flips become 0.4s crossfades (still snapping per page), no sparkles, no shimmer.
- All artwork images have the alt text from §2. Buttons are real `<button>`/`<a>` elements with labels and visible focus rings (gold).
- UI text contrast meets WCAG AA against its background.

---

## 10. Content config — `src/config.js`
Put every editable value here so I can change things without touching logic:

```js
export const CONFIG = {
  siteUrl: 'https://REPLACE-AFTER-DEPLOY.vercel.app', // used for og:image absolute URL
  couple: 'Kasim & Khadija',
  timezone: 'Asia/Kolkata',
  nikah: {
    start: '2026-12-10T18:15:00+05:30',
    label: 'Nikah · Al Madina Masjid',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Al+Madina+Masjid+Agripada+Mumbai',
  },
  reception: {
    start: '2026-12-11T20:30:00+05:30',
    label: 'Reception · Islam Gymkhana',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Islam+Gymkhana+Marine+Drive+Mumbai',
  },
  music: { src: '/audio/song.mp3', volume: 0.6 },
};
```

---

## 11. Sharing preview (WhatsApp link card)
In `index.html`:
- `<title>Kasim & Khadija · Nikah & Reception</title>`
- Meta description: "You're invited to the Nikah & Reception of Kasim & Khadija · 10–11 December · Mumbai"
- Open Graph + Twitter tags with **absolute** `og:image` URL built from `siteUrl` (WhatsApp ignores relative URLs). 1200×630.
- `theme-color` `#c99a8b`, favicon, apple-touch-icon, `lang="en"`, viewport with `viewport-fit=cover`.

---

## 12. Performance budget
- Lighthouse mobile performance ≥ 85. Images ≤ 3 MB total; JS ≤ 120 KB gzipped.
- Only transform/opacity animations. No animating `filter`, `box-shadow` or layout properties on large layers.
- 60fps target on a mid-range Android during page flips — profile and simplify if needed.

---

## 13. Deployment prep (I'll give GitHub/Vercel details later)
- `git init`, sensible `.gitignore` (node_modules, dist, .DS_Store), first commit. **Do not** create or push to a remote yet.
- `vercel.json`: cache headers for `/images/*` and `/audio/*` (`max-age=604800`).
- `README.md` with: run locally, how to replace the song, how to edit dates/map links in `config.js`, how to re-run image optimisation, and Vercel deploy steps (import the GitHub repo → Framework: Vite → Build: `npm run build` → Output: `dist`), plus a reminder to set `siteUrl` after the first deploy.

---

## 14. Milestones (check each at 390×844 before moving on)
1. Scaffold project, image optimisation script, stage system, all pages rendering correctly aligned.
2. Pinned scroll page-flip with shading, snap and page indicator.
3. Curtain split + SVG bow + pull/tap interaction + scroll lock/unlock + scroll hint.
4. Music + mute button.
5. Back cover: countdown (with IST and post-event states) + map buttons + "open again".
6. Ambient effects, reduced-motion mode, desktop framing, orientation handling.
7. QA pass (below), then the README and first git commit.

## 15. Acceptance checklist
- [ ] Curtain seam is perfectly aligned; no gap or overlap before the split.
- [ ] Dragging the ribbon feels physical; releasing early springs back; tapping the bow also works.
- [ ] Music starts on the pull on iOS Safari and Android Chrome; mute works; missing file doesn't break anything.
- [ ] Page cannot scroll while the curtain is closed; scrolls normally afterwards.
- [ ] Each scroll gesture turns exactly one page and it always rests flat on a page.
- [ ] No printed text is cropped at 360×780, 375×667, 390×844, 412×915.
- [ ] Countdown shows the right time for a guest whose phone is set to a non-Indian timezone.
- [ ] Map buttons open the correct venues.
- [ ] Reduced-motion mode works end to end.
- [ ] No console errors; no horizontal scroll; Lighthouse mobile ≥ 85.
- [ ] Looks and feels original — do not copy any existing invitation website's design or code.

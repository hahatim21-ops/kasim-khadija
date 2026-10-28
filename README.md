# Kasim & Khadija · Nikah & Reception

A mobile-first wedding invitation: a lace curtain tied with a satin bow → pull the ribbon →
the curtain parts → scroll to turn the pages of the book → the back cover shows a live countdown
and directions. Built with Vite, vanilla JavaScript and GSAP (ScrollTrigger). Static output, no backend.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173). Use your browser's device toolbar at a phone size
such as 390×844 to see it as guests will.

```bash
npm run build     # production build into dist/
npm run preview   # serve dist/ locally
```

Handy preview switches (add to the URL):

- `?now=2026-12-10T19:00:00+05:30` pretends it is that moment, to check the countdown states
  (before the Nikah → Nikah countdown; between → Reception countdown; after → "JazakAllah Khair").
- `?reduced-motion` previews the reduced-motion version (fades instead of page turns).

## Replace the song

Put the track at `public/audio/song.mp3` (≈2–3 min, 128 kbps is plenty). It starts when the guest
pulls the ribbon, fades in to 60% volume, and loops. To use another file name or volume, edit
`music` in `src/config.js`. If the file is missing, the music button simply stays hidden.

## Edit dates, venues and map links

Everything editable lives in `src/config.js`:

- `nikah.start` / `reception.start`: ISO date-times **with the +05:30 offset**. The countdown is
  computed from these exact instants, so it is correct for guests in any timezone.
- `nikah.label` / `reception.label`: the text on the map buttons.
- `nikah.mapUrl` / `reception.mapUrl`: Google Maps links (a `search/?api=1&query=` link or a
  share link copied from the Maps app both work).
- `countdown`: the countdown label, the after-the-event message and the "Open again" text.
- `pages`: page order and the alt text screen readers announce for each artwork.
- `siteUrl`: the deployed address (see the deploy steps).

## Artwork and image optimisation

The original artwork lives in `assets-src/`. `scripts/optimize-images.mjs` maps each source file
to its page (the mapping is at the top of the script, because the source file names don't follow the
page order) and writes to `public/images/`:

- WebP at 1080×1920, 900×1600 and 720×1280 plus a JPEG fallback (the back cover is never upscaled
  past its native 941px width);
- a tiny blurred copy of each page used behind the stage on desktop and in letterbox bands;
- `public/og-image.jpg` (1200×630 share card), `public/favicon.png` and `public/apple-touch-icon.png`.

After changing anything in `assets-src/`, re-run:

```bash
npm run images
```

Optional: a `public/images/bow.png` (transparent PNG) replaces the drawn satin bow; restart
`npm run dev` / rebuild after adding it.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project → Import** the GitHub repo.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Deploy.
5. **After the first deploy:** copy the production URL (e.g. `https://kasim-khadija.vercel.app`)
   into `siteUrl` in `src/config.js`, commit and push. WhatsApp only shows the preview card when the
   `og:image` address is absolute, so this step matters.
6. To refresh a link preview that WhatsApp has already cached, share the URL with a harmless query
   string added (e.g. `?v=2`).

`vercel.json` sets one-week caching for `/images/*` and `/audio/*`.

## Notes on behaviour

- **One page per gesture.** Swipes, mouse-wheel/trackpad gestures and arrow keys each turn exactly
  one page; the page follows the finger while dragging and always settles flat. The pin and the
  page-turn timeline are a ScrollTrigger scrub; ScrollTrigger's own `snap` is not used because its
  momentum projection lets a fast flick skip pages. A small rest-on-a-page fallback handles native
  scrolling (scrollbar, find-in-page) instead.
- **Loading.** The curtain is preloaded; the cover, the rest of the pages and the song load right
  after the curtain is on screen, and the ribbon becomes pullable once every page is decoded.
- **Reduced motion.** With the system setting on, the curtain fades, pages crossfade and the
  sparkles and shimmer are off.
- **The folder name contains `&`**, which breaks npm's `.bin` shims on Windows, so the npm scripts
  call Vite through `node node_modules/vite/bin/vite.js`. That works the same on Vercel.

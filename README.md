# Kasim & Khadija · Nikah & Reception

A mobile-first wedding invitation: a lace curtain with two pearl strands over the seam → pull the
strings → the curtain parts and the monogram is written onto the cover → scroll to turn the pages of
the book, each page's text writing itself in → the back cover shows a live countdown and directions.
Built with Vite, vanilla JavaScript and GSAP (ScrollTrigger). Static output, no backend.

Live: https://kasim-khadija.vercel.app · Repo: https://github.com/hahatim21-ops/kasim-khadija

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

Put the track at `public/audio/song.mp3` (≈2–3 min, 128 kbps is plenty), then commit and push. It
starts when the guest pulls the strings, fades in to 60% volume, and loops. To use another file name or
volume, edit `music` in `src/config.js`. The build only switches music on when the file exists, so
until you add it there is no music button and no request for a missing file.

## Edit dates, venues and map links

Everything editable lives in `src/config.js`:

- `nikah.start` / `reception.start`: ISO date-times **with the +05:30 offset**. The countdown is
  computed from these exact instants, so it is correct for guests in any timezone.
- `nikah.label` / `reception.label`: the text on the map buttons.
- `nikah.mapUrl` / `reception.mapUrl`: Google Maps links (a `search/?api=1&query=` link or a
  share link copied from the Maps app both work).
- `countdown`: the countdown label, the after-the-event message and the "Open again" text.
- `pages`: page order and the alt text screen readers announce for each artwork.
- `siteUrl`: the deployed address, used for the WhatsApp preview image.

## Artwork and image optimisation

The original artwork lives in `assets-src/` (the pages, the curtain and `pearl-strands.png`).
`npm run images` runs `scripts/optimize-images.mjs`, which writes everything in `public/images/`:

- **Pages are split so the text can animate.** For each book page the script lifts every printed line
  into its own transparent layer (`public/images/text/`) and rebuilds the paper underneath, giving a
  text-free "plate". Plate + layers put back together are identical to the original artwork.
  Invitation, Nikah and Reception share one background, so their paper is restored from each other;
  the other pages are filled with paper texture borrowed from nearby.
- The measurements that drive this — which part of each page turns (the "leaf"), and a box around each
  line of text — are in `scripts/page-layout.mjs`, in % of the artwork.
- WebP at 1080×1920, 900×1600 and 720×1280 plus a JPEG fallback (the back cover is never upscaled
  past its native 941px width), and a tiny blurred copy of each page for the desktop backdrop.
- The two pearl strands, cut apart with a soft shadow baked in.
- `public/og-image.jpg` (1200×630 share card), `public/favicon.png` and `public/apple-touch-icon.png`.

After changing anything in `assets-src/`, re-run `npm run images`. If you replace a page and its text
moves, adjust that page's boxes in `scripts/page-layout.mjs`. To check the result, set `TEXT_DEBUG` to
a folder: the script writes each plate and a preview of the lifted ink (in red) there.

```bash
TEXT_DEBUG=./text-debug npm run images
```

## Deploy

The GitHub repo is connected to the Vercel project **kasim-khadija**: every push to `main` deploys
to https://kasim-khadija.vercel.app automatically. Vercel settings: Framework **Vite**, build
`npm run build`, output `dist`.

To refresh a link preview that WhatsApp has already cached, share the URL with a harmless query
string added (e.g. `?v=2`).

`vercel.json` sets one-week caching for `/images/*` and `/audio/*`.

## Notes on behaviour

- **Only the page turns.** Each page is drawn twice: the background (with a hole where the paper
  sits) and the leaf (just the paper page or cover board, hinged at the spine). Only the leaf turns;
  the lace and flowers around the book ease across to the next page's.
- **Text animation.** When a page settles its lines appear one after another: capitals fade and
  rise, script is written left to right, Arabic right to left. Turn back and forward again and they
  play again. The cover's monogram is written in as the curtain opens, followed by a glint of light.
- **One page per gesture.** Swipes, mouse-wheel/trackpad gestures and arrow keys each turn exactly
  one page; the page follows the finger while dragging and always settles flat. The pin and the
  page-turn timeline are a ScrollTrigger scrub; ScrollTrigger's own `snap` is not used because its
  momentum projection lets a fast flick skip pages. A small rest-on-a-page fallback handles native
  scrolling (scrollbar, find-in-page) instead.
- **Loading.** The curtain is preloaded; the strands, cover, pages, text and song load right after
  the curtain is on screen, and the strings become pullable once everything is decoded.
- **Reduced motion.** With the system setting on, the curtain fades, pages crossfade, text simply
  fades in, and the sparkles and shimmer are off.
- **The folder name contains `&`**, which breaks npm's `.bin` shims on Windows, so the npm scripts
  call Vite through `node node_modules/vite/bin/vite.js`. That works the same on Vercel.

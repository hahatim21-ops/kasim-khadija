# Kasim & Khadija · Nikah & Reception

A mobile-first wedding invitation: a lace curtain with two pearl strands over the seam → pull the
strings → the curtain parts and the monogram is written onto the cover → scroll to turn the pages of
the book → the back cover shows a live countdown and directions. Background music plays throughout.
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

## The song

`public/audio/song.mp3` starts when the guest pulls the strings, fades in to 60% volume, and loops.
It is made from the original track in `assets-src/song-original.mp3` with a short fade at each end so
the loop point is soft. To replace it, put the new track in `assets-src/` and run:

```bash
ffmpeg -i assets-src/song-original.mp3 -af "afade=t=in:st=0:d=0.8,afade=t=out:st=58.9:d=1.29" -map_metadata -1 -c:a libmp3lame -b:a 128k -ar 44100 public/audio/song.mp3
```

(set the fade-out start `st=` to the track length minus 1.3 seconds), then commit and push. To use
another file name or volume, edit `music` in `src/config.js`. The build only switches music on when the
file exists, so without it there is no music button and no request for a missing file.

## Edit dates, venues and map links

Everything editable lives in `src/config.js`:

- `nikah.start` / `reception.start`: ISO date-times **with the +05:30 offset**. The countdown is
  computed from these exact instants, so it is correct for guests in any timezone.
- `nikah.label` / `reception.label`: the map buttons, written `Event · Venue` (shown on two lines).
- `nikah.mapUrl` / `reception.mapUrl`: Google Maps links (a `search/?api=1&query=` link or a
  share link copied from the Maps app both work).
- `countdown`: the countdown label, the after-the-event message and the "Open again" text.
- `pages`: page order and the alt text screen readers announce for each artwork.
- `siteUrl`: the deployed address, used for the WhatsApp preview image.

## Artwork and image optimisation

The original artwork lives in `assets-src/` (the pages, the curtain and `pearl-strands.png`; the
page order and which source file is which page are at the top of `scripts/optimize-images.mjs`).
`npm run images` rebuilds everything in `public/images/` from scratch:

- WebP at 1080×1920, 900×1600 and 720×1280 plus a JPEG fallback (the back cover is never upscaled
  past its native 941px width), and a tiny blurred copy of each page for the desktop backdrop.
- **The cover monogram** is lifted onto its own transparent layer (`public/images/text/`) and the oval
  is rebuilt underneath, so the monogram can be written in after the curtain opens. Every other page is
  used exactly as printed.
- `scripts/page-layout.mjs` holds the measurements, in % of the artwork: which part of each page turns
  (the "leaf", from the spine to the page edge) and where the cover monogram is.
- The two pearl strands, cut apart with a soft shadow baked in.
- `public/og-image.jpg` (1200×630 share card), `public/favicon.png` and `public/apple-touch-icon.png`.

After changing anything in `assets-src/`, re-run `npm run images`. To add a page, put its image in
`assets-src/`, add it to the list at the top of `scripts/optimize-images.mjs` and to
`scripts/page-layout.mjs` (an open-book page can reuse `OPEN_BOOK`), then add it to `pages` in
`src/config.js`. To check the monogram cut-out, set `TEXT_DEBUG` to a folder: the script writes the
rebuilt cover and a preview of the lifted ink (in red) there.

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
- **Text.** Page text turns with its page exactly as printed — no fades. The only animated mark is
  the cover monogram, written in right to left as the curtain opens, followed by a glint of light.
- **One page per gesture.** Swipes, mouse-wheel/trackpad gestures and arrow keys each turn exactly
  one page; the page follows the finger while dragging (about two-thirds of the screen per page) and
  always settles flat; a turn takes a little over two seconds. `SCRUB` and `FINGER_PER_PAGE` at the top
  of `src/book.js` and the `goTo` durations set the pace. The pin and the
  page-turn timeline are a ScrollTrigger scrub; ScrollTrigger's own `snap` is not used because its
  momentum projection lets a fast flick skip pages. A small rest-on-a-page fallback handles native
  scrolling (scrollbar, find-in-page) instead.
- **Every phone.** The artwork fills the screen, trimming at most 10% off each side on tall phones
  (never into the text). The countdown block is sized in proportion to the artwork, so it sits in the
  same place inside the back cover's blank panel from a 320×568 iPhone SE to a 430×932 Pro Max. The
  page indicator is a row of pearls at the bottom, below the book, so it never covers printed text.
- **Loading.** The curtain is preloaded; the strands, cover, pages and song load right after the
  curtain is on screen, and the strings become pullable once everything is decoded.
- **Reduced motion.** With the system setting on, the curtain fades, pages crossfade, the monogram
  simply fades in, and the sparkles and shimmer are off.
- **The folder name contains `&`**, which breaks npm's `.bin` shims on Windows, so the npm scripts
  call Vite through `node node_modules/vite/bin/vite.js`. That works the same on Vercel.

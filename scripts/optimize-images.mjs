// One-time image optimisation: assets-src/* → public/images/*
// Run with `npm run images`. Re-run whenever the artwork in assets-src changes.
//
// Book pages are split into a text-free "plate" plus one transparent layer per line of text
// (see scripts/extract-text.mjs and the measurements in scripts/page-layout.mjs), so the text
// can be animated and only the paper page turns.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_LAYOUT } from './page-layout.mjs';
import { analysePage, buildPlate, lineLayer } from './extract-text.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'public', 'images');
const PUBLIC = path.join(ROOT, 'public');
const MANIFEST = path.join(ROOT, 'src', 'images.json');
const DEBUG = process.env.TEXT_DEBUG; // folder for plate / mask previews

// Source files identified by content (filenames in assets-src don't match the page order).
const MAP = {
  '00-curtain': 'Curtain 1.JPG.jpeg',
  '01-cover': '2.JPG.jpeg',
  '02-bismillah': '3.JPG.jpeg',
  '03-invitation': 'Khadija  Kasim - 4.JPG.jpeg',
  '04-nikah': 'Khadija  Kasim - 5.JPG.jpeg',
  '05-reception': 'Khadija  Kasim - 6.JPG.jpeg',
  '06-awaiting': '7.JPG.jpeg',
  '07-back-cover': '8.PNG',
};
const STRANDS = 'pearl-strands.png';

const MASTER = { w: 1080, h: 1920 };
const LARGE = { w: 1080, q: 80, maxBytes: 350 * 1024 };
const MEDIUM = { w: 900, q: 78 }; // fits DPR ≈ 2 phones without paying for 1080
const SMALL = { w: 720, q: 78 };
const JPEG_Q = 82;
const BLUR_W = 36; // tiny pre-blurred copy for letterbox / desktop backdrop

const h169 = (w) => Math.round((w * 16) / 9);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const pct = (v, of) => +((v / of) * 100).toFixed(3);

async function webpUnderBudget(input, w, q, maxBytes) {
  // Step quality down until the file fits the budget (lace textures compress poorly).
  for (let quality = q; quality >= 60; quality -= 4) {
    const buf = await input().resize(w, h169(w), { fit: 'cover' })
      .webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (!maxBytes || buf.length <= maxBytes || quality - 4 < 60) return { buf, quality };
  }
}

const rawImage = (buf) => sharp(buf, { raw: { width: MASTER.w, height: MASTER.h, channels: 3 } });

async function master(file) {
  return sharp(path.join(SRC, file)).rotate().resize(MASTER.w, MASTER.h, { fit: 'cover' })
    .removeAlpha().raw().toBuffer();
}

async function main() {
  fs.mkdirSync(path.join(OUT, 'text'), { recursive: true });
  if (DEBUG) fs.mkdirSync(DEBUG, { recursive: true });
  const manifest = {};
  let total = 0;

  // Split every book page into plate + text layers first: grouped pages refill each other.
  const pages = {};
  for (const [name, layout] of Object.entries(PAGE_LAYOUT)) {
    const rgb = await master(MAP[name]);
    pages[name] = { rgb, layout, ...analysePage(rgb, MASTER.w, MASTER.h, layout) };
  }
  for (const [name, page] of Object.entries(pages)) {
    const siblings = Object.entries(pages)
      .filter(([other, p]) => other !== name && page.layout.group && p.layout.group === page.layout.group)
      .map(([, p]) => p);
    page.plate = buildPlate(page.rgb, MASTER.w, MASTER.h, page.hole, siblings);
  }

  for (const [name, file] of Object.entries(MAP)) {
    const input = path.join(SRC, file);
    if (!fs.existsSync(input)) throw new Error(`Missing source for ${name}: ${file}`);
    const page = pages[name];
    const meta = await sharp(input).metadata();
    // Never upscale: the back cover is only 941px wide.
    const large = Math.min(LARGE.w, meta.width);
    const medium = Math.min(MEDIUM.w, meta.width);
    const small = Math.min(SMALL.w, meta.width);
    const src = page
      ? () => rawImage(Buffer.from(page.plate.buffer))
      : () => sharp(input).rotate();

    const L = await webpUnderBudget(src, large, LARGE.q, LARGE.maxBytes);
    fs.writeFileSync(path.join(OUT, `${name}-${large}.webp`), L.buf);
    const M = await webpUnderBudget(src, medium, MEDIUM.q);
    fs.writeFileSync(path.join(OUT, `${name}-${medium}.webp`), M.buf);
    const S = await webpUnderBudget(src, small, SMALL.q);
    fs.writeFileSync(path.join(OUT, `${name}-${small}.webp`), S.buf);
    const jpg = await src().resize(large, h169(large), { fit: 'cover' }).jpeg({ quality: JPEG_Q, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${name}-${large}.jpg`), jpg);

    await sharp(input).rotate().resize(BLUR_W, h169(BLUR_W), { fit: 'cover' })
      .blur(1.2).jpeg({ quality: 70 }).toFile(path.join(OUT, `${name}-blur.jpg`));

    manifest[name] = { widths: [...new Set([small, medium, large])] };
    total += L.buf.length;
    let textBytes = 0;

    if (page) {
      manifest[name].leaf = page.layout.leaf;
      manifest[name].text = [];
      for (const [n, line] of page.lines.entries()) {
        if (!line.bbox) { console.warn(`  ! ${name} line ${n}: no ink found`); continue; }
        const { buf, w, h } = lineLayer(page.rgb, MASTER.w, line);
        const out = await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
          .webp({ quality: 88, alphaQuality: 90, effort: 6 }).toBuffer();
        const rel = `text/${name}-${n}.webp`;
        fs.writeFileSync(path.join(OUT, rel), out);
        textBytes += out.length;
        const [x0, y0] = line.bbox;
        manifest[name].text.push({
          src: `/images/${rel}`, w, h, kind: line.kind,
          x: pct(x0, MASTER.w), y: pct(y0, MASTER.h), width: pct(w, MASTER.w),
        });
      }
      if (DEBUG) await writeDebug(name, page);
    }
    console.log(`${name.padEnd(14)} ${large}w q${L.quality} ${kb(L.buf.length).padStart(7)} | ${medium}w ${kb(M.buf.length).padStart(7)} | ${small}w ${kb(S.buf.length).padStart(7)} | jpg ${kb(jpg.length).padStart(7)}${page ? ` | ${page.lines.length} text layers ${kb(textBytes)}` : ''}`);
    total += textBytes;
  }

  manifest.strands = await makeStrands();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nLarge WebP payload incl. text layers: ${kb(total)} (budget 3072 KB)`);

  await makeOgImage();
  await makeIcons();
}

// Debug previews: the rebuilt plate, and the ink that was lifted (red) on top of it.
async function writeDebug(name, page) {
  const { w, h } = MASTER;
  await rawImage(Buffer.from(page.plate.buffer)).jpeg({ quality: 85 }).toFile(path.join(DEBUG, `${name}-plate.jpg`));
  const over = Buffer.from(page.plate);
  for (const l of page.lines) for (let i = 0; i < w * h; i++) if (l.ink[i]) { over[i * 3] = 255; over[i * 3 + 1] = 0; over[i * 3 + 2] = 0; }
  await rawImage(over).jpeg({ quality: 85 }).toFile(path.join(DEBUG, `${name}-ink.jpg`));
}

// The two pearl strands that replace the bow, cut apart, with a soft shadow baked in.
async function makeStrands() {
  const file = path.join(SRC, STRANDS);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const bounds = (from, to) => {
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = from; x < to; x++) {
      if (data[(y * W + x) * 4 + 3] < 8) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  };
  const out = {};
  for (const [side, from, to] of [['l', 0, W / 2], ['r', W / 2, W]]) {
    const b = bounds(Math.round(from), Math.round(to));
    const pad = 14;
    const strand = await sharp(file).extract(b).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const { width, height } = await sharp(strand).metadata();
    // Shadow: the strand's own alpha, blurred and offset, in a deep rose-brown.
    const alpha = await sharp(strand).extractChannel(3).blur(4).toBuffer();
    const shadow = await sharp({ create: { width, height, channels: 3, background: { r: 70, g: 28, b: 26 } } })
      .joinChannel(await sharp(alpha).linear(0.42, 0).toBuffer()).png().toBuffer();
    const buf = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: shadow, left: 3, top: 6 }, { input: strand, left: 0, top: 0 }])
      .webp({ quality: 90, alphaQuality: 95, effort: 6 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `strand-${side}.webp`), buf);
    out[side] = { src: `/images/strand-${side}.webp`, w: width, h: height };
    console.log(`strand-${side}.webp    ${width}×${height} ${kb(buf.length)}`);
  }
  return out;
}

// 1200×630 share card: blush backdrop, the front cover centred with a soft shadow.
async function makeOgImage() {
  const cover = path.join(SRC, MAP['01-cover']);
  const { width, height } = await sharp(cover).metadata();
  // Crop to the book itself (spine + board), measured from the artwork.
  const crop = {
    left: Math.round(width * 0.042), top: Math.round(height * 0.143),
    width: Math.round(width * 0.916), height: Math.round(height * 0.723),
  };
  const bookH = 560;
  const book = await sharp(cover).extract(crop).resize({ height: bookH }).toBuffer();
  const { width: bookW } = await sharp(book).metadata();
  const left = Math.round((1200 - bookW) / 2), top = Math.round((630 - bookH) / 2);

  const shadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
    <radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#e2bcae"/><stop offset="1" stop-color="#c99a8b"/></radialGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <rect x="${left + 10}" y="${top + 18}" width="${bookW - 8}" height="${bookH - 6}" rx="6" fill="#5a2626" opacity=".38" filter="url(#b)"/>
  </svg>`);

  await sharp(shadow).composite([{ input: book, left, top }])
    .jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(PUBLIC, 'og-image.jpg'));
  console.log('og-image.jpg     1200×630');
}

// Favicons from a square crop of the oval monogram on the cover.
async function makeIcons() {
  const cover = path.join(SRC, MAP['01-cover']);
  const { width, height } = await sharp(cover).metadata();
  const side = Math.round(width * 0.31);
  const cx = width * 0.555, cy = height * 0.485;
  const region = { left: Math.round(cx - side / 2), top: Math.round(cy - side / 2), width: side, height: side };
  for (const [file, size] of [['favicon.png', 48], ['apple-touch-icon.png', 180]]) {
    await sharp(cover).extract(region).resize(size, size).png({ compressionLevel: 9 })
      .toFile(path.join(PUBLIC, file));
    console.log(`${file.padEnd(16)} ${size}×${size}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

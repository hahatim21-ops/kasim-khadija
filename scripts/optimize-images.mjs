// One-time image optimisation: assets-src/* → public/images/*
// Run with `npm run images`. Re-run whenever the artwork in assets-src changes.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'public', 'images');
const PUBLIC = path.join(ROOT, 'public');
const MANIFEST = path.join(ROOT, 'src', 'images.json');

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

const LARGE = { w: 1080, q: 80, maxBytes: 350 * 1024 };
const MEDIUM = { w: 900, q: 78 }; // fits DPR ≈ 2 phones without paying for 1080
const SMALL = { w: 720, q: 78 };
const JPEG_Q = 82;
const BLUR_W = 36; // tiny pre-blurred copy for letterbox / desktop backdrop

const h169 = (w) => Math.round((w * 16) / 9);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function webpUnderBudget(input, w, q, maxBytes) {
  // Step quality down until the file fits the budget (lace textures compress poorly).
  for (let quality = q; quality >= 60; quality -= 4) {
    const buf = await sharp(input).rotate().resize(w, h169(w), { fit: 'cover' })
      .webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (!maxBytes || buf.length <= maxBytes || quality - 4 < 60) return { buf, quality };
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  let total = 0;

  for (const [name, file] of Object.entries(MAP)) {
    const input = path.join(SRC, file);
    if (!fs.existsSync(input)) throw new Error(`Missing source for ${name}: ${file}`);
    const meta = await sharp(input).metadata();
    // Never upscale: the back cover is only 941px wide.
    const large = Math.min(LARGE.w, meta.width);
    const medium = Math.min(MEDIUM.w, meta.width);
    const small = Math.min(SMALL.w, meta.width);

    const L = await webpUnderBudget(input, large, LARGE.q, LARGE.maxBytes);
    fs.writeFileSync(path.join(OUT, `${name}-${large}.webp`), L.buf);
    const M = await webpUnderBudget(input, medium, MEDIUM.q);
    fs.writeFileSync(path.join(OUT, `${name}-${medium}.webp`), M.buf);
    const S = await webpUnderBudget(input, small, SMALL.q);
    fs.writeFileSync(path.join(OUT, `${name}-${small}.webp`), S.buf);

    const jpg = await sharp(input).rotate().resize(large, h169(large), { fit: 'cover' })
      .jpeg({ quality: JPEG_Q, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${name}-${large}.jpg`), jpg);

    await sharp(input).rotate().resize(BLUR_W, h169(BLUR_W), { fit: 'cover' })
      .blur(1.2).jpeg({ quality: 70 }).toFile(path.join(OUT, `${name}-blur.jpg`));

    manifest[name] = { widths: [...new Set([small, medium, large])] };
    total += L.buf.length;
    console.log(`${name.padEnd(14)} ${large}w q${L.quality} ${kb(L.buf.length).padStart(7)} | ${medium}w ${kb(M.buf.length).padStart(7)} | ${small}w ${kb(S.buf.length).padStart(7)} | jpg ${kb(jpg.length).padStart(7)}`);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nLarge WebP payload: ${kb(total)} (budget 3072 KB)`);

  await makeOgImage();
  await makeIcons();
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

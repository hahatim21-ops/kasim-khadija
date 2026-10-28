// Lifts printed text off a page so it can be animated:
//   • a "plate": the page with every text line removed and the paper rebuilt underneath;
//   • one transparent layer per line, cut from the original pixels.
// Plate + all layers composited back together reproduce the original exactly.
// Works on raw RGB buffers at the 1080×1920 master size.
//
// Extra line options (see page-layout.mjs for the basics):
//   minRG   – require red to exceed green by this much (keeps green leaves out of pink ink);
//   exclude – rectangles inside the box to ignore (florals reaching into it);
//   group   – pages sharing a name have an identical background and refill each other's holes.
// Boxes may overlap: ink caught by two lines is identical in both layers.

const lum = (b, i) => 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];

// ── binary masks ────────────────────────────────────────────────────────────────
function dilate(mask, W, H, r) {
  // Separable square max filter (cheap and good enough for growing ink strokes).
  const tmp = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    let run = -1e9;
    for (let x = 0; x < W; x++) if (mask[y * W + x]) run = x; else if (x - run <= r) tmp[y * W + x] = 1;
    run = 1e9;
    for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (mask[i]) { run = x; tmp[i] = 1; } else if (run - x <= r) tmp[i] = 1; }
  }
  for (let x = 0; x < W; x++) {
    let run = -1e9;
    for (let y = 0; y < H; y++) if (tmp[y * W + x]) run = y; else if (y - run <= r) out[y * W + x] = 1;
    run = 1e9;
    for (let y = H - 1; y >= 0; y--) { const i = y * W + x; if (tmp[i]) { run = y; out[i] = 1; } else if (run - y <= r) out[i] = 1; }
  }
  return out;
}

function boxBlur(src, W, H, r, channels = 1) {
  // Two passes of a separable box blur on a Float32 buffer.
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let c = 0; c < channels; c++) {
      let s = 0, n = 0;
      for (let x = -r; x < W; x++) {
        if (x + r < W) { s += a[(y * W + x + r) * channels + c]; n++; }
        if (x - r - 1 >= 0) { s -= a[(y * W + x - r - 1) * channels + c]; n--; }
        if (x >= 0) b[(y * W + x) * channels + c] = s / n;
      }
    }
    for (let x = 0; x < W; x++) for (let c = 0; c < channels; c++) {
      let s = 0, n = 0;
      for (let y = -r; y < H; y++) {
        if (y + r < H) { s += b[((y + r) * W + x) * channels + c]; n++; }
        if (y - r - 1 >= 0) { s -= b[((y - r - 1) * W + x) * channels + c]; n--; }
        if (y >= 0) a[(y * W + x) * channels + c] = s / n;
      }
    }
  }
  return a;
}

// ── ink detection inside one line box ──────────────────────────────────────────
export function inkMask(rgb, W, H, line) {
  const [bx0, by0, bx1, by1] = line.box;
  const x0 = Math.round((bx0 / 100) * W), x1 = Math.round((bx1 / 100) * W);
  const y0 = Math.round((by0 / 100) * H), y1 = Math.round((by1 / 100) * H);
  const inside = (x, y) => {
    const px = (x / W) * 100, py = (y / H) * 100;
    if (line.exclude?.some(([ex0, ey0, ex1, ey1]) => px >= ex0 && px <= ex1 && py >= ey0 && py <= ey1)) return false;
    if (!line.ellipse) return true;
    const [cx, cy, rx, ry] = line.ellipse;
    const dx = (px - cx) / rx, dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  // Paper brightness: a high percentile of the box (most of a line box is paper).
  const ls = [];
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) if (inside(x, y)) ls.push(lum(rgb, (y * W + x) * 3));
  ls.sort((a, b) => a - b);
  const paper = ls[Math.floor(ls.length * 0.8)];
  const thr = paper - (line.delta ?? 40);
  const mask = new Uint8Array(W * H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * W + x, p = i * 3;
    if (!inside(x, y) || lum(rgb, p) >= thr) continue;
    if (line.minRG && rgb[p] - rgb[p + 1] < line.minRG) continue;
    mask[i] = 1;
  }
  // Drop isolated specks of paper texture.
  const clean = new Uint8Array(W * H);
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    const i = y * W + x;
    if (!mask[i]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += mask[i + dy * W + dx];
    if (n >= 4) clean[i] = 1;
  }
  return clean;
}

// ── filling the holes ──────────────────────────────────────────────────────────
// Smooth push-pull fill: averages known pixels down an image pyramid, then pulls back up.
function pushPull(rgb, hole, W, H) {
  const levels = [];
  let w = W, h = H;
  let C = new Float32Array(W * H * 3), Wt = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { Wt[i] = hole[i] ? 0 : 1; for (let c = 0; c < 3; c++) C[i * 3 + c] = rgb[i * 3 + c]; }
  levels.push({ w, h, C, Wt });
  while (w > 1 || h > 1) {
    const nw = Math.max(1, Math.ceil(w / 2)), nh = Math.max(1, Math.ceil(h / 2));
    const nC = new Float32Array(nw * nh * 3), nWt = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let s0 = 0, s1 = 0, s2 = 0, sw = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const cx = x * 2 + dx, cy = y * 2 + dy;
        if (cx >= w || cy >= h) continue;
        const k = cy * w + cx, wk = Wt[k];
        s0 += C[k * 3] * wk; s1 += C[k * 3 + 1] * wk; s2 += C[k * 3 + 2] * wk; sw += wk;
      }
      const j = y * nw + x;
      if (sw > 0) { nC[j * 3] = s0 / sw; nC[j * 3 + 1] = s1 / sw; nC[j * 3 + 2] = s2 / sw; }
      nWt[j] = Math.min(1, sw);
    }
    w = nw; h = nh; C = nC; Wt = nWt;
    levels.push({ w, h, C, Wt });
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l], coarse = levels[l + 1];
    for (let y = 0; y < fine.h; y++) for (let x = 0; x < fine.w; x++) {
      const k = y * fine.w + x, wk = fine.Wt[k];
      if (wk >= 1) continue;
      // Bilinear sample of the (already complete) coarser level.
      const fx = Math.min(coarse.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
      const fy = Math.min(coarse.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const ix1 = Math.min(coarse.w - 1, ix + 1), iy1 = Math.min(coarse.h - 1, iy + 1);
      for (let c = 0; c < 3; c++) {
        const v = (coarse.C[(iy * coarse.w + ix) * 3 + c] * (1 - tx) + coarse.C[(iy * coarse.w + ix1) * 3 + c] * tx) * (1 - ty)
          + (coarse.C[(iy1 * coarse.w + ix) * 3 + c] * (1 - tx) + coarse.C[(iy1 * coarse.w + ix1) * 3 + c] * tx) * ty;
        fine.C[k * 3 + c] = fine.C[k * 3 + c] * wk + v * (1 - wk);
      }
      fine.Wt[k] = 1;
    }
  }
  return levels[0].C;
}

// Push-pull gives the right colour but no texture; borrow the paper grain from a nearby
// text-free spot and shift it to the local colour.
function inpaint(rgb, hole, W, H) {
  const smooth = pushPull(rgb, hole, W, H);
  const low = boxBlur(smooth, W, H, 6, 3);
  const avoid = dilate(hole, W, H, 3);
  // Lines of text run horizontally, so paper directly above/below is the best donor; try those first.
  const angles = [90, 270, 60, 120, 240, 300, 30, 150, 210, 330, 0, 180];
  const offsets = [];
  for (const d of [26, 40, 56, 74, 96, 124]) for (const deg of angles) {
    const t = (deg / 180) * Math.PI;
    offsets.push([Math.round(Math.cos(t) * d), Math.round(Math.sin(t) * d)]);
  }
  const out = Uint8ClampedArray.from(rgb);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!hole[i]) continue;
    let src = -1;
    for (const [dx, dy] of offsets) {
      const sx = x + dx, sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const j = sy * W + sx;
      if (avoid[j]) continue;
      // Only borrow from paper of a similar tone (never from flowers or frame ornaments).
      const dl = Math.abs(low[j * 3] - low[i * 3]) + Math.abs(low[j * 3 + 1] - low[i * 3 + 1]) + Math.abs(low[j * 3 + 2] - low[i * 3 + 2]);
      if (dl < 22) { src = j; break; }
    }
    for (let c = 0; c < 3; c++) {
      out[i * 3 + c] = src < 0 ? smooth[i * 3 + c] : rgb[src * 3 + c] - low[src * 3 + c] + low[i * 3 + c];
    }
  }
  return out;
}

// ── per page ────────────────────────────────────────────────────────────────────
const CORE_GROW = 3; // px around the ink that is rebuilt on the plate
const LAYER_GROW = 6; // px of original paper kept around the ink on the text layer (fully opaque over the rebuilt area)

export function analysePage(rgb, W, H, layout) {
  const lines = layout.text.map((line) => {
    const ink = inkMask(rgb, W, H, line);
    const hole = dilate(ink, W, H, CORE_GROW);
    const support = dilate(ink, W, H, LAYER_GROW);
    const soft = boxBlur(Float32Array.from(support), W, H, 2);
    const alpha = new Uint8Array(W * H);
    let x0 = W, y0 = H, x1 = -1, y1 = -1, count = 0;
    for (let i = 0; i < W * H; i++) {
      const a = hole[i] ? 255 : Math.round(Math.min(1, soft[i] * 1.6) * 255) * support[i];
      if (a < 6) continue;
      alpha[i] = a;
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      count++;
    }
    return { ...line, ink, hole, alpha, bbox: count ? [x0, y0, x1 + 1, y1 + 1] : null };
  });
  const hole = new Uint8Array(W * H);
  for (const l of lines) for (let i = 0; i < W * H; i++) if (l.hole[i]) hole[i] = 1;
  return { lines, hole };
}

// Rebuild the paper under the text: first from sibling pages that share the same background,
// then by inpainting whatever is left.
export function buildPlate(rgb, W, H, hole, siblings = []) {
  const remaining = Uint8Array.from(hole);
  const out = Uint8ClampedArray.from(rgb);
  for (let i = 0; i < W * H; i++) {
    if (!remaining[i]) continue;
    // Ink is always darker than the paper, so the lightest sibling pixel is the bare background.
    let best = null, bestLum = -1;
    for (const sib of siblings) {
      if (sib.hole[i]) continue;
      const l = lum(sib.rgb, i * 3);
      if (l > bestLum) { bestLum = l; best = sib.rgb; }
    }
    if (!best) continue;
    out[i * 3] = best[i * 3]; out[i * 3 + 1] = best[i * 3 + 1]; out[i * 3 + 2] = best[i * 3 + 2];
    remaining[i] = 0;
  }
  let left = 0;
  for (let i = 0; i < W * H; i++) left += remaining[i];
  return left ? inpaint(out, remaining, W, H) : out;
}

// RGBA buffer of one line, cropped to its bounding box.
export function lineLayer(rgb, W, line) {
  const [x0, y0, x1, y1] = line.bbox;
  const w = x1 - x0, h = y1 - y0;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y + y0) * W + (x + x0), o = (y * w + x) * 4;
    buf[o] = rgb[i * 3]; buf[o + 1] = rgb[i * 3 + 1]; buf[o + 2] = rgb[i * 3 + 2]; buf[o + 3] = line.alpha[i];
  }
  return { buf, w, h };
}

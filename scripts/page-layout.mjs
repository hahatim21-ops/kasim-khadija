// Measurements of the artwork, in % of the 9:16 stage (x across, y down).
//
// leaf  – the paper page (or the cover board) that turns: [left = spine, top, right, bottom].
// text  – one entry per animated line, in reading/animation order. Each box only needs to contain
//         its line and avoid florals; the text itself is picked out by colour inside the box.
//         kind: caps (fade + rise), title, script (written left→right), arabic (written right→left),
//               logo (the cover monogram, written right→left, then a gold glint).
//         ellipse: limit the box to an ellipse [cx, cy, rx, ry] (the oval frame on the cover).
//         exclude: rectangles inside the box to ignore (florals that reach into it).
//         Boxes may overlap: ink caught by two lines is identical in both layers.
//         delta: how much darker than the paper a pixel must be to count as ink (default 40).
//         minRG: require red to exceed green by this much (keeps green leaves out of pink script).
// Pages in the same `group` share an identical background, so their text holes are refilled
// from each other instead of being inpainted.

const OPEN_BOOK = [7.4, 13.7, 92.8, 84.5]; // Bismillah and Awaiting template
const BOW_BOOK = [5.5, 11.2, 93.3, 83.5]; // Invitation, Nikah and Reception template

export const PAGE_LAYOUT = {
  '01-cover': {
    leaf: [15.2, 14.5, 96.2, 86.0],
    text: [{ box: [42, 39.3, 70, 58.5], ellipse: [55.75, 49.2, 14.1, 9.8], kind: 'logo', delta: 60 }],
  },
  '02-bismillah': {
    leaf: OPEN_BOOK,
    text: [
      { box: [33, 27.5, 72.5, 33], kind: 'arabic' },
      { box: [40, 34.5, 63, 54.5], kind: 'arabic' },
      { box: [24, 55, 83, 63.5], kind: 'arabic' },
    ],
  },
  '03-invitation': {
    leaf: BOW_BOOK,
    group: 'bow',
    text: [
      { box: [36, 27.8, 88.5, 31.2], kind: 'caps' },
      { box: [47, 31.2, 77, 34.3], kind: 'caps' },
      { box: [35, 34.3, 89, 38.0], kind: 'caps' },
      { box: [32, 38.0, 81, 49.0], kind: 'script' },
      { box: [34, 47.4, 65.5, 51.8], kind: 'caps' },
      { box: [65.5, 47.8, 78, 52.2], kind: 'script' },
      { box: [31.2, 52.2, 80, 64], kind: 'script', minRG: 25 },
      { box: [33, 60.6, 67, 65.2], kind: 'caps' },
    ],
  },
  '04-nikah': {
    leaf: BOW_BOOK,
    group: 'bow',
    text: [
      { box: [38, 27.5, 80, 39.2], kind: 'title', delta: 32 },
      { box: [35, 39.4, 82, 43.7], kind: 'caps' },
      { box: [37, 43.7, 79, 47.0], kind: 'caps' },
      { box: [41, 47.2, 76, 50.4], kind: 'caps' },
      { box: [34, 50.6, 81, 53.8], kind: 'caps' },
      { box: [45, 53.8, 69, 56.6], kind: 'caps' },
      { box: [48, 56.8, 66, 60.2], kind: 'caps' },
      { box: [35, 60.4, 79, 63.4], kind: 'caps' },
      { box: [43, 63.4, 72, 66.6], kind: 'caps' },
    ],
  },
  '05-reception': {
    leaf: BOW_BOOK,
    group: 'bow',
    text: [
      { box: [36, 27.5, 87, 39.2], kind: 'title', delta: 32 },
      { box: [31, 39.4, 85.5, 43.7], kind: 'caps' },
      { box: [37, 43.7, 79, 47.0], kind: 'caps' },
      { box: [40, 47.6, 78, 51.4], kind: 'caps' },
      { box: [36, 51.6, 80, 54.8], kind: 'caps' },
      { box: [48, 55.0, 66, 58.7], kind: 'caps' },
      { box: [34, 59.0, 78, 62.4], kind: 'caps' },
      { box: [31, 62.4, 79, 66.2], kind: 'caps' },
    ],
  },
  '06-awaiting': {
    leaf: OPEN_BOOK,
    text: [
      { box: [25, 41.4, 81, 45.0], kind: 'caps' },
      { box: [20.5, 45.0, 85, 58.6], kind: 'script', delta: 52, minRG: 40, exclude: [[15, 53.6, 24.2, 60], [15, 44, 22.8, 50.3]] },
    ],
  },
};

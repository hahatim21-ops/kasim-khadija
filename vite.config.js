import { defineConfig } from 'vite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './src/config.js';
import { SIZES } from './src/sizes.js';

const songFile = CONFIG.music.src && path.join('public', CONFIG.music.src);
const hasSong = !!songFile && fs.existsSync(songFile);
const fingerprint = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);

// The curtain preload in index.html must use the same fingerprinted URLs as the page.
function curtainSrcset() {
  const m = JSON.parse(fs.readFileSync('src/images.json', 'utf8'))[CONFIG.curtain];
  return m.widths.map((w) => `${m.files[w]} ${w}w`).join(', ');
}

export default defineConfig({
  define: {
    // Only request the song if it is actually in public/ (a missing file would log a 404).
    __HAS_MUSIC__: JSON.stringify(hasSong),
    // Changes whenever the song file changes, so a replaced song is never served from cache.
    __MUSIC_VERSION__: JSON.stringify(hasSong ? fingerprint(songFile) : ''),
  },
  plugins: [
    {
      name: 'inject-page-values',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html
          .replaceAll('__SITE_URL__', CONFIG.siteUrl.replace(/\/+$/, ''))
          .replaceAll('__CURTAIN_SRCSET__', curtainSrcset())
          .replaceAll('__IMAGE_SIZES__', SIZES),
      },
    },
  ],
  build: {
    target: ['es2020', 'safari15', 'chrome90'],
    cssTarget: ['safari15', 'chrome90'],
    assetsInlineLimit: 0,
  },
});

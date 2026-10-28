import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './src/config.js';

export default defineConfig({
  define: {
    // Only request the song if it is actually in public/ (a missing file would log a 404).
    __HAS_MUSIC__: JSON.stringify(!!CONFIG.music.src && fs.existsSync(path.join('public', CONFIG.music.src))),
  },
  plugins: [
    {
      name: 'inject-site-url',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replaceAll('__SITE_URL__', CONFIG.siteUrl.replace(/\/+$/, '')),
      },
    },
  ],
  build: {
    target: ['es2020', 'safari15', 'chrome90'],
    cssTarget: ['safari15', 'chrome90'],
    assetsInlineLimit: 0,
  },
});

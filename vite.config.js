import { defineConfig } from 'vite';
import fs from 'node:fs';
import { CONFIG } from './src/config.js';

export default defineConfig({
  define: {
    // Use public/images/bow.png instead of the SVG bow when the file exists.
    __BOW_PNG__: JSON.stringify(fs.existsSync('public/images/bow.png')),
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

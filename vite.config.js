import { defineConfig } from 'vite';
import { CONFIG } from './src/config.js';

export default defineConfig({
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

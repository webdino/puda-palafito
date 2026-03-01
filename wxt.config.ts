import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

export default defineConfig({
  vite: () => ({
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  }),
  browser: 'chrome',
  manifestVersion: 3,
  srcDir: 'src',
  outDir: '.output',
  manifest: {
    name: 'Puda Palafito',
    version: '0.1.0',
    description: 'Chrome-first browser extension scaffold with WXT + React + TypeScript',
    permissions: ['storage'],
    host_permissions: ['<all_urls>'],
    browser_specific_settings: {
      gecko: {
        id: 'puda-palafito@example.com',
      },
    },
  },
});

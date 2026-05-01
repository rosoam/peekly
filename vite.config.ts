import { defineConfig } from 'vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Peekly',
  version: '0.3.0',
  description:
    'Hold Y and click to peek at any React component, DOM element, or CSS. Hold Y + X for the contextual tooltip — on any site.',
  homepage_url: 'https://github.com/rosoam/peekly',
  icons: {
    16: 'icons/16.png',
    32: 'icons/32.png',
    48: 'icons/48.png',
    128: 'icons/128.png',
  },
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'Peekly',
    default_icon: {
      16: 'icons/16.png',
      32: 'icons/32.png',
    },
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/main.ts'],
      run_at: 'document_start',
      all_frames: true,
    },
    {
      matches: ['<all_urls>'],
      js: ['src/injected/bridge.ts'],
      run_at: 'document_start',
      world: 'MAIN',
      all_frames: true,
    },
  ],
  permissions: ['storage', 'activeTab'],
  host_permissions: ['<all_urls>'],
});

export default defineConfig({
  plugins: [crx({ manifest })],
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5174 },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
      },
    },
  },
});

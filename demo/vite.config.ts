import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React plugin enables the JSX dev transform which sets `_debugSource`
// on every fiber — that's what makes Peekly's "Open in editor" button work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
});

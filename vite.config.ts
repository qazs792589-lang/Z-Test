import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

import fs from 'fs';

try {
  fs.copyFileSync("C:\\Users\\林祐任\\.gemini\\antigravity\\brain\\088bd3aa-6440-4e27-9790-271008c0996b\\media__1777351232764.png", path.resolve(__dirname, 'public', 'logo.png'));
  fs.copyFileSync("C:\\Users\\林祐任\\.gemini\\antigravity\\brain\\088bd3aa-6440-4e27-9790-271008c0996b\\z_ledger_light_logo_1777376796681.png", path.resolve(__dirname, 'public', 'logo-light.png'));
} catch (e) {
  console.error("Failed to copy logo:", e);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/Z-Money-/',
    build: {
      outDir: 'dist',
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

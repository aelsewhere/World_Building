import { defineConfig } from 'vite';

// Relative asset paths, so the built site works from any folder or host
// (including the published claude.ai page, see scripts/build-artifact.mjs).
export default defineConfig({
  base: './',
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The backend persists every exam attempt here. Reloading the renderer
    // when this runtime data changes resets the in-memory student exam route.
    watch: {
      ignored: ['**/server/vigilexam_store.json'],
    },
  }
});

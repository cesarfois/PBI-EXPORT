import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      // Proxy for DocuWare Platform API
      '/DocuWare': {
        target: 'http://localhost:3001', // Forward to local dynamic proxy
        changeOrigin: true,
        secure: false,
      },
      // Proxy for Identity Service (login)
      '/docuware-proxy': {
        target: 'http://localhost:3001', // Forward to local dynamic proxy
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fetch from 'node-fetch';

export default defineConfig({
 plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      // Aliases para pacotes three.js
      'three/examples/jsm/': new URL('./node_modules/three/examples/jsm/', import.meta.url).pathname,
    }
  },
  optimizeDeps: {
    include: ['three', 'chess.js', 'gsap']
  },
  server: {
    proxy: {
      '/asset': {
        target: 'https://github.com/YZhLu/chess3d/releases/download/Asset',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Accept', 'application/octet-stream');
          });
          proxy.on('proxyRes', async (proxyRes, req, res) => {
            if (proxyRes.statusCode === 302) {
              const redirectUrl = proxyRes.headers.location;
              try {
                if (!redirectUrl) {
                  throw new Error('Redirect URL is undefined');
                }
                const response = await fetch(redirectUrl);
                const data = await response.arrayBuffer();
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(Buffer.from(data));
              } catch (error) {
                console.error('Error fetching from redirect:', error);
                res.statusCode = 500;
                res.end();
              }
            }
          });
        },
      },
    },
  },
});
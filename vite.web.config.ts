import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    plugins: [react()],
    root: 'src/renderer',
    build: {
        outDir: '../../dist-web',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                    'tiptap': ['@tiptap/react', '@tiptap/starter-kit'],
                    'yjs': ['yjs', 'y-webrtc', 'y-indexeddb'],
                    'vendor': ['react', 'react-dom', 'react-router-dom'],
                }
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
        },
    },
});
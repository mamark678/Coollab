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
                    'framer-motion': ['framer-motion'],
                    'icons': ['lucide-react'],
                    'vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
        },
    },
});
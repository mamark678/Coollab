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
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
        },
    },
});
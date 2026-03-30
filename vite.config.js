import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                servicios: resolve(__dirname, 'servicios.html'),
                'under-construction': resolve(__dirname, 'under-construction/index.html'),
            },
        },
    },
})

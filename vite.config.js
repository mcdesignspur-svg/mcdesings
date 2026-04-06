import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                servicios: resolve(__dirname, 'servicios.html'),
                contacto: resolve(__dirname, 'contacto.html'),
                portfolio: resolve(__dirname, 'portfolio.html'),
                'under-construction': resolve(__dirname, 'under-construction/index.html'),
            },
        },
    },
})

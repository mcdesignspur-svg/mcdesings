import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                servicios: resolve(__dirname, 'servicios.html'),
                contacto: resolve(__dirname, 'contacto.html'),
                'case-study-teamdrita': resolve(__dirname, 'case-study-teamdrita.html'),
                'case-study-mcpromo': resolve(__dirname, 'case-study-mcpromo.html'),
                'case-study-beboutique': resolve(__dirname, 'case-study-beboutique.html'),
                'automation-content-generator': resolve(__dirname, 'automation-content-generator.html'),
            },
        },
    },
})

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
                about: resolve(__dirname, 'about.html'),
                recursos: resolve(__dirname, 'recursos.html'),
                automation: resolve(__dirname, 'automation-content-generator.html'),
                csbeboutique: resolve(__dirname, 'case-study-beboutique.html'),
                csmcpromo: resolve(__dirname, 'case-study-mcpromo.html'),
                csteamdrita: resolve(__dirname, 'case-study-teamdrita.html'),
                guiaProspecting: resolve(__dirname, 'guia-prospecting-ai.html'),
                guiaConfiguracion: resolve(__dirname, 'guia-configuracion-claude-code.html'),
                guiaMigracion: resolve(__dirname, 'guia-migracion-claude.html'),
            },
        },
    },
})

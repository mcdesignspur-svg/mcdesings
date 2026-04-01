/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './*.html',
        './assets/**/*.js',
    ],
    theme: {
        extend: {
            colors: {
                black: '#000000',
                slate: {
                    900: '#0B0D12',
                    800: '#14171E',
                    700: '#1A1E27',
                },
                accentsBlue: '#4DA6FF',
                darkPanel: '#07080B',
                offWhite: '#F3F4F6',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                heading: ['Anton', 'Impact', 'sans-serif-condensed', 'sans-serif'],
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
    ],
}

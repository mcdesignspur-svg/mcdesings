import { translations } from './content.js';

document.addEventListener('DOMContentLoaded', () => {
    // Default to Spanish
    let currentLang = localStorage.getItem('mcdesigns_lang') || 'es';

    function updateContent(lang) {
        const content = translations[lang];

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const keys = key.split('.');
            let value = content;
            keys.forEach(k => { if (value) value = value[k]; });
            if (value !== undefined && value !== null && typeof value === 'string') {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = value;
                } else if (element.tagName === 'IMG') {
                    element.alt = value;
                } else {
                    element.innerHTML = value;
                }
            }
        });

        // Update html lang attribute
        document.documentElement.lang = lang;

        // Update toggle pill display
        const esPill = document.getElementById('lang-es');
        const enPill = document.getElementById('lang-en');
        if (esPill && enPill) {
            if (lang === 'es') {
                esPill.classList.add('bg-primary', 'text-white');
                esPill.classList.remove('text-slate-500');
                enPill.classList.remove('bg-primary', 'text-white');
                enPill.classList.add('text-slate-500');
            } else {
                enPill.classList.add('bg-primary', 'text-white');
                enPill.classList.remove('text-slate-500');
                esPill.classList.remove('bg-primary', 'text-white');
                esPill.classList.add('text-slate-500');
            }
        }
    }

    function handleToggle(targetLang) {
        currentLang = targetLang;
        localStorage.setItem('mcdesigns_lang', currentLang);
        updateContent(currentLang);
    }

    // Bind ES button
    const esBtn = document.getElementById('lang-es');
    if (esBtn) esBtn.addEventListener('click', () => handleToggle('es'));

    // Bind EN button
    const enBtn = document.getElementById('lang-en');
    if (enBtn) enBtn.addEventListener('click', () => handleToggle('en'));

    // Initialize
    updateContent(currentLang);
});

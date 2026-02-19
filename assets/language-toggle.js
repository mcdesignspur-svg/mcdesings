import { translations } from './content.js';

document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('lang-toggle');
    const toggleText = document.getElementById('lang-text');

    // Default to Spanish
    let currentLang = 'es';

    // Function to update content
    function updateContent(lang) {
        const content = translations[lang];

        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const keys = key.split('.');
            let value = content;

            keys.forEach(k => {
                if (value) value = value[k];
            });

            if (value) {
                // Check if it's an input placeholder or text content
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = value;
                } else if (element.tagName === 'IMG') {
                    element.alt = value;
                } else {
                    element.innerHTML = value; // Use innerHTML to allow for formatting
                }
            }
        });

        // Special handling for gradient text in Hero which is split
        // This relies on the structure: <span data-i18n="hero.headlinePrefix"></span> <span class="..." data-i18n="hero.headlineHighlight"></span>
        // The generic handler above handles this if we structure HTML correctly.
    }

    // Initialize
    updateContent(currentLang);
    updateToggleUI();

    // Toggle Event
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            currentLang = currentLang === 'es' ? 'en' : 'es';
            updateContent(currentLang);
            updateToggleUI();
        });
    }

    function updateToggleUI() {
        if (toggleText) {
            toggleText.textContent = currentLang.toUpperCase();
        }
        // Optional: specific styling for active state if needed
    }
});

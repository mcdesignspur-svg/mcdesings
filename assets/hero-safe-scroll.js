/**
 * Safe Hero Scroll Script
 * Updates CSS variables for background-position only.
 * No DOM manipulation or layout shifts.
 */

document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero');

    if (!heroSection) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let ticked = false;

    function updateGrid() {
        const scrollY = window.scrollY;
        const heroHeight = heroSection.offsetHeight;

        // Only animate if within view + buffer
        if (scrollY <= heroHeight * 1.2) {
            // Parallax movement (slow upward shift)
            // Cap movement at 20px
            const moveY = Math.min(scrollY * 0.2, 20);

            // Opacity fade out
            // Start fading after 50px, completely gone by 600px
            let opacity = 0.06;
            if (scrollY > 50) {
                const fadeProgress = (scrollY - 50) / 550;
                opacity = 0.06 * (1 - Math.min(Math.max(fadeProgress, 0), 1));
            }

            // Update CSS variables directly
            heroSection.style.setProperty('--grid-y', `-${moveY}px`);
            heroSection.style.setProperty('--grid-alpha', opacity.toFixed(4));
        }

        ticked = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticked) {
            window.requestAnimationFrame(updateGrid);
            ticked = true;
        }
    });

    // Initial call
    updateGrid();
});

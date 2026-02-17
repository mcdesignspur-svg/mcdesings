/**
 * Hero Grid Animation Script
 * Handles subtle parallax and fade-out effects for the hero background grid.
 */

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.hero-grid-overlay');
    const heroSection = document.getElementById('hero');

    if (!grid || !heroSection) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let lastScrollY = window.scrollY;
    let ticked = false;

    function updateGrid() {
        const scrollY = window.scrollY;
        const heroHeight = heroSection.offsetHeight;

        // Only animate if within view + buffer
        if (scrollY <= heroHeight * 1.2) {
            // Parallax movement (slow upward shift)
            // Move 1px for every ~4px scrolled (0.25 factor), capped at ~30px
            const translateY = scrollY * 0.25;

            // Opacity fade out
            // Start fading after 100px, completely gone by hero end
            let opacity = 0.6; // Base opacity from CSS
            if (scrollY > 100) {
                // Map scroll 100 -> heroHeight to opacity 0.6 -> 0
                const fadeProgress = (scrollY - 100) / (heroHeight - 100);
                opacity = 0.6 * (1 - Math.min(Math.max(fadeProgress, 0), 1));
            }

            // Apply transforms using translate3d for GPU acceleration
            grid.style.transform = `translate3d(0, -${translateY}px, 0)`;
            grid.style.opacity = opacity.toFixed(3);
        }

        lastScrollY = scrollY;
        ticked = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticked) {
            window.requestAnimationFrame(updateGrid);
            ticked = true;
        }
    });

    // Initial call to set state
    updateGrid();
});

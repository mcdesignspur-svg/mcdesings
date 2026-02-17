document.addEventListener('DOMContentLoaded', () => {
    // 1. Diagram Animations
    const observerOptions = {
        threshold: 0.2,
        rootMargin: "0px"
    };

    const diagramObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const container = entry.target;

                // Animate lines first
                const lines = container.querySelectorAll('.reveal-line');
                lines.forEach((line, index) => {
                    setTimeout(() => {
                        line.classList.add('active');
                    }, index * 100); // Stagger lines if multiple
                });

                // Animate nodes after lines
                const nodes = container.querySelectorAll('.reveal-node');
                const lineDuration = 600; // ms

                nodes.forEach((node, index) => {
                    setTimeout(() => {
                        node.classList.add('active');
                    }, lineDuration + (index * 150)); // Sequential fade-in
                });

                // Stop observing once triggered
                observer.unobserve(container);
            }
        });
    }, observerOptions);

    // Target the diagram containers
    const diagramContainers = document.querySelectorAll('[data-diagram-container]');
    diagramContainers.forEach(container => {
        diagramObserver.observe(container);
    });

    // 2. Optional: Add hover glow effect to cards if needed via JS (CSS handles most)
});

// ---- Card spotlight glow (Aceternity card-spotlight pattern) ----
function initSpotlight() {
    document.querySelectorAll('.spotlight-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--spotlight-x', `${e.clientX - rect.left}px`);
            card.style.setProperty('--spotlight-y', `${e.clientY - rect.top}px`);
        });
        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--spotlight-x', '-500px');
            card.style.setProperty('--spotlight-y', '-500px');
        });
    });
}

// ---- Word blur reveal on scroll (Aceternity animated-testimonials pattern) ----
function initWordBlur() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('word-blur-active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });

    document.querySelectorAll('[data-word-blur]').forEach(el => {
        const words = el.textContent.trim().split(' ');
        el.innerHTML = words
            .map((word, i) => `<span class="word-blur-item" style="animation-delay:${(i * 0.04).toFixed(2)}s">${word}</span>`)
            .join(' ');
        observer.observe(el);
    });
}

initSpotlight();
initWordBlur();

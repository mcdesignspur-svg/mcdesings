/* ============================================================
   MC DESIGNS — dither.js
   1) <canvas data-dither-field>: eclipse tramado (Bayer 8x8) que
      respira detrás del contenido. Se pausa fuera de pantalla y con
      la pestaña oculta; con prefers-reduced-motion pinta un solo frame.
   2) <img data-dither>: la imagen se muestra en 1-bit (Atkinson) y se
      revela a color con hover / foco del link que la contiene.
   Sin dependencias. Si falla o no hay JS, el sitio se ve igual sin
   las texturas.
   ============================================================ */
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const BAYER = [
        0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
        12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
        15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
    ].map(v => (v + 0.5) / 64);

    const cssRGB = (name, fallback) => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const parts = (raw || fallback).split(/[\s,]+/).map(Number);
        return parts.length >= 3 && parts.every(n => !Number.isNaN(n)) ? parts : fallback.split(' ').map(Number);
    };

    /* ---------------- 1) Campo eclipse ---------------- */
    function initField(canvas) {
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;
        const PX = Number(canvas.dataset.px || 3);           // tamaño del pixel dither en px CSS
        const intensity = Number(canvas.dataset.intensity || 1);
        const ink = cssRGB('--ink-rgb', '237 234 226');
        const accent = cssRGB('--accent-rgb', '124 147 255');

        let w = 0, h = 0, img = null, running = false, visible = true, raf = 0, last = 0;
        const t0 = performance.now();

        function resize() {
            const r = canvas.getBoundingClientRect();
            const nw = Math.max(1, Math.round(r.width / PX));
            const nh = Math.max(1, Math.round(r.height / PX));
            if (nw === w && nh === h) return;
            w = nw; h = nh;
            canvas.width = w; canvas.height = h;
            img = ctx.createImageData(w, h);
        }

        function draw(t) {
            if (!img) return;
            const d = img.data;
            const narrow = w * PX < 768;
            const cx = w * 0.5;
            const cy = h * Number(canvas.dataset.cy || 0.5);
            // En móvil el eclipse es más ancho que la pantalla: el borde queda
            // fuera y solo asoma el halo en las esquinas, nunca sobre el titular
            const R = (narrow ? w * 0.64 : Math.min(w * 0.36, h * 0.64)) * Number(canvas.dataset.r || 1);
            const edgeX = Math.max(1, w * 0.08), edgeY = Math.max(1, h * 0.14);
            // La luz orbita despacio detrás de la esfera
            const a = t * 0.00012 - 0.9;
            const lx = Math.cos(a), ly = Math.sin(a) * 0.65 - 0.35;
            const breathe = 0.9 + Math.sin(t * 0.0006) * 0.1;
            const aInk = Math.round(235 * intensity), aAcc = Math.round(215 * intensity);

            let i = 0;
            for (let y = 0; y < h; y++) {
                const dy = (y - cy) / R;
                const by = (y & 7) << 3;
                for (let x = 0; x < w; x++, i += 4) {
                    const dx = (x - cx) / R;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    let lum = 0;
                    if (dist > 0.0001) {
                        const nx = dx / dist, ny = dy / dist;
                        const facing = 0.5 + 0.5 * (nx * lx + ny * ly);   // 0..1 hacia la luz
                        if (dist < 1) {
                            // Borde iluminado (rim light): solo cerca del contorno
                            const z = Math.sqrt(1 - dist * dist);
                            lum = Math.pow(1 - z, 6) * (0.2 + 0.9 * facing * facing);
                        } else {
                            // Halo exterior que se apaga con la distancia
                            const fall = Math.exp(-(dist - 1) * 7);
                            lum = fall * (0.12 + 0.78 * Math.pow(facing, 2.2)) * breathe;
                        }
                    }
                    // Bordes del lienzo: se desvanecen tramados, sin cortes rectos
                    const ex = Math.min(1, x / edgeX, (w - 1 - x) / edgeX);
                    const ey = Math.min(1, y / edgeY, (h - 1 - y) / edgeY);
                    lum *= ex * ey;
                    const th = BAYER[by + (x & 7)];
                    if (lum > th) {
                        const hot = lum > 0.7;
                        const c = hot ? ink : accent;
                        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
                        d[i + 3] = hot ? aInk : aAcc;
                    } else {
                        d[i + 3] = 0;
                    }
                }
            }
            ctx.putImageData(img, 0, 0);
        }

        function frame(now) {
            raf = 0;
            if (!running) return;
            if (now - last > 1000 / 24) {             // 24 fps es suficiente para un dither
                last = now;
                draw(now - t0);
            }
            raf = requestAnimationFrame(frame);
        }

        function sync() {
            const shouldRun = visible && !document.hidden && !reduceMotion.matches;
            if (shouldRun && !running) {
                running = true;
                raf = requestAnimationFrame(frame);
            } else if (!shouldRun && running) {
                running = false;
                if (raf) cancelAnimationFrame(raf);
                raf = 0;
            }
            if (!shouldRun) draw(16000);             // frame fijo y bonito
        }

        resize();
        draw(16000);
        if ('ResizeObserver' in window) {
            new ResizeObserver(() => { resize(); if (!running) draw(16000); }).observe(canvas);
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(canvas);
        }
        document.addEventListener('visibilitychange', sync);
        reduceMotion.addEventListener?.('change', sync);
        canvas.classList.add('is-ready');
        sync();
    }

    /* ---------------- 2) Imágenes 1-bit ---------------- */
    function ditherImage(img) {
        if (img.dataset.ditherDone) return;
        const host = img.parentElement;
        if (!host || !img.naturalWidth) return;
        img.dataset.ditherDone = '1';

        const PX = Number(img.dataset.ditherPx || 2);
        const canvas = document.createElement('canvas');
        canvas.className = 'dither-img';
        canvas.setAttribute('aria-hidden', 'true');
        host.style.position = host.style.position || (getComputedStyle(host).position === 'static' ? 'relative' : '');
        host.appendChild(canvas);

        const ink = cssRGB('--ink-rgb', '237 234 226');
        const paper = cssRGB('--paper-rgb', '17 17 16');

        function render() {
            const bw = img.clientWidth, bh = img.clientHeight;
            if (!bw || !bh) return;
            const w = Math.max(1, Math.round(bw / PX)), h = Math.max(1, Math.round(bh / PX));
            canvas.style.left = img.offsetLeft + 'px';
            canvas.style.top = img.offsetTop + 'px';
            canvas.style.width = bw + 'px';
            canvas.style.height = bh + 'px';
            canvas.style.right = 'auto';
            canvas.style.bottom = 'auto';
            canvas.style.borderRadius = getComputedStyle(img).borderRadius;
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // object-fit: cover + object-position (top por defecto en el sitio)
            const iw = img.naturalWidth, ih = img.naturalHeight;
            const scale = Math.max(w / iw, h / ih);
            const sw = w / scale, sh = h / scale;
            const pos = getComputedStyle(img).objectPosition.split(' ');
            const fx = parseFloat(pos[0]) / 100 || 0.5;
            const fy = pos[1] && pos[1].includes('%') ? parseFloat(pos[1]) / 100 : 0;
            ctx.drawImage(img, (iw - sw) * fx, (ih - sh) * fy, sw, sh, 0, 0, w, h);

            let data;
            try { data = ctx.getImageData(0, 0, w, h); } catch (_) { canvas.remove(); return; }
            const d = data.data;
            const lum = new Float32Array(w * h);
            for (let i = 0, p = 0; p < lum.length; i += 4, p++) {
                // un poco de contraste para que el 1-bit lea bien
                const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
                lum[p] = Math.min(1, Math.max(0, (l - 0.5) * 1.25 + 0.52));
            }
            // Atkinson: difunde 6/8 del error → contraste "Mac clásico"
            const spread = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const p = y * w + x;
                    const on = lum[p] > 0.5;
                    const err = (lum[p] - (on ? 1 : 0)) / 8;
                    for (const [ox, oy] of spread) {
                        const nx = x + ox, ny = y + oy;
                        if (nx >= 0 && nx < w && ny < h) lum[ny * w + nx] += err;
                    }
                    const c = on ? ink : paper, i = p * 4;
                    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
                }
            }
            ctx.putImageData(data, 0, 0);
        }

        render();
        if ('ResizeObserver' in window) new ResizeObserver(render).observe(img);
    }

    function initImages() {
        const imgs = document.querySelectorAll('img[data-dither]');
        if (!imgs.length) return;
        const start = img => {
            // carga perezosa: solo cuando se acerca al viewport
            if (img.complete && img.naturalWidth) ditherImage(img);
            else img.addEventListener('load', () => ditherImage(img), { once: true });
        };
        if (!('IntersectionObserver' in window)) { imgs.forEach(start); return; }
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                io.unobserve(e.target);
                start(e.target);
            });
        }, { rootMargin: '300px' });
        imgs.forEach(img => io.observe(img));
    }

    function init() {
        document.querySelectorAll('canvas[data-dither-field]').forEach(c => {
            try { initField(c); } catch (err) { console.warn('dither field', err); }
        });
        try { initImages(); } catch (err) { console.warn('dither images', err); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

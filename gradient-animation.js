// Simplified TouchTexture class for button-sized canvases
class TouchTexture {
    constructor(size = 64) {
        this.size = size;
        this.width = this.height = this.size;
        this.maxAge = 64;
        this.radius = 0.25 * this.size;
        this.speed = 1 / this.maxAge;
        this.trail = [];
        this.last = null;
        this.initTexture();
    }

    initTexture() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.texture = new THREE.Texture(this.canvas);
    }

    update() {
        this.clear();
        let speed = this.speed;
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const point = this.trail[i];
            let f = point.force * speed * (1 - point.age / this.maxAge);
            point.x += point.vx * f;
            point.y += point.vy * f;
            point.age++;
            if (point.age > this.maxAge) {
                this.trail.splice(i, 1);
            } else {
                this.drawPoint(point);
            }
        }
        this.texture.needsUpdate = true;
    }

    clear() {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    addTouch(point) {
        let force = 0;
        let vx = 0;
        let vy = 0;
        const last = this.last;
        if (last) {
            const dx = point.x - last.x;
            const dy = point.y - last.y;
            if (dx === 0 && dy === 0) return;
            const dd = dx * dx + dy * dy;
            let d = Math.sqrt(dd);
            vx = dx / d;
            vy = dy / d;
            force = Math.min(dd * 20000, 2.0);
        }
        this.last = { x: point.x, y: point.y };
        this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
    }

    drawPoint(point) {
        const pos = {
            x: point.x * this.width,
            y: (1 - point.y) * this.height
        };

        let intensity = 1;
        if (point.age < this.maxAge * 0.3) {
            intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
        } else {
            const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
            intensity = -t * (t - 2);
        }
        intensity *= point.force;

        const radius = this.radius;
        let color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255
            }, ${intensity * 255}`;
        let offset = this.size * 5;
        this.ctx.shadowOffsetX = offset;
        this.ctx.shadowOffsetY = offset;
        this.ctx.shadowBlur = radius * 1;
        this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;

        this.ctx.beginPath();
        this.ctx.fillStyle = "rgba(255,0,0,1)";
        this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

// Button Gradient Animation class
class ButtonGradientAnimation {
    constructor(buttonElement) {
        this.button = buttonElement;
        this.canvas = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.mesh = null;
        this.clock = new THREE.Clock();
        this.touchTexture = new TouchTexture(64);
        this.isAnimating = false;
        this.mouse = { x: 0.5, y: 0.5 };

        // Subtle electric blue gradient with #2D5BFF base and white accent
        this.color1 = new THREE.Vector3(0.176, 0.357, 1.0); // #2D5BFF - base color
        this.color2 = new THREE.Vector3(1.0, 1.0, 1.0); // White - accent
        this.color3 = new THREE.Vector3(0.2, 0.4, 0.95); // Brighter electric blue - shadow

        this.init();
    }

    init() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'gradient-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.borderRadius = 'inherit';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '0';

        // Make button position relative if not already
        const position = window.getComputedStyle(this.button).position;
        if (position === 'static') {
            this.button.style.position = 'relative';
        }

        // Add depth shadow without outer glow
        this.button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)';

        // Add subtle transform for elevation
        this.button.style.transform = 'translateY(-2px)';
        this.button.style.transition = 'all 0.3s ease';

        // Ensure button text is above canvas
        const textNodes = this.button.childNodes;
        textNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                // Wrap text nodes in a span to apply z-index
                const span = document.createElement('span');
                span.style.position = 'relative';
                span.style.zIndex = '2';
                span.style.color = '#FFFFFF';
                span.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.7)';
                span.textContent = node.textContent;
                this.button.replaceChild(span, node);
            } else if (node.nodeType === Node.ELEMENT_NODE && node !== this.canvas) {
                // Ensure element children are above canvas
                node.style.position = 'relative';
                node.style.zIndex = '2';
                node.style.color = '#FFFFFF';
                node.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.7)';
            }
        });

        // Insert canvas as first child
        this.button.insertBefore(this.canvas, this.button.firstChild);

        // Setup Three.js
        this.setupThreeJS();

        // Add event listeners
        this.button.addEventListener('mouseenter', () => {
            this.startAnimation();
            // Enhance depth on hover without glow
            this.button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
            this.button.style.transform = 'translateY(-2px)';
        });
        this.button.addEventListener('mouseleave', () => {
            this.stopAnimation();
            // Reset to default depth shadow without glow
            this.button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
            this.button.style.transform = 'translateY(-2px)';
        });
        this.button.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.button.addEventListener('touchmove', (e) => this.onTouchMove(e));

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Initial render
        this.render();
    }

    setupThreeJS() {
        const rect = this.button.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.OrthographicCamera(
            width / -2,
            width / 2,
            height / 2,
            height / -2,
            0.1,
            1000
        );
        this.camera.position.z = 1;

        // Shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(width, height) },
                uColor1: { value: this.color1 }, // Electric blue
                uColor2: { value: this.color2 }, // White
                uColor3: { value: this.color3 }, // Black
                uTouchTexture: { value: this.touchTexture.texture },
                uSpeed: { value: 0.4 },
                uIntensity: { value: 0.6 }
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec3 uColor1; // Electric blue
        uniform vec3 uColor2; // White
        uniform vec3 uColor3; // Black
        uniform sampler2D uTouchTexture;
        uniform float uSpeed;
        uniform float uIntensity;
        
        varying vec2 vUv;
        
        void main() {
          vec2 uv = vUv;
          
          // Apply touch distortion
          vec4 touchTex = texture2D(uTouchTexture, uv);
          float vx = -(touchTex.r * 2.0 - 1.0);
          float vy = -(touchTex.g * 2.0 - 1.0);
          float intensity = touchTex.b;
          uv.x += vx * 0.3 * intensity;
          uv.y += vy * 0.3 * intensity;
          
          // Multiple animated gradient centers for more dynamic effect
          vec2 center1 = vec2(
            0.5 + sin(uTime * uSpeed * 0.4) * 0.3,
            0.5 + cos(uTime * uSpeed * 0.5) * 0.3
          );
          vec2 center2 = vec2(
            0.5 + cos(uTime * uSpeed * 0.6) * 0.4,
            0.5 + sin(uTime * uSpeed * 0.45) * 0.4
          );
          vec2 center3 = vec2(
            0.5 + sin(uTime * uSpeed * 0.35) * 0.35,
            0.5 + cos(uTime * uSpeed * 0.55) * 0.35
          );
          
          float dist1 = length(uv - center1);
          float dist2 = length(uv - center2);
          float dist3 = length(uv - center3);
          
          float influence1 = 1.0 - smoothstep(0.0, 0.7, dist1);
          float influence2 = 1.0 - smoothstep(0.0, 0.6, dist2);
          float influence3 = 1.0 - smoothstep(0.0, 0.8, dist3);
          
          // Create subtle, even gradient blend
          vec3 color = uColor1 * 0.85;
          
          // Add gentle variations
          color = mix(color, uColor2, influence1 * 0.15);
          color = mix(color, uColor3, influence2 * 0.1);
          color = mix(color, uColor1, influence3 * 0.2);
          
          // Add subtle animated wave for movement
          float wave = sin(dist1 * 10.0 - uTime * 2.0) * 0.08;
          color += uColor1 * wave;
          
          color = clamp(color * uIntensity, vec3(0.0), vec3(1.0));
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
        });

        // Mesh
        const geometry = new THREE.PlaneGeometry(width, height);
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
    }

    onMouseMove(e) {
        const rect = this.button.getBoundingClientRect();
        this.mouse = {
            x: (e.clientX - rect.left) / rect.width,
            y: 1 - (e.clientY - rect.top) / rect.height
        };
        this.touchTexture.addTouch(this.mouse);
    }

    onTouchMove(e) {
        const touch = e.touches[0];
        const rect = this.button.getBoundingClientRect();
        this.mouse = {
            x: (touch.clientX - rect.left) / rect.width,
            y: 1 - (touch.clientY - rect.top) / rect.height
        };
        this.touchTexture.addTouch(this.mouse);
    }

    startAnimation() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }

    stopAnimation() {
        this.isAnimating = false;
    }

    animate() {
        if (!this.isAnimating) return;

        this.render();
        requestAnimationFrame(() => this.animate());
    }

    render() {
        const delta = this.clock.getDelta();

        // Update touch texture
        this.touchTexture.update();

        // Update time uniform
        if (this.mesh && this.mesh.material.uniforms.uTime) {
            this.mesh.material.uniforms.uTime.value += delta;
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const rect = this.button.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        if (this.renderer) {
            this.renderer.setSize(width, height);
        }

        if (this.camera) {
            this.camera.left = width / -2;
            this.camera.right = width / 2;
            this.camera.top = height / 2;
            this.camera.bottom = height / -2;
            this.camera.updateProjectionMatrix();
        }

        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.geometry = new THREE.PlaneGeometry(width, height);
            this.mesh.material.uniforms.uResolution.value.set(width, height);
        }
    }
}

// Initialize gradient animations on all buttons with data-gradient-button attribute
function initGradientButtons() {
    const buttons = document.querySelectorAll('[data-gradient-button]');
    buttons.forEach(button => {
        new ButtonGradientAnimation(button);
    });
}

// Wait for Three.js to load, then initialize
if (typeof THREE !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGradientButtons);
    } else {
        initGradientButtons();
    }
} else {
    console.error('Three.js library not loaded. Please include Three.js before gradient-animation.js');
}

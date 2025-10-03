class HorrorGlitchOverlay {
    constructor() {
        this.overlay = null;
        this.canvas = null;
        this.gl = null;
        this.isTransitioning = false;
        this.transitionDuration = 1.5; // 1.5 seconds
        this.startTime = 0;
        this.progress = 0;

        // Shader program and textures
        this.program = null;
        this.noiseTexture = null;
        this.bloodTexture = null;

        this.init();
    }

    init() {
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'glitch-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 100;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';

        this.overlay.appendChild(this.canvas);
        document.body.appendChild(this.overlay);

        // Initialize WebGL
        try {
            this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
            if (this.gl) {
                this.setupWebGL();
                console.log('✅ Horror Glitch Overlay initialized');
            } else {
                console.warn('⚠️ WebGL not supported, glitch overlay disabled');
            }
        } catch (error) {
            console.warn('⚠️ WebGL initialization failed:', error);
        }

        // Handle resize
        window.addEventListener('resize', () => this.handleResize());
    }

    setupWebGL() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_progress;
            uniform sampler2D u_noiseTexture;
            uniform sampler2D u_bloodTexture;
            varying vec2 v_texCoord;

            // GlitchMemories transition adapted for Halloween overlay
            vec4 transition(vec2 p) {
                vec2 block = floor(p.xy / vec2(16));
                vec2 uv_noise = block / vec2(64);
                uv_noise += floor(vec2(u_progress) * vec2(1200.0, 3500.0)) / vec2(64);
                vec2 dist = u_progress > 0.0 ? (fract(uv_noise) - 0.5) * 0.3 * (1.0 - u_progress) : vec2(0.0);
                vec2 red = p + dist * 0.2;
                vec2 green = p + dist * .3;
                vec2 blue = p + dist * .5;

                return vec4(
                    mix(texture2D(u_noiseTexture, red).r, texture2D(u_noiseTexture, red).r, u_progress).r,
                    mix(texture2D(u_noiseTexture, green).g, texture2D(u_noiseTexture, green).g, u_progress).g,
                    mix(texture2D(u_noiseTexture, blue).b, texture2D(u_noiseTexture, blue).b, u_progress).b,
                    1.0
                );
            }

            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            void main() {
                vec2 uv = v_texCoord;
                vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

                if (u_progress > 0.0) {
                    // Apply the GlitchMemories transition effect
                    vec4 glitchColor = transition(uv);

                    // Intensity peaks in middle of transition
                    float glitchIntensity = sin(u_progress * 3.14159) * 2.0;

                    // Use the glitch transition as base
                    color = glitchColor * glitchIntensity * 0.3;

                    // Add horror elements
                    // Digital static
                    float noise = random(uv + u_time * 100.0);
                    if (noise > 0.97) {
                        color += vec4(1.0, 1.0, 1.0, 0.8 * glitchIntensity * 0.5);
                    }

                    // Blood drips with glitch distortion
                    vec2 bloodUV = vec2(uv.x, uv.y + u_time * 0.2);
                    // Apply same block distortion to blood
                    vec2 block = floor(bloodUV * vec2(16.0));
                    vec2 bloodNoise = block / vec2(64.0);
                    bloodNoise += floor(vec2(u_progress) * vec2(800.0, 2000.0)) / vec2(64.0);
                    vec2 bloodDist = u_progress > 0.0 ? (fract(bloodNoise) - 0.5) * 0.2 : vec2(0.0);
                    bloodUV += bloodDist;

                    vec4 bloodSample = texture2D(u_bloodTexture, bloodUV);
                    if (bloodSample.r > 0.7) {
                        color += vec4(0.4, 0.0, 0.0, bloodSample.r * glitchIntensity * 0.4);
                    }

                    // Scan lines with glitch blocks
                    float scanline = sin(uv.y * 800.0 + u_time * 20.0 + glitchIntensity * 10.0);
                    if (scanline > 0.98) {
                        color += vec4(0.0, 0.0, 0.0, glitchIntensity * 0.4);
                    }

                    // Vignette darkening
                    vec2 center = uv - 0.5;
                    float vignette = 1.0 - dot(center, center) * (2.0 + glitchIntensity * 0.5);
                    color.rgb *= max(0.2, vignette);

                    // Make sure alpha builds up properly for overlay effect
                    color.a = min(1.0, color.a + glitchIntensity * 0.3);
                }

                gl_FragColor = color;
            }
        `;

        // Compile shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);

        // Get locations
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
        this.timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
        this.progressLocation = this.gl.getUniformLocation(this.program, 'u_progress');
        this.noiseTextureLocation = this.gl.getUniformLocation(this.program, 'u_noiseTexture');
        this.bloodTextureLocation = this.gl.getUniformLocation(this.program, 'u_bloodTexture');

        // Setup geometry
        this.setupGeometry();
        this.generateTextures();
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    setupGeometry() {
        const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
        const texCoords = [0, 1, 1, 1, 0, 0, 1, 0];

        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
    }

    generateTextures() {
        // Noise texture
        const noiseSize = 256;
        const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
        for (let i = 0; i < noiseSize * noiseSize; i++) {
            const noise = Math.random() * 255;
            noiseData[i * 4] = noise;
            noiseData[i * 4 + 1] = noise;
            noiseData[i * 4 + 2] = noise;
            noiseData[i * 4 + 3] = 255;
        }

        this.noiseTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.noiseTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, noiseSize, noiseSize, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, noiseData);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // Blood texture
        const bloodSize = 256;
        const bloodData = new Uint8Array(bloodSize * bloodSize * 4);
        for (let y = 0; y < bloodSize; y++) {
            for (let x = 0; x < bloodSize; x++) {
                const i = (y * bloodSize + x) * 4;
                const dripNoise = Math.sin(x * 0.1) * 0.5 + 0.5;
                const verticalGrad = Math.pow(y / bloodSize, 1.5);
                const bloodValue = Math.min(1, dripNoise * verticalGrad + Math.random() * 0.2);

                bloodData[i] = bloodValue * 255;
                bloodData[i + 1] = 0;
                bloodData[i + 2] = 0;
                bloodData[i + 3] = 255;
            }
        }

        this.bloodTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bloodTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, bloodSize, bloodSize, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bloodData);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    async startTransition() {
        if (this.isTransitioning || !this.gl) return;

        console.log('🔥 Starting horror glitch overlay transition');
        this.isTransitioning = true;
        this.startTime = performance.now();
        this.progress = 0;

        // Show overlay
        this.overlay.style.opacity = '1';

        // Start render loop
        this.render();

        // Auto-complete after duration
        setTimeout(() => {
            this.endTransition();
        }, this.transitionDuration * 1000);
    }

    endTransition() {
        if (!this.isTransitioning) return;

        console.log('✨ Horror glitch overlay transition completed');
        this.isTransitioning = false;
        this.progress = 0;

        // Hide overlay
        this.overlay.style.opacity = '0';
    }

    render() {
        if (!this.isTransitioning || !this.gl) return;

        const currentTime = performance.now();
        const elapsed = (currentTime - this.startTime) / 1000;
        this.progress = Math.min(elapsed / this.transitionDuration, 1);

        // Setup viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Use program
        this.gl.useProgram(this.program);

        // Set uniforms
        this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.timeLocation, currentTime / 1000);
        this.gl.uniform1f(this.progressLocation, this.progress);

        // Bind textures
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.noiseTexture);
        this.gl.uniform1i(this.noiseTextureLocation, 0);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bloodTexture);
        this.gl.uniform1i(this.bloodTextureLocation, 1);

        // Setup attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Enable blending for overlay effect
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Draw
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        // Continue rendering if still transitioning
        if (this.isTransitioning) {
            requestAnimationFrame(() => this.render());
        }
    }

    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    dispose() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.gl) {
            this.gl.deleteTexture(this.noiseTexture);
            this.gl.deleteTexture(this.bloodTexture);
            this.gl.deleteBuffer(this.positionBuffer);
            this.gl.deleteBuffer(this.texCoordBuffer);
            this.gl.deleteProgram(this.program);
        }
    }
}
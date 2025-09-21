class VideoGlitchTransition {
    constructor(videoElement) {
        this.video = videoElement;
        this.canvas = null;
        this.gl = null;
        this.isTransitioning = false;

        // Textures for video frames
        this.currentFrameTexture = null;
        this.nextFrameTexture = null;

        // Transition state
        this.progress = 0;
        this.transitionDuration = 1.0; // 1 second
        this.startTime = 0;

        // Shader program
        this.program = null;

        this.init();
    }

    init() {
        // Create transition canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: absolute;
            pointer-events: none;
            z-index: 10;
            opacity: 0;
        `;

        // Add to video container
        const videoContainer = this.video.parentElement;
        videoContainer.appendChild(this.canvas);

        // Initialize WebGL
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            console.warn('WebGL not supported for video transitions');
            return;
        }

        this.setupWebGL();

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.isTransitioning) {
                this.resizeCanvas();
            }
        });

        console.log('✅ Video GlitchMemories transition initialized');
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
            uniform float progress;
            uniform sampler2D from;
            uniform sampler2D to;
            varying vec2 v_texCoord;

            // Pure GlitchMemories transition from GL-Transitions
            vec4 getFromColor(vec2 p) {
                return texture2D(from, p);
            }

            vec4 getToColor(vec2 p) {
                return texture2D(to, p);
            }

            vec4 transition(vec2 p) {
                vec2 block = floor(p.xy / vec2(16));
                vec2 uv_noise = block / vec2(64);
                uv_noise += floor(vec2(progress) * vec2(1200.0, 3500.0)) / vec2(64);
                vec2 dist = progress > 0.0 ? (fract(uv_noise) - 0.5) * 0.3 * (1.0 - progress) : vec2(0.0);
                vec2 red = p + dist * 0.2;
                vec2 green = p + dist * 0.3;
                vec2 blue = p + dist * 0.5;

                return vec4(
                    mix(getFromColor(red), getToColor(red), progress).r,
                    mix(getFromColor(green), getToColor(green), progress).g,
                    mix(getFromColor(blue), getToColor(blue), progress).b,
                    1.0
                );
            }

            void main() {
                gl_FragColor = transition(v_texCoord);
            }
        `;

        // Compile shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);

        // Get locations
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.progressLocation = this.gl.getUniformLocation(this.program, 'progress');
        this.fromTextureLocation = this.gl.getUniformLocation(this.program, 'from');
        this.toTextureLocation = this.gl.getUniformLocation(this.program, 'to');

        // Setup geometry
        this.setupGeometry();

        // Create textures
        this.currentFrameTexture = this.createVideoTexture();
        this.nextFrameTexture = this.createVideoTexture();
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

    createVideoTexture() {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        return texture;
    }

    captureCurrentFrame() {
        if (!this.video.videoWidth || !this.video.videoHeight) return;

        this.gl.bindTexture(this.gl.TEXTURE_2D, this.currentFrameTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.video);
        console.log('📸 Captured current video frame');
    }

    async prepareNextFrame(nextVideoSrc) {
        return new Promise((resolve) => {
            // Create a hidden video element to load the next video
            const nextVideo = document.createElement('video');
            nextVideo.muted = true;
            nextVideo.crossOrigin = 'anonymous';
            nextVideo.style.position = 'absolute';
            nextVideo.style.opacity = '0';
            nextVideo.style.pointerEvents = 'none';
            document.body.appendChild(nextVideo);

            nextVideo.addEventListener('loadeddata', () => {
                // Capture first frame
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextFrameTexture);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, nextVideo);

                // Clean up
                nextVideo.remove();
                console.log('📸 Captured next video frame');
                resolve();
            });

            nextVideo.addEventListener('error', () => {
                nextVideo.remove();
                console.error('Failed to load next video for transition');
                resolve();
            });

            nextVideo.src = nextVideoSrc;
        });
    }

    async startTransition(nextVideoSrc) {
        if (this.isTransitioning || !this.gl) return;

        console.log('🎬 Starting GlitchMemories transition');

        // Capture current frame
        this.captureCurrentFrame();

        // Prepare next frame
        await this.prepareNextFrame(nextVideoSrc);

        // Start transition
        this.isTransitioning = true;
        this.startTime = performance.now();
        this.progress = 0;

        // Resize canvas to match video display area
        this.resizeCanvas();

        // Show transition canvas
        this.canvas.style.opacity = '1';

        // Start render loop
        this.render();

        return new Promise((resolve) => {
            setTimeout(() => {
                this.endTransition();
                resolve();
            }, this.transitionDuration * 1000);
        });
    }

    render() {
        if (!this.isTransitioning) return;

        const currentTime = performance.now();
        this.progress = Math.min((currentTime - this.startTime) / (this.transitionDuration * 1000), 1);

        // Setup viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Use program
        this.gl.useProgram(this.program);

        // Set uniform
        this.gl.uniform1f(this.progressLocation, this.progress);

        // Bind textures
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.currentFrameTexture);
        this.gl.uniform1i(this.fromTextureLocation, 0);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextFrameTexture);
        this.gl.uniform1i(this.toTextureLocation, 1);

        // Setup attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Draw
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        // Continue rendering
        if (this.isTransitioning) {
            requestAnimationFrame(() => this.render());
        }
    }

    endTransition() {
        this.isTransitioning = false;
        this.progress = 0;
        this.canvas.style.opacity = '0';
        console.log('✨ GlitchMemories transition completed');
    }

    resizeCanvas() {
        if (!this.video.videoWidth || !this.video.videoHeight) {
            return;
        }

        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        const videoAspectRatio = this.video.videoWidth / this.video.videoHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let displayWidth, displayHeight;

        // Calculate actual video display dimensions with object-fit: contain
        if (videoAspectRatio > containerAspectRatio) {
            // Video is wider than container - width is constrained
            displayWidth = containerWidth;
            displayHeight = containerWidth / videoAspectRatio;
        } else {
            // Video is taller than container - height is constrained
            displayHeight = containerHeight;
            displayWidth = containerHeight * videoAspectRatio;
        }

        // Set canvas size to match video display area
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;

        // Center the canvas like the video
        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;
        this.canvas.style.left = '50%';
        this.canvas.style.top = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)';

        console.log(`📐 Transition canvas sized: ${displayWidth}x${displayHeight} (video: ${this.video.videoWidth}x${this.video.videoHeight})`);
    }

    dispose() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        if (this.gl) {
            this.gl.deleteTexture(this.currentFrameTexture);
            this.gl.deleteTexture(this.nextFrameTexture);
            this.gl.deleteBuffer(this.positionBuffer);
            this.gl.deleteBuffer(this.texCoordBuffer);
            this.gl.deleteProgram(this.program);
        }
    }
}
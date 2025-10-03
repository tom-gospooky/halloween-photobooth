class HorrorGlitchTransition {
    constructor(canvas, video) {
        this.canvas = canvas;
        this.video = video;
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        this.currentTexture = null;
        this.nextTexture = null;
        this.transitionProgress = 0;
        this.isTransitioning = false;
        this.transitionDuration = 2.0; // 2 seconds
        this.startTime = 0;

        // Noise texture for glitch effects
        this.noiseTexture = null;
        this.bloodTexture = null;

        this.init();
    }

    init() {
        this.gl.getExtension('OES_texture_float');

        // Compile shaders
        this.vertexShader = this.createShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
        this.fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderSource);
        this.program = this.createProgram(this.vertexShader, this.fragmentShader);

        // Get attribute and uniform locations
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');

        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
        this.timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
        this.transitionLocation = this.gl.getUniformLocation(this.program, 'u_transition');
        this.currentTextureLocation = this.gl.getUniformLocation(this.program, 'u_currentTexture');
        this.nextTextureLocation = this.gl.getUniformLocation(this.program, 'u_nextTexture');
        this.noiseTextureLocation = this.gl.getUniformLocation(this.program, 'u_noiseTexture');
        this.bloodTextureLocation = this.gl.getUniformLocation(this.program, 'u_bloodTexture');

        // Create buffers
        this.positionBuffer = this.gl.createBuffer();
        this.texCoordBuffer = this.gl.createBuffer();

        // Set up vertex data (full screen quad)
        this.setupGeometry();

        // Generate noise and blood textures
        this.generateNoiseTexture();
        this.generateBloodTexture();

        // Initial render
        this.render();
    }

    get vertexShaderSource() {
        return `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;

            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
    }

    get fragmentShaderSource() {
        return `
            precision mediump float;

            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_transition;
            uniform sampler2D u_currentTexture;
            uniform sampler2D u_nextTexture;
            uniform sampler2D u_noiseTexture;
            uniform sampler2D u_bloodTexture;

            varying vec2 v_texCoord;

            // Random function
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            // Noise function
            float noise(vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            // Glitch function for scary digital corruption
            vec2 glitchDisplace(vec2 uv, float intensity) {
                vec2 noiseUV = uv * 10.0 + u_time * 0.5;
                float n = texture2D(u_noiseTexture, noiseUV).r;

                // Create horizontal scan line effect
                float scanline = sin(uv.y * 800.0 + u_time * 20.0);
                float glitchStrength = smoothstep(0.98, 1.0, scanline) * intensity;

                // Random horizontal displacement
                float displacement = (n - 0.5) * glitchStrength * 0.1;

                return vec2(uv.x + displacement, uv.y);
            }

            // Blood drip effect
            vec4 bloodEffect(vec2 uv, float intensity) {
                vec2 bloodUV = vec2(uv.x, uv.y + u_time * 0.1);
                vec4 bloodSample = texture2D(u_bloodTexture, bloodUV);

                // Create dripping effect
                float drip = smoothstep(0.7, 1.0, bloodSample.r) * intensity;
                return vec4(0.3, 0.0, 0.0, drip * 0.8); // Dark red blood
            }

            // Static noise for old TV effect
            vec4 staticNoise(vec2 uv, float intensity) {
                float n = random(uv + u_time * 100.0);
                float staticAmount = smoothstep(0.9, 1.0, n) * intensity;
                return vec4(staticAmount, staticAmount, staticAmount, staticAmount * 0.3);
            }

            // Digital corruption effect
            vec4 digitalCorruption(vec2 uv, float intensity) {
                vec2 corruptUV = uv;

                // Create blocky corruption
                float blockSize = 0.02;
                vec2 blockUV = floor(uv / blockSize) * blockSize;
                float corruption = random(blockUV + floor(u_time * 10.0));

                if (corruption > 0.98 && intensity > 0.5) {
                    // Corrupt this block
                    corruptUV = blockUV + vec2(random(blockUV), random(blockUV + 1.0)) * blockSize;
                }

                return texture2D(u_currentTexture, corruptUV);
            }

            void main() {
                vec2 uv = v_texCoord;
                float transition = u_transition;

                // Apply glitch displacement based on transition progress
                float glitchIntensity = sin(transition * 3.14159) * 2.0; // Peak in middle of transition
                vec2 glitchedUV = glitchDisplace(uv, glitchIntensity);

                // Sample textures
                vec4 currentColor = texture2D(u_currentTexture, glitchedUV);
                vec4 nextColor = texture2D(u_nextTexture, glitchedUV);

                // Apply digital corruption to current texture
                if (transition > 0.3) {
                    currentColor = digitalCorruption(glitchedUV, transition);
                }

                // Create transition mask with scary effects
                float transitionMask = transition;

                // Add jagged edges to transition
                float jaggedNoise = noise(uv * 20.0 + u_time);
                transitionMask += (jaggedNoise - 0.5) * 0.2 * glitchIntensity;

                // Smooth transition between textures
                vec4 mixedColor = mix(currentColor, nextColor, smoothstep(0.0, 1.0, transitionMask));

                // Add horror effects
                vec4 bloodColor = bloodEffect(uv, glitchIntensity * 0.5);
                vec4 staticColor = staticNoise(uv, transition * 0.3);

                // Combine all effects
                vec4 finalColor = mixedColor;

                // Add blood drips during transition
                finalColor = mix(finalColor, finalColor + bloodColor, bloodColor.a);

                // Add static noise
                finalColor = mix(finalColor, finalColor + staticColor, staticColor.a);

                // Darken and desaturate during peak transition for horror effect
                if (glitchIntensity > 1.0) {
                    float desaturate = (glitchIntensity - 1.0) * 0.5;
                    float gray = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
                    finalColor.rgb = mix(finalColor.rgb, vec3(gray) * 0.3, desaturate);
                }

                // Add vignette effect
                vec2 center = uv - 0.5;
                float vignette = 1.0 - dot(center, center) * (1.0 + glitchIntensity * 0.5);
                finalColor.rgb *= vignette;

                gl_FragColor = vec4(finalColor.rgb, 1.0);
            }
        `;
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
        // Full screen quad
        const positions = [
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ];

        const texCoords = [
            0, 1,
            1, 1,
            0, 0,
            1, 0,
        ];

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
    }

    generateNoiseTexture() {
        const size = 256;
        const data = new Uint8Array(size * size * 4);

        for (let i = 0; i < size * size; i++) {
            const noise = Math.random() * 255;
            data[i * 4] = noise;     // R
            data[i * 4 + 1] = noise; // G
            data[i * 4 + 2] = noise; // B
            data[i * 4 + 3] = 255;   // A
        }

        this.noiseTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.noiseTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, size, size, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    generateBloodTexture() {
        const width = 256;
        const height = 256;
        const data = new Uint8Array(width * height * 4);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;

                // Create vertical drip patterns
                const dripNoise = Math.sin(x * 0.1) * 0.5 + 0.5;
                const verticalGrad = Math.pow(y / height, 2);
                const bloodValue = Math.min(1, dripNoise * verticalGrad + Math.random() * 0.3);

                data[i] = bloodValue * 255;     // R (blood intensity)
                data[i + 1] = 0;               // G
                data[i + 2] = 0;               // B
                data[i + 3] = 255;             // A
            }
        }

        this.bloodTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bloodTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    createVideoTexture(video) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Set parameters for video texture
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        return texture;
    }

    updateVideoTexture(texture, video) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video);
    }

    startTransition(currentVideo, nextVideo) {
        if (this.isTransitioning) return;

        this.isTransitioning = true;
        this.startTime = performance.now();
        this.transitionProgress = 0;

        // Create textures for both videos
        if (!this.currentTexture) {
            this.currentTexture = this.createVideoTexture(currentVideo);
        }
        if (!this.nextTexture) {
            this.nextTexture = this.createVideoTexture(nextVideo);
        }

        this.updateVideoTexture(this.currentTexture, currentVideo);
        this.updateVideoTexture(this.nextTexture, nextVideo);

        console.log('Horror glitch transition started');
    }

    update() {
        if (!this.isTransitioning) return;

        const currentTime = performance.now();
        const elapsed = (currentTime - this.startTime) / 1000; // Convert to seconds
        this.transitionProgress = Math.min(elapsed / this.transitionDuration, 1);

        if (this.transitionProgress >= 1) {
            this.isTransitioning = false;

            // Swap textures
            const temp = this.currentTexture;
            this.currentTexture = this.nextTexture;
            this.nextTexture = temp;

            console.log('Horror glitch transition completed');
        }
    }

    render() {
        // Resize canvas to match container
        this.resizeCanvas();

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (!this.program || !this.currentTexture) {
            requestAnimationFrame(() => this.render());
            return;
        }

        // Update video texture if video is playing
        if (this.video && this.video.readyState >= 2 && !this.video.paused) {
            this.updateVideoTexture(this.currentTexture, this.video);
        }

        this.gl.useProgram(this.program);

        // Set uniforms
        this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.timeLocation, performance.now() / 1000);
        this.gl.uniform1f(this.transitionLocation, this.transitionProgress);

        // Bind textures
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.currentTexture);
        this.gl.uniform1i(this.currentTextureLocation, 0);

        if (this.nextTexture) {
            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
            this.gl.uniform1i(this.nextTextureLocation, 1);
        }

        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.noiseTexture);
        this.gl.uniform1i(this.noiseTextureLocation, 2);

        this.gl.activeTexture(this.gl.TEXTURE3);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bloodTexture);
        this.gl.uniform1i(this.bloodTextureLocation, 3);

        // Set up attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Draw
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        // Update transition
        this.update();

        requestAnimationFrame(() => this.render());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setCurrentVideo(video) {
        if (!this.currentTexture) {
            this.currentTexture = this.createVideoTexture(video);
        }
        this.updateVideoTexture(this.currentTexture, video);
    }

    dispose() {
        if (this.gl) {
            this.gl.deleteTexture(this.currentTexture);
            this.gl.deleteTexture(this.nextTexture);
            this.gl.deleteTexture(this.noiseTexture);
            this.gl.deleteTexture(this.bloodTexture);
            this.gl.deleteBuffer(this.positionBuffer);
            this.gl.deleteBuffer(this.texCoordBuffer);
            this.gl.deleteProgram(this.program);
            this.gl.deleteShader(this.vertexShader);
            this.gl.deleteShader(this.fragmentShader);
        }
    }
}
// Neon smoke behind the hero: a small WebGL shader, no libraries.
// Renders at reduced resolution (smoke is soft anyway), pauses when the hero is
// off screen or the tab is hidden, and draws one still frame for reduced motion.
// If WebGL isn't available the canvas just stays empty.
(() => {
  const canvas = document.getElementById('smoke');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SCALE = finePointer ? 0.5 : 0.35; // render pixels per CSS pixel

  const vert = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const frag = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 res;
    uniform float time;
    uniform vec2 mouse;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / res.y;
      float t = time * 0.045;
      // Warp the noise by itself so it curls like smoke, drifting upward.
      vec2 q = vec2(fbm(uv * 1.5 + vec2(0.0, -t * 2.0)), fbm(uv * 1.5 + vec2(5.2, 1.3) + t));
      float s = fbm(uv * 1.7 + 2.4 * q + vec2(t * 0.5, -t * 2.6));

      vec3 purple = vec3(0.64, 0.39, 1.0);
      vec3 pink   = vec3(1.0, 0.15, 0.66);
      vec3 orange = vec3(1.0, 0.40, 0.07);
      vec3 col = mix(purple, pink, smoothstep(0.35, 0.8, q.x));
      col = mix(col, orange, smoothstep(0.6, 0.95, q.y) * 0.55);

      float a = smoothstep(0.42, 0.95, s) * 0.5;
      // Soft glow that follows the mouse.
      float glow = exp(-5.0 * length(uv - mouse / res.y));
      a += glow * 0.18 * smoothstep(0.3, 0.7, s);
      gl_FragColor = vec4(col * a, a);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'res');
  const uTime = gl.getUniformLocation(prog, 'time');
  const uMouse = gl.getUniformLocation(prog, 'mouse');

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(uRes, w, h);
  }

  // Mouse position in render pixels (y up), eased so the glow trails smoothly.
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  if (finePointer) {
    addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) * SCALE;
      mouse.ty = (r.bottom - e.clientY) * SCALE;
      if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    }, { passive: true });
  }

  let visible = true, frame = 0;
  const start = performance.now() - 20000; // start mid-drift so the first frame already looks like smoke
  function draw(now) {
    resize();
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('on');
  }
  // If a device can't keep up (slower than ~22 fps over the first 90 frames),
  // leave the current frame on screen as a still image instead of animating.
  let frames = 0, firstAt = 0, tooSlow = false;
  function loop(now) {
    frame = 0;
    if (!visible || document.hidden || tooSlow) return;
    draw(now);
    if (frames === 0) firstAt = now;
    if (++frames === 90 && (now - firstAt) / 89 > 45) { tooSlow = true; return; }
    frame = requestAnimationFrame(loop);
  }
  const run = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(loop); };

  if (reduceMotion) {
    draw(performance.now());
    addEventListener('resize', () => draw(performance.now()));
    return;
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(canvas);
  document.addEventListener('visibilitychange', run);
  run();
})();

// ============================================================
// River Hero — Phase 1: Flow Field
// 基于 river.ai 算法思路重写的精简版
// 现阶段：FBM 流动色场 + river.ai navy/aqua/cream 调色板
// 后续会加：ASCII 量化 / Bloom / 山谷 / 日出
// ============================================================

(function () {
  "use strict";

  const canvas = document.getElementById("heroCanvas");
  const loading = document.getElementById("loading");
  const hud = document.getElementById("hud");
  const hudStatus = document.getElementById("hudStatus");
  const hudGL = document.getElementById("hudGL");
  const hudFPS = document.getElementById("hudFPS");
  const hudRes = document.getElementById("hudRes");

  // ── WebGL 初始化 ──────────────────────────────────────────
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  }) || canvas.getContext("experimental-webgl");

  if (!gl) {
    loading.innerHTML = "WebGL 不可用 — 显示降级背景";
    hud.style.display = "block";
    hudStatus.innerHTML = '<span class="err">WebGL 不可用</span>';
    hudGL.textContent = "unsupported";
    return;
  }

  gl.getExtension("OES_standard_derivatives");
  const hasFBO = !!gl.getExtension("WEBGL_depth_texture");

  // ── 顶点着色器：全屏四边形 ──────────────────────────────────
  const VS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  // ── 片元着色器：流动河流色场 ──────────────────────────────────
  // 第一回合目标：让 navy/aqua/cream 三色调按 FBM 噪声流动起来
  // 学习自 river.ai 的算法思路：值噪声 + 多层叠加 + 河流强度场
  const FS = `#extension GL_OES_standard_derivatives : enable
  precision highp float;
  varying vec2 v_uv;
  uniform vec2  u_res;
  uniform float u_time;
  uniform vec2  u_mouse;
  uniform float u_intro;    // 0..1 入场进度

  // ─── 哈希噪声 ───
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float sq(float x) { return x * x; }

  // ─── 值噪声（双线性插值） ───
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // ─── FBM（分形布朗运动） ───
  // 模仿 river.ai 的 fbm：两层叠加 + 旋转
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + vec2(11.3, 7.7);
      a *= 0.5;
    }
    return s;
  }

  // ─── 河流强度场 ───
  // 学习自 river.ai 的核心思路：
  // 沿屏幕 Y 方向定义一个"河流中心带"，强度按距中心距离衰减
  // 时间让噪声流动起来（uv.x 缩放 + 时间偏移）
  float riverField(vec2 uv, float time) {
    // 河流主轴在屏幕 Y=0.62（学习自 river.ai 的 yOff=0.62）
    float center = 0.62;
    float dist = abs(uv.y - center);

    // 噪声扰动让河流边缘有"地形感"
    vec2 flowUv = vec2(uv.x * 3.5 + time * 0.08, uv.y * 2.5);
    float n = fbm(flowUv);

    // 河流宽度（受噪声影响）
    float width = 0.15 + 0.08 * n;
    float river = smoothstep(width, width * 0.3, dist);

    // 第二层细节
    float detail = fbm(vec2(uv.x * 8.0 + time * 0.12, uv.y * 5.0));
    river *= 0.7 + 0.3 * detail;

    return river;
  }

  // ─── river.ai 配色 ───
  // navy   #0a0e1a  深背景
  // blue   #1a2a4e  河床
  // aqua   #bcdcd0  河流浅水
  // teal   #6da89f  河流中深
  // cream  #f2e9d6  日光高光
  vec3 colorNavy  = vec3(10.0, 14.0, 26.0) / 255.0;
  vec3 colorBlue  = vec3(26.0, 42.0, 78.0) / 255.0;
  vec3 colorTeal  = vec3(109.0, 168.0, 159.0) / 255.0;
  vec3 colorAqua  = vec3(188.0, 220.0, 208.0) / 255.0;
  vec3 colorCream = vec3(242.0, 233.0, 214.0) / 255.0;

  void main() {
    // 屏幕坐标 → uv（保持长宽比）
    vec2 uv = v_uv;
    vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
    vec2 p = uv * aspect;

    float t = u_time;

    // ─── 天空背景渐变 ───
    // 上方 navy，下方稍亮（黎明感）
    float skyT = smoothstep(0.4, 1.0, uv.y);
    vec3 sky = mix(colorBlue * 0.7, colorNavy, skyT);

    // ─── 河流流动 ───
    float river = riverField(uv, t);

    // 河流高光：沿流向的细线条（模仿 river.ai 的 streak）
    float streak = sin(uv.x * 60.0 + t * 3.0 + fbm(uv * 8.0) * 6.0) * 0.5 + 0.5;
    streak = pow(streak, 6.0);

    // 河流基础色（按距中心远近 teal → aqua → cream）
    float depth = smoothstep(0.0, 1.0, river);
    vec3 riverColor = mix(colorTeal, colorAqua, depth);
    riverColor = mix(riverColor, colorCream, streak * depth * 0.6);

    // ─── 合成 ───
    vec3 col = sky;
    col = mix(col, riverColor, river * 0.85);

    // 整体噪声颗粒（模仿胶片质感）
    float grain = (hash(gl_FragCoord.xy + t * 60.0) - 0.5) * 0.04;
    col += grain;

    // 入场淡入
    col = mix(colorNavy, col, u_intro);

    // Vignette（角落变暗，模仿 river.ai）
    vec2 vUv = uv * 2.0 - 1.0;
    float vig = 1.0 - dot(vUv, vUv) * 0.25;
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
  }
  `;

  // ── 着色器编译 ──────────────────────────────────────────
  function compileShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error("[hero] shader compile error:", log);
      hudStatus.innerHTML = '<span class="err">着色器编译失败</span>';
      throw new Error("Shader compile failed: " + log);
    }
    return s;
  }

  const vs = compileShader(gl.VERTEX_SHADER, VS);
  const fs = compileShader(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    console.error("[hero] program link error:", log);
    hudStatus.innerHTML = '<span class="err">程序链接失败</span>';
    throw new Error("Program link failed: " + log);
  }
  gl.useProgram(prog);

  // ── 全屏四边形 ──────────────────────────────────────────
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1,  1,  1, -1,   1, 1
  ]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // ── Uniforms ──────────────────────────────────────────
  const U = {
    res:    gl.getUniformLocation(prog, "u_res"),
    time:   gl.getUniformLocation(prog, "u_time"),
    mouse:  gl.getUniformLocation(prog, "u_mouse"),
    intro:  gl.getUniformLocation(prog, "u_intro")
  };

  // ── 尺寸 / DPR ──────────────────────────────────────────
  let W = 0, H = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let mouse = { x: 0, y: 0 }; // 初始化为 0（shader 中未使用，预留防跳变）

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    gl.viewport(0, 0, canvas.width, canvas.height);
    W = canvas.width;
    H = canvas.height;
    if (hudRes) hudRes.textContent = canvas.width + "x" + canvas.height;
  }
  resize();
  window.addEventListener("resize", resize);

  // ── 鼠标 ──────────────────────────────────────────
  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX * DPR;
    mouse.y = (window.innerHeight - e.clientY) * DPR; // flip y for GL
  });
  window.addEventListener("mouseleave", function () {
    mouse.x = -9999; mouse.y = -9999;
  });

  // ── 渲染循环 ──────────────────────────────────────────
  let startTime = performance.now();
  let lastFpsT = startTime;
  let frames = 0;
  let introStart = startTime;

  loading.classList.add("hidden");
  hud.style.display = "block";
  hudStatus.innerHTML = '<span class="ok">运行中</span>';
  hudGL.textContent = "WebGL 1.0";

  function frame(now) {
    const t = (now - startTime) / 1000;
    // 入场淡入 1.5s
    const intro = Math.min(1, (now - introStart) / 1500);
    const introEased = intro * intro * (3 - 2 * intro); // smoothstep

    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, t);
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.uniform1f(U.intro, introEased);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // FPS
    frames++;
    if (now - lastFpsT > 500) {
      const fps = (frames * 1000 / (now - lastFpsT)).toFixed(0);
      if (hudFPS) hudFPS.textContent = fps;
      frames = 0;
      lastFpsT = now;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

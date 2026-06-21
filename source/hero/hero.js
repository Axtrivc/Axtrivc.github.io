// ============================================================
// River Hero — Phase 8: 日夜循环动画
//
// 核心特性：
//   1. 太阳沿弧形轨迹运动（日出→正午→日落）
//   2. 天空颜色随时间动态插值（冷蓝 ↔ 暖橙）
//   3. 太阳颜色/大小随高度变化
//   4. 山脉光照跟随太阳方向
//   5. 整体氛围色温循环
//   6. 保留竖向 ASCII 字符点缀 + Bloom 辉光
//
// 循环周期：24秒
//   0%   深夜（深蓝黑）
//   15%  黎明（淡紫粉）
//   25%  日出（橙红，太阳低）
//   40%  上午（暖黄蓝）
//   50%  正午（明亮，太阳最高）
//   65%  下午（暖色回归）
//   75%  日落（强烈橙红）
//   85%  黄昏（暗紫）
//   100% 回到深夜
// ============================================================

(function () {
  "use strict";

  var canvas = document.getElementById("heroCanvas");
  var loading = document.getElementById("loading");
  var hud = document.getElementById("hud");
  var hudStatus = document.getElementById("hudStatus");
  var hudGL = document.getElementById("hudGL");
  var hudFPS = document.getElementById("hudFPS");
  var hudRes = document.getElementById("hudRes");

  var gl = canvas.getContext("webgl", {
    antialias: false, alpha: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  }) || canvas.getContext("experimental-webgl");

  if (!gl) {
    if (loading) loading.textContent = "WebGL 不可用";
    if (hud) hud.style.display = "block";
    if (hudStatus) hudStatus.textContent = "无 WebGL";
    return;
  }

  gl.getExtension("OES_standard_derivatives");

  // ══════════════════════════════════════════════════════════
  // ASCII 字符图集
  // ══════════════════════════════════════════════════════════
  var CHARS = " .,-~:;=+*#%$@";
  var CHAR_COUNT = CHARS.length;
  var CHAR_PX = 16;
  var ATLAS_W = CHAR_PX * CHAR_COUNT;
  var ATLAS_H = CHAR_PX;

  function buildAtlas() {
    var c = document.createElement("canvas");
    c.width = ATLAS_W; c.height = ATLAS_H;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold " + (CHAR_PX - 2) + "px 'Courier New', Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < CHAR_COUNT; i++) {
      ctx.fillText(CHARS[i], i * CHAR_PX + CHAR_PX / 2, CHAR_PX / 2 + 1);
    }
    return c;
  }

  var atlasTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // ══════════════════════════════════════════════════════════
  // 全屏四边形 + 程序构建
  // ══════════════════════════════════════════════════════════
  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
    gl.STATIC_DRAW);

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[hero] shader error:", gl.getShaderInfoLog(s));
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function makeProgram(vsSrc, fsSrc) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  function bindQuad(prog) {
    var loc = gl.getAttribLocation(prog, "a_pos");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  var VS =
    "attribute vec2 a_pos;" +
    "varying vec2 v_uv;" +
    "void main() {" +
    "  v_uv = a_pos * 0.5 + 0.5;" +
    "  gl_Position = vec4(a_pos, 0.0, 1.0);" +
    "}";

  // ══════════════════════════════════════════════════════════
  // Pass 1：日夜循环场景渲染
  // ══════════════════════════════════════════════════════════
  var FS_SCENE =
    "#extension GL_OES_standard_derivatives : enable\n" +
    "precision highp float;\n" +
    "varying vec2 v_uv;\n" +
    "uniform vec2  u_res;\n" +
    "uniform float u_time;\n" +
    "uniform float u_intro;\n" +
    "uniform sampler2D u_atlas;\n" +
    "uniform vec2  u_atlasSize;\n" +
    "uniform float u_charCount;\n" +

    // ── 噪声 ──
    "float hash21(vec2 p) {\n" +
    "  p = fract(p * vec2(123.34, 345.45));\n" +
    "  p += dot(p, p + 34.345);\n" +
    "  return fract(p.x * p.y);\n" +
    "}\n" +
    "float vnoise(vec2 p) {\n" +
    "  vec2 i = floor(p), f = fract(p);\n" +
    "  f = f*f*(3.0-2.0*f);\n" +
    "  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),\n" +
    "             mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);\n" +
    "}\n" +
    "float fbm5(vec2 p) {\n" +
    "  float s=0.0, a=0.5;\n" +
    "  mat2 m = mat2(1.6,1.2,-1.2,1.6);\n" +
    "  for(int i=0;i<5;i++){\n" +
    "    s += a*vnoise(p);\n" +
    "    p = m*p*2.01 + vec2(7.3,4.7);\n" +
    "    a *= 0.5;\n" +
    "  }\n" +
    "  return s;\n" +
    "}\n" +
    "float ridge(vec2 p) {\n" +
    "  return 1.0 - abs(vnoise(p) * 2.0 - 1.0);\n" +
    "}\n" +
    "float ridgedFbm(vec2 p) {\n" +
    "  float sum = 0.0, amp = 0.5, freq = 1.0, prev = 1.0;\n" +
    "  for(int i=0;i<4;i++){\n" +
    "    float r = ridge(p * freq);\n" +
    "    r = r * r;\n" +
    "    r = r * prev;\n" +
    "    prev = r;\n" +
    "    sum += r * amp;\n" +
    "    freq *= 2.0;\n" +
    "    amp *= 0.5;\n" +
    "  }\n" +
    "  return sum;\n" +
    "}\n" +

    // ── 山脉高度场 ──
    "float mtHeight(vec2 uv, float scale, float gain, float seed) {\n" +
    "  vec2 p = vec2(uv.x * scale + seed, 0.0);\n" +
    "  float h = ridgedFbm(p);\n" +
    "  h = pow(h, 1.3);\n" +
    "  return h * gain;\n" +
    "}\n" +

    // ── 太阳圆盘 ──
    "float sunDisk(vec2 uv, vec2 center, float radius) {\n" +
    "  float ar = u_res.x / u_res.y;\n" +
    "  float d = length((uv - center) * vec2(ar, 1.0));\n" +
    "  return smoothstep(radius + 0.004, radius - 0.004, d);\n" +
    "}\n" +

    // ── 太阳光晕 ──
    "float sunGlow(vec2 uv, vec2 center, float radius) {\n" +
    "  float ar = u_res.x / u_res.y;\n" +
    "  float d = length((uv - center) * vec2(ar, 1.0));\n" +
    "  float g = radius * 3.5 / (d * 4.0 + radius * 0.5);\n" +
    "  return clamp(g - 0.25, 0.0, 1.0) * smoothstep(radius*8.0, radius*0.5, d);\n" +
    "}\n" +

    // ── God rays（体积光）──
    "float godRays(vec2 uv, vec2 sunPos, float t) {\n" +
    "  vec2 d = uv - sunPos;\n" +
    "  float ang = atan(d.y, d.x);\n" +
    "  float r = length(d);\n" +
    "  float n = vnoise(vec2(ang * 6.0 + t * 0.2, r * 25.0));\n" +
    "  float ray = pow(max(n, 0.0), 3.5);\n" +
    "  ray *= smoothstep(0.55, 0.03, r);\n" +
    "  return ray;\n" +
    "}\n" +

    // ── 平滑脉冲函数（用于日出/日落的平滑过渡）──
    "float pulse(float a, float b, float x) {\n" +
    "  return smoothstep(a, a + 0.08, x) * smoothstep(b + 0.08, b, x);\n" +
    "}\n" +

    "void main() {\n" +
    "  vec2 uv = v_uv;\n" +
    "  float t = u_time;\n" +
    "  float ar = u_res.x / u_res.y;\n" +

    // ═══════════════════════════════════════════════════
    // 日夜循环系统（24秒一周期）
    // ═══════════════════════════════════════════════════
    "  float CYCLE = 24.0; // 周期长度（秒）\n" +
    "  float phase = mod(t / CYCLE, 1.0); // 0~1 循环\n" +

    // --- 太阳弧形轨迹 ---
    // 太阳角度：从 -30°（左下升起）到 210°（右下落下），经过正上方
    "  float sunAngle = -0.52 + phase * 3.14 * 1.35; // 弧度范围\n" +
    "  float sunArcHeight = sin(sunAngle); // -1 ~ 1 ~ -1\n" +
    "  float sunArcX = cos(sunAngle) * 0.45 + 0.5; // 0.05 ~ 0.95\n" +
    "  float sunArcY = 0.38 + sunArcHeight * 0.32; // 0.06 ~ 0.70 ~ 0.06\n" +

    // 太阳只在 horizon 以上可见（否则在地平线下）
    "  float sunVisible = smoothstep(0.22, 0.28, sunArcY);\n" +
    "  vec2 sunPos = vec2(sunArcX, sunArcY);\n" +

    // --- 日夜关键阶段权重 ---
    // night: 0.75~1.0 和 0~0.15（深夜/黎明前）
    // dawn:  0.15~0.28（黎明粉紫）
    // sunrise: 0.22~0.38（日出橙红）
    // day:   0.35~0.65（白天明亮）
    // sunset: 0.62~0.78（日落橙红）
    // dusk:  0.73~0.88（黄昏暗紫）
    "  float wNight   = pulse(0.82, 0.12, phase) + step(0.95, phase) * step(phase, 0.05);\n" +
    "  float wDawn    = pulse(0.13, 0.27, phase);       // 黎明\n" +
    "  float wSunrise = pulse(0.20, 0.38, phase);        // 日出\n" +
    "  float wDay     = pulse(0.33, 0.67, phase);        // 白天\n" +
    "  float wSunset  = pulse(0.60, 0.80, phase);        // 日落\n" +
    "  float wDusk    = pulse(0.75, 0.92, phase);        // 黄昏\n" +

    // --- 天空颜色（基于阶段混合）---
    // 各阶段的调色板
    "  vec3 skyNight   = vec3(0.015, 0.024, 0.052);  // 深夜蓝黑\n" +
    "  vec3 skyDawn    = vec3(0.120, 0.080, 0.180);  // 黎明紫粉\n" +
    "  vec3 skyRise    = vec3(0.350, 0.200, 0.280);  // 日出粉红\n" +
    "  vec3 skyDayTop  = vec3(0.150, 0.280, 0.480);  // 白天天顶蓝\n" +
    "  vec3 skyDayHorz = vec3(0.400, 0.480, 0.580);  // 白天地平线\n" +
    "  vec3 skySet     = vec3(0.650, 0.280, 0.120);  // 日落橙红\n" +
    "  vec3 skyDusk    = vec3(0.140, 0.070, 0.160);  // 黄昏暗紫\n" +

    // 基础天空：垂直渐变
    "  vec3 skyTop, skyBot;\n" +
    // 根据各阶段权重混合天空顶部和底部颜色
    "  skyTop = skyNight;\n" +
    "  skyTop = mix(skyTop, skyDawn,   wDawn * 0.7);\n" +
    "  skyTop = mix(skyTop, skyDayTop,  wSunrise * 0.5 + wDay);\n" +
    "  skyTop = mix(skyTop, skySet,     wSunset * 0.4);\n" +
    "  skyTop = mix(skyTop, skyDusk,    wDusk * 0.6);\n" +
    "  \n" +
    "  skyBot = skyNight * 1.5;\n" +
    "  skyBot = mix(skyBot, skyRise,    wDawn * 0.6 + wSunrise * 0.8);\n" +
    "  skyBot = mix(skyBot, skyDayHorz, wSunrise * 0.4 + wDay);\n" +
    "  skyBot = mix(skyBot, skySet,     wSunset * 0.9 + wDusk * 0.3);\n" +
    "  skyBot = mix(skyBot, skyDusk,    wDusk * 0.5);\n" +

    "  vec3 sky = mix(skyBot, skyTop, smoothstep(0.25, 0.80, uv.y));\n" +

    // 地平线附近的额外暖色光晕（日出/日落时）
    "  float horizGlow = exp(-pow((uv.y - 0.28) * 6.0, 2.0));\n" +
    "  vec3 riseColor = vec3(1.000, 0.500, 0.250); // 日出暖橙\n" +
    "  vec3 setColor  = vec3(0.900, 0.300, 0.150); // 日落深橙红\n" +
    "  sky += riseColor * horizGlow * wSunrise * 0.5;\n" +
    "  sky += setColor  * horizGlow * wSunset  * 0.6;\n" +

    // --- 太阳颜色随阶段变化 ---
    "  vec3 sunCoreDay   = vec3(1.000, 0.980, 0.900);  // 白天亮白\n" +
    "  vec3 sunCoreRise  = vec3(1.000, 0.600, 0.200);  // 日出橙\n" +
    "  vec3 sunCoreSet   = vec3(1.000, 0.350, 0.120);  // 日落红橙\n" +
    "  vec3 sunCore = sunCoreDay;\n" +
    "  sunCore = mix(sunCore, sunCoreRise, wSunrise);\n" +
    "  sunCore = mix(sunCore, sunCoreSet,  wSunset);\n" +

    "  vec3 sunGlowColor = vec3(1.000, 0.550, 0.250);\n" +
    "  sunGlowColor = mix(sunGlowColor, vec3(1.0, 0.35, 0.15), wSunset);\n" +

    // 太阳大小：低空时更大（折射效果）
    "  float sunRadius = 0.032 + (wSunrise + wSunset) * 0.018;\n" +
    "  sunRadius *= sunVisible;\n" +

    "  float sunD = sunDisk(uv, sunPos, sunRadius);\n" +
    "  float sunG = sunGlow(uv, sunPos, sunRadius);\n" +
    "  float rays = godRays(uv, sunPos, t) * sunVisible;\n" +

    // 太阳叠加
    "  float sunBrightness = 1.8 + (wSunrise + wSunset) * 1.2;\n" +
    "  sky += sunCore * sunD * sunBrightness * sunVisible;\n" +
    "  sky = mix(sky, sunGlowColor, sunG * 0.65 * sunVisible);\n" +
    "  sky += sunGlowColor * rays * 0.40 * sunVisible;\n" +

    // --- 光照方向（从太阳位置射向场景）---
    "  vec3 lightDir = normalize(vec3((sunPos.x - 0.5) * 2.5, sunPos.y + 0.2, 0.6));\n" +
    "  float lightIntensity = 0.5 + sunArcHeight * 0.5; // 低空时弱\n" +
    "  lightIntensity = max(lightIntensity, 0.15);\n" +
    "  lightIntensity *= sunVisible;\n" +

    // ═══════════════════════════════════════════════════
    // 山脉（4 层，带 Lambert 光照 + 色温变化）
    // ═══════════════════════════════════════════════════

    // 山体基础色（受色温影响）
    "  vec3 mtFarLit   = mix(vec3(0.160,0.220,0.320), vec3(0.450,0.300,0.280), wSunset+wSunrise*0.7);\n" +
    "  vec3 mtMidLit   = mix(vec3(0.110,0.170,0.260), vec3(0.380,0.240,0.220), wSunset+wSunrise*0.7);\n" +
    "  vec3 mtNearLit  = mix(vec3(0.050,0.100,0.170), vec3(0.280,0.160,0.150), wSunset+wSunrise*0.7);\n" +
    "  vec3 mtShade    = mix(vec3(0.020,0.040,0.075), vec3(0.080,0.040,0.060), wSunset+wSunrise*0.5);\n" +

    "  vec3 col = sky;\n" +

    // ── 通用：单层山脉绘制（输入参数 + 该层受光色）──
    // 输出：col 被覆盖为 mtCol 的部分
    // 为避免 GLSL ES 1.00 的动态数组索引限制，手动展开 4 层

    // ── L0：远山（最浅，雾化最强）──
    "  {\n" +
    "    float by = 0.42, sc = 2.0, gn = 0.038, sd = 3.1;\n" +
    "    float h = mtHeight(uv, sc, gn, sd);\n" +
    "    float ridge_y = by + h;\n" +
    "    float hL = mtHeight(uv + vec2(0.004, 0.0), sc, gn, sd);\n" +
    "    float hR = mtHeight(uv + vec2(-0.004, 0.0), sc, gn, sd);\n" +
    "    vec3 normal = normalize(vec3((hR - hL) * 22.0, 0.6, 0.3));\n" +
    "    float lambert = max(dot(normal, lightDir), 0.0);\n" +
    "    float hill = pow(lambert, 0.75) * lightIntensity;\n" +
    "    vec3 mtCol = mix(mtShade, mtFarLit, hill);\n" +
    "    vec3 fogCol = mix(skyBot, skySet * 0.6, wSunset + wSunrise * 0.5);\n" +
    "    mtCol = mix(mtCol, fogCol, 0.50 * 0.55);\n" +
    "    float edgeLight = smoothstep(ridge_y - 0.010, ridge_y, uv.y) * step(uv.y, ridge_y);\n" +
    "    mtCol += sunGlowColor * edgeLight * (0.25 + wSunset * 0.35) * sunVisible;\n" +
    "    float mask = step(uv.y, ridge_y);\n" +
    "    col = mix(col, mtCol, mask);\n" +
    "  }\n" +

    // ── L1：中山 ──
    "  {\n" +
    "    float by = 0.36, sc = 3.2, gn = 0.050, sd = 10.4;\n" +
    "    float h = mtHeight(uv, sc, gn, sd);\n" +
    "    float ridge_y = by + h;\n" +
    "    float hL = mtHeight(uv + vec2(0.004, 0.0), sc, gn, sd);\n" +
    "    float hR = mtHeight(uv + vec2(-0.004, 0.0), sc, gn, sd);\n" +
    "    vec3 normal = normalize(vec3((hR - hL) * 22.0, 0.6, 0.3));\n" +
    "    float lambert = max(dot(normal, lightDir), 0.0);\n" +
    "    float hill = pow(lambert, 0.75) * lightIntensity;\n" +
    "    vec3 mtCol = mix(mtShade, mtMidLit, hill);\n" +
    "    vec3 fogCol = mix(skyBot, skySet * 0.6, wSunset + wSunrise * 0.5);\n" +
    "    mtCol = mix(mtCol, fogCol, 0.333 * 0.55);\n" +
    "    float edgeLight = smoothstep(ridge_y - 0.010, ridge_y, uv.y) * step(uv.y, ridge_y);\n" +
    "    mtCol += sunGlowColor * edgeLight * (0.25 + wSunset * 0.35) * sunVisible;\n" +
    "    float mask = step(uv.y, ridge_y);\n" +
    "    col = mix(col, mtCol, mask);\n" +
    "  }\n" +

    // ── L2：中近山 ──
    "  {\n" +
    "    float by = 0.29, sc = 4.5, gn = 0.065, sd = 17.7;\n" +
    "    float h = mtHeight(uv, sc, gn, sd);\n" +
    "    float ridge_y = by + h;\n" +
    "    float hL = mtHeight(uv + vec2(0.004, 0.0), sc, gn, sd);\n" +
    "    float hR = mtHeight(uv + vec2(-0.004, 0.0), sc, gn, sd);\n" +
    "    vec3 normal = normalize(vec3((hR - hL) * 22.0, 0.6, 0.3));\n" +
    "    float lambert = max(dot(normal, lightDir), 0.0);\n" +
    "    float hill = pow(lambert, 0.75) * lightIntensity;\n" +
    "    vec3 mtCol = mix(mtShade, mtNearLit, hill);\n" +
    "    vec3 fogCol = mix(skyBot, skySet * 0.6, wSunset + wSunrise * 0.5);\n" +
    "    mtCol = mix(mtCol, fogCol, 0.167 * 0.55);\n" +
    "    float edgeLight = smoothstep(ridge_y - 0.010, ridge_y, uv.y) * step(uv.y, ridge_y);\n" +
    "    mtCol += sunGlowColor * edgeLight * (0.25 + wSunset * 0.35) * sunVisible;\n" +
    "    float mask = step(uv.y, ridge_y);\n" +
    "    col = mix(col, mtCol, mask);\n" +
    "  }\n" +

    // ── L3：近山（最深、雾化最弱）──
    "  {\n" +
    "    float by = 0.21, sc = 6.0, gn = 0.082, sd = 25.0;\n" +
    "    float h = mtHeight(uv, sc, gn, sd);\n" +
    "    float ridge_y = by + h;\n" +
    "    float hL = mtHeight(uv + vec2(0.004, 0.0), sc, gn, sd);\n" +
    "    float hR = mtHeight(uv + vec2(-0.004, 0.0), sc, gn, sd);\n" +
    "    vec3 normal = normalize(vec3((hR - hL) * 22.0, 0.6, 0.3));\n" +
    "    float lambert = max(dot(normal, lightDir), 0.0);\n" +
    "    float hill = pow(lambert, 0.75) * lightIntensity;\n" +
    "    vec3 mtCol = mix(mtShade, mtNearLit, hill);\n" +
    "    vec3 fogCol = mix(skyBot, skySet * 0.6, wSunset + wSunrise * 0.5);\n" +
    "    mtCol = mix(mtCol, fogCol, 0.0);\n" +
    "    float edgeLight = smoothstep(ridge_y - 0.010, ridge_y, uv.y) * step(uv.y, ridge_y);\n" +
    "    mtCol += sunGlowColor * edgeLight * (0.25 + wSunset * 0.35) * sunVisible;\n" +
    "    float mask = step(uv.y, ridge_y);\n" +
    "    col = mix(col, mtCol, mask);\n" +
    "  }\n" +

    // 山谷底
    "  vec3 valleyCol = mix(vec3(0.005,0.010,0.025), vec3(0.060,0.025,0.020), wSunset+wSunrise*0.4);\n" +
    "  col = mix(col, valleyCol, smoothstep(0.18, 0.04, uv.y));\n" +

    // ═══════════════════════════════════════════════════
    // 竖向字符流（ASCII 点缀）
    // ═══════════════════════════════════════════════════
    // 字符颜色也随色温变化
    "  vec3 charColor = mix(\n" +
    "    vec3(0.450, 0.600, 0.700),\n" +
    "    vec3(0.750, 0.500, 0.450),\n" +
    "    wSunset + wSunrise * 0.6\n" +
    "  );\n" +
    "  charColor = mix(charColor, vec3(0.300, 0.280, 0.450), wNight * 0.7);\n" +

    "  if (uv.y > 0.28 && uv.y < 0.92) {\n" +
    "    float col_id = floor(uv.x * 55.0);\n" +
    "    float col_speed = 0.4 + hash21(vec2(col_id, 0.0)) * 1.2;\n" +
    "    float flow = mod(uv.y + t * col_speed * 0.04, 1.0);\n" +
    "    float char_row = floor(flow * 35.0);\n" +
    "    float char_seed = hash21(vec2(col_id, char_row));\n" +
    "    float headFade = smoothstep(0.0, 0.06, flow) * smoothstep(1.0, 0.86, flow);\n" +
    "    float visible = step(0.56, char_seed) * headFade;\n" +
    "    float intensity = char_seed;\n" +
    "    float charIdx = floor(clamp(intensity, 0.0, 0.999) * u_charCount);\n" +
    "    float charPxW = u_atlasSize.x / u_charCount;\n" +
    "    vec2 cellLocal = fract(vec2(uv.x * 55.0, flow * 35.0));\n" +
    "    vec2 atlasUV = vec2(\n" +
    "      (charIdx * charPxW + cellLocal.x * charPxW) / u_atlasSize.x,\n" +
    "      cellLocal.y\n" +
    "    );\n" +
    "    float charAlpha = texture2D(u_atlas, atlasUV).r;\n" +
    // 夜间字符更亮，白天稍暗
    "    float charBright = 0.35 + wNight * 0.25 - wDay * 0.10;\n" +
    "    col += charColor * charAlpha * visible * charBright;\n" +
    "  }\n" +

    // ═══════════════════════════════════════════════════
    // 后处理
    // ═══════════════════════════════════════════════════

    // 胶片颗粒
    "  col += (hash21(gl_FragCoord.xy + t*60.0)-0.5)*0.012;\n" +

    // 入场动画
    "  col = mix(vec3(0.010, 0.018, 0.040), col, smoothstep(0.0, 1.8, u_intro));\n" +

    // 暗角
    "  vec2 vv = uv*2.0-1.0;\n" +
    "  float vg = 1.0 - dot(vv,vv)*0.18;\n" +
    "  col *= smoothstep(0.0, 1.0, vg);\n" +

    // 轻微色差（边缘）
    "  float ca = length(vv) * 0.015;\n" +
    "  col.r -= ca * 0.5; col.b += ca * 0.3;\n" +

    "  gl_FragColor = vec4(col, 1.0);\n" +
    "}\n";

  // ══════════════════════════════════════════════════════════
  // Pass 2: Bloom 辉光
  // ══════════════════════════════════════════════════════════
  var FS_BLOOM =
    "precision highp float;\n" +
    "varying vec2 v_uv;\n" +
    "uniform sampler2D u_scene;\n" +
    "uniform vec2  u_texel;\n" +
    "uniform float u_bloomStrength;\n" +
    "uniform float u_bloomThreshold;\n" +

    "float luminance(vec3 c) {\n" +
    "  return dot(c, vec3(0.299, 0.587, 0.114));\n" +
    "}\n" +
    "vec3 brightPass(vec3 c) {\n" +
    "  float l = luminance(c);\n" +
    "  float k = max(l - u_bloomThreshold, 0.0) / max(l, 0.001);\n" +
    "  return c * k;\n" +
    "}\n" +

    "void main() {\n" +
    "  vec2 uv = v_uv;\n" +
    "  vec2 texel = u_texel;\n" +
    "  vec3 original = texture2D(u_scene, uv).rgb;\n" +
    "  vec3 blur = vec3(0.0);\n" +
    "  float wsum = 0.0;\n" +
    "  for(int x=-2;x<=2;x++){\n" +
    "    for(int y=-2;y<=2;y++){\n" +
    "      vec2 off = vec2(float(x), float(y));\n" +
    "      float dist2 = dot(off,off);\n" +
    "      float w = exp(-dist2 * 0.4);\n" +
    "      blur += brightPass(texture2D(u_scene, uv + off * texel).rgb) * w;\n" +
    "      wsum += w;\n" +
    "    }\n" +
    "  }\n" +
    "  blur /= max(wsum, 0.001);\n" +
    "  vec3 final = original + blur * u_bloomStrength;\n" +
    "  final = final / (final + vec3(0.82));\n" +
    "  final = pow(final, vec3(0.90));\n" +
    "  gl_FragColor = vec4(final, 1.0);\n" +
    "}\n";

  // ── 编译着色器 ──
  var progScene, progBloom;
  try {
    progScene = makeProgram(VS, FS_SCENE);
    progBloom = makeProgram(VS, FS_BLOOM);
  } catch (e) {
    console.error("[hero] program error:", e);
    if (hudStatus) hudStatus.innerHTML = '<span style="color:#ff6b6b">初始化失败</span>';
    return;
  }

  var UScene = {
    res:        gl.getUniformLocation(progScene, "u_res"),
    time:       gl.getUniformLocation(progScene, "u_time"),
    intro:      gl.getUniformLocation(progScene, "u_intro"),
    atlas:      gl.getUniformLocation(progScene, "u_atlas"),
    atlasSize:  gl.getUniformLocation(progScene, "u_atlasSize"),
    charCount:  gl.getUniformLocation(progScene, "u_charCount")
  };
  var UBloom = {
    scene:          gl.getUniformLocation(progBloom, "u_scene"),
    texel:          gl.getUniformLocation(progBloom, "u_texel"),
    bloomStrength:  gl.getUniformLocation(progBloom, "u_bloomStrength"),
    bloomThreshold: gl.getUniformLocation(progBloom, "u_bloomThreshold")
  };

  // 绑定 atlas 纹理
  gl.useProgram(progScene);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.uniform1i(UScene.atlas, 0);
  gl.uniform2f(UScene.atlasSize, ATLAS_W, ATLAS_H);
  gl.uniform1f(UScene.charCount, CHAR_COUNT);

  // ══════════════════════════════════════════════════════════
  // FBO（帧缓冲对象）
  // ══════════════════════════════════════════════════════════
  var sceneFBO = gl.createFramebuffer();
  var sceneTex = gl.createTexture();

  function resizeFBO(w, h) {
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  var W = 0, H = 0;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    W = canvas.width; H = canvas.height;
    resizeFBO(W, H);
    if (hudRes) hudRes.textContent = W + "x" + H;
  }
  resize();
  window.addEventListener("resize", resize);

  var T0 = performance.now();
  var fc = 0, lastT = T0;

  // 渲染主循环
  function frame() {
    var now = performance.now();
    var t = (now - T0) / 1000;

    fc++;
    if (now - lastT >= 1000) {
      if (hudFPS) hudFPS.textContent = String(fc);
      fc = 0; lastT = now;
    }

    var introVal = Math.min(t / 1.8, 1.0);

    // Pass 1: 场景渲染 → FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO);
    gl.viewport(0, 0, W, H);
    gl.useProgram(progScene);
    bindQuad(progScene);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(UScene.atlas, 0);
    gl.uniform2f(UScene.res, W, H);
    gl.uniform1f(UScene.time, t);
    gl.uniform1f(UScene.intro, introVal);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 2: Bloom 后处理 → 屏幕
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(progBloom);
    bindQuad(progBloom);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(UBloom.scene, 0);
    gl.uniform2f(UBloom.texel, 1.0 / W, 1.0 / H);
    gl.uniform1f(UBloom.bloomStrength, 1.5);  // 辉光强度略增
    gl.uniform1f(UBloom.bloomThreshold, 0.38); // 阈值略降

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(frame);
  }

  // 启动
  if (loading) loading.classList.add("hidden");
  if (hud) hud.style.display = "block";
  if (hudStatus) hudStatus.innerHTML = '<span style="color:#4ade80">运行中 · Phase 8: 日夜循环</span>';
  if (hudGL) hudGL.textContent = (gl.getParameter(gl.RENDERER) || "").split("(")[0].trim();

  frame();
})();

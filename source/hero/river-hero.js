(async function () {
  // Always open at the top with the hero filling the screen. Browsers otherwise
  // restore the previous scroll position on reload, landing partway down where
  // the cream section below the hero shows through as a white band.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const canvas = document.getElementById("asciiRiver");
  const hero = document.getElementById("hero");
  const fpsMeter = document.getElementById("fpsMeter");
  const heroStill = document.getElementById("heroStill");
  // live 预热兜底: shader 在后台编译期间 canvas 还是不透明的黑布——先把日出
  // 静态图盖在上面, 等 live 场景淡起过半再交叉淡出(见 loop 内 heroWarmupStill)。
  let heroWarmupStill = false;
  if (!canvas || !hero) return;

  const gl =
    canvas.getContext("webgl", { antialias: false, alpha: false }) ||
    canvas.getContext("experimental-webgl");
  if (!gl) {
    console.warn("[river] WebGL unavailable — CSS placeholder fallback shown");
    // No shader → no boot; reveal the header/chrome so the page is usable
    [document.getElementById("nav"),
     document.querySelector(".scroll-cue"),
     document.querySelector(".tod-debug")].forEach((el) => {
      if (el) { el.style.opacity = "1"; el.style.pointerEvents = ""; }
    });
    return;
  }
  // Screen-space derivatives (fwidth) for stable, constant-width contour lines.
  gl.getExtension("OES_standard_derivatives");

  // ── Upfront perf gate ─────────────────────────────────────────
  // This must run BEFORE the expensive hero shader is compiled/linked. Weak
  // mobile/Windows GPUs can freeze the browser just compiling the main fragment
  // shader, even if we later decide to show the static fallback.
  // Vendored locally (/hero/vendor/) — pulling the module + its benchmark DB
  // from esm.sh/unpkg at runtime added seconds of cold-start latency (and could
  // hang entirely on blocked/slow networks, e.g. crawlers), stalling the hero
  // before it even started compiling shaders.
  const DETECT_GPU_URL = "/hero/vendor/detect-gpu.js";
  const DETECT_GPU_BENCHMARKS_URL = "/hero/vendor/benchmarks";
  const DETECT_GPU_MIN_TIER = 3;   // 0..3; only top-tier GPUs run the live hero.
  const HERO_HEAD_LINE = "Axtrivc's Blog";
  const HERO_SUB_LINE  = "";  // sub 由主区 butterfly typed.js 显示 (hitokoto + '抽刀断水')
  const HERO_SUB_DELAY = 0;   // no sub
  const HERO_SUB_RATE  = 30;  // unused
  const HERO_TYPEIN_MS = 250 + HERO_HEAD_LINE.length * 36;  // no sub, no delay
  const HERO_REVEAL_HOLD_MS = 350;
  const HERO_TEXT_SLIDE_MS = 1100;
  const HERO_REVEAL_MS = 1500;
  const HERO_TEXT_DELAY_MS = 200;   // start typing shortly after the shader fade-in begins (not after it finishes)
  const HERO_STATIC_TEXT_DELAY_MS = 650;
  const HERO_MOBILE_FADE_DELAY_MS = 900;
  // Phones/narrow (live hero): the text types in first over the bare sky, holds
  // briefly, then fades out — and the valley reveal is held back until after that
  // fade so it has time to load and condenses in behind the departing text.
  const HERO_MOBILE_REVEAL_START_MS = 1400;
  const HERO_MOBILE_REVEAL_MS = 2500;
  const HERO_TEXT_SLIDE_MIN_W = 768;
  const heroParams = new URLSearchParams(window.location.search);
  const HERO_FORCE_LIVE = heroParams.has("riverLive");
  const HERO_FORCE_STATIC = heroParams.has("riverStatic");

  function setHeroTextOffsetCss(axis, v) {
    const unit = axis === "x" ? "vw" : "vh";
    document.documentElement.style.setProperty(`--hero-text-offset-${axis}`, `${(v * 100).toFixed(2)}${unit}`);
  }

  function heroTextSliderValue(id, fallback) {
    const el = document.getElementById(id);
    return el ? parseInt(el.value, 10) / 1000 : fallback;
  }

  function staticHeroTextSlides() {
    return !window.matchMedia("(pointer: coarse)").matches && window.innerWidth >= HERO_TEXT_SLIDE_MIN_W;
  }

  function animateStaticHeroText() {
    const heroTextFallback = document.getElementById("heroText");
    const heroHeadlineFallback = document.getElementById("heroHeadlineLive");
    const heroSublineFallback = document.getElementById("heroSublineLive");
    if (!heroTextFallback || !heroHeadlineFallback || !heroSublineFallback) return;

    const textHorizonToggle = document.getElementById("textHorizonToggle");
    heroTextFallback.classList.toggle("hero-text--horizon", !textHorizonToggle || textHorizonToggle.checked);
    const targetX = heroTextSliderValue("textOffsetXSlider", -0.25);
    setHeroTextOffsetCss("x", 0);
    setHeroTextOffsetCss("y", heroTextSliderValue("textOffsetYSlider", 0.02));

    heroTextFallback.style.opacity = "0";
    heroHeadlineFallback.textContent = "";
    heroHeadlineFallback.classList.add("typing");
    heroSublineFallback.textContent = "";
    heroSublineFallback.classList.remove("cursor");

    const liveT0Static = performance.now();
    let done = false;
    function frame(now) {
      const el = now - liveT0Static - HERO_STATIC_TEXT_DELAY_MS;
      const nH = Math.max(0, Math.min(HERO_HEAD_LINE.length, Math.floor((el - 250) / 36)));
      const sH = HERO_HEAD_LINE.slice(0, nH);
      if (heroHeadlineFallback.textContent !== sH) heroHeadlineFallback.textContent = sH;
      heroHeadlineFallback.classList.toggle("typing", nH < HERO_HEAD_LINE.length);

      const headDoneAt = 250 + HERO_HEAD_LINE.length * 36 + HERO_SUB_DELAY;
      if (el >= headDoneAt) {
        const nS = Math.max(0, Math.min(HERO_SUB_LINE.length, Math.floor((el - headDoneAt) / HERO_SUB_RATE)));
        const sS = HERO_SUB_LINE.slice(0, nS);
        if (heroSublineFallback.textContent !== sS) heroSublineFallback.textContent = sS;
        heroSublineFallback.classList.add("cursor");
      } else {
        if (heroSublineFallback.textContent !== "") heroSublineFallback.textContent = "";
        heroSublineFallback.classList.remove("cursor");
      }

      if (now - liveT0Static >= HERO_STATIC_TEXT_DELAY_MS) heroTextFallback.style.opacity = "1";
      const elapsed = now - liveT0Static - HERO_STATIC_TEXT_DELAY_MS - HERO_TYPEIN_MS - HERO_REVEAL_HOLD_MS;
      if (elapsed >= 0 && !done) {
        if (staticHeroTextSlides()) {
          const sp = Math.max(0, Math.min(1, elapsed / HERO_TEXT_SLIDE_MS));
          const sEase = sp * sp * (3.0 - 2.0 * sp);
          setHeroTextOffsetCss("x", targetX * sEase);
          if (sp >= 1.0) done = true;
        } else {
          // Static fallback has no live scene reveal competing for attention, so
          // keep the completed text visible on touch/narrow viewports.
          heroTextFallback.style.opacity = "1";
          done = true;
        }
      }

      if (!done) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function revealStaticFallback() {
    canvas.style.display = "none";
    if (heroStill) heroStill.classList.add("is-shown");
    animateStaticHeroText();
    document.body.classList.remove("booting");
    [document.getElementById("nav"),
     document.querySelector(".scroll-cue"),
     document.querySelector(".tod-debug")].forEach((el) => {
      if (el) { el.style.opacity = "1"; el.style.pointerEvents = ""; }
    });
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function gpuTierGoodEnough(gpu) {
    const tier = Number(gpu && gpu.tier);
    return Number.isFinite(tier) && tier >= DETECT_GPU_MIN_TIER;
  }

  function webglRendererString() {
    try {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).toLowerCase() : "";
    } catch (e) {
      return "";
    }
  }

  function perfVetoReason() {
    const renderer = webglRendererString();
    if (/swiftshader|llvmpipe|software|basic render|mesa offscreen/.test(renderer)) {
      return "software-gl:" + renderer;
    }
    if (/intel.*\b(hd|uhd) graphics (400|405|500|505|510|515|600|605|610|615)\b/.test(renderer)) {
      return "low-end-intel:" + renderer;
    }
    if (/\badreno (3\d\d|4\d\d|5\d\d|61[0-8])\b/.test(renderer)) {
      return "low-end-adreno:" + renderer;
    }

    const ua = navigator.userAgent || "";
    const isChromeOS = /\bCrOS\b/i.test(ua);
    const mem = Number(navigator.deviceMemory || 0);        // Chromium only; 0 = unknown
    const cores = Number(navigator.hardwareConcurrency || 0); // 0 = unknown
    if (isChromeOS && ((mem && mem < 8) || (cores && cores < 8))) {
      return "low-resource-chromeos:" + (mem || "?") + "gb/" + (cores || "?") + "cores";
    }
    if (mem && mem <= 2) return "low-mem:" + mem + "gb";
    return null;
  }

  function gpuTierMessage(gpu, live) {
    return "[river] detect-gpu "
      + (gpu
          ? "tier " + gpu.tier
            + (typeof gpu.fps === "number" ? ", fps " + Math.round(gpu.fps) : "")
            + (gpu.type ? ", " + gpu.type : "")
            + (gpu.gpu ? ", " + gpu.gpu : "")
            + " (" + gpu.total.toFixed(0) + "ms)"
          : "failed")
      + "  ->  " + (live ? "LIVE" : "STATIC");
  }

  async function detectGpuTier() {
    const t0 = performance.now();
    const mod = await import(DETECT_GPU_URL);
    const opts = { failIfMajorPerformanceCaveat: true, glContext: gl, benchmarksURL: DETECT_GPU_BENCHMARKS_URL };
    let gpu = await mod.getGPUTier(opts);
    // detect-gpu matches against a benchmark DB fetched from a CDN at runtime.
    // On a cold load that fetch can lose the race / fail (BENCHMARK_FETCH_FAILED),
    // which would wrongly demote a capable device on the FIRST visit only. It's
    // documented as safe to retry, so give it one more shot.
    if (gpu && gpu.type === "BENCHMARK_FETCH_FAILED") {
      gpu = await mod.getGPUTier(opts);
    }
    gpu.total = performance.now() - t0;
    return gpu;
  }
  window.riverGpuTier = detectGpuTier;   // dev hook: call riverGpuTier() in the console

  let gpuTier = null;
  let liveAllowed = false;
  try {
    if (HERO_FORCE_LIVE) {
      liveAllowed = true;
      console.info("[river] forced live hero");
    } else if (HERO_FORCE_STATIC) {
      console.info("[river] forced static fallback");
    } else {
      const veto = perfVetoReason();
      if (veto) {
        console.info("[river] perf veto " + veto + "  ->  STATIC");
      } else {
        gpuTier = await detectGpuTier();
        const postDetectVeto = perfVetoReason();
        // detect-gpu's tier is authoritative whenever it could actually classify
        // the GPU: a real BENCHMARK match, a FALLBACK conservative default for a
        // recognised-but-unbenchmarked GPU (e.g. a new low-end laptop), or a
        // blocklist/unsupported verdict. We trust the tier in all of those, so
        // weak/unknown devices correctly stay on the static hero.
        // The ONE case we don't trust is a transient benchmark-DB fetch failure
        // (a network race, common on a cold first visit) — that's not a device
        // verdict, so we fall back to our own perf veto rather than demoting a
        // capable device (this is what was wrongly forcing iPhones to static on
        // the first load only).
        const fetchFailed = gpuTier && gpuTier.type === "BENCHMARK_FETCH_FAILED";
        liveAllowed = !postDetectVeto && (fetchFailed ? true : gpuTierGoodEnough(gpuTier));
        const msg = gpuTierMessage(gpuTier, liveAllowed)
          + (postDetectVeto ? " veto:" + postDetectVeto : "")
          + (fetchFailed ? " (DB fetch failed → veto-gated)" : "");
        console.info(msg);
      }
    }
  } catch (e) {
    // The detect-gpu module itself failed to load (CDN/network — most likely on
    // a cold first visit). Fall back to our perf veto rather than defaulting
    // everyone to the static hero.
    console.warn("[river] detect-gpu failed; falling back to perf veto", e);
    if (!HERO_FORCE_STATIC) liveAllowed = !perfVetoReason();
  }
  if (!liveAllowed) {
    window.__riverLive = false;          // signal to any inline fallback: take over text
    revealStaticFallback();
    return;
  }
  window.__riverLive = true;             // live mode is taking over headline/subline text
  // 预热兜底上岗: 后台编译期间用日出静态图盖住黑 canvas, 首帧淡起后再撤。
  if (heroStill) { heroStill.classList.add("is-shown"); heroWarmupStill = true; }

  // ── Tunables ──────────────────────────────────────────────────
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Shaders (GLSL ES 1.00) ────────────────────────────────────
  const VS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  // ── Shared shader prelude ── uniforms + every helper up to (not including)
  // renderValley. The main scene shader AND the offscreen sky pass (SKY_FS,
  // below) are both built from this one string, so their math can never drift.
  const FS_COMMON = `#extension GL_OES_standard_derivatives : enable
    precision highp float;
    varying vec2 v_uv;
    uniform vec2  u_res;
    uniform float u_sceneH;  // 场景区(100dvh)设备高 —— canvas 高 = u_sceneH + 尾部溶解区(v9)
    uniform vec3  u_pageBg;  // 尾部溶解目标色 = 页面 --page-bg(v9)
    uniform float u_time;
    uniform vec2  u_par;     // v14 指针视差: 相机摇摆(sx/sy 偏移), 天空 uv 层不动
    uniform float u_tod;     // time of day, 0..1 == 00:00..24:00
    uniform float u_aurHue;  // aurora colour latched at sunset: 0=green, 1=violet
    uniform float u_aurSpeed; // aurora drift speed, rolled fresh each sunset
    uniform float u_aurDot;   // screen-space aurora dots (0 = smooth)
    uniform float u_aurPlaneSamples; // PERF: max aurora plane samples
    uniform float u_aurSampleFill;   // fills each sample's vertical cell toward the next sample
    uniform float u_aurTopGain;      // brightness scale for the upper aurora plane
    uniform float u_aurRaySamples;   // PERF: max vertical ray samples
    uniform float u_aurHeightScale;  // vertical envelope scale from the fixed origin
    uniform float u_aurOriginY;      // positive raises the emitting origin on screen
    uniform float u_aurOriginTaper;  // higher = stronger fade near emitting origin
    uniform float u_aurFilamentDensity;
    uniform float u_aurFilamentWidth;
    uniform float u_aurFilamentHeight;
    uniform float u_aurFilamentIntensity;
    uniform float u_aurFilamentTrack;
    uniform float u_cloudOn;
    uniform float u_aurOn;   // 1 = aurora enabled, 0 = skip it (e.g. disabled on mobile)
    uniform float u_cloudDot; // screen-space cloud dots per viewport height
    uniform float u_waterDot; // screen-space water dots per viewport height
    uniform float u_aaN;     // silhouette supersample taps: 0 off, 4, 8, or 9 (3x3)
    uniform float u_aaFeather; // silhouette edge feather width (world units)
    uniform float u_aaSigned;  // 1 = signed-distance coverage mode (overrides SSAA)
    uniform sampler2D u_txt; // in-shader terminal text layer
    uniform sampler2D u_noise; // baked value-noise LUT (256x256, R = grid, G = z+1 fold)
    uniform float u_noiseOn;    // 1 = sample the baked LUT, 0 = procedural hash noise (A/B)
    uniform float u_boot;    // 1 = terminal boot screen, 0 = live
    uniform float u_reveal;  // 0..1 intro reveal: canyon condenses in foreground→horizon (1 = full)
    uniform float u_viewHorizon; // active canyon/river vanishing point Y
    uniform float u_scroll;  // worldZ scroll speed (river flow)
    uniform float u_grain;   // pixel grain amplitude
    uniform float u_flowSpd; // river flow speed multiplier
    uniform float u_foam;    // foam flicker intensity
    uniform float u_sun;     // sun disk + glow brightness (0 = none)
    uniform float u_twilight; // 1 = twilight mode: sun orbits a small circle on the horizon
    uniform float u_twRadius; // twilight sun-orbit radius (uv units)
    uniform float u_twEllipse; // twilight orbit Y-axis scale (1 = round, <1 = flatter)
    uniform float u_twEllipseX; // twilight orbit X-axis scale (1 = round baseline)
    uniform float u_twSunZone;  // twilight: sun height (uv) below which sky is sunset-warm
    uniform float u_canyonDepth; // canyon wall/depth scale (1 = default)
    uniform float u_canyonShadow; // 1 = full canyon self-shadowing, 0 = simpler lighting
    uniform float u_canyonMaxSteps; // PERF: max canyon march iterations
    uniform float u_canyonStepScale; // PERF: larger steps = faster, rougher canyon
    uniform float u_refineSteps; // PERF: canyon hit-refine iterations (4..14)
    uniform float u_refineMode;  // PERF: 0 = bisection, 1 = secant (cheaper)
    uniform float u_hoist;       // PERF: 1 = read per-frame canyon constants cached once

    float hash(vec2 p){
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }
    float sq(float x){ return x * x; }
    float vnoise(vec2 p){
      // Baked path: the LUT's R channel is a 256-periodic random grid; hardware
      // bilinear filtering reconstructs value noise in one fetch (vs 4 hashes +
      // a manual smoothstep blend). Visually equivalent to the procedural path.
      if (u_noiseOn > 0.5) return texture2D(u_noise, (p + 0.5) * 0.00390625).r; // /256
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i), b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbm(vec2 p){
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 2; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(11.3, 7.7); a *= 0.5; }
      return s;
    }

    float auroraAntiLinearFold(float tb, float at){
      float t = clamp(tb, 0.0, 1.0);
      float keepNodes = smoothstep(0.010, 0.150, t) * (1.0 - smoothstep(0.78, 1.0, t));
      float p = t * 14.0 + at * 0.10;
      return keepNodes * (0.018 * sin(p + 0.8) + 0.010 * sin(p * 0.67 + 2.4));
    }

    float auroraCurveX(float tb, float at, float sweep){
      float wb = 0.16 * tb;
      float p = tb * 6.0 + at * 0.16;
      // Low-freq terms (sin(p), the 0.57 harmonic) average to a sideways LEAN over
      // the curtain's height, pulling it off-centre; the 1.9 harmonic cycles ~fully
      // so it's near-zero-mean and supplies the tight multiple nodes. Cut the lean
      // terms, boost the node term → stays centred but keeps (more) bends.
      float m = 0.65 * sin(p) + 0.22 * sin(p * 0.57 + 1.1) + 0.30 * sin(p * 1.9 + 2.3)
              + 0.35 * (fbm(vec2(tb * 2.6 + at * 0.05, 3.0)) - 0.5);  // halved low-freq wander → less drift
      return 0.5 + sweep - 0.06 + wb * m + auroraAntiLinearFold(tb, at);
    }

    float auroraGapX(float tb, float at){
      return 0.05 + 0.07 * tb
           + 0.11 * tb * (0.5 + 0.5 * sin(tb * 2.1 + at * 0.10))
           + 0.07 * tb * fbm(vec2(tb * 1.8 + at * 0.04, 12.0));
    }

    float auroraPathX(float tb, float at, float sweep, float originDelta, float rightSide){
      return auroraCurveX(tb + originDelta * rightSide, at, sweep)
           + auroraGapX(tb, at) * rightSide;
    }

    float auroraPathDxLite(float tb, float at, float originDelta, float rightSide){
      float t = clamp(tb + originDelta * rightSide, 0.0, 1.0);
      float p = t * 6.0 + at * 0.16;
      float m = 0.65 * sin(p) + 0.22 * sin(p * 0.57 + 1.1) + 0.30 * sin(p * 1.9 + 2.3);
      float dm = 0.65 * 6.0 * cos(p)
               + 0.22 * 0.57 * 6.0 * cos(p * 0.57 + 1.1)
               + 0.30 * 1.9 * 6.0 * cos(p * 1.9 + 2.3);
      float dx = 0.16 * m + 0.16 * t * dm;

      float keepNodes = smoothstep(0.010, 0.150, t) * (1.0 - smoothstep(0.78, 1.0, t));
      float ap = t * 14.0 + at * 0.10;
      dx += keepNodes * (0.018 * 14.0 * cos(ap + 0.8) +
                         0.010 * 0.67 * 14.0 * cos(ap * 0.67 + 2.4));

      float q = tb * 2.1 + at * 0.10;
      float gapDx = 0.07
                  + 0.11 * (0.5 + 0.5 * sin(q))
                  + 0.11 * tb * 0.5 * 2.1 * cos(q);
      dx += gapDx * rightSide;
      return dx;
    }

    // PERF: the two curtains share ONE curve. auroraPathX(tb2, …, 1.0) evaluates
    // auroraCurveX at (tb2 + originDelta), and the plane loop's tb1/tb2 differ by
    // exactly originDelta — so both curtains call auroraCurveX with the SAME
    // argument. These split helpers let the loop evaluate the curve (and its
    // derivative) once per sample and add only the cheap gap term for the right
    // curtain. Bit-identical to calling auroraPathX/auroraPathDxLite twice.
    float auroraCurveDxLite(float tb, float at){
      float t = clamp(tb, 0.0, 1.0);
      float p = t * 6.0 + at * 0.16;
      float m = 0.65 * sin(p) + 0.22 * sin(p * 0.57 + 1.1) + 0.30 * sin(p * 1.9 + 2.3);
      float dm = 0.65 * 6.0 * cos(p)
               + 0.22 * 0.57 * 6.0 * cos(p * 0.57 + 1.1)
               + 0.30 * 1.9 * 6.0 * cos(p * 1.9 + 2.3);
      float dx = 0.16 * m + 0.16 * t * dm;
      float keepNodes = smoothstep(0.010, 0.150, t) * (1.0 - smoothstep(0.78, 1.0, t));
      float ap = t * 14.0 + at * 0.10;
      dx += keepNodes * (0.018 * 14.0 * cos(ap + 0.8) +
                         0.010 * 0.67 * 14.0 * cos(ap * 0.67 + 2.4));
      return dx;
    }
    float auroraGapDx(float tb, float at){
      float q = tb * 2.1 + at * 0.10;
      return 0.07
           + 0.11 * (0.5 + 0.5 * sin(q))
           + 0.11 * tb * 0.5 * 2.1 * cos(q);
    }

    vec2 auroraRayBaseInfo(float tb, float at, float sweep, float span, float originDelta,
                           float rightSide, float originY, float x, float x0){
      float e = 0.010;
      float lo = max(0.0, tb - e);
      float hi = min(1.0, tb + e);
      float xLo = auroraPathX(lo, at, sweep, originDelta, rightSide);
      float xHi = auroraPathX(hi, at, sweep, originDelta, rightSide);
      float invSpan = 1.0 / max(hi - lo, 0.001);
      float dxdtRaw = (xHi - xLo) * invSpan;
      float dxdt = abs(dxdtRaw) < 0.010 ? (dxdtRaw < 0.0 ? -0.010 : 0.010) : dxdtRaw;
      float d2x = (xHi - 2.0 * x0 + xLo) / max(e * e, 0.00001);

      float wantDx = x - x0;
      float dt = clamp(wantDx / dxdt, -0.055, 0.055);
      float f = dxdt * dt + 0.5 * d2x * dt * dt - wantDx;
      float fp = dxdt + d2x * dt;
      dt -= f / (abs(fp) < 0.010 ? (fp < 0.0 ? -0.010 : 0.010) : fp);
      dt = clamp(dt, -0.060, 0.060);

      float baseY = originY - clamp(tb + dt, 0.0, 1.0) * span;
      float bendDx = abs(dxdtRaw);
      float bendD2 = abs(d2x);
      float nearVertical = 1.0 - smoothstep(0.045, 0.180, bendDx);
      float tightBend = smoothstep(0.90, 4.80, bendD2);
      float pinch = clamp(max(nearVertical, tightBend * 0.62), 0.0, 1.0);
      return vec2(baseY, mix(1.0, 0.22, pinch));
    }

    float auroraFilamentField(float tb, float planeT, float sheet, float x, float bandX,
                              float at, float pulseAt, float sweep, float originDelta, float side){
      if (tb <= 0.0) return 0.0;
      float depth = smoothstep(0.03, 0.58, tb);
      float laneScale = 82.0 * max(u_aurFilamentDensity, 0.10);
      float laneCoord = x + side * 0.37;
      if (u_aurFilamentTrack > 2.5) {
        float e = 0.010;
        float lo = max(0.0, tb - e);
        float hi = min(1.0, tb + e);
        float xLo = auroraPathX(lo, at, sweep, originDelta, side);
        float xHi = auroraPathX(hi, at, sweep, originDelta, side);
        float dxdtRaw = (xHi - xLo) / max(hi - lo, 0.001);
        float dxdt = abs(dxdtRaw) < 0.012 ? (dxdtRaw < 0.0 ? -0.012 : 0.012) : dxdtRaw;
        float curveT = clamp(tb + (x - bandX) / dxdt, 0.0, 1.0);
        laneCoord = curveT + side * 0.37;
      } else if (u_aurFilamentTrack > 1.5) {
        // Curve-lite keeps the cheap/stable vertical filament field. Earlier this
        // projected the stripe coordinate along the curve, which made filaments
        // bend visibly around the aurora folds.
        laneScale *= mix(1.0, 1.17, side);
        laneCoord = x + side * 0.213;
      } else if (u_aurFilamentTrack > 0.5) {
        laneScale *= mix(1.0, 1.17, side);
        laneCoord = x + side * 0.213;
      }
      float laneWarp = 1.7 * vnoise(vec2(floor(laneCoord * 19.0) + side * 17.0, 66.0));
      float lane = laneCoord * laneScale + laneWarp;
      float cell = floor(lane);
      float local = fract(lane);
      float center = 0.16 + 0.68 * hash(vec2(cell, 24.0 + side * 31.0));
      float width = mix(0.06, 0.21, hash(vec2(cell, 54.0 + side * 17.0))) *
                    max(u_aurFilamentWidth, 0.10);
      float stripe = exp(-sq((local - center) / max(width, 0.025)));

      float ampSeed = hash(vec2(cell, 81.0 + side * 13.0));
      float heightSeed = hash(vec2(cell, 117.0 + side * 19.0));
      float rayH = mix(0.10, 0.48, pow(heightSeed, 1.35)) * mix(0.45, 1.0, depth) *
                   max(u_aurFilamentHeight, 0.10);
      float heightGate = smoothstep(0.025, 0.10, planeT) *
                         (1.0 - smoothstep(rayH * 0.92, rayH * 1.18, planeT));
      float shimmer = 0.55 + 0.45 * sin(pulseAt * mix(0.24, 0.76, ampSeed) +
                                        ampSeed * 6.2831853 + cell * 0.71);
      float amp = mix(0.18, 1.45, pow(ampSeed, 1.50)) *
                  (1.0 + 0.45 * smoothstep(0.82, 0.98, ampSeed));
      float baseBias = 0.74 + 0.44 * (1.0 - smoothstep(0.20, 0.68, planeT));
      return sheet * stripe * heightGate * amp * shimmer * baseBias * u_aurFilamentIntensity;
    }

    // ── Volumetric clouds (3D raymarch, ported from the aurora sandbox) ──
    // 3D value noise + fbm (overloaded for vec3).
    float hash(vec3 p){
      p = fract(p * vec3(127.31, 311.7, 74.7));
      p += dot(p, p.yzx + 19.19);
      return fract((p.x + p.y) * p.z);
    }
    float vnoise(vec3 p){
      // Baked path (IQ trick): pack 3D value noise into a 2D LUT. The G channel
      // holds the same grid shifted by (37,17), so it equals the z+1 slice. One
      // bilinear fetch covers x/y; mix() over the z fraction covers z — turning
      // 8 hashes + 7 mixes into a single texture read + one lerp.
      if (u_noiseOn > 0.5){
        vec3 ip = floor(p), fp = fract(p);
        fp = fp * fp * (3.0 - 2.0 * fp);
        vec2 uv = (ip.xy + vec2(37.0, 17.0) * ip.z) + fp.xy;
        vec2 rg = texture2D(u_noise, (uv + 0.5) * 0.00390625).rg; // /256
        return mix(rg.r, rg.g, fp.z);
      }
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i + vec3(0.,0.,0.)), b = hash(i + vec3(1.,0.,0.));
      float c = hash(i + vec3(0.,1.,0.)), d = hash(i + vec3(1.,1.,0.));
      float e = hash(i + vec3(0.,0.,1.)), g = hash(i + vec3(1.,0.,1.));
      float h = hash(i + vec3(0.,1.,1.)), k = hash(i + vec3(1.,1.,1.));
      return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
                 mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
    }
    const mat3 cldRot = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
    float fbm(vec3 p){
      float s = 0.0, a = 0.5;
      s += a * vnoise(p); p = cldRot * p * 2.03; a *= 0.5;
      s += a * vnoise(p); p = cldRot * p * 2.01; a *= 0.5;
      s += a * vnoise(p); p = cldRot * p * 2.02; a *= 0.5;
      s += a * vnoise(p);
      return s;
    }
    // Cheap 2-octave fbm for the sun-shadow tap (halves that per-sample cost).
    float fbmSh(vec3 p){
      float s = vnoise(p) * 0.6;
      p = cldRot * p * 2.03;
      s += vnoise(p) * 0.3;
      return s;
    }
    // Density of the cloud slab. lod (1 near, 0 far) fades detail & softens the
    // coverage edge with distance so the layer recedes cleanly to the horizon.
    // Tuned constants baked from the sandbox: cover 0.45, scale 0.60.
    float cldVol(vec3 p, vec3 drift, float lod){
      float base = 0.65, top = 1.95;
      float env = smoothstep(base, base + 0.25, p.y) * smoothstep(top, top - 0.5, p.y);
      if (env < 0.001) return 0.0;
      vec3 q = p * 0.60 + drift;
      float n = fbm(q) - 0.14 * vnoise(q * 4.2) * lod;
      float w = mix(1.50, 0.31, lod);
      return smoothstep(0.45, 0.45 + w, n) * env;
    }
    // Front-to-back volumetric march, IQ single-tap shadow. Baked preset:
    // 40 steps, stepX 1.45, per-step dither (→ stippled, no banding lines).
    vec4 marchClouds(vec3 ro, vec3 rd, vec3 sunDir3, vec3 skyTint){
      vec3  drift = vec3(0.155 * 0.20, 0.0, 0.155) * u_time; // speed 0.155, angle 0.20
      vec3  sunC = vec3(1.00, 0.92, 0.78), amb = vec3(0.55, 0.65, 0.78);
      vec4  sum = vec4(0.0);
      float jit = hash(vec3(gl_FragCoord.xy, 7.0));
      float t = 0.4;
      for (int i = 0; i < 40; i++){
        if (sum.a > 0.99 || t > 60.0) break;
        float dt = clamp(0.04 * t, 0.08, 0.9) * 1.45;        // stepX 1.45
        vec3 p = ro + (t + (jit - 0.5) * dt) * rd;           // per-step dither → stipple, not lines
        if (p.y < 0.65){ if (rd.y <= 0.0) break; t += max(0.30, 0.08 * t) * 1.45; continue; }
        if (p.y > 1.95){ if (rd.y >= 0.0) break; t += max(0.30, 0.08 * t) * 1.45; continue; }
        float lod = 1.0 - smoothstep(4.0, 14.0, t);
        float d = cldVol(p, drift, lod);
        if (d > 0.01){
          float w  = (1.95 - p.y) / max(sunDir3.y, 0.20);
          float ls = fbmSh((p + sunDir3 * w) * 0.60 + drift);
          float lit = smoothstep(0.30, 0.60, ls);
          vec3  col = amb * 0.45 + sunC * lit;
          col = mix(col, skyTint, 1.0 - exp(-0.0011 * t * t));
          float a = clamp(d * 1.20, 0.0, 1.0);
          sum.rgb += col * a * (1.0 - sum.a);
          sum.a   += a       * (1.0 - sum.a);
        }
        t += dt;
      }
      return clamp(sum, 0.0, 1.0);
    }
    // ── In-valley meandering canyon (smooth, reference-style) ────────
    // A perspective camera flies along a winding valley: tall walls rise on
    // both sides and converge toward a warm glow at the vanishing point, with
    // a bright river threading the floor. Navy/aqua palette, aerial haze.
    // Gentle, low-frequency meander → the view looks mostly downstream with
    // walls framing the sides (not blocked by sharp bends). The argument is
    // wrapped to the meander's spatial period (2π/0.12) so sin() stays precise
    // even after long sessions — otherwise a large camZ ripples the walls. The
    // harmonics (0.12, 0.24) share that period, so the wrap is seamless.
    // One gentle harmonic → the wall silhouette is a single smooth curve (two
    // harmonics put visible wiggles in the ridge line). Wrapped to its period
    // (2π/0.09) so sin() stays precise over long sessions; the wrap is seamless.
    float vCenter(float z){
      float zz = mod(z, 69.813170);
      return 2.0 * sin(zz * 0.09 + 0.4);
    }
    // Pure smooth wall profile — clean gradient slopes like the reference, no
    // bumps/flutes on the silhouette. Only the gentle meander varies it.
    float canyonDepth(){
      return clamp(u_canyonDepth, 0.35, 2.20);
    }
    // PERF A/B (u_hoist): canyonMaxH/lowCanyon are constant for the whole frame
    // yet are read every march step and inside every vH(). With u_hoist on we
    // compute them once at the top of renderValley() and read the cached globals
    // here; with it off they recompute each call (the original behaviour) so the
    // FPS delta is measurable from the debug menu.
    float gCanyonMaxH = 0.0, gLowCanyon = 0.0;
    // PERF: the march-cap math below is re-evaluated on EVERY march step (148×
    // per ray, ×9 on AA edges) but several terms depend only on frame uniforms.
    // We cache those once per frame in renderValley() and read them here, so each
    // step does only the genuinely t/gap-dependent smoothsteps. Bit-identical.
    float gNearCap = 0.0, gLocalCapBase = 0.0, gStepScale = 1.0;
    float canyonMaxHCalc(){ return 16.0 * canyonDepth(); }
    float lowCanyonCalc(){ return 1.0 - smoothstep(0.35, 1.0, canyonDepth()); }
    float canyonMaxH(){ return (u_hoist > 0.5) ? gCanyonMaxH : canyonMaxHCalc(); }
    float lowCanyon(){ return (u_hoist > 0.5) ? gLowCanyon : lowCanyonCalc(); }
    float marchCap(float t){
      // Low canyon values need finer foreground steps to avoid ridge scallops,
      // but the far march must recover quickly so the river still reaches the
      // same vanishing point instead of shortening with the height slider.
      return mix(gNearCap, 0.8, smoothstep(6.0, 16.0, t));
    }
    float nearSurfaceMarchCap(float t, float gap){
      float cap = marchCap(t);
      // The remaining low-height scallop comes from grazing rays crossing the
      // wall in chunky depth steps. Shrink the step only while the ray is close
      // to the foreground/midground heightfield; sky/open-space and the far
      // horizon keep the normal cap so the valley mouth does not shorten.
      float nearSurface = smoothstep(2.2, 0.02, gap);
      float foreground = 1.0 - smoothstep(18.0, 34.0, t);
      // A lighter mid-distance clamp catches the second layered rim without
      // pulling the valley mouth/horizon forward like the original foreground
      // clamp did when it ran too far.
      float secondRim = smoothstep(20.0, 34.0, t) * (1.0 - smoothstep(34.0, 58.0, t)) * gLowCanyon * 0.42;
      float localCap = gLocalCapBase + max(gap, 0.0) * 0.12;
      float secondCap = min(cap, localCap * 1.65);
      float baseCap = mix(cap, min(cap, localCap), nearSurface * foreground);
      return mix(baseCap, min(baseCap, secondCap), nearSurface * secondRim) * gStepScale;
    }
    float vH(float x, float z){
      float d = abs(x - vCenter(z));
      return canyonMaxH() * smoothstep(2.6, 6.6, d);   // wider flat bed before the walls rise
    }
    float missCoverage(float minGap, float feather){
      if (feather <= 0.0001) return 0.0;
      return 1.0 - smoothstep(0.0, feather, minGap);
    }
    float signedCoverage(float mn, float feather){
      if (feather <= 0.0001) return (mn < 0.0) ? 1.0 : 0.0;
      return 1.0 - smoothstep(-feather, feather, mn);
    }
    // Build the valley view ray for a (possibly offset) screen uv.
    vec3 valleyRay(vec2 uvp, float asp, float fx){
      float sx  = (uvp.x - 0.5) * 2.0 * fx * asp;
      float sy  = (u_viewHorizon - uvp.y) * 2.0 * fx;  // uv is y-down
      float cpi = cos(0.0), spi = sin(0.0);            // centered active horizon
      return normalize(vec3(sx, sy * cpi - spi, sy * spi + cpi));
    }
    vec3 yawValleyRay(vec2 uvp, float asp, float fx, float yaw){
      vec3 r = valleyRay(uvp, asp, fx);
      float cyw = cos(yaw), syw = sin(yaw);
      return vec3(cyw * r.x + syw * r.z, r.y, cyw * r.z - syw * r.x);
    }
    // Coverage-only silhouette test for ONE ray: 1.0 solid, feathered at the
    // grazing rim, 0.0 sky. Same march + parabolic minGap refine as the main
    // pass, but no binary search / shading — cheap enough to supersample.
    // tc = the MAIN ray's grazing/hit distance. A sub-pixel offset ray crosses
    // the silhouette within a hair of there, so we only march a tight window
    // around tc instead of the whole ray (0.4 → far). The coverage result is
    // identical to a full march — we just skip the empty near/far span that the
    // main pass already proved holds no closer wall, cutting AA-edge cost ~3-5×.
    const float AA_WIN = 7.0;
    float wallCoverage(vec3 ro, vec3 dir, float camZ, float feather, float tc){
      float tStop = tc + AA_WIN;
      float t = max(0.4, tc - AA_WIN), stp = 0.30, tHit = -1.0;
      float minGap = 1.0e9, minGapT = 0.0;
      for (int k = 0; k < 240; k++){
        if (float(k) >= u_canyonMaxSteps) break;
        if (t > tStop) break;
        vec3 p = ro + dir * t;
        float gapNow = 1.0e6;
        if (p.y > canyonMaxH() + 0.5 && dir.y >= 0.0) break;
        if (p.z > camZ + 0.05){
          float gap = p.y - vH(p.x, p.z);
          gapNow = gap;
          if (gap < minGap){ minGap = gap; minGapT = t; }
          if (gap < 0.0){ tHit = t; break; }
        }
        stp = min(stp * 1.045, nearSurfaceMarchCap(t, gapNow)); t += stp;
      }
      if (tHit >= 0.0) return 1.0;
      if (minGap < 1.0e8){
        float h  = 0.18;
        vec3  pa = ro + dir * (minGapT - h);
        vec3  pb = ro + dir *  minGapT;
        vec3  pc = ro + dir * (minGapT + h);
        float ga = pa.y - vH(pa.x, pa.z);
        float gb = pb.y - vH(pb.x, pb.z);
        float gc = pc.y - vH(pc.x, pc.z);
        float den = ga - 2.0 * gb + gc;
        if (den > 1.0e-4){ float d = ga - gc; minGap = max(gb - (d * d) / (8.0 * den), 0.0); }
      }
      return missCoverage(minGap, feather);
    }
    // Signed-distance coverage: track the MIN of (p.y − vH) over the whole ray
    // — deeply negative inside the wall, ~0 at the silhouette, positive in sky.
    // A single continuous field, feathered by ±feather → comb-free analytic AA.
    float wallCoverageSDF(vec3 ro, vec3 dir, float camZ, float feather){
      float t = 0.4, stp = 0.30, mn = 1.0e9;
      for (int k = 0; k < 240; k++){
        if (float(k) >= u_canyonMaxSteps) break;
        vec3 p = ro + dir * t;
        float gapNow = 1.0e6;
        if (p.y > canyonMaxH() + 0.5 && dir.y >= 0.0) break;
        if (p.z > camZ + 0.05){
          float gap = p.y - vH(p.x, p.z);
          gapNow = gap;
          mn = min(mn, gap);
          if (gap < -3.0) break;                  // deep inside → certainly solid
        }
        stp = min(stp * 1.045, nearSurfaceMarchCap(t, gapNow)); t += stp;
      }
      return signedCoverage(mn, feather);
    }
    float canyonSunShadow(vec3 p, vec3 lightDir, float lowSun){
      float reach = mix(0.70, 2.20, lowSun);
      float shadow = 0.0;
      for (int i = 1; i <= 6; i++){
        float fi = float(i);
        vec3 q = p + lightDir * reach * fi;
        float clearance = q.y - vH(q.x, q.z);
        float block = 1.0 - smoothstep(-0.45, 0.95, clearance);
        shadow = max(shadow, block * (1.0 - fi * 0.105));
      }
      return clamp(shadow, 0.0, 1.0);
    }

    // ── Aurora curtain field ── the FULL plane/filament accumulation for one
    // scene uv (y-down), including the time-of-day window (aurZ), tonemap and
    // origin taper. Runs only in the offscreen sky pass (SKY_FS → u_aurTex, at
    // half res, ~30Hz); the main pass fetches the stored scalar and applies
    // the per-night colour + halftone dots. Lives in the shared prelude so a
    // future caller can never drift from the sky pass.
    float auroraField(vec2 uv){
      float todHr = u_tod * 24.0;
      float aurZ  = max(smoothstep(19.5, 22.5, todHr), 1.0 - smoothstep(2.0, 4.0, todHr));
        float at = u_time * u_aurSpeed;      // aurora's own clock (per-night speed, rolled at sunset)
        float pulseAt = at * 2.8;            // faster brightness flutter, slower spatial drift
        float heightScale = clamp(u_aurHeightScale, 0.5, 5.0);
        float span = 0.66;
        float oySwap   = 0.015 * sin(at * 0.110 + 0.6);
        float oyIndepR = 0.020 * sin(at * 0.130)       + 0.015 * sin(at * 0.071 + 2.1);
        float oyIndepL = 0.020 * sin(at * 0.097 + 1.2) + 0.015 * sin(at * 0.054 + 0.2);
        float originY = u_viewHorizon - clamp(u_aurOriginY, -0.25, 0.25);
        float oy  = originY + oyIndepR - oySwap;
        float oyL = originY + oyIndepL + oySwap;
        float originDelta = (oyL - oy) / span;
        float oyLow = max(oy, oyL);
        float aur = 0.0;
        if (uv.y < oyLow) {
          // Global left/right drift of the whole curtain — kept small (~0.4x) so
          // the aurora stays near centre and out of the canyon walls, while the
          // per-height sine terms below still give it multiple nodes/bends.
          float sweep = 0.014 * sin(at * 0.06) + 0.009 * sin(at * 0.041 + 1.3)
                      + 0.007 * (fbm(vec2(at * 0.03, 21.0)) - 0.5);
          float plane = 0.0;
          float lowerPlane = 0.0;
          float rays = 0.0;
          float filamentField = 0.0;
          float baseSearchMax = 0.34;
          float baseSearchReach = min(baseSearchMax, max(0.0, oyLow - uv.y));
          float searchMax = baseSearchMax * heightScale;
          float searchReach = min(searchMax, max(0.0, oyLow - uv.y));
          float searchNorm = clamp(searchReach / searchMax, 0.0, 1.0);
          float sampleEnergy = searchReach / max(baseSearchReach, 0.001);
          float searchWeight = smoothstep(0.0, 0.12, searchNorm);
          float planeSamples = clamp(u_aurPlaneSamples, 1.0, 56.0);
          float sampleFill = clamp(u_aurSampleFill, 0.0, 1.0);
          float raySamples = clamp(u_aurRaySamples, 0.0, 48.0);
          float fieldMode = 1.0 - smoothstep(0.5, 1.5, raySamples);
          // PERF: loop-invariants lifted out of the 28× plane loop (depend only
          // on frame uniforms / this pixel, not on the sample index k).
          float sampleCellY = searchReach / max(planeSamples, 1.0);
          float cellHalfY = 0.5 * sampleCellY * sampleFill * (1.0 + 0.32 * sampleFill);
          float fillBaseFloor = 0.58 * sampleFill;
          float topGain = clamp(u_aurTopGain, 0.25, 1.0);
          // PERF: skip radius for off-curtain samples. Beyond ~4.3σ of the widest
          // sheet gaussian (sgFill ≤ ~0.035) plus the worst-case xFill drift
          // (|dxdy| · cellHalfY), every term a sample adds is < e⁻⁹ — invisible.
          float skipDist = 0.15 + 2.6 * cellHalfY;
          for (int k = 0; k < 56; k++) {
            if (float(k) >= planeSamples) break;
            float sk = (float(k) + 0.5) / planeSamples;
            float yb = uv.y + searchReach * sk;
            float tb1 = (oyL - yb) / span;
            float tb2 = (oy  - yb) / span;
            // PERF: tb1 == tb2 + originDelta, so both curtains share one curve
            // evaluation (see auroraCurveDxLite) — only the gap term differs.
            float curveX = auroraCurveX(tb1, at, sweep);
            float b1 = curveX;
            float b2 = curveX + auroraGapX(tb2, at);
            float d1 = abs(uv.x - b1);
            float d2 = abs(uv.x - b2);
            // PERF: this pixel column is far from BOTH curtains at this sample
            // height — all of the taper/noise/filament math below scales by the
            // sheet gaussians, so the whole tail can be skipped.
            if (min(d1, d2) > skipDist) continue;
            float sgCore1 = 0.013 * (0.15 + 0.95 * tb1);
            float sgCore2 = 0.013 * (0.15 + 0.95 * tb2);
            float sheetCore1 = (tb1 > 0.0) ? exp(-d1 * d1 / (2.0 * sgCore1 * sgCore1)) : 0.0;
            float sheetCore2 = (tb2 > 0.0) ? exp(-d2 * d2 / (2.0 * sgCore2 * sgCore2)) : 0.0;

            float centerHeight = mix(0.048, 0.120, smoothstep(0.03, 0.56, tb2)) * heightScale;
            float centerPlaneT = max(0.0, yb - uv.y) / max(centerHeight, 0.001);
            float originDamp = mix(0.24, 1.0, smoothstep(0.0, 0.20, max(tb1, tb2)));

            float dCurve = auroraCurveDxLite(tb1, at);   // shared curve slope (see above)
            float dxdy1 = -dCurve / span;
            float dxdy2 = -(dCurve + auroraGapDx(tb2, at)) / span;
            float shift1 = (abs(dxdy1) > 0.002) ? clamp((uv.x - b1) / dxdy1, -cellHalfY, cellHalfY) : 0.0;
            float shift2 = (abs(dxdy2) > 0.002) ? clamp((uv.x - b2) / dxdy2, -cellHalfY, cellHalfY) : 0.0;
            float srcY1 = clamp(yb + shift1, uv.y, oyL);
            float srcY2 = clamp(yb + shift2, uv.y, oy);
            float cellTb1 = (oyL - srcY1) / span;
            float cellTb2 = (oy - srcY2) / span;
            float xFill1 = b1 + dxdy1 * (srcY1 - yb);
            float xFill2 = b2 + dxdy2 * (srcY2 - yb);
            float sweepFill1 = min(abs(dxdy1) * cellHalfY * 0.42, 0.030);
            float sweepFill2 = min(abs(dxdy2) * cellHalfY * 0.42, 0.030);
            float sgFill1 = sqrt(sgCore1 * sgCore1 + sweepFill1 * sweepFill1);
            float sgFill2 = sqrt(sgCore2 * sgCore2 + sweepFill2 * sweepFill2);
            float sheet1 = step(0.0, cellTb1) *
                           exp(-sq(uv.x - xFill1) / (2.0 * sgFill1 * sgFill1));
            float sheet2 = step(0.0, cellTb2) *
                           exp(-sq(uv.x - xFill2) / (2.0 * sgFill2 * sgFill2));
            float planeHeight1 = mix(0.048, 0.120, smoothstep(0.03, 0.56, cellTb1)) * heightScale;
            float planeHeight2 = mix(0.048, 0.120, smoothstep(0.03, 0.56, cellTb2)) * heightScale;
            float planeT1 = max(0.0, srcY1 - uv.y) / max(planeHeight1, 0.001);
            float planeT2 = max(0.0, srcY2 - uv.y) / max(planeHeight2, 0.001);
            float bottomTaper1 = max(smoothstep(0.025, 0.12, planeT1), fillBaseFloor);
            float bottomTaper2 = max(smoothstep(0.025, 0.12, planeT2), fillBaseFloor);
            float topTaper1 = 1.0 - smoothstep(0.94, 1.34, planeT1);
            float topTaper2 = 1.0 - smoothstep(0.94, 1.34, planeT2);
            float crest1 = exp(-sq((planeT1 - 0.18) / 0.24));
            float crest2 = exp(-sq((planeT2 - 0.18) / 0.24));
            float midShelf1 = smoothstep(0.22, 0.36, planeT1) * (1.0 - smoothstep(0.78, 1.12, planeT1));
            float midShelf2 = smoothstep(0.22, 0.36, planeT2) * (1.0 - smoothstep(0.78, 1.12, planeT2));
            float planeGradient1 = 0.44 + 2.10 * crest1 + 0.95 * midShelf1;
            float planeGradient2 = 0.44 + 2.10 * crest2 + 0.95 * midShelf2;
            float upperScale1 = mix(1.0, topGain, smoothstep(0.52, 1.10, planeT1));
            float upperScale2 = mix(1.0, topGain, smoothstep(0.52, 1.10, planeT2));
            float fall1 = exp(-planeT1 * 0.42) * bottomTaper1 * topTaper1;
            float fall2 = exp(-planeT2 * 0.42) * bottomTaper2 * topTaper2;
            plane += (sheet1 * fall1 * planeGradient1 * upperScale1 + sheet2 * fall2 * planeGradient2 * upperScale2) *
                     0.25 * searchWeight * originDamp * sampleEnergy;

            float lowerH1 = mix(0.15, 0.40, vnoise(vec2(cellTb1 * 9.5 + at * 0.09, 41.0)));
            float lowerH2 = mix(0.15, 0.40, vnoise(vec2(cellTb2 * 9.5 + at * 0.08 + 5.7, 73.0)));
            float lowerGate1 = smoothstep(0.018, 0.080, planeT1) *
                               (1.0 - smoothstep(lowerH1 * 0.82, lowerH1 * 1.18, planeT1));
            float lowerGate2 = smoothstep(0.018, 0.080, planeT2) *
                               (1.0 - smoothstep(lowerH2 * 0.82, lowerH2 * 1.18, planeT2));
            float patch1 = fbm(vec2(cellTb1 * 13.0 + at * 0.18, uv.x * 2.1 + 18.0));
            float patch2 = fbm(vec2(cellTb2 * 13.0 + at * 0.16 + 3.4, uv.x * 2.1 + 29.0));
            float flicker1 = 0.72 + 0.28 * sin(pulseAt * (0.22 + patch1 * 0.30) + patch1 * 6.2831853);
            float flicker2 = 0.72 + 0.28 * sin(pulseAt * (0.20 + patch2 * 0.30) + patch2 * 6.2831853 + 1.2);
            float local1 = mix(0.28, 1.58, pow(patch1, 1.55)) * flicker1;
            float local2 = mix(0.28, 1.58, pow(patch2, 1.55)) * flicker2;
            lowerPlane += (sheet1 * lowerGate1 * local1 + sheet2 * lowerGate2 * local2) *
                          0.16 * searchWeight * originDamp * sampleEnergy;
            filamentField += fieldMode * searchWeight * originDamp * (
              auroraFilamentField(tb1, centerPlaneT, sheetCore1, uv.x, b1, at, pulseAt, sweep, originDelta, 0.0) +
              auroraFilamentField(tb2, centerPlaneT, sheetCore2, uv.x, b2, at, pulseAt, sweep, originDelta, 1.0)
            ) * 0.20 * sampleEnergy;
          }

          float raySampleDenom = max(raySamples, 1.0);
          for (int r = 0; r < 48; r++) {
            if (float(r) >= raySamples) break;
            float ri = float(r);
            float seedA = hash(vec2(ri, 18.4));
            float seedB = hash(vec2(ri, 72.9));
            float jitterA = (seedA - 0.5) * 1.18 + (hash(vec2(ri, 104.2)) - 0.5) * 0.42;
            float jitterB = (seedB - 0.5) * 1.18 + (hash(vec2(ri, 144.7)) - 0.5) * 0.42;
            float srcTb1 = 0.97 * fract((ri + 0.5 + jitterA) / raySampleDenom);
            float srcTb2 = 0.97 * fract((ri + 0.5 + jitterB) / raySampleDenom + 0.47);
            float srcX1 = auroraPathX(srcTb1, at, sweep, originDelta, 0.0);
            float srcX2 = auroraPathX(srcTb2, at, sweep, originDelta, 1.0);
            vec2 baseInfo1 = auroraRayBaseInfo(srcTb1, at, sweep, span, originDelta, 0.0, oyL, uv.x, srcX1);
            vec2 baseInfo2 = auroraRayBaseInfo(srcTb2, at, sweep, span, originDelta, 1.0, oy,  uv.x, srcX2);
            float drop1 = max(0.0, baseInfo1.x - uv.y);
            float drop2 = max(0.0, baseInfo2.x - uv.y);
            float lenSeed1 = hash(vec2(ri, 31.7));
            float lenSeed2 = hash(vec2(ri, 52.6));
            float widthSeed1 = hash(vec2(ri, 203.4));
            float widthSeed2 = hash(vec2(ri, 261.8));
            float brightSeed1 = hash(vec2(ri, 318.2));
            float brightSeed2 = hash(vec2(ri, 377.6));
            float rayDepth1 = smoothstep(0.04, 0.58, srcTb1);
            float rayDepth2 = smoothstep(0.04, 0.58, srcTb2);
            float len1 = mix(0.040, 0.240, clamp(srcTb1, 0.0, 1.0)) * heightScale * mix(0.46, 0.96, pow(lenSeed1, 1.25));
            float len2 = mix(0.040, 0.240, clamp(srcTb2, 0.0, 1.0)) * heightScale * mix(0.46, 0.96, pow(lenSeed2, 1.25));
            float rawT1 = drop1 / max(len1, 0.001);
            float rawT2 = drop2 / max(len2, 0.001);
            float tailT1 = clamp(rawT1, 0.0, 1.0);
            float tailT2 = clamp(rawT2, 0.0, 1.0);
            float upperRamp1 = smoothstep(0.12, 0.92, tailT1);
            float upperRamp2 = smoothstep(0.12, 0.92, tailT2);
            float baseHot1 = 1.0 - smoothstep(0.26, 0.62, tailT1);
            float baseHot2 = 1.0 - smoothstep(0.26, 0.62, tailT2);
            float rayShape1 = smoothstep(0.025, 0.14, rawT1) * (1.0 - smoothstep(1.02, 1.28, rawT1));
            float rayShape2 = smoothstep(0.025, 0.14, rawT2) * (1.0 - smoothstep(1.02, 1.28, rawT2));
            float yRay1 = rayShape1 * mix(1.05, 0.60, upperRamp1);
            float yRay2 = rayShape2 * mix(1.05, 0.60, upperRamp2);
            float bendWidth1 = baseInfo1.y;
            float bendWidth2 = baseInfo2.y;
            float bendFade1 = mix(0.38, 1.0, smoothstep(0.24, 0.76, bendWidth1));
            float bendFade2 = mix(0.38, 1.0, smoothstep(0.24, 0.76, bendWidth2));
            float xWidth1 = mix(0.0026, 0.0060, pow(widthSeed1, 1.55)) * mix(0.40, 1.0, rayDepth1) * bendWidth1;
            float xWidth2 = mix(0.0026, 0.0060, pow(widthSeed2, 1.55)) * mix(0.40, 1.0, rayDepth2) * bendWidth2;
            float xRay1 = exp(-sq((uv.x - srcX1) / xWidth1));
            float xRay2 = exp(-sq((uv.x - srcX2) / xWidth2));
            float fade1 = mix(0.20, 1.0, smoothstep(0.0, 0.24, srcTb1)) * (1.0 - smoothstep(1.05, 1.32, srcTb1));
            float fade2 = mix(0.20, 1.0, smoothstep(0.0, 0.24, srcTb2)) * (1.0 - smoothstep(1.05, 1.32, srcTb2));
            float wave1 = 0.5 + 0.5 * sin(pulseAt * (0.22 + seedA * 0.36) + seedA * 6.2831853 + ri * 0.43);
            float wave2 = 0.5 + 0.5 * sin(pulseAt * (0.20 + seedB * 0.34) + seedB * 6.2831853 + ri * 0.39 + 1.7);
            float pulse1 = mix(0.16, 1.42, pow(wave1, 1.35));
            float pulse2 = mix(0.16, 1.42, pow(wave2, 1.35));
            float amp1 = mix(0.08, 1.20, pow(brightSeed1, 1.70));
            float amp2 = mix(0.08, 1.20, pow(brightSeed2, 1.70));
            amp1 *= 1.0 + 0.70 * smoothstep(0.78, 0.96, seedA);
            amp2 *= 1.0 + 0.70 * smoothstep(0.78, 0.96, seedB);
            float tailBoost1 = mix(0.95, 1.12 + 0.18 * hash(vec2(ri, 519.8)), baseHot1);
            float tailBoost2 = mix(0.95, 1.12 + 0.18 * hash(vec2(ri, 563.1)), baseHot2);
            rays += xRay1 * yRay1 * fade1 * pulse1 * amp1 * tailBoost1 * bendFade1;
            rays += xRay2 * yRay2 * fade2 * pulse2 * amp2 * tailBoost2 * bendFade2;
          }
          plane = 1.0 - exp(-plane * 0.23);
          lowerPlane = 1.0 - exp(-lowerPlane * 0.44);
          rays = 1.0 - exp(-rays * 0.40);
          filamentField = 1.0 - exp(-filamentField * 0.44);
          aur = 0.62 * plane + 0.30 * mix(rays, filamentField, fieldMode) + 0.34 * lowerPlane;
        }
        aur = clamp(aurZ * aur, 0.0, 1.0);
        float originDistance = max(0.0, oyLow - uv.y);
        float originTaper = clamp(u_aurOriginTaper, 0.5, 4.0);
        float originRamp = pow(smoothstep(0.030, 0.280, originDistance), originTaper);
        float originFloor = mix(0.32, 0.16, smoothstep(1.0, 4.0, originTaper));
        float originScale = mix(originFloor, 1.0, originRamp);
        aur *= originScale;
        return aur;
    }
  `;

  // ── Main scene shader ── the shared prelude + renderValley + the halftone /
  // text / post composite.
  const FS = FS_COMMON + `
    // Offscreen half-res sky layers, rendered by SKY_FS into FBO textures
    // (cloud march on u_cloudTex, aurora curtains on u_aurTex). Sampling them
    // here replaces the per-pixel volumetric loops.
    uniform sampler2D u_cloudTex;
    uniform sampler2D u_aurTex;
    vec3 renderValley(vec2 uv){
      gCanyonMaxH = canyonMaxHCalc();   // PERF: cache per-frame constants once (read when u_hoist on)
      gLowCanyon  = lowCanyonCalc();
      gNearCap      = mix(0.8, 0.28, gLowCanyon);          // marchCap near-field cap
      gLocalCapBase = mix(0.20, 0.075, gLowCanyon);        // nearSurface local cap base
      gStepScale    = clamp(u_canyonStepScale, 1.0, 2.6);  // frame-constant step multiplier
      float asp = u_res.x / max(1.0, u_sceneH);   // v9: 场景纵横比按场景区高度(不含尾部)
      float fx  = tan(0.60);                           // field of view
      float sx  = (uv.x - 0.5) * 2.0 * fx * asp;
      float sy  = (u_viewHorizon - uv.y) * 2.0 * fx;   // uv is y-down
      // v14 指针视差: 只摇 3D 峡谷相机的射线, 不动 uv 层(天空渐变/太阳/光晕
      // 都是 uv 空间, 远墙 haze 也朝同像素 skyHaze 溶解)——近景峡谷/河面随
      // 指针轻移, 远景天空锚定, 剪影衔接保持无缝; 尾部溶解(uvS)不受影响。
      sx += u_par.x;
      sy += u_par.y;
      float cpi = cos(0.0), spi = sin(0.0);            // centered active horizon
      vec3 dir  = normalize(vec3(sx, sy * cpi - spi, sy * spi + cpi));

      float camZ = mod(u_time * u_scroll * 2.2, 69.813170); // wrap → stays small & seamless
      float camX = vCenter(camZ);                      // follow the river
      vec3  ro   = vec3(camX, 2.2, camZ);
      // Yaw the view to track the valley ahead so the EXIT stays centred on
      // screen (the meander curves the walls instead of sliding the opening
      // off-frame).
      float zAhd = camZ + 20.0;
      float yaw  = atan(vCenter(zAhd) - camX, 20.0);
      float cyw  = cos(yaw), syw = sin(yaw);
      dir = vec3(cyw * dir.x + syw * dir.z, dir.y, cyw * dir.z - syw * dir.x);

      float gd   = length(vec2((uv.x - 0.5) * 1.9, (uv.y - 0.5) * 3.2));
      float glow = max(0.0, 0.45 - gd);                // vanishing-point bloom

      // ── Time of day ── drives sky colour, sun, glow, stars and aurora.
      float aDay     = (u_tod * 24.0 - 6.0) / 12.0;    // 0 dawn .. 1 dusk
      float elev     = sin(aDay * 3.14159265);         // sun elevation (-1..1)
      float sunUp    = smoothstep(-0.10, 0.12, elev);
      // golden hour, widened ~30min on each side (elev window stretched out by
      // ~0.13 at both the early and late edges).
      float twi      = smoothstep(-0.33, -0.08, elev) * (1.0 - smoothstep(-0.08, 0.23, elev));
      float nightAmt = smoothstep(0.06, -0.45, elev);  // 0 day .. 1 night

      // Twilight day-amount: full while the sun is up, then ramps to night. The
      // ramp is keyed to how far the sun DISK has set behind the horizon, not a
      // fixed elevation — setFrac is the fraction of the disk below the line,
      // derived from the orbit (radius × ellipse) vs the disk radius (0.052), so
      // it stays correct as those sliders change. Dimming begins at ~75% set and
      // darkens quickly to full night just past fully-set. Monotonic — no hump.
      // Hero only: bracket the day a few min tighter — end twilight slightly
      // earlier at dusk and begin it slightly later at dawn. Near the horizon the
      // sun's elevation moves ≈ π rad / 12 h, so 0.025 of elevation ≈ 6 min;
      // biasing elev down by that shifts BOTH edges of night outward symmetrically.
      float elevNight = elev - 0.025;
      float setFrac = 0.5 - elevNight * (u_twRadius * u_twEllipse) / 0.104;
      float twDay = 1.0 - smoothstep(0.75, 1.15, setFrac);
      // Daylight→sunset blend driven by the sun's HEIGHT above the horizon (not the
      // clock): sunHeight is the disk's rise above the line in uv (radius×ellipse×
      // elev). Within u_twSunZone of the horizon the sky is sunset-warm; above the
      // zone it blends back to daylight blue. The zone height is the SUN ZONE knob.
      float sunHeight = u_twRadius * u_twEllipse * elev;
      float sunsetAmt = 1.0 - smoothstep(0.0, u_twSunZone, sunHeight);
      twi = mix(twi, twDay * mix(0.35, 0.85, sunsetAmt), u_twilight);

      vec3 NAVY_LO=vec3(0.015,0.035,0.12), NAVY=vec3(0.04,0.11,0.30);
      vec3 STEEL=vec3(0.11,0.24,0.46),  AQUA=vec3(0.58,0.80,0.80);
      // Twilight mutes the daytime-blue lift, but lets MORE blue back in near noon
      // (sun high → 0.34) than at the horizon (sunset → 0.14 dusk band), and falls
      // toward the dark night base once the sun has fully set (twDay).
      float skyUp = mix(sunUp, twDay * mix(0.40, 0.14, sunsetAmt), u_twilight);
      // Sky endpoints shift night→day; the horizon warms through golden hour.
      vec3 SKY_TOP = mix(vec3(0.026,0.046,0.115), vec3(0.060,0.160,0.420), smoothstep(0.0,0.55,skyUp));
      vec3 SKY_HOR = mix(vec3(0.060,0.112,0.245), vec3(0.330,0.560,0.820), smoothstep(0.0,0.55,skyUp));
      SKY_HOR = mix(SKY_HOR, vec3(0.85,0.45,0.24), twi * 0.6);
      // Twilight: warm the WHOLE gradient toward sunset — upper sky to a dusk rose
      // (warm-dominant, not blue) and the horizon to a deep burnt orange — so it
      // reads as a perpetual sunset rather than midday.
      SKY_TOP = mix(SKY_TOP, vec3(0.160,0.090,0.110), u_twilight * twi);
      SKY_HOR = mix(SKY_HOR, vec3(0.98,0.44,0.22), u_twilight * twi * 0.55);
      // The valley-mouth glow follows the sun: warm by day/golden, cool & dim at night.
      vec3 GLOW = mix(vec3(0.26,0.40,0.80), vec3(0.99,0.74,0.55), max(sunUp, twi));

      // Perf: during the opening (u_reveal ≈ 0) only the bare sky gradient is
      // visible — the canyon raymarch, cloud march, sun god-rays and aurora all
      // sit hidden behind it. Skip the whole scene and return just the gradient,
      // so the intro text phase is cheap. (Exactly the reveal=0 composite output.)
      if (u_reveal <= 0.001) {
        float sgInit = pow(clamp(uv.y / 0.6, 0.0, 1.0), 1.6);
        return mix(SKY_TOP, SKY_HOR, sgInit);
      }

      // Capped growing step: fine near the camera, and the cap keeps far steps
      // small enough that the wall silhouettes stay smooth (no stair-step kinks
      // in the ridge line). Sky rays bail early once above all walls & rising.
      float t = 0.4, stp = 0.30, prevT = 0.0, tHit = -1.0;
      float minGap = 1.0e9, minGapT = 0.0;
      for (int k = 0; k < 240; k++){
        if (float(k) >= u_canyonMaxSteps) break;
        vec3 p = ro + dir * t;
        float gapNow = 1.0e6;
        if (p.y > canyonMaxH() + 0.5 && dir.y >= 0.0) break; // above tallest wall, ascending → sky
        if (p.z > camZ + 0.05){
          float gap = p.y - vH(p.x, p.z);
          gapNow = gap;
          if (gap < minGap){ minGap = gap; minGapT = t; }   // track closest approach
          if (gap < 0.0){
            float a = prevT, b = t;
            // PERF: a hit whose whole bracket sits beyond the haze saturation
            // distance (≥96% faded toward skyHaze at 108, see below) doesn't
            // need a sub-step-accurate depth — skip the 14-iteration refine.
            if (a > 108.0) { tHit = b; break; }
            if (u_refineMode > 0.5){
              // secant: keep the bracket gap values and interpolate toward the
              // zero crossing — converges faster than bisection, ~1 vH per step.
              vec3 pa0 = ro + dir * a; float ga = pa0.y - vH(pa0.x, pa0.z);
              float gb = gap;                          // gap at b (=t), < 0
              for (int r = 0; r < 14; r++){
                if (float(r) >= u_refineSteps) break;
                float mt = a + (b - a) * ga / max(ga - gb, 1.0e-5);
                vec3 pm = ro + dir * mt; float gm = pm.y - vH(pm.x, pm.z);
                if (gm < 0.0){ b = mt; gb = gm; } else { a = mt; ga = gm; }
              }
            } else {
              for (int r = 0; r < 14; r++){
                if (float(r) >= u_refineSteps) break;
                float mt = 0.5 * (a + b);
                vec3 pm = ro + dir * mt;
                if (pm.y < vH(pm.x, pm.z)) b = mt; else a = mt;
              }
            }
            tHit = b; break;
          }
        }
        prevT = t; stp = min(stp * 1.045, nearSurfaceMarchCap(t, gapNow)); t += stp;  // capped march → smoother silhouette
      }

      // PERF: the canyon slopes hide the sky behind them, yet every wall pixel
      // used to build the full sky anyway — sun disk, cloud march, stars and the
      // 28-sample aurora — only for the final composite to throw it away (walls
      // fade toward skyHaze, which carries none of those extras by design). A
      // hit pixel can only show background if the AA pass below lowers its
      // coverage under 1.0, and that pass triggers on exactly this predicate
      // (plus the SDF blend's |minGap| < 1.22 window and the intro reveal) — so
      // anything outside it can skip building the sky extras entirely. Kept as
      // a cheap conservative test so the full coverage pass stays where it was.
      float covQ = (tHit >= 0.0) ? 1.0 : missCoverage(minGap, u_aaFeather);
      float surfQ = (tHit >= 0.0) ? tHit : minGapT;
      float revealFrontQ = mix(-16.0, 130.0, u_reveal);
      float revealQ = smoothstep(revealFrontQ + 16.0, revealFrontQ - 16.0, surfQ);
      bool skyVisible = covQ < 0.999 || revealQ < 0.999
                     || abs(minGap) < 1.25 || fwidth(covQ) > 0.0008;

      // ── Sky ── day/night gradient + sun glow + stars + aurora (from v1).
      float asp2 = u_res.x / max(1.0, u_sceneH);   // v9: 同 asp, 按场景区高度
      float skyG = pow(clamp(uv.y / 0.6, 0.0, 1.0), 1.6);     // top → horizon
      vec3 sky = mix(SKY_TOP, SKY_HOR, skyG);
      // Intro: the bare blue gradient is the floor that's visible from the very
      // start; the sun, valley glow, clouds, stars and aurora (skybox extras) are
      // layered on below and only fade in over the back half of the reveal (they
      // live at the horizon/overhead, the far end of the front-to-back sweep).
      vec3 skyBare = sky;
      float skyReveal = smoothstep(0.5, 1.0, u_reveal);
      // Fold the valley-mouth glow in, then capture skyHaze = the bare
      // ATMOSPHERE (gradient + glow only). The far-wall haze fades toward THIS,
      // so the sun disk / stars / aurora never bleed onto the canyon walls.
      sky += GLOW * glow * 0.5;
      vec3 skyHaze = sky;
      // sun — rises low on the LEFT at dawn, arcs up over the canyon, and sets
      // just to the RIGHT of the valley opening at dusk. Keep the horizontal
      // arc alive beyond dusk so the disk fully crosses the horizon instead of
      // clamping at the old horizon point and falling straight down.
      float sunArcT = clamp(aDay, -0.18, 1.18);
      float sunPathShift = 0.052 / max(asp2, 0.001); // half an apparent sun diameter
      float sunX = mix(-0.30, 0.55, sunArcT) - sunPathShift;
      // sunY keeps DESCENDING as the sun drops below the horizon (elev<0) so it
      // visibly sinks past the valley opening and the floor occludes it, instead
      // of fading out while still aloft. Higher apex (0.0) → arcs more overhead,
      // as if it rose behind us. (Update the JS solver's range if you change 0.0.)
      float sunY = mix(0.47, 0.00, clamp(elev, -0.42, 1.0));
      // Twilight mode: the sun traces a small orbit centred on the horizon line
      // (horizontally at the pane centre), so it RISES FROM and SETS INTO the
      // horizon — on the line at dawn/dusk, up to u_twRadius above it at noon, and
      // below (occluded) at night. Day length is unchanged — it tracks the shorter
      // path, so the disk drifts more slowly. The X radius is divided by the
      // aspect so the orbit reads round at u_twEllipse = 1; lower values flatten Y.
      float twHorizonY = u_viewHorizon;                    // active march horizon line
      float twTheta = 3.14159265 * (1.0 - aDay);           // dawn→dusk = left→top→right
      float twX = 0.5 + (u_twRadius / max(asp2, 0.001) * u_twEllipseX) * cos(twTheta);
      float twY = twHorizonY - (u_twRadius * u_twEllipse) * sin(twTheta);
      sunX = mix(sunX, twX, u_twilight);
      sunY = mix(sunY, twY, u_twilight);
      vec3  sunCol = mix(vec3(1.0, 0.86, 0.56), vec3(1.0, 0.40, 0.22), twi);  // reddens toward sunset
      // Visibility follows the actual screen-space horizon instead of sun
      // elevation. The disk stays full-strength until it is geometrically
      // excluded below the valley mouth; the tiny terminal fade prevents a pop.
      float sunHorizonY = u_viewHorizon;
      float sunVis = 1.0 - smoothstep(sunHorizonY + 0.050, sunHorizonY + 0.068, sunY);
      // ── Sun: glowing BALL of light + animated god-rays (ported from sandbox) ──
      // (sunCol/sunVis stay unconditional — the volumetric shafts and skyHaze
      // below need them on wall pixels too; the disk itself is sky-only.)
      if (skyVisible) {
        float sd   = length((uv - vec2(sunX, sunY)) * vec2(asp2, 1.0));
        float rr     = sd / 0.052;                            // normalised radius
        float sCore  = exp(-rr * rr * 5.0);                   // hot bright centre
        float sBall  = smoothstep(0.62, 0.28, rr);            // soft-edged disk
        // angular ray field: irregular noise on a circle, two scales, drifting; the
        // rays' length & intensity vary over time via rayMod, plus a slow sweep
        float sAng   = atan(uv.y - sunY, (uv.x - sunX) * asp2) + u_time * 0.02;
        vec2  sAc    = vec2(cos(sAng), sin(sAng));
        float sRayB  = fbm(sAc * 4.0 + vec2(u_time * 0.22, 3.0));
        float sRayF  = fbm(sAc * 10.0 - vec2(u_time * 0.36, 9.0));
        float sRayM  = pow(clamp(sRayB * (0.5 + 0.6 * sRayF), 0.0, 1.0), 2.1);
        float sFall  = mix(2.6, 0.9, sRayM);                  // strong ray → long reach
        float sGlowR = exp(-rr * 1.7) * 0.35 + exp(-rr * sFall) * sRayM * 0.85;
        sky += sunVis * u_sun * 1.6 * (0.7 + 0.5 * twi) * sunCol
               * (sCore * 0.7 + sBall + sGlowR);
      }

      // Volumetric shafts: sun rays converge toward the canyon mouth and ride
      // the same haze as the far walls. Kept soft/noisy so resize resolution
      // changes cannot create hard bands across the scene.
      float mouthX = 0.5 - tan(yaw) / (2.0 * fx * asp);
      vec2 sunP = vec2(sunX * asp2, sunY);
      vec2 mouthP = vec2(mouthX * asp2, u_viewHorizon);
      vec2 rayAxis = normalize(mouthP - sunP + vec2(0.0001, 0.0001));
      vec2 rayRel = vec2(uv.x * asp2, uv.y) - sunP;
      float rayAlong = dot(rayRel, rayAxis);
      float rayCross = abs(rayRel.x * rayAxis.y - rayRel.y * rayAxis.x);
      float rayLow = sunVis * (1.0 - smoothstep(0.36, 0.90, elev)) * (0.38 + 0.62 * twi);
      float rayNoise = 0.55 + 0.45 * fbm(vec2(rayAlong * 2.4 + u_time * 0.035, rayCross * 24.0 + 4.0));
      float rayMask = smoothstep(0.00, 0.12, rayAlong)
                    * (1.0 - smoothstep(1.05, 1.85, rayAlong))
                    * smoothstep(0.135, 0.012, rayCross)
                    * smoothstep(0.74, 0.34, uv.y);
      vec3 rayCol = sunCol * (rayMask * rayNoise * rayLow * u_sun * 0.18);
      sky += rayCol;
      skyHaze += rayCol * 0.72;

      // ── Clouds: VOLUMETRIC 3D layer (ported from the aurora sandbox) ── a real
      // cloud deck overhead, pitched so it begins just above the valley mouth and
      // drifts up/over the canyon as you travel. Tuned preset baked in.
      // PERF: sky-only — wall pixels above the horizon used to pay the full
      // 40-step cloud march for a value the composite then discarded.
      if (skyVisible) {
        // Fade clouds out before the heavy aurora window, then skip the cloud
        // raymarch entirely while hidden so the aurora owns the night GPU budget.
        float cloudHr = u_tod * 24.0;
        float cloudDayGate = u_cloudOn * min(
          1.0 - smoothstep(18.6, 20.4, cloudHr),  // sunset fade-out
          smoothstep(4.0, 5.2, cloudHr)           // pre-sunrise fade-in after aurora
        );
        float ch = u_viewHorizon;                            // sky/valley-mouth horizon
        vec2  P    = uv * vec2(u_res.x, u_sceneH);           // v9: 真实设备 px(尾部连续)
        float cell = max(u_sceneH / max(u_cloudDot, 1.0), 2.0);
        vec2  Cd   = floor(P / cell);
        vec2  dotCenter = (Cd + 0.5) * cell;
        vec2  dotUv = dotCenter / vec2(u_res.x, u_sceneH);
        vec2  Cp   = (P - dotCenter) / cell;
        // Sample the cloud deck once at the dot cell centre. The shader still
        // executes per pixel, but every pixel inside a dot receives the same
        // cloud value, so volumetric texture noise cannot show through the dot.
        vec3 crd = normalize(vec3((dotUv.x - 0.5) * asp2, (ch - dotUv.y) * 1.70, 1.0));
        if (cloudDayGate > 0.015 && crd.y > 0.001) {          // sky only
          // PERF: the 40-step volumetric march now runs once, at half res, in
          // the offscreen sky pass (SKY_FS) — here we just fetch its
          // premultiplied result at the dot-cell centre. The sunset tint,
          // visibility and halftone below need full-res dot geometry and are
          // cheap, so they stay in this pass unchanged.
          vec4 cl = texture2D(u_cloudTex, vec2(dotUv.x, 1.0 - dotUv.y));
          // ── catch the sunset ── strong warm/gold tint + a brightness lift through
          // twilight, so the deck is at its most striking right at sunset.
          cl.rgb = mix(cl.rgb, cl.rgb * vec3(1.45, 0.92, 0.58), twi * 0.85);
          cl.rgb *= (1.0 + 0.35 * twi);
          // ── visibility ── more present at night (floor 0.35, was 0.12) and PEAKS
          // through golden hour so sunset clouds don't fade with the night effect.
          float vis  = clamp(0.35 + 0.65 * sunUp + 0.55 * twi, 0.0, 1.0) * cloudDayGate;
          float fade = smoothstep(0.0, 0.015, crd.y) * vis;  // tiny gap above the horizon
          cl.rgb *= fade; cl.a *= fade;
          // HALFTONE: cloud gets its own dot-density control in the same
          // dots-per-screen-height unit as AUR DOT.
          float cloudDotBase = clamp(cl.a, 0.0, 1.0);
          float jitR = (hash(Cd) - 0.5) * 0.065 * smoothstep(0.025, 0.155, cloudDotBase);
          float cloudDotLevel = clamp(cloudDotBase + jitR, 0.0, 1.0);
          float dotDensity = pow(smoothstep(0.025, 0.50, cloudDotLevel), 0.70);
          float rad = mix(0.000, 0.395, dotDensity);
          float dotDist = length(Cp);
          float aa = 0.160;
          float dotc = step(0.025, cloudDotBase) * smoothstep(rad + aa, rad - aa, dotDist);
          vec3  cloudCol = cl.rgb / max(cl.a, 1e-3);         // un-premultiply → lit colour
          sky = mix(sky, cloudCol, dotc);
        }
      }
      // Twilight: warm-grade the whole daytime sky (gradient + glow + cloud deck)
      // together so the deck and the open sky both sit firmly in sunset tones —
      // the gradient endpoints alone can't reach the cloud pixels. Night elements
      // (stars / aurora) are added afterwards and stay untouched.
      if (skyVisible) {
        sky = mix(sky, sky * vec3(1.55, 0.90, 0.58) + vec3(0.05, 0.018, 0.0),
                  u_twilight * twi * 0.75);
      }
      // ✦ Stars — small round points of varying size & brightness that rotate
      // around a celestial pole over the night (sky rotation), and twinkle.
      if (skyVisible && nightAmt > 0.001) {
        vec2 pole = vec2(0.64, -0.22);                      // celestial pole (off-screen, upper-right)
        float sang = mod(u_time * 0.015, 6.2831853);        // slow, steady sky rotation
        vec2 rel = (uv - pole) * vec2(asp2, 1.0);
        float ca = cos(sang), sa = sin(sang);
        vec2 srot = vec2(rel.x * ca - rel.y * sa, rel.x * sa + rel.y * ca);
        vec2 g  = srot * 92.0;
        vec2 gi = floor(g);
        vec2 gf = fract(g) - 0.5;
        float sh = hash(gi);
        float present = step(0.84, sh);                     // sparse
        vec2 off = (vec2(hash(gi + 1.7), hash(gi + 4.3)) - 0.5) * 0.7;  // random position in cell
        float sz  = 0.05 + 0.16 * hash(gi + 2.1);           // varying size
        float mag = 0.30 + 0.70 * hash(gi + 5.5);           // varying brightness
        float tw  = 0.55 + 0.45 * sin(u_time * 2.5 + sh * 50.0);        // twinkle
        float star = present * smoothstep(sz, sz * 0.25, length(gf - off)) * mag * tw;
        star *= smoothstep(0.62, 0.0, uv.y);                // above the horizon
        sky += star * nightAmt * vec3(0.92, 0.95, 1.0) * 1.3;
      }
      // ✦ Northern lights — two wave curtains that emit from the CENTRE of the
      // horizon (where the river runs to) and rise up, running off the top of
      // the screen. A soft gradient plane is convolved upward from each wavy
      // line (the bright cores are hidden — gradient only); the width shrinks
      // toward the horizon (perspective) so they appear to recede indefinitely.
      // Aurora window keyed to time-of-day (not symmetric elevation) so it can
      // linger past midnight: fades in after sunset (~20:30→22:12), then fades
      // out early before sunrise (full to ~02:00, gone by ~04:00) so clouds can
      // return before dawn.
      float todHr = u_tod * 24.0;
      float aurZ  = max(smoothstep(19.5, 22.5, todHr), 1.0 - smoothstep(2.0, 4.0, todHr));
      if (skyVisible && aurZ > 0.001 && u_aurOn > 0.5) {
        // PERF: the 28-sample curtain accumulation (auroraField, in the shared
        // prelude) now runs once, at half res, in the offscreen sky pass — the
        // stored scalar already carries the aurZ window, tonemap and origin
        // taper. Only the origin lines survive here (the halftone overlay's
        // topLift needs oyLow), plus the per-night colour and dot composite,
        // which want full-res cell geometry.
        float at = u_time * u_aurSpeed;      // aurora's own clock (per-night speed, rolled at sunset)
        float oySwap   = 0.015 * sin(at * 0.110 + 0.6);
        float oyIndepR = 0.020 * sin(at * 0.130)       + 0.015 * sin(at * 0.071 + 2.1);
        float oyIndepL = 0.020 * sin(at * 0.097 + 1.2) + 0.015 * sin(at * 0.054 + 0.2);
        float originY = u_viewHorizon - clamp(u_aurOriginY, -0.25, 0.25);
        float oy  = originY + oyIndepR - oySwap;
        float oyL = originY + oyIndepL + oySwap;
        float oyLow = max(oy, oyL);
        float aur = texture2D(u_aurTex, vec2(uv.x, 1.0 - uv.y)).r;
        // ── per-night colour ── latched once at sunset in JS (u_aurHue), so it
        // can never change mid-aurora: green, or the traditional violet.
        vec3 aurCol = mix(vec3(0.26, 0.97, 0.55), vec3(0.58, 0.40, 0.98), u_aurHue);
        if (u_aurDot < 1.0) {
          sky += aur * aurCol * (0.55 + 0.6 * aur);
        } else {
          vec2 P = uv * vec2(u_res.x, u_sceneH);
          float cell = max(u_sceneH / u_aurDot, 2.0);
          vec2 C = floor(P / cell);
          vec2 Cp = (P - (C + 0.5) * cell) / cell;
          float jitR = (hash(C + 47.0) - 0.5) * 0.12;
          float topLift = smoothstep(0.055, 0.300, oyLow - uv.y);
          float dotGamma = mix(0.82, 0.56, topLift);
          float dotBoost = mix(0.90, 1.22, topLift);
          float aurDotLevel = clamp(pow(aur, dotGamma) * dotBoost, 0.0, 1.0);
          float rad = clamp(aurDotLevel + jitR, 0.0, 1.0) * 0.78;
          float dotc = smoothstep(rad, rad - 0.18, length(Cp));
          float aurD = aurDotLevel * dotc;
          float dotLight = mix(0.56 + 0.58 * aurD, 0.72 + 0.78 * aurD, topLift);
          sky += aurD * aurCol * dotLight;
        }
      }

      // Refine the closest approach to a CONTINUOUS sub-step value. The march
      // only samples minGap at discrete steps, so it quantizes — adjacent
      // pixels jump between sampled gaps, combing the grazing edge into teeth.
      // A parabolic fit through three fine samples around the coarse minimum
      // recovers the true minimum smoothly, so the feather below is tooth-free.
      if (tHit < 0.0 && minGap < 1.0e8) {
        float h  = 0.18;
        vec3  pa = ro + dir * (minGapT - h);
        vec3  pb = ro + dir *  minGapT;
        vec3  pc = ro + dir * (minGapT + h);
        float ga = pa.y - vH(pa.x, pa.z);
        float gb = pb.y - vH(pb.x, pb.z);
        float gc = pc.y - vH(pc.x, pc.z);
        float den = ga - 2.0 * gb + gc;                 // >0 ⇒ convex (a real minimum)
        if (den > 1.0e-4) {
          float d = ga - gc;
          minGap = max(gb - (d * d) / (8.0 * den), 0.0);
        }
      }

      // ── Anti-aliased silhouette ── instead of a hard hit/miss edge (which
      // aliases into a jagged ridge), the wall fades over a soft band based on
      // how closely the ray grazed the rim. Solid inside, smoothly feathered at
      // the edge → a clean ridge line regardless of GPU float behaviour.
      float edgeFeather = u_aaFeather;
      float covC = (tHit >= 0.0) ? 1.0 : missCoverage(minGap, edgeFeather);
      // ── Silhouette anti-aliasing (live-tunable from the panel) ──
      // Signed-distance mode (u_aaSigned) → single continuous field, comb-free.
      // Otherwise supersample the silhouette only, still at full-frame 1x.
      // The offset rays must apply the same yaw as the main ray; otherwise the
      // AA pass samples a different canyon direction and creates edge artifacts.
      float coverage = covC;
      // PERF: surfQ ≥ 108 → the wall is ≥96% swallowed by haze (see the
      // smoothstep(30, 108, surfT) fade below), so a supersampled silhouette
      // is indistinguishable from the 1x analytic feather — skip the 4 extra
      // wall marches on those far-ridge pixels.
      if (u_aaN >= 3.5 && surfQ < 108.0
          && (fwidth(covC) > 0.0008 || (covC > 0.001 && covC < 0.999) || abs(minGap) < 0.85)) {
        vec2 px = 1.0 / vec2(u_res.x, u_sceneH);   // v9: 1 设备 px 的场景-uv 偏移
        // Offset rays graze the wall within a hair of the main ray's distance,
        // so window every supersample around it (see wallCoverage).
        float aaC = (tHit >= 0.0) ? tHit : minGapT;
        if (u_aaN >= 8.5) {   // 3×3 edge-only SSAA test with a wider footprint
          vec2 a = vec2(-0.62, -0.62), b = vec2(0.0, -0.62), c = vec2(0.62, -0.62);
          vec2 d = vec2(-0.62,  0.0),                           e = vec2(0.62,  0.0);
          vec2 f = vec2(-0.62,  0.62), g = vec2(0.0,  0.62), h = vec2(0.62,  0.62);
          float s = covC
                  + wallCoverage(ro, yawValleyRay(uv + a * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + b * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + c * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + d * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + e * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + f * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + g * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + h * px, asp, fx, yaw), camZ, edgeFeather, aaC);
          coverage = s / 9.0;
        } else {
          vec2 o0 = vec2( 0.375,  0.125), o1 = vec2(-0.125,  0.375),
               o2 = vec2(-0.375, -0.125), o3 = vec2( 0.125, -0.375);   // 4× RGSS
          float s = wallCoverage(ro, yawValleyRay(uv + o0 * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + o1 * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + o2 * px, asp, fx, yaw), camZ, edgeFeather, aaC)
                  + wallCoverage(ro, yawValleyRay(uv + o3 * px, asp, fx, yaw), camZ, edgeFeather, aaC);
          if (u_aaN >= 7.5) {   // 8× — second rotated grid, finer
          vec2 q0 = vec2( 0.25, -0.05), q1 = vec2( 0.05,  0.25),
               q2 = vec2(-0.25,  0.05), q3 = vec2(-0.05, -0.25);
            s += wallCoverage(ro, yawValleyRay(uv + q0 * px, asp, fx, yaw), camZ, edgeFeather, aaC)
               + wallCoverage(ro, yawValleyRay(uv + q1 * px, asp, fx, yaw), camZ, edgeFeather, aaC)
               + wallCoverage(ro, yawValleyRay(uv + q2 * px, asp, fx, yaw), camZ, edgeFeather, aaC)
               + wallCoverage(ro, yawValleyRay(uv + q3 * px, asp, fx, yaw), camZ, edgeFeather, aaC);
            coverage = s / 8.0;
          } else {
            coverage = s / 4.0;
          }
        }
      }
      if (u_aaSigned > 0.5) {
        // Cheap 1× SDF pass: use the ray's closest wall gap as a continuous
        // edge field. This targets the remaining stair-step after sample AA
        // without projecting or painting any extra wall geometry into the sky.
        float gapAA = clamp(fwidth(minGap) * 0.95, 0.035, 0.70);
        float sdfCoverage = 1.0 - smoothstep(-gapAA, gapAA, minGap);
        float sdfBlend = 1.0 - smoothstep(0.42, 1.22, abs(minGap));
        coverage = mix(coverage, sdfCoverage, sdfBlend);
      }
      // Background = bare blue until the skybox extras have revealed.
      vec3 bg = mix(skyBare, sky, skyReveal);
      if (coverage <= 0.001) return bg;
      float surfT = (tHit >= 0.0) ? tHit : minGapT;

      vec3 p = ro + dir * surfT;
      float e = 0.10;
      float hx = (vH(p.x + e, p.z) - vH(p.x - e, p.z)) / (2.0 * e);
      float hz = (vH(p.x, p.z + e) - vH(p.x, p.z - e)) / (2.0 * e);
      vec3 n = normalize(vec3(-hx, 1.0, -hz));
      float hMax = max(canyonMaxH(), 1.0);
      float heightT = clamp(p.y / hMax, 0.0, 1.0);
      // ── Sun-tracking canyon light ── direction follows the sun's arc, but
      // the canyon now also self-shadows at low angles. One wall warms while
      // the opposing wall/floor fall into cooler shade, then the contrast
      // collapses toward softer overhead light at noon.
      float aDayC = clamp(aDay, 0.0, 1.0);
      vec3 sunDirW = normalize(vec3(mix(-0.95, 0.72, aDayC),
                                    0.11 + 1.35 * max(elev, 0.0),
                                    mix(0.22, 0.92, aDayC)));
      // Below the horizon the sun azimuth flips (aDay's clamp jumps 1→0 exactly
      // at midnight), so blend to a FIXED night key light by ELEVATION — which
      // is continuous through midnight — masking the flip (weight 0 at night).
      vec3 nightDir = normalize(vec3(-0.40, 0.70, 0.30));
      float sunWeight = smoothstep(-0.05, 0.25, elev);
      vec3 lightDir = normalize(mix(nightDir, sunDirW, sunWeight));
      float directRaw = max(0.0, dot(n, lightDir));
      float lowSun = (1.0 - smoothstep(0.16, 0.85, elev)) * sunWeight;
      float wallness = smoothstep(0.12, 0.62, length(n.xz)) * smoothstep(0.06, 0.44, heightT);
      vec2 sunHoriz = normalize(sunDirW.xz + vec2(0.0001, 0.0));
      float sideLight = dot(normalize(n.xz + vec2(0.0001, 0.0)), sunHoriz);
      float sunFace = smoothstep(-0.25, 0.62, sideLight);
      float shadeFace = 1.0 - smoothstep(-0.62, 0.12, sideLight);
      float shadow = 0.0;
      // PERF: sunWeight is 0 all night (elev < -0.05) — the 6-tap shadow
      // march used to run anyway and multiply to zero.
      if (u_canyonShadow > 0.5 && sunWeight > 0.001) {
        shadow = canyonSunShadow(p + n * 0.045, sunDirW, lowSun) * sunWeight;
      }
      float lowWall = lowCanyon();
      float rimShadowFade = smoothstep(0.66, 0.98, heightT);
      float rimShadowDamp = 1.0 - rimShadowFade * lowWall * 0.88;
      shadow = clamp(max(shadow, shadeFace * wallness * lowSun * 0.78 * u_canyonShadow), 0.0, 1.0) * rimShadowDamp;
      float direct = max(directRaw, sunFace * wallness * lowSun * 0.58) * (1.0 - 0.82 * shadow);
      float dfloor = abs(p.x - vCenter(p.z));
      float skyOpen = smoothstep(0.31, 0.94, heightT) * (0.45 + 0.55 * max(n.y, 0.0));
      float floorAO = mix(0.50, 1.0, smoothstep(0.75, 4.6, dfloor))
                    * mix(0.62, 1.0, smoothstep(0.03, 0.41, heightT));
      float bounce = (1.0 - smoothstep(0.0, 4.0, dfloor)) * (0.35 + 0.65 * max(n.y, 0.0));
      float ambient = (0.15 + 0.13 * max(n.y, 0.0) + 0.13 * skyOpen + 0.06 * bounce * sunUp)
                    * mix(0.48, 1.0, sunUp);
      // The hard 1x silhouette is most visible where the bright rim highlight
      // reaches partly covered edge pixels. Keep the wall shape from coverage,
      // but reduce high-frequency rim/aqua light on those transitional pixels.
      float edgeSolid = smoothstep(0.46, 0.98, coverage);
      float edgeRimDamp = mix(0.36, 1.0, edgeSolid);
      float lowRidgeFade = smoothstep(0.58, 0.98, heightT) * lowWall;
      float rim = pow(clamp(1.0 - abs(dot(n, lightDir)), 0.0, 1.0), 2.6)
                * lowSun * smoothstep(0.38, 0.97, heightT) * (1.0 - shadow) * (0.45 + 0.55 * sunFace)
                * (1.0 - 0.68 * lowRidgeFade) * edgeRimDamp;
      float sideContrast = mix(1.0, mix(0.58, 1.42, sunFace), wallness * lowSun);
      float shade = clamp((ambient + 1.58 * direct + 0.52 * rim) * floorAO * sideContrast, 0.045, 2.20);
      float hh = heightT;
      vec3 col = mix(NAVY_LO, NAVY, smoothstep(0.015, 0.35, hh));
      col = mix(col, STEEL, smoothstep(0.35, 0.72, hh));
      col = mix(col, AQUA,  smoothstep(0.80, 1.0,  hh) * (1.0 - 0.56 * lowRidgeFade) * edgeRimDamp);
      col *= shade;
      vec3 coolShade = mix(vec3(0.52, 0.68, 1.14), vec3(0.64, 0.78, 1.18), nightAmt * 0.5);
      vec3 warmSun = mix(vec3(1.20, 1.08, 0.78), vec3(1.86, 1.18, 0.54), max(twi, lowSun * 0.70));
      col *= mix(coolShade, vec3(1.0), clamp(0.28 + 0.82 * direct + 0.20 * skyOpen, 0.0, 1.0));
      col = mix(col, col * warmSun, clamp(direct * (0.38 + 0.36 * lowSun) + rim * 0.76, 0.0, 0.86));
      col += vec3(1.0, 0.62, 0.30) * rim * twi * 0.09;
      // River bed: the (now wider) low ground between the walls; dots cover it.
      float bed = smoothstep(1.4, 0.0, p.y) * smoothstep(3.4, 0.5, dfloor);
      col = mix(col, mix(NAVY, STEEL, 0.35), bed * 0.6);       // dim navy bed so pale dots read

      // ── River as a flowing halftone dot field (v1) ── a STATIC screen dot
      // grid; each dot's size follows a downstream-flowing water intensity
      // (channel × flow noise + foam). The grid is fixed and the intensity
      // flows through it — the v1 page's water look.
      if (bed > 0.02) {
        float across = (p.x - vCenter(p.z)) / 2.7;
        float along  = p.z - camZ;   // camera-relative depth → continuous across the camZ wrap (no jump)
        float chan   = exp(-across * across * 0.7);
        float fT     = u_time * u_flowSpd;
        float flow1  = fbm(vec2(across * 1.7, along * 0.42 + fT * 2.6));   // +fT → bright bands
        float flow2  = fbm(vec2(across * 3.6, along * 0.95 + fT * 4.2));   //        flow toward the
        float flow   = flow1 * 0.55 + flow2 * 0.45;                        //        camera (downstream)
        float strm   = smoothstep(0.20, 0.95, 0.35 + 0.80 * flow);
        float foam   = smoothstep(0.80, 0.96, flow) * (0.55 + 0.45 * sin(along * 5.0 + fT * 6.0));
        strm = max(strm, foam * u_foam);
        float I = (0.30 + 0.70 * clamp(strm, 0.0, 1.0)) * mix(0.45, 1.0, chan) * bed;
        vec2 P    = uv * vec2(u_res.x, u_sceneH);   // v9: 真实设备 px(尾部连续)
        float waterCell = max(u_sceneH / max(u_waterDot, 1.0), 2.0);
        vec2 cell = floor(P / waterCell);
        vec2 cp   = (P - (cell + 0.5) * waterCell) / waterCell;
        float jit = (hash(cell) - 0.5) * 0.16;
        float radius = clamp(I + jit, 0.0, 1.0) * 0.50;
        float dotc = smoothstep(radius, radius - 0.16, length(cp));
        vec3 dotCol = mix(vec3(0.58, 0.76, 0.95), vec3(1.0, 0.99, 0.94), smoothstep(0.5, 1.0, I));
        // ── water reacts to the sun ── warms through golden hour, picks up a
        // sunset glint down the channel centre, and dims at night.
        vec3 sunWarm = vec3(1.0, 0.74, 0.45);
        dotCol = mix(dotCol, sunWarm, twi * 0.55);
        dotCol += sunWarm * (chan * twi * 0.6 * smoothstep(0.45, 1.0, flow));   // sunset glint
        float lit = mix(0.5, 1.0, sunUp);                                       // dimmer at night
        col = mix(col, dotCol, dotc * (0.7 + 0.3 * I) * lit);
      }

      // Aerial perspective: farther walls fade toward the hazy sky/glow, so an
      // overlapping near-wall edge reads as soft atmospheric depth rather than a
      // hard occlusion line (like the layered ridges in the reference).
      // Strong far-fade into the ACTUAL local sky (glow-inclusive): a distant
      // wall seen edge-on as a new bend emerges would otherwise pop as a bright
      // vertical sliver. Fading toward the exact background behind it makes it
      // appear seamlessly and resolve into a slope. Near walls stay crisp.
      float haze = smoothstep(30.0, 108.0, surfT) * 0.96;
      col = mix(col, skyHaze, haze);   // aurora-free target → curtains never bleed onto walls
      // Intro reveal: the canyon condenses out of the sky from the foreground back
      // to the horizon. u_reveal grows 0→1; a soft depth band sweeps a "reveal
      // front" from just in front of the camera (hidden) out past the far walls
      // (shown), so nearer geometry resolves first. Below the front → canyon, above
      // → still bare sky. (u_reveal = 1 leaves the scene fully shown.)
      float revealFront = mix(-16.0, 130.0, u_reveal);
      float revealA = smoothstep(revealFront + 16.0, revealFront - 16.0, surfT);
      return mix(bg, col, coverage * revealA);              // feathered silhouette + depth reveal
    }

    void main(){
      vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);       // y down — 全 canvas [0,1]

      // v9: canvas = 场景区(100dvh, uvS.y∈[0,1]) + 尾部溶解区(uvS.y>1)。
      // 场景区像素与加高前完全一致; 尾部射线自然更向下, 峡谷地面/河流
      // 点阵延续渲染, 再由下方的 tailT 溶解进页面底色。
      float sceneK = u_res.y / max(u_sceneH, 1.0);
      vec2 uvS = vec2(uv.x, uv.y * sceneK);

      // ── Generated hero: smooth in-valley canyon (replaces the ASCII-river scene) ──
      vec3 col = renderValley(uvS);
      // Minimal post: boot fade, headline text, gentle vignette, grain.
      col = mix(col, vec3(0.010, 0.017, 0.045), u_boot);
      float tAv = smoothstep(0.30, 0.62, texture2D(u_txt, uvS).a);
      col = mix(col, vec3(0.84, 0.93, 0.87), tAv);
      col += tAv * vec3(0.18, 0.40, 0.34) * 0.5;
      vec2 qv = (uvS - 0.5) * vec2(1.05, 1.18);
      float vigv = smoothstep(1.22, 0.10, dot(qv, qv) * 2.1);
      col *= mix(0.86, 1.0, vigv);
      col += (hash(uv * u_res + u_time) - 0.5) * u_grain;
      // 尾部溶解: 场景 → --page-bg, smoothstep 两端导数为 0(无结节),
      // 溶解放在 vignette/grain 之后, 底部 = 纯 pageBg, 与 main 底色零色差。
      float tailT = smoothstep(1.0, sceneK, uvS.y);
      col = mix(col, u_pageBg, tailT);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  // ── Offscreen sky pass ── renders the two expensive volumetric layers into
  // half-res FBO textures the main pass samples instead of recomputing per
  // pixel: the 40-step cloud march (→ u_cloudTex) and the 28-sample aurora
  // curtains (→ u_aurTex). Both fields are resolution-independent functions
  // of scene uv + frame uniforms, and the main pass's halftone composites
  // quantise them into dot cells anyway, so half resolution + LINEAR
  // upsampling is visually transparent. The layers are temporally disjoint
  // (clouds by day, aurora at night) — JS only draws the layer whose
  // time-of-day gate is open, at ~30Hz (the fields drift slowly; the dots
  // can't show a one-frame lag).
  //
  // Each layer gets its OWN program — merging them behind a uniform branch
  // makes the register allocator size the (cheap) cloud pass for the (huge)
  // aurora branch, and the occupancy hit measurably slowed the whole frame
  // on Apple GPUs.
  const SKY_CLOUD_FS = FS_COMMON + `
    // Cloud layer for one scene uv. The time-of-day subset below is copied
    // line-for-line from renderValley (sun arc / twilight orbit / sky-horizon
    // tint) so the offscreen march sees the exact same sun. Output is the raw
    // premultiplied march result (already clamped 0..1); the sunset tint,
    // visibility fade and halftone stay in the main pass.
    vec4 cloudLayer(vec2 uv){
      float asp2 = u_res.x / max(1.0, u_res.y);
      float aDay     = (u_tod * 24.0 - 6.0) / 12.0;
      float elev     = sin(aDay * 3.14159265);
      float sunUp    = smoothstep(-0.10, 0.12, elev);
      float twi      = smoothstep(-0.33, -0.08, elev) * (1.0 - smoothstep(-0.08, 0.23, elev));
      float elevNight = elev - 0.025;
      float setFrac = 0.5 - elevNight * (u_twRadius * u_twEllipse) / 0.104;
      float twDay = 1.0 - smoothstep(0.75, 1.15, setFrac);
      float sunHeight = u_twRadius * u_twEllipse * elev;
      float sunsetAmt = 1.0 - smoothstep(0.0, u_twSunZone, sunHeight);
      twi = mix(twi, twDay * mix(0.35, 0.85, sunsetAmt), u_twilight);
      float skyUp = mix(sunUp, twDay * mix(0.40, 0.14, sunsetAmt), u_twilight);
      vec3 SKY_HOR = mix(vec3(0.060,0.112,0.245), vec3(0.330,0.560,0.820), smoothstep(0.0,0.55,skyUp));
      SKY_HOR = mix(SKY_HOR, vec3(0.85,0.45,0.24), twi * 0.6);
      SKY_HOR = mix(SKY_HOR, vec3(0.98,0.44,0.22), u_twilight * twi * 0.55);
      float sunArcT = clamp(aDay, -0.18, 1.18);
      float sunPathShift = 0.052 / max(asp2, 0.001);
      float sunX = mix(-0.30, 0.55, sunArcT) - sunPathShift;
      float twTheta = 3.14159265 * (1.0 - aDay);
      float twX = 0.5 + (u_twRadius / max(asp2, 0.001) * u_twEllipseX) * cos(twTheta);
      sunX = mix(sunX, twX, u_twilight);
      vec3 crd = normalize(vec3((uv.x - 0.5) * asp2, (u_viewHorizon - uv.y) * 1.70, 1.0));
      if (crd.y <= 0.001) return vec4(0.0);   // below the horizon — main pass never samples here
      vec3 sunDir3 = normalize(vec3((sunX - 0.5) * 1.4, 0.35 + 0.7 * max(elev, 0.0), 0.55));
      return marchClouds(vec3(0.0), crd, sunDir3, SKY_HOR);
    }

    void main(){
      vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);   // scene uv, y-down (matches main pass)
      gl_FragColor = cloudLayer(uv);
    }
  `;

  const SKY_AUR_FS = FS_COMMON + `
    void main(){
      vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);   // scene uv, y-down (matches main pass)
      gl_FragColor = vec4(auroraField(uv), 0.0, 0.0, 1.0);
    }
  `;

  // ── Async parallel shader compile ─────────────────────────────
  // compileShader()/linkProgram() are SYNCHRONOUS on most drivers: translating
  // + optimising this ~2.5k-line raymarcher (and the two sky passes sharing its
  // prelude) blocked the main thread for many seconds on a cold shader cache —
  // the whole page froze on load. With KHR_parallel_shader_compile the driver
  // compiles on background threads, so we submit all three programs up front,
  // overlap the wait with the terrain build (Web Worker), and only then read
  // status/uniforms. Without the extension the status reads below block on
  // first access, exactly as before — no regression on older browsers.
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  function checkShader(s, label) {
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[river] shader compile (" + label + "):", gl.getShaderInfoLog(s));
      return false;
    }
    return true;
  }
  function linkProg(...shaders) {
    const p = gl.createProgram();
    // Fixed attribute location shared by every program (the sky passes used to
    // re-bind to the main program's location for exactly this sharing).
    gl.bindAttribLocation(p, 0, "a_pos");
    for (const s of shaders) gl.attachShader(p, s);
    gl.linkProgram(p);
    return p;
  }
  function checkProg(p, label) {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("[river] program link (" + label + "):", gl.getProgramInfoLog(p));
      return false;
    }
    return true;
  }

  // GL resources below are declared with `let` (not `const`) so they can be
  // rebuilt after a WebGL context loss (driver reset / GPU sleep-wake). On
  // `webglcontextrestored` rebuildGLResources() re-runs this same init path.
  let vs = compile(gl.VERTEX_SHADER, VS);
  let fs = compile(gl.FRAGMENT_SHADER, FS);
  let fsSkyCloud = compile(gl.FRAGMENT_SHADER, SKY_CLOUD_FS);
  let fsSkyAur = compile(gl.FRAGMENT_SHADER, SKY_AUR_FS);
  let prog = linkProg(vs, fs);
  let skyCloudProg = linkProg(vs, fsSkyCloud);
  let skyAurProg = linkProg(vs, fsSkyAur);

  let parCompile = gl.getExtension("KHR_parallel_shader_compile");
  if (parCompile) {
    const progs = [prog, skyCloudProg, skyAurProg];
    const t0 = performance.now();
    while (performance.now() - t0 < 60000) {
      let done = true;
      for (const p of progs) {
        if (!gl.getProgramParameter(p, parCompile.COMPLETION_STATUS_KHR)) { done = false; break; }
      }
      if (done) break;
      await new Promise((r) => setTimeout(r, 8));
    }
  }
  if (!checkShader(vs, "vs") || !checkShader(fs, "main")) return;
  if (!checkProg(prog, "main")) return;
  gl.useProgram(prog);

  // Fullscreen geometry (two triangles)
  let buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = 0;   // bound via bindAttribLocation before link
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Main-program uniform locations — one factory shared by the cold start and
  // rebuildGLResources() so the two lists can never drift apart again. (The
  // rebuild used to carry 45 stale keys from the removed ASCII/field systems.)
  function collectMainUniforms(p) {
    return {
      res: gl.getUniformLocation(p, "u_res"),
      time: gl.getUniformLocation(p, "u_time"),
      par: gl.getUniformLocation(p, "u_par"),
      tod: gl.getUniformLocation(p, "u_tod"),
      aurHue: gl.getUniformLocation(p, "u_aurHue"),
      aurSpeed: gl.getUniformLocation(p, "u_aurSpeed"),
      aurDot: gl.getUniformLocation(p, "u_aurDot"),
      aurPlaneSamples: gl.getUniformLocation(p, "u_aurPlaneSamples"),
      aurSampleFill: gl.getUniformLocation(p, "u_aurSampleFill"),
      aurTopGain: gl.getUniformLocation(p, "u_aurTopGain"),
      aurRaySamples: gl.getUniformLocation(p, "u_aurRaySamples"),
      aurHeightScale: gl.getUniformLocation(p, "u_aurHeightScale"),
      aurOriginY: gl.getUniformLocation(p, "u_aurOriginY"),
      aurOriginTaper: gl.getUniformLocation(p, "u_aurOriginTaper"),
      aurFilamentDensity: gl.getUniformLocation(p, "u_aurFilamentDensity"),
      aurFilamentWidth: gl.getUniformLocation(p, "u_aurFilamentWidth"),
      aurFilamentHeight: gl.getUniformLocation(p, "u_aurFilamentHeight"),
      aurFilamentIntensity: gl.getUniformLocation(p, "u_aurFilamentIntensity"),
      aurFilamentTrack: gl.getUniformLocation(p, "u_aurFilamentTrack"),
      cloudOn: gl.getUniformLocation(p, "u_cloudOn"),
      aurOn: gl.getUniformLocation(p, "u_aurOn"),
      cloudDot: gl.getUniformLocation(p, "u_cloudDot"),
      waterDot: gl.getUniformLocation(p, "u_waterDot"),
      txt: gl.getUniformLocation(p, "u_txt"),
      noise: gl.getUniformLocation(p, "u_noise"),
      noiseOn: gl.getUniformLocation(p, "u_noiseOn"),
      aaN: gl.getUniformLocation(p, "u_aaN"),
      aaFeather: gl.getUniformLocation(p, "u_aaFeather"),
      aaSigned: gl.getUniformLocation(p, "u_aaSigned"),
      boot: gl.getUniformLocation(p, "u_boot"),
      reveal: gl.getUniformLocation(p, "u_reveal"),
      viewHorizon: gl.getUniformLocation(p, "u_viewHorizon"),
      scroll:  gl.getUniformLocation(p, "u_scroll"),
      grain:   gl.getUniformLocation(p, "u_grain"),
      flowSpd: gl.getUniformLocation(p, "u_flowSpd"),
      foam:    gl.getUniformLocation(p, "u_foam"),
      sun:     gl.getUniformLocation(p, "u_sun"),
      canyonDepth: gl.getUniformLocation(p, "u_canyonDepth"),
      canyonShadow: gl.getUniformLocation(p, "u_canyonShadow"),
      canyonMaxSteps: gl.getUniformLocation(p, "u_canyonMaxSteps"),
      canyonStepScale: gl.getUniformLocation(p, "u_canyonStepScale"),
      refineSteps: gl.getUniformLocation(p, "u_refineSteps"),
      refineMode: gl.getUniformLocation(p, "u_refineMode"),
      hoist: gl.getUniformLocation(p, "u_hoist"),
      twilight: gl.getUniformLocation(p, "u_twilight"),
      twRadius: gl.getUniformLocation(p, "u_twRadius"),
      twEllipse: gl.getUniformLocation(p, "u_twEllipse"),
      twEllipseX: gl.getUniformLocation(p, "u_twEllipseX"),
      twSunZone: gl.getUniformLocation(p, "u_twSunZone"),
      sceneH:  gl.getUniformLocation(p, "u_sceneH"),
      pageBg:  gl.getUniformLocation(p, "u_pageBg"),
    };
  }
  let U = collectMainUniforms(prog);
  U.cloudTex = gl.getUniformLocation(prog, "u_cloudTex");
  U.aurTex   = gl.getUniformLocation(prog, "u_aurTex");
  gl.uniform1i(U.cloudTex, 4);
  gl.uniform1i(U.aurTex, 5);

  // ── JS uniform 镜像 ── updateSkyTextures 每帧要读 reveal/tod/cloudOn/aurOn +
  // SKY_SYNC 共 16 个值; gl.getUniform 是同步回读(管线 stall)。这 16 个 uniform
  // 的所有写入都经 setU1f/setU2f, 同步更新 uMirror; 读取只查 map, 不再回读。
  const uMirror = {};
  function setU1f(name, loc, v) { gl.uniform1f(loc, v); uMirror[name] = v; }
  function setU2f(name, loc, x, y) { gl.uniform2f(loc, x, y); uMirror[name] = [x, y]; }

  // ── Offscreen sky pass (perf) ── half-res FBO targets for the volumetric
  // layers (cloud march / aurora curtains, see SKY_FS). Updated at ~30Hz from
  // draw(); the main pass samples them on units 4/5 instead of recomputing
  // the loops per pixel. Falls back silently (zero textures = no clouds, no
  // aurora) if the sky program fails to build.
  // Frame uniforms mirrored main→sky on each update (names map as "u_" + key);
  // values come from the uMirror JS map above (every write goes through
  // setU1f/setU2f). A name a given SKY program does not use simply yields a
  // null location there, and uniform1f on null is a silent no-op — so one list
  // serves both layer programs.
  const SKY_SYNC = [
    "res", "time", "tod", "viewHorizon", "noiseOn",
    "twilight", "twRadius", "twEllipse", "twEllipseX", "twSunZone",
    "aurSpeed", "aurOriginY",
  ];
  // Knobs that now live ONLY in the aurora sky program (the curtain loop left
  // the main shader, so these uniforms are inactive/null there). Values are
  // kept here and pushed on each sky update; setSkyKnob also invalidates the
  // aurora texture so panel tweaks repaint immediately.
  const skyKnobs = {
    aurPlaneSamples: 28.0, aurSampleFill: 1.0, aurTopGain: 0.50,
    aurRaySamples: 0.0, aurHeightScale: 2.75, aurOriginTaper: 0.50,
    aurFilamentDensity: 1.75, aurFilamentWidth: 2.00, aurFilamentHeight: 2.00,
    aurFilamentIntensity: 2.25, aurFilamentTrack: 2.0,
  };
  function setSkyKnob(name, v) {
    skyKnobs[name] = v;
    skyTargets.aur.fresh = false;
  }
  // The sky programs were already compiled+linked up front (parallel with the
  // main program — see "Async parallel shader compile"); here we only verify
  // the link and collect uniforms once SKY_SYNC/skyKnobs exist.
  function finishSkyProg(p2, label) {
    if (!checkProg(p2, label)) return null;
    const u = {};
    for (const n of SKY_SYNC) u[n] = gl.getUniformLocation(p2, "u_" + n);
    for (const n in skyKnobs) u[n] = gl.getUniformLocation(p2, "u_" + n);
    gl.useProgram(p2);
    gl.uniform1i(gl.getUniformLocation(p2, "u_noise"), 3);  // shared noise LUT
    gl.useProgram(prog);
    return { prog: p2, u };
  }
  let skyProgs = {
    cloud: finishSkyProg(skyCloudProg, "cloud"),
    aur:   finishSkyProg(skyAurProg, "aurora"),
  };
  let skyTargets = {
    cloud: { unit: 4, tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 0, h: 0, fresh: false },
    aur:   { unit: 5, tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 0, h: 0, fresh: false },
  };
  for (const t of [skyTargets.cloud, skyTargets.aur]) {
    gl.activeTexture(gl.TEXTURE0 + t.unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  gl.activeTexture(gl.TEXTURE0);
  // (Re)allocate the half-res targets — called from size() with the canvas dims.
  function sizeSkyTargets(cw, ch) {
    const w = Math.max(2, Math.round(cw / 2));
    const h = Math.max(2, Math.round(ch / 2));
    for (const t of [skyTargets.cloud, skyTargets.aur]) {
      if (t.w === w && t.h === h) continue;
      gl.activeTexture(gl.TEXTURE0 + t.unit);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      t.w = w; t.h = h; t.fresh = false;   // zero-initialised → transparent until drawn
    }
    gl.activeTexture(gl.TEXTURE0);
  }
  function skySmooth(a, b, x) {
    x = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return x * x * (3 - 2 * x);
  }
  let skyTick = 0;
  function updateSkyTextures() {
    // Match renderValley's u_reveal early-out: nothing samples the sky yet.
    if (!(uMirror.reveal > 0.001)) return;
    // JS copies of the shader's own time-of-day gates (clouds: cloudDayGate,
    // aurora: aurZ × u_aurOn) with slightly LOOSER thresholds, so a layer's
    // texture is always fresh by the time the main pass starts sampling it.
    const hr = uMirror.tod * 24.0;
    const cloudGate = uMirror.cloudOn > 0.5
      ? Math.min(1 - skySmooth(18.6, 20.4, hr), skySmooth(4.0, 5.2, hr)) : 0;
    const aurGate = uMirror.aurOn > 0.5
      ? Math.max(skySmooth(19.5, 22.5, hr), 1 - skySmooth(2.0, 4.0, hr)) : 0;
    const wantCloud = cloudGate > 0.005 && skyProgs.cloud;
    const wantAur = aurGate > 0.0005 && skyProgs.aur;
    if (!wantCloud && !wantAur) return;
    // ~30Hz: the layers drift slowly (cloud deck, curtain sway) and the main
    // pass's halftone dots quantise them anyway — a one-frame lag can't show.
    const due = (skyTick++ & 1) === 0;
    const list = [];
    if (wantCloud && (due || !skyTargets.cloud.fresh)) list.push("cloud");
    if (wantAur && (due || !skyTargets.aur.fresh)) list.push("aur");
    if (!list.length) return;
    // Push the mirrored frame uniforms per layer program (JS map, no readback).
    for (const name of list) {
      const p = skyProgs[name], t = skyTargets[name];
      gl.useProgram(p.prog);
      for (const n of SKY_SYNC) {
        // v9: 主程序 u_res 是全 canvas(含尾部); sky pass 只渲染场景区, res.y 换成 sceneHDev
        if (n === "res") gl.uniform2f(p.u[n], uMirror.res[0], sceneHDev);
        else gl.uniform1f(p.u[n], uMirror[n]);
      }
      for (const n in skyKnobs) gl.uniform1f(p.u[n], skyKnobs[n]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      t.fresh = true;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
  }

  // Initial default uniforms + the ones reapplied after a context restore share
  // one function so the two paths can never drift. The per-frame uniforms
  // (u_time/u_tod/u_boot/u_reveal/…) are owned by the render loop and not set
  // here. Mirrored uniforms (uMirror, see setU1f) go through the write helper.
  function applyDefaultUniforms() {
    gl.uniform2f(U.par, 0.0, 0.0);         // v14 指针视差默认居中
    setU1f("reveal", U.reveal, 1.0);       // default canyon fully shown (live loop animates 0→1)
    setU1f("tod", U.tod, (new Date().getHours() * 60 + new Date().getMinutes()) / 1440);

    // Slider-controlled defaults (mirror the original hard-coded values)
    const KNOBS = { scroll: 1.18, grain: 0.000, flowSpd: 0.51, foam: 1.69 };
    setU1f("viewHorizon", U.viewHorizon, 0.570);   // active river/march horizon — POV HZN slider
    gl.uniform1f(U.scroll,  KNOBS.scroll);
    gl.uniform1f(U.grain,   KNOBS.grain);
    gl.uniform1f(U.flowSpd, KNOBS.flowSpd);
    gl.uniform1f(U.foam,    KNOBS.foam);
    gl.uniform1f(U.canyonDepth, 0.50);                  // default canyon wall depth
    gl.uniform1f(U.canyonShadow, 1.0);                  // full canyon shadowing by default
    gl.uniform1f(U.canyonMaxSteps, 112.0);              // canyon march budget by default
    gl.uniform1f(U.canyonStepScale, 1.18);               // slightly larger step (≈1.18x), fewer iters
    gl.uniform1f(U.refineSteps, 14.0);                  // full hit-refine iterations (current behaviour)
    gl.uniform1f(U.refineMode, 0.0);                    // bisection by default (current behaviour)
    gl.uniform1f(U.hoist, 1.0);                         // PERF: cache frame-constant canyon values once (was recompute-per-step)
    gl.uniform1f(U.sun, 0.64);                           // sun brightness — set by SUN slider
    setU1f("twilight", U.twilight, 1.0);                 // twilight mode on by default — TWILIGHT switch
    setU1f("twRadius", U.twRadius, 0.18);                // twilight sun-orbit radius — TW RAD slider
    setU1f("twEllipse", U.twEllipse, 0.90);              // twilight orbit Y scale (1 = round) — TW ELY slider
    setU1f("twEllipseX", U.twEllipseX, 0.48);            // twilight orbit X scale (1 = round) — TW ELX slider
    setU1f("twSunZone", U.twSunZone, 0.10);              // twilight sunset-zone height (uv) — TW ZONE slider
    gl.uniform1f(U.aurDot, 186.0);                       // aurora dot density — set by AUR DOT slider
    setSkyKnob("aurPlaneSamples", 28.0);                // aurora plane sample budget — AUR SAMP slider
    setSkyKnob("aurSampleFill", 1.0);                   // filled sample cells — AUR FILL slider
    setSkyKnob("aurTopGain", 0.50);                     // upper-plane brightness — TOP GAIN slider
    setSkyKnob("aurRaySamples", 0.0);                   // 0 = cheaper filament-field path; nonzero = old ray loop
    setSkyKnob("aurHeightScale", 2.75);                 // aurora vertical scale — AUR HGT slider
    setU1f("aurOriginY", U.aurOriginY, -0.05);           // origin vertical offset — ORIG Y slider
    setSkyKnob("aurOriginTaper", 0.50);                 // origin distance fade — ORIG TPR slider
    setSkyKnob("aurFilamentDensity", 1.75);             // filament count — FIL DENS slider
    setSkyKnob("aurFilamentWidth", 2.00);               // filament width — FIL W slider
    setSkyKnob("aurFilamentHeight", 2.00);              // filament height cap — FIL H slider
    setSkyKnob("aurFilamentIntensity", 2.25);           // filament brightness — FIL INT slider
    setSkyKnob("aurFilamentTrack", 2.0);                // curve-lite
    setU1f("cloudOn", U.cloudOn, 1.0);                   // cloud raymarch toggle — CLOUD switch
    setU1f("aurOn", U.aurOn, 1.0);                       // aurora enabled by default (disabled on mobile)
    gl.uniform1f(U.cloudDot, 226.0);                      // cloud dot density — CLD DOT slider
    gl.uniform1f(U.waterDot, 186.0);                      // water dot density — WATER DOT slider
  }
  applyDefaultUniforms();

  const cam = { clock: 0, lastNow: null };

  // ── DOM headline + subtitle (rendered crisp at native dpr) ────
  const heroTextLive = document.getElementById("heroText");
  const heroHeadlineLive = document.getElementById("heroHeadlineLive");
  const heroSublineLive  = document.getElementById("heroSublineLive");

  function setHeroHorizonY(v) {
    document.documentElement.style.setProperty("--hero-horizon-y", `${(v * 100).toFixed(3)}%`);
  }
  function setHeroTextOffset(axis, v) {
    const unit = axis === "x" ? "vw" : "vh";
    document.documentElement.style.setProperty(`--hero-text-offset-${axis}`, `${(v * 100).toFixed(2)}${unit}`);
  }

  // ── In-shader terminal text layer ─────────────────────────────
  const txCanvas = document.createElement("canvas");   // Canvas2D — survives context loss
  const txCtx = txCanvas.getContext("2d");
  let txTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, txTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.txt, 1);
  gl.uniform1f(U.boot, 1.0);

  // ── Baked value-noise LUT ─────────────────────────────────────
  // 256×256 RGBA. R = a 256-periodic white-noise grid; bilinear sampling of it
  // reconstructs 2D value noise in a single fetch. G = the same grid shifted by
  // (37,17) so it doubles as the z+1 slice for the IQ-style 3D noise lookup.
  // This replaces the per-call hash chains in vnoise() — the dominant ALU cost
  // of the cloud/aurora/god-ray passes — with one cached texture read.
  function buildNoiseTexture(size) {
    const N = size;
    const base = new Float32Array(N * N);
    let s = 0x9e3779b9 >>> 0; // deterministic xorshift32 so the look is stable
    const rnd = () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    for (let i = 0; i < N * N; i++) base[i] = rnd();
    const data = new Uint8Array(N * N * 4);
    const mask = N - 1; // N is a power of two → cheap wrap
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const idx = y * N + x;
        const g = base[((y + 17) & mask) * N + ((x + 37) & mask)];
        data[idx * 4 + 0] = (base[idx] * 255) | 0;
        data[idx * 4 + 1] = (g * 255) | 0;
        data[idx * 4 + 2] = 0;
        data[idx * 4 + 3] = 255;
      }
    }
    return { size: N, data };
  }
  let noiseTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  {
    const nm = buildNoiseTexture(256);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nm.size, nm.size, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, nm.data);
  }
  gl.uniform1i(U.noise, 3);
  setU1f("noiseOn", U.noiseOn, 1.0);

  const BOOT_LINE = "Hi, I'm River";
  const HEAD_LINE = HERO_HEAD_LINE;
  const SUB_LINE  = HERO_SUB_LINE;
  const SUB_DELAY = HERO_SUB_DELAY;     // ms after headline finishes before sub starts
  const SUB_RATE  = HERO_SUB_RATE;      // ms per character

  // Branch mark drawn straight onto the boot canvas (vector path, no
  // async image) so it picks up the same CRT pixelation/glow as the text.
  // New filled "river" mark. Drawn as a Path2D straight onto the boot
  // canvas (white, since the boot screen is dark) so it picks up the same
  // sampling/glow as the text. Source bounds: x[51..290], y[90..250.3]
  // → visual height ≈ 160.33, top-left at (51, 90).
  const BOOT_MARK = new Path2D(
    "M290 96.9999C290 137.317 257.344 170.066 216.875 170.066H160L166.216 145.171C168.44 136.265 176.441 130.016 185.62 130.016H216.875C235.169 130.015 250 115.222 250 96.9741V93.005C250 91.3462 251.346 90.0022 253.005 90.005L287.005 90.0613C288.66 90.064 290 91.4064 290 93.0613V96.9999Z " +
    "M51.0004 163.066C51.0004 122.75 83.6561 90.0004 124.125 90.0002H176.159C178.11 90.0002 179.542 91.8337 179.069 93.7269L171.514 123.989C170.624 127.551 167.424 130.051 163.752 130.051H124.125C105.831 130.051 91.0004 144.844 91.0004 163.092V167.033C91.0004 168.69 89.6572 170.033 88.0004 170.033H54.0004C52.3435 170.033 51.0004 168.69 51.0004 167.033V163.066Z " +
    "M51.0002 243.334C51.0002 203.017 83.6559 170.268 124.125 170.268L160 170L151.496 204.017C150.614 207.543 147.467 210.031 143.833 210.076L124.125 210.318C105.831 210.319 91.0002 225.112 91.0002 243.36V247.329C91.0002 248.988 89.654 250.332 87.9952 250.329L53.9952 250.273C52.3403 250.27 51.0002 248.928 51.0002 247.273V243.334Z " +
    "M290 177C290 217.317 257.344 250.066 216.875 250.066H140L145.27 228.96C148.05 217.827 158.051 210.016 169.525 210.016H216.875C235.169 210.015 250 195.222 250 176.974V173.005C250 171.346 251.346 170.002 253.005 170.005L287.005 170.061C288.66 170.064 290 171.406 290 173.061V177Z"
  );
  function drawLogo(ctx, x, y, h, alpha) {
    const s = h / 160.33;                // new mark visual height ≈ 160.33
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x - 51 * s, y - 90 * s);   // anchor mark's top-left at (x, y)
    ctx.scale(s, s);
    ctx.fillStyle = "#fff";
    ctx.fill(BOOT_MARK);
    ctx.restore();
  }

  let state = "boot";                 // "boot" → "live"
  let bootT0 = performance.now();
  let liveT0 = 0;
  // The intro clock (reveal + text delay) must measure from the FIRST frame the
  // loop actually renders, not from the performance.now() captured in goLive() —
  // async GPU detection + shader warm-up can elapse in between, which would
  // silently eat into (or skip past) the reveal. Re-anchored on the first live
  // rendered frame; the reduced-motion/static path never loops so is unaffected.
  let liveClockAnchored = false;
  // ── Page-visibility time tracking ──────────────────────────────
  // Background tabs throttle rAF to ~1Hz; on return the browser hands us a huge
  // `now - liveT0` jump which makes the headline/sub typing fast-forward and
  // the canyon reveal skip past its intro fade. Accumulate the hidden duration
  // and shift `liveT0` forward when we come back, so the scene continues exactly
  // where it left off (smooth, not jumpy).
  let hiddenSince = 0;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      // Mark the moment we went dark; rAF is paused here so we cannot rely on
      // a later `now` capture from the loop.
      hiddenSince = performance.now();
    } else if (hiddenSince > 0) {
      const wasAway = performance.now() - hiddenSince;
      hiddenSince = 0;
      // Shift liveT0 forward by the time we were away so subsequent
      // (now - liveT0) calculations are continuous, not jumpy. Only safe to
      // shift after the clock has been anchored (i.e. after the first live
      // frame) — before then the scene is still in the boot fade and the
      // headline hasn't started typing.
      if (liveClockAnchored) liveT0 += wasAway;
    }
  });

  let sceneHDev = 0;              // 场景区(100dvh)设备高; canvas 高 = sceneHDev + 尾部溶解区(v9)
  let pageBg = [1.0, 1.0, 1.0];   // 尾部溶解目标色 = --page-bg(themechange 同步)

  // 读取 --page-bg → u_pageBg。hex 与 rgb() 都接; 解析失败保持上一色(初始白)。
  function readPageBg() {
    let v = '';
    try { v = (getComputedStyle(document.documentElement).getPropertyValue('--page-bg') || '').trim(); } catch (e) {}
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (m) {
      let hx = m[1];
      if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
      pageBg = [parseInt(hx.slice(0, 2), 16) / 255, parseInt(hx.slice(2, 4), 16) / 255, parseInt(hx.slice(4, 6), 16) / 255];
    } else {
      const m2 = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(v);
      if (m2) pageBg = [parseFloat(m2[1]) / 255, parseFloat(m2[2]) / 255, parseFloat(m2[3]) / 255];
    }
    if (U.pageBg) gl.uniform3f(U.pageBg, pageBg[0], pageBg[1], pageBg[2]);
  }
  window.addEventListener('themechange', readPageBg);   // theme-system.js 派发自 window

  let headX = 0;                       // headline left, aligned to the nav logo
  let textScale   = 0.75;              // fixed boot text scale

  function sizeText() {
    // Match the render resolution so the text is sharp (not upscaled)
    txCanvas.width  = Math.max(2, canvas.width  || 1280);
    txCanvas.height = Math.max(2, sceneHDev || canvas.height || 720);   // v9: 文字层只覆盖场景区
    // Align the headline with the nav logo's left edge (--pad-x)
    const lk = document.querySelector(".nav .wordmark");
    const vw = Math.max(1, window.innerWidth || 1280);
    let leftCss = lk ? lk.getBoundingClientRect().left : vw * 0.085;
    if (!(leftCss > 0)) leftCss = vw * 0.085;
    headX = Math.round(leftCss * (txCanvas.width / vw));
  }

  function paintText(now) {
    const W = txCanvas.width, H = txCanvas.height;
    txCtx.clearRect(0, 0, W, H);
    txCtx.textBaseline = "alphabetic";
    txCtx.fillStyle = "#fff";
    const mx = Math.round(W * 0.085);
    const blink = (Math.floor(now / 500) % 2) === 0;

    if (state === "boot") {
      const el = now - bootT0;
      const n1 = Math.max(0, Math.min(BOOT_LINE.length, Math.floor((el - 350) / 72)));
      const f1 = Math.round(H * 0.036 * textScale);
      txCtx.font = `500 ${f1}px "JetBrains Mono", ui-monospace, monospace`;
      const s1 = "> " + BOOT_LINE.slice(0, n1);
      const y1 = Math.round(H * 0.45);
      txCtx.fillText(s1, mx, y1);
      const done1 = n1 >= BOOT_LINE.length;
      if (!done1 && blink) {
        const w = txCtx.measureText(s1).width;
        txCtx.fillRect(mx + w + 5, y1 - f1 * 0.78, f1 * 0.52, f1 * 0.92);
      }
      const doneAt = 350 + BOOT_LINE.length * 72;
      const y2 = y1 + Math.round(H * 0.105);
      if (done1) {
        // Logo sits inline, right after the "Hi, I'm River" text
        const fade = Math.max(0, Math.min(1, (el - doneAt - 120) / 400));
        const w1 = txCtx.measureText(s1).width;
        const hLogo = Math.round(f1 * 1.05);
        const yTop = Math.round(y1 - f1 * 0.36 - hLogo / 2);
        drawLogo(txCtx, mx + w1 + Math.round(f1 * 0.45), yTop, hLogo, fade);
      }
      if (done1 && el > doneAt + 480) {
        const f2 = Math.round(H * 0.020 * textScale);
        txCtx.font = `400 ${f2}px "JetBrains Mono", ui-monospace, monospace`;
        txCtx.globalAlpha = 0.62;
        const s2 = "press enter to continue";
        txCtx.fillText(s2, mx, y2);
        if (blink) {
          const w2 = txCtx.measureText(s2 + " ").width;
          txCtx.fillRect(mx + w2, y2 - f2 * 0.78, f2 * 0.52, f2 * 0.92);
        }
        txCtx.globalAlpha = 1;
      }
    } else {
      // Live mode: the headline + subtitle are rendered as a DOM overlay
      // (.hero-text) for crisp native-dpr type in the site's font. Nothing
      // to paint into the shader text texture here — leaving txCanvas clear
      // so the shader's text sample contributes zero.
      // Desktop (slide path) waits for the valley to condense in before the text
      // types. Phones/narrow (fade path) type in immediately over the bare sky,
      // then fade out before the valley reveals behind them.
      const el = now - liveT0 - (heroTextSlides() ? TEXT_DELAY_MS : 0);
      const nH = Math.max(0, Math.min(HEAD_LINE.length, Math.floor((el - 250) / 36)));
      const sH = HEAD_LINE.slice(0, nH);
      if (heroHeadlineLive && heroHeadlineLive.textContent !== sH) {
        heroHeadlineLive.textContent = sH;
      }
      if (heroHeadlineLive) {
        heroHeadlineLive.classList.toggle("typing", nH < HEAD_LINE.length);
      }

      const headDoneAt = 250 + HEAD_LINE.length * 36 + SUB_DELAY;
      if (el >= headDoneAt) {
        const nS = Math.max(0, Math.min(SUB_LINE.length,
                                        Math.floor((el - headDoneAt) / SUB_RATE)));
        const sS = SUB_LINE.slice(0, nS);
        if (heroSublineLive && heroSublineLive.textContent !== sS) {
          heroSublineLive.textContent = sS;
        }
        if (heroSublineLive) heroSublineLive.classList.add("cursor");
      } else if (heroSublineLive) {
        if (heroSublineLive.textContent !== "") heroSublineLive.textContent = "";
        heroSublineLive.classList.remove("cursor");
      }
    }
  }

  // PERF A/B (TEXT SUB toggle): texImage2D reallocates the screen-sized text
  // texture on every upload; texSubImage2D reuses the existing storage. Sub mode
  // needs storage already allocated at the current size, so we fall back to a
  // full texImage2D on first use and after any resize.
  let textSubMode = false;
  let txTexW = 0, txTexH = 0;
  function uploadText() {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, txTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (textSubMode && txTexW === txCanvas.width && txTexH === txCanvas.height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, txCanvas);
      return;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, txCanvas);
    txTexW = txCanvas.width; txTexH = txCanvas.height;
  }

  sizeText();
  paintText(performance.now());
  uploadText();

  // Deterministic chrome hide + scroll lock (JS-authoritative)
  const chromeEls = [
    document.getElementById("nav"),
    document.querySelector(".scroll-cue"),
    document.querySelector(".tod-debug"),
  ];
  function setChrome(hidden) {
    chromeEls.forEach((el) => {
      if (!el) return;
      if (hidden) {
        el.style.transition = "none";        // instant — no fade-out flash
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      } else {
        el.style.transition = "opacity 0.7s ease, color 240ms ease, background-color 240ms ease, border-bottom-color 240ms ease, backdrop-filter 240ms ease, -webkit-backdrop-filter 240ms ease";
        el.style.opacity = "1";              // fade IN from the inline 0
        el.style.pointerEvents = "";
      }
    });
    const ov = hidden ? "hidden" : "";
    document.documentElement.style.overflow = ov;
    document.body.style.overflow = ov;
    // Snap back to the top as the scene reveals, so the hero always fills the
    // viewport instead of leaving the cream section peeking below it.
    if (!hidden) window.scrollTo(0, 0);
  }

  function goLive() {
    if (state !== "boot") return;
    state = "live";
    liveT0 = performance.now();
    // Desktop holds the overlay hidden until the valley has revealed (it then
    // slides in). Phones/narrow show it from the start so the text can type in
    // over the bare sky before the valley reveal.
    if (heroTextLive) heroTextLive.style.opacity = heroTextSlides() ? "0" : "1";
    document.body.classList.remove("booting");
    document.body.classList.add("live");   // triggers the logo-bloom animation
    setChrome(false);
  }
  function retriggerTextSplay() {
    if (state === "boot") {
      goLive();
    } else {
      state = "live";
      liveT0 = performance.now();
    }
    if (heroHeadlineLive) {
      heroHeadlineLive.textContent = "";
      heroHeadlineLive.classList.add("typing");
    }
    if (heroSublineLive) {
      heroSublineLive.textContent = "";
      heroSublineLive.classList.remove("cursor");
    }
    paintText(performance.now());
    uploadText();
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.code === "Space") goLive();
  });
  window.addEventListener("pointerdown", goLive, { passive: true }); // tap/click too

  gl.clearColor(0.027, 0.078, 0.235, 1.0);

  // ── Silhouette AA tuning state (driven by the right-side debug panel) ──
  // Keep the full frame at 1× for volumetric cloud performance. Silhouette
  // clarity is tested through edge-only supersampling in the shader.
  // PERF v12.5 — browser at 50fps vs preview at 90fps was renderScale + AA cap
  // running wide-open. 0.66 backbuffer scaled by CSS = 2.3x fewer pixels for a
  // barely-noticeable quality hit; AA_LADDER starts at 4 (was 8) so we don't
  // peg the GPU on the very first frame and have to recover. Combine with the
  // existing adaptive governor — the ladder still climbs if there's headroom.
  // v13: 恢复 river.ai 原版值（hijack 已砍, shader 是唯一 pipeline）
  const AA = { taps: 4, feather: 0.0, signed: false, renderScale: 0.66 };
  const AA_LADDER = [0, 4, 8, 9];
  let aaGovernor = true;
  let aaLevel = Math.max(0, AA_LADDER.indexOf(AA.taps));
  let liveScale = AA.renderScale;
  let frameCap = 40;   // river.ai 原版默认值
  let frameMin = 1000 / frameCap;

  let dpr = 1;
  function size() {
    // hero is width:100% / height:100vh; guard the 0-width pre-layout case.
    // Use window.innerWidth/Height (NOT hero.clientWidth/Height) so a min-height
    // declaration on the container doesn't make the canvas taller than the
    // visible viewport (causing a black letterbox strip when 100vh < min-height).
    let w = window.innerWidth || 1280;
    let hv = window.innerHeight || 720;
    if (!(w > 2)) w = 1280;
    if (!(hv > 2)) hv = 720;
    // v9: canvas 向下延伸 tail CSS px —— 过渡并入动画本体(尾部在 shader 内溶解
    // 到 --page-bg), 不再有独立渐变带。与 CSS 侧 clamp(240px, 32dvh, 420px) 一致。
    const tail = Math.max(240, Math.min(420, Math.round(hv * 0.32)));
    let h = hv + tail;
    readPageBg();
    // Base dpr capped at 1.0 (matches river.ai original — 2.25x fewer pixels
    // than 1.5 cap, the single biggest win for iGPU. CSS handles the visual
    // sharpness; the GPU only does the math). render-scale multiplies it for
    // full-frame supersampling. CAP the result so the canvas never exceeds
    // the GPU's max buffer — otherwise the browser silently clamps ONE axis
    // and the whole scene + text stretch off-centre (worst at wide
    // fullscreen). Scaling both axes by the same factor preserves aspect.
    dpr = Math.min(window.devicePixelRatio || 1, 1.0) * liveScale;
    let cw = Math.max(2, Math.round(w * dpr));
    let ch = Math.max(2, Math.round(h * dpr));
    const maxDim = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, 8192);
    const over = Math.max(cw, ch) / maxDim;
    if (over > 1.0) { cw = Math.round(cw / over); ch = Math.round(ch / over); }
    dpr = cw / Math.max(1, w);   // effective dpr (after the cap) for cell sizing
    sceneHDev = Math.max(2, Math.round(hv * dpr));   // 场景区设备高(v9)
    canvas.width = cw;
    canvas.height = ch;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    gl.viewport(0, 0, cw, ch);
    sizeSkyTargets(cw, sceneHDev);   // v9: sky FBO 只覆盖场景区(与加高前一致)
    setU2f("res", U.res, cw, ch);    // 镜像 res: updateSkyTextures 读 uMirror.res
    gl.uniform1f(U.sceneH, sceneHDev);
    gl.uniform3f(U.pageBg, pageBg[0], pageBg[1], pageBg[2]);
    sizeText();
    paintText(performance.now());
    uploadText();
    // Re-paint immediately. Reassigning canvas.width/height clears the GL
    // drawing buffer; without this draw the canvas shows opaque black until
    // the next rAF tick, which flickers during window resizes.
    draw(reduce ? 8.0 : cam.clock);
  }

  function draw(t) {
    setU1f("time", U.time, t);   // time ∈ SKY_SYNC: 云/极光的天空 pass 靠它流动
    updateSkyTextures();   // refresh the half-res cloud/aurora layers (~30Hz)
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  size();
  // Keep the render scale stable across resize. Coalesce browser resize bursts
  // to one canvas realloc per animation frame so the shader does not visibly
  // switch lighting/shadow resolution while the user drags the window.
  let resizeRAF = 0;
  function onResize() {
    if (resizeRAF) cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(() => {
      resizeRAF = 0;
      liveScale = AA.renderScale;
      size();
    });
  }
  window.addEventListener("resize", onResize);
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(hero);

  // Push the (now fixed) silhouette-AA settings to the shader once at startup.
  gl.useProgram(prog);
  gl.uniform1f(U.aaN, AA.signed ? 0.0 : AA.taps);
  gl.uniform1f(U.aaFeather, AA.feather);
  gl.uniform1f(U.aaSigned, AA.signed ? 1.0 : 0.0);

  // ── WebGL context-loss recovery ───────────────────────────────
  // On Windows driver reset / GPU sleep-wake every GL object (programs, buffers,
  // textures, FBOs, uniform locations) is invalidated; the canvas stays alive
  // and the same `gl` handle is reused once `webglcontextrestored` fires. Without
  // rebuilding, the loop keeps drawing on a lost context → black hero + WebGL
  // errors every frame. `contextLost` gates the loop (no GL calls while lost);
  // rebuildGLResources() re-runs the SAME init primitives used at startup.
  let contextLost = false;

  async function rebuildGLResources() {
    // Recompile/relink all three programs (shader sources VS/FS/SKY_* survive
    // the loss — they are plain strings in this closure).
    vs = compile(gl.VERTEX_SHADER, VS);
    fs = compile(gl.FRAGMENT_SHADER, FS);
    fsSkyCloud = compile(gl.FRAGMENT_SHADER, SKY_CLOUD_FS);
    fsSkyAur = compile(gl.FRAGMENT_SHADER, SKY_AUR_FS);
    prog = linkProg(vs, fs);
    skyCloudProg = linkProg(vs, fsSkyCloud);
    skyAurProg = linkProg(vs, fsSkyAur);

    // Re-query the parallel-compile extension (handle object is also lost) and
    // wait for all three programs exactly as on the cold start.
    parCompile = gl.getExtension("KHR_parallel_shader_compile");
    if (parCompile) {
      const progs = [prog, skyCloudProg, skyAurProg];
      const t0 = performance.now();
      while (performance.now() - t0 < 60000) {
        let done = true;
        for (const p of progs) {
          if (!gl.getProgramParameter(p, parCompile.COMPLETION_STATUS_KHR)) { done = false; break; }
        }
        if (done) break;
        await new Promise((r) => setTimeout(r, 8));
      }
    }
    if (!checkShader(vs, "vs") || !checkShader(fs, "main")) return;
    if (!checkProg(prog, "main")) return;
    gl.useProgram(prog);

    // Fullscreen quad buffer + attrib (recreate + re-upload).
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Re-cache main-program uniform locations + sampler unit bindings.
    // Same factory as the cold start — the lists cannot drift (see
    // collectMainUniforms above).
    U = collectMainUniforms(prog);
    U.cloudTex = gl.getUniformLocation(prog, "u_cloudTex");
    U.aurTex   = gl.getUniformLocation(prog, "u_aurTex");
    gl.uniform1i(U.cloudTex, 4);
    gl.uniform1i(U.aurTex, 5);

    // Sky programs (re-finish) + half-res FBO targets (recreate textures/FBOs,
    // re-bind, re-param). finishSkyProg re-collects the sky uniform locations.
    skyProgs = {
      cloud: finishSkyProg(skyCloudProg, "cloud"),
      aur:   finishSkyProg(skyAurProg, "aurora"),
    };
    skyTargets = {
      cloud: { unit: 4, tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 0, h: 0, fresh: false },
      aur:   { unit: 5, tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 0, h: 0, fresh: false },
    };
    for (const t of [skyTargets.cloud, skyTargets.aur]) {
      gl.activeTexture(gl.TEXTURE0 + t.unit);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.activeTexture(gl.TEXTURE0);

    // Re-apply the slider/config defaults shared with the cold-start path.
    applyDefaultUniforms();

    // In-shader text layer texture (recreate + re-param + re-upload current text).
    txTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, txTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.txt, 1);
    textSubMode = false;   // force a full texImage2D on the next uploadText()
    txTexW = 0; txTexH = 0;

    // Value-noise LUT texture (recreate + re-param + regenerate the 256² grid).
    noiseTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    {
      const nm = buildNoiseTexture(256);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nm.size, nm.size, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE, nm.data);
    }
    gl.uniform1i(U.noise, 3);
    setU1f("noiseOn", U.noiseOn, 1.0);

    gl.activeTexture(gl.TEXTURE0);
    gl.clearColor(0.027, 0.078, 0.235, 1.0);

    // Re-apply touch overrides (cloud/aurora off + lighter AA) exactly as on the
    // cold start, so a restored hero on a phone doesn't suddenly turn both heavy
    // sky passes back on. heroCoarsePointer is queried fresh here to avoid any
    // TDZ coupling to its later top-level declaration.
    if (window.matchMedia("(pointer: coarse)").matches) {
      setU1f("cloudOn", U.cloudOn, 0.0);
      setU1f("aurOn", U.aurOn, 0.0);
    }

    // Re-push the silhouette-AA settings from the persistent AA state.
    gl.useProgram(prog);
    gl.uniform1f(U.aaN, AA.signed ? 0.0 : AA.taps);
    gl.uniform1f(U.aaFeather, AA.feather);
    gl.uniform1f(U.aaSigned, AA.signed ? 1.0 : 0.0);

    // Re-size (re-allocates the half-res sky targets against the new texture
    // objects, re-sets viewport/u_res(镜像)/u_sceneH/u_pageBg, repaints +
    // re-uploads the text, and draws one frame so the hero isn't black for a
    // tick).
    size();
  }

  // preventDefault on `webglcontextlost` is what ALLOWS the context to be
  // restored (otherwise the canvas stays permanently dead). The loop checks
  // `contextLost` and no-ops while it is true.
  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    contextLost = true;
  }, false);
  canvas.addEventListener("webglcontextrestored", async function () {
    try {
      await rebuildGLResources();
    } catch (err) {
      // If the rebuild itself throws (a flaky driver mid-restore), don't leave
      // the hero stuck: surface it and fall back so the page stays usable.
      console.error("[river] context-restore rebuild failed", err);
      if (typeof freezeStaticHero === "function") freezeStaticHero();
      return;
    }
    contextLost = false;
    // Kick the loop again — it self-schedules via rAF once restarted. The live
    // loop's IntersectionObserver/startLoop path also re-arms on its own, but
    // calling startLoop() here covers the common in-view case immediately.
    if (!reduce && typeof startLoop === "function") startLoop();
  }, false);

  // Pointer interaction note: the legacy u_mouse/u_mAmt river-bend uniforms
  // died with the ASCII field() code (removed in the dead-code sweep) — do not
  // re-add them. The live pointer effect is the v14 camera sway (u_par),
  // tracked in the loop-state block and written every frame in loop().

  // ── Intro reveal: text types in centred over a bare sky, then (after a beat)
  // the headline slides left quickly to its resting offset while the canyon + sky
  // condense in front→horizon over a slower, more cinematic fade. Both start
  // together; the slide finishes well before the fade.
  const TYPEIN_MS = HERO_TYPEIN_MS;
  const REVEAL_HOLD_MS = HERO_REVEAL_HOLD_MS;  // beat to read the full line before it moves
  const TEXT_SLIDE_MS = HERO_TEXT_SLIDE_MS;    // headline slide-left — quick
  const REVEAL_MS = HERO_REVEAL_MS;            // canyon + sky fade-in — slow
  const TEXT_DELAY_MS = HERO_TEXT_DELAY_MS;    // hold the headline until the valley has condensed in, then type it
  const MOBILE_FADE_DELAY_MS = HERO_MOBILE_FADE_DELAY_MS; // narrow/touch: hold the text before it fades
  const MOBILE_REVEAL_START_MS = HERO_MOBILE_REVEAL_START_MS; // narrow/touch: hold the valley reveal until the text has faded
  const MOBILE_REVEAL_MS = HERO_MOBILE_REVEAL_MS;            // narrow/touch: valley condense duration
  // The headline's resting X offset (captured target); it starts centred (0) and
  // animates to this. heroRevealDone gates whether the slider applies live.
  let heroTextTargetX = (() => {
    const el = document.getElementById("textOffsetXSlider");
    return el ? parseInt(el.value, 10) / 1000 : -0.25;
  })();
  let heroRevealDone = false;

  // Below this width, or on a touch device, the leftward headline slide doesn't
  // fit — the headline fades out during the reveal instead of sliding. On a
  // non-touch viewport it reappears (slid to its offset) when resized wide enough.
  const heroCoarsePointer = window.matchMedia("(pointer: coarse)");
  function heroTextSlides() {
    return !heroCoarsePointer.matches && window.innerWidth >= HERO_TEXT_SLIDE_MIN_W;
  }
  function refreshHeroTextForViewport() {
    if (!heroRevealDone || !heroTextLive) return;   // only matters after the intro slide
    if (heroTextSlides()) {
      setHeroTextOffset("x", heroTextTargetX);       // rest at the slid offset
      heroScrollFade();                              // honour the current scroll position
    } else {
      heroTextLive.style.opacity = "0";              // too narrow / touch → stay hidden
    }
  }
  window.addEventListener("resize", refreshHeroTextForViewport, { passive: true });

  // Fade the headline + subtitle out as the page scrolls so they never collide
  // with the fixed nav logo. Reversible; only after the intro slide, slide layout
  // only (the narrow/touch path keeps the centred text hidden anyway).
  function heroScrollFade() {
    if (!heroRevealDone || !heroTextLive || !heroTextSlides()) return;
    heroTextLive.style.transition = "none";          // track scroll crisply (the intro fade-in is done)
    const sf = Math.max(0, Math.min(1, 1 - window.scrollY / (window.innerHeight * 0.4)));
    heroTextLive.style.opacity = String(sf);
  }
  window.addEventListener("scroll", heroScrollFade, { passive: true });

  // Time-of-day: defaults to the user's local clock; the debug slider
  // overrides it once dragged ("· live" tag drops off the label).
  const todSlider = document.getElementById("todSlider");
  const todLabel  = document.getElementById("todLabel");
  const timeSpeedSlider = document.getElementById("timeSpeedSlider");
  const timeSpeedLabel  = document.getElementById("timeSpeedLabel");
  let todAuto = true;
  let todSpeed = 1.0;
  function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  // Always-flattering day/night cycle: time advances through a FULL day
  // — sunrise, daytime, sunset, night all happen — but a monotonic warp
  // lingers on the dawn & dusk golden hours and moves quickest across
  // midnight and noon. Combined with the lifted night floor and the
  // softened midday (in the grade), every moment stays cinematic.
  const TOD_CYCLE_MS = 90000;              // one full (warped) day ~90s
  const HERO_LIVE_STOP_MS = TOD_CYCLE_MS;  // stop after the full scene cycle, not just the intro
  const TOD_DWELL    = 0.60;               // dawn/dusk dwell strength (0..<1)
  const todStartMin = 510;                 // 08:30
  let todBaseMin = todStartMin;            // linear, unwarped minute at todStartTS
  let todStartTS = -1;                     // set from the rAF clock on 1st frame
  let todLinearMin = todStartMin;
  let todLastTS = -1;
  if (todSlider) {
    todSlider.value = String(todStartMin);
    todSlider.addEventListener("input", () => { todAuto = false; });
  }
  if (timeSpeedSlider) {
    const applyTimeSpeed = () => {
      if (todAuto && todLastTS >= 0) {
        todBaseMin = todLinearMin;
        todStartTS = todLastTS;
      }
      todSpeed = Math.max(0, parseInt(timeSpeedSlider.value, 10) || 0) / 100;
      if (timeSpeedLabel) {
        timeSpeedLabel.textContent =
          (todSpeed >= 10 ? todSpeed.toFixed(1) : todSpeed.toFixed(2)) + "x";
      }
    };
    timeSpeedSlider.addEventListener("input", applyTimeSpeed);
    applyTimeSpeed();
  }

  // ── Shader knob sliders ────────────────────────────────────
  // Each slider stores an integer; we divide to get the float value the
  // shader uniform expects. Live updates — no reload required.
  function wireKnob(id, labelId, divisor, fmt, applyFn) {
    const sl = document.getElementById(id);
    const lb = document.getElementById(labelId);
    if (!sl) return;
    function apply() {
      const v = parseInt(sl.value, 10) / divisor;
      if (lb) lb.textContent = fmt(v);
      applyFn(v);
    }
    sl.addEventListener("input", apply);
    apply();
  }
  const fix2 = (v) => v.toFixed(2);
  const fix3 = (v) => v.toFixed(3);
  wireKnob("waterDotSlider", "waterDotLabel", 1, (v) => String(Math.round(v)),
           (v) => gl.uniform1f(U.waterDot, v));
  wireKnob("viewHorizonSlider", "viewHorizonLabel", 1000, fix3,
           (v) => {
             setU1f("viewHorizon", U.viewHorizon, v);   // 镜像: 天空 pass 地平线同步
             setHeroHorizonY(v);
           });
  wireKnob("scrollSlider", "scrollLabel", 100, fix2,
           (v) => gl.uniform1f(U.scroll, v));
  wireKnob("sunSlider", "sunLabel", 100, fix2,
           (v) => gl.uniform1f(U.sun, v));
  const twilightToggle = document.getElementById("twilightToggle");
  if (twilightToggle) {
    const applyTwilight = () => setU1f("twilight", U.twilight, twilightToggle.checked ? 1.0 : 0.0);
    twilightToggle.addEventListener("change", applyTwilight);
    applyTwilight();
  }
  wireKnob("twRadiusSlider", "twRadiusLabel", 100, fix2,
           (v) => setU1f("twRadius", U.twRadius, v));
  wireKnob("twEllipseSlider", "twEllipseLabel", 100, fix2,
           (v) => setU1f("twEllipse", U.twEllipse, v));
  wireKnob("twEllipseXSlider", "twEllipseXLabel", 100, fix2,
           (v) => setU1f("twEllipseX", U.twEllipseX, v));
  wireKnob("twSunZoneSlider", "twSunZoneLabel", 100, fix2,
           (v) => setU1f("twSunZone", U.twSunZone, v));
  wireKnob("canyonSlider", "canyonLabel", 100, fix2,
           (v) => gl.uniform1f(U.canyonDepth, v));
  wireKnob("fpsCapSlider", "fpsCapLabel", 1, (v) => String(Math.round(v)),
           (v) => { frameCap = Math.max(15, Math.round(v)); frameMin = 1000 / frameCap; });
  // AA MODE select: SSAA tap count (off/4/8/9) vs the cheaper signed-distance
  // 1× path (u_aaSigned). Exposes the SDF path that was previously hardcoded off.
  const aaModeSelect = document.getElementById("aaModeSelect");
  if (aaModeSelect) {
    const applyAaMode = () => {
      if (aaModeSelect.value === "sdf") {
        AA.signed = true;
      } else {
        AA.signed = false;
        AA.taps = parseInt(aaModeSelect.value, 10) || 0;
      }
      aaLevel = Math.max(0, AA_LADDER.indexOf(AA.taps));
      gl.uniform1f(U.aaN, AA.signed ? 0.0 : AA.taps);
      gl.uniform1f(U.aaSigned, AA.signed ? 1.0 : 0.0);
    };
    // A real user change hands control to the dropdown; the init call doesn't.
    aaModeSelect.addEventListener("change", () => {
      aaGovernor = false;
      if (aaAutoToggle) aaAutoToggle.checked = false;   // reflect in the panel
      applyAaMode();
    });
    applyAaMode();
  }

  // AUTO AA: enable/disable the adaptive governor. When re-enabled it resumes
  // from the dropdown's current rung; turning it off freezes the current level.
  const aaAutoToggle = document.getElementById("aaAutoToggle");
  if (aaAutoToggle) {
    aaAutoToggle.checked = aaGovernor;
    aaAutoToggle.addEventListener("change", () => {
      aaGovernor = aaAutoToggle.checked && !AA.signed;
    });
  }
  wireKnob("canyonStepsSlider", "canyonStepsLabel", 1, (v) => String(Math.round(v)),
           (v) => gl.uniform1f(U.canyonMaxSteps, Math.max(1, Math.round(v))));
  wireKnob("refineSlider", "refineLabel", 1, (v) => String(Math.round(v)),
           (v) => gl.uniform1f(U.refineSteps, Math.max(1, Math.round(v))));
  const refineModeSelect = document.getElementById("refineModeSelect");
  if (refineModeSelect) {
    const applyRefineMode = () =>
      gl.uniform1f(U.refineMode, parseFloat(refineModeSelect.value) || 0.0);
    refineModeSelect.addEventListener("change", applyRefineMode);
    applyRefineMode();
  }
  const hoistToggle = document.getElementById("hoistToggle");
  if (hoistToggle) {
    const applyHoist = () => gl.uniform1f(U.hoist, hoistToggle.checked ? 1.0 : 0.0);
    hoistToggle.addEventListener("change", applyHoist);
    applyHoist();
  }
  const noiseTexToggle = document.getElementById("noiseTexToggle");
  if (noiseTexToggle) {
    const applyNoiseTex = () => setU1f("noiseOn", U.noiseOn, noiseTexToggle.checked ? 1.0 : 0.0);
    noiseTexToggle.addEventListener("change", applyNoiseTex);
    applyNoiseTex();
  }
  const textSubToggle = document.getElementById("textSubToggle");
  if (textSubToggle) {
    const applyTextSub = () => { textSubMode = textSubToggle.checked; };
    textSubToggle.addEventListener("change", applyTextSub);
    applyTextSub();
  }
  const textHorizonToggle = document.getElementById("textHorizonToggle");
  if (textHorizonToggle) {
    const applyTextHorizon = () => {
      if (heroTextLive) heroTextLive.classList.toggle("hero-text--horizon", textHorizonToggle.checked);
    };
    textHorizonToggle.addEventListener("change", applyTextHorizon);
    applyTextHorizon();
  }
  wireKnob("textOffsetXSlider", "textOffsetXLabel", 1000, fix2,
           (v) => {
             heroTextTargetX = v;
             // During the intro the loop owns the X offset (centred → target); only
             // apply slider drags directly once the reveal has finished (or static).
             if (heroRevealDone || reduce) setHeroTextOffset("x", v);
           });
  wireKnob("textOffsetYSlider", "textOffsetYLabel", 1000, fix2,
           (v) => setHeroTextOffset("y", v));
  const textRetriggerButton = document.getElementById("textRetriggerButton");
  if (textRetriggerButton) {
    textRetriggerButton.addEventListener("click", retriggerTextSplay);
  }
  wireKnob("canyonStepScaleSlider", "canyonStepScaleLabel", 100, fix2,
           (v) => gl.uniform1f(U.canyonStepScale, v));
  wireKnob("renderScaleSlider", "renderScaleLabel", 100, fix2,
           (v) => {
             AA.renderScale = Math.max(0.5, Math.min(1.0, v));
             liveScale = AA.renderScale;
             size();
           });
  wireKnob("aurDotSlider", "aurDotLabel", 1, (v) => String(Math.round(v)),
           (v) => gl.uniform1f(U.aurDot, v));
  wireKnob("aurPlaneSlider", "aurPlaneLabel", 1, (v) => String(Math.round(v)),
           (v) => setSkyKnob("aurPlaneSamples", v));
  wireKnob("aurFillSlider", "aurFillLabel", 100, fix2,
           (v) => setSkyKnob("aurSampleFill", v));
  wireKnob("aurTopGainSlider", "aurTopGainLabel", 100, fix2,
           (v) => setSkyKnob("aurTopGain", v));
  wireKnob("aurRaysSlider", "aurRaysLabel", 1, (v) => String(Math.round(v)),
           (v) => setSkyKnob("aurRaySamples", v));
  wireKnob("aurHeightSlider", "aurHeightLabel", 100, fix2,
           (v) => setSkyKnob("aurHeightScale", v));
  wireKnob("aurOriginYSlider", "aurOriginYLabel", 100, fix2,
           (v) => setU1f("aurOriginY", U.aurOriginY, v));   // 镜像: 天空 pass 发射原点同步
  wireKnob("aurOriginTaperSlider", "aurOriginTaperLabel", 100, fix2,
           (v) => setSkyKnob("aurOriginTaper", v));
  wireKnob("aurFilDensitySlider", "aurFilDensityLabel", 100, fix2,
           (v) => setSkyKnob("aurFilamentDensity", v));
  wireKnob("aurFilWidthSlider", "aurFilWidthLabel", 100, fix2,
           (v) => setSkyKnob("aurFilamentWidth", v));
  wireKnob("aurFilHeightSlider", "aurFilHeightLabel", 100, fix2,
           (v) => setSkyKnob("aurFilamentHeight", v));
  wireKnob("aurFilIntSlider", "aurFilIntLabel", 100, fix2,
           (v) => setSkyKnob("aurFilamentIntensity", v));
  const aurFilTrackSelect = document.getElementById("aurFilTrackSelect");
  if (aurFilTrackSelect) {
    const applyFilTrack = () => {
      setSkyKnob("aurFilamentTrack", parseFloat(aurFilTrackSelect.value));
    };
    aurFilTrackSelect.addEventListener("change", applyFilTrack);
    applyFilTrack();
  }
  const cloudToggle = document.getElementById("cloudToggle");
  if (cloudToggle) {
    const applyCloudToggle = () => {
      setU1f("cloudOn", U.cloudOn, cloudToggle.checked ? 1.0 : 0.0);   // 镜像: 云层门控
    };
    cloudToggle.addEventListener("change", applyCloudToggle);
    applyCloudToggle();
  }
  // Mobile/touch: disable the two heaviest sky effects — the volumetric clouds
  // and the aurora — to keep the hero light on weaker GPUs. (Set after the cloud
  // toggle wiring so it wins; touch state doesn't change on resize.)
  if (heroCoarsePointer.matches) {
    if (cloudToggle) cloudToggle.checked = false;
    setU1f("cloudOn", U.cloudOn, 0.0);
    setU1f("aurOn", U.aurOn, 0.0);
    // Open lighter on touch GPUs — start AA at ×4; the governor climbs back
    // to ×8/×9 if the device proves it has the headroom.
    AA.taps = 4;
    aaLevel = AA_LADDER.indexOf(4);
    gl.uniform1f(U.aaN, AA.taps);
    if (aaModeSelect) aaModeSelect.value = "4";
  }
  wireKnob("cloudDotSlider", "cloudDotLabel", 1, (v) => String(Math.round(v)),
           (v) => gl.uniform1f(U.cloudDot, v));
  const canyonShadowToggle = document.getElementById("canyonShadowToggle");
  if (canyonShadowToggle) {
    const applyCanyonShadowToggle = () => {
      gl.uniform1f(U.canyonShadow, canyonShadowToggle.checked ? 1.0 : 0.0);
    };
    canyonShadowToggle.addEventListener("change", applyCanyonShadowToggle);
    applyCanyonShadowToggle();
  }

  wireKnob("flowSlider", "flowLabel", 100, fix2,
           (v) => gl.uniform1f(U.flowSpd, v));
  wireKnob("foamSlider", "foamLabel", 100, fix2,
           (v) => gl.uniform1f(U.foam, v));

  // Debug panel minimize toggle
  const dbgBar = document.getElementById("debugBar");
  const dbgToggle = document.getElementById("dbgToggle");
  if (dbgBar && dbgToggle) {
    dbgToggle.addEventListener("click", () => {
      const min = dbgBar.classList.toggle("minimized");
      dbgToggle.textContent = min ? "+" : "−";
      dbgToggle.setAttribute("aria-label", min ? "Expand debug" : "Minimize debug");
    });
  }
  // ts = the requestAnimationFrame timestamp (the render clock that
  // actually advances here — performance.now() can be frozen).
  // Aurora colour is chosen once per night and latched at sunset (minute 1080),
  // so it stays constant for the whole night and can never flip mid-aurora.
  // 0 = green, 1 = violet. It simply ALTERNATES every night; the first colour
  // shown on this page load is picked at random.
  let auroraHue = 0.0;
  const auroraStart = Math.random() < 0.5 ? 0 : 1;   // random first colour at load
  function nightHue(nightIndex) {
    const parity = (((nightIndex % 2) + 2) % 2);      // 0,1,0,1 … (handles negatives)
    return (parity ^ auroraStart) ? 1.0 : 0.0;
  }
  // Aurora drift speed is also rolled fresh each sunset (same night index as the
  // colour), picked at random from a fixed set so each night dances differently.
  let auroraSpeed = 1.0;
  // Matches the sandbox default: global speed 0.30 × aurora 4.6 = 1.38.
  const AUR_SPEEDS = [1.38, 1.38, 1.38, 1.38];
  function nightSpeed(nightIndex) {
    const r = Math.abs(Math.sin(nightIndex * 91.73 + 13.13) * 43758.5453);
    return AUR_SPEEDS[Math.floor((r - Math.floor(r)) * 4.0) & 3];
  }

  function todFrac(ts) {
    let m;
    if (todAuto) {
      if (todStartTS < 0) todStartTS = ts;
      const adv = (ts - todStartTS) * (1440 / TOD_CYCLE_MS) * todSpeed;
      const linearMin = todBaseMin + adv;
      todLinearMin = linearMin;
      todLastTS = ts;
      // night index advances at sunset (1080) so the latched colour spans the
      // entire dark window (sunset → midnight → sunrise) without changing.
      auroraHue = nightHue(Math.floor((linearMin - 1080) / 1440));
      auroraSpeed = nightSpeed(Math.floor((linearMin - 1080) / 1440));
      // Linear phase 0..1 → a monotonic warp that dwells on dawn (06:00)
      // and dusk (18:00) and rushes midnight & noon, so the whole cycle
      // still plays out but the flattering golden hours dominate.
      const pl = (((linearMin % 1440) + 1440) % 1440) / 1440;
      let pw = pl + (TOD_DWELL / (4.0 * Math.PI)) * Math.sin(4.0 * Math.PI * pl);
      pw = ((pw % 1) + 1) % 1;
      m = pw * 1440;
      if (todSlider) todSlider.value = String(Math.floor(m));
    } else {
      m = todSlider ? (parseInt(todSlider.value, 10) || 0) : todStartMin;
      auroraHue = nightHue(Math.floor((m - 1080) / 1440));
      auroraSpeed = nightSpeed(Math.floor((m - 1080) / 1440));
    }
    if (todLabel) {
      const mm = Math.floor(m);
      todLabel.textContent =
        pad2((mm / 60) | 0) + ":" + pad2(mm % 60) + (todAuto ? " · auto" : "");
    }
    return m / 1440.0;
  }

  if (reduce) {
    // Reduced motion: skip the boot, headline shown statically
    state = "live";
    liveT0 = performance.now() - 1.0e6;
    setChrome(false);                       // reveal header (inline starts hidden)
    gl.uniform1f(U.boot, 0.0);
    setU1f("tod", U.tod, todFrac(0));       // static (reduced motion)
    gl.uniform1f(U.aurHue, auroraHue);
    setU1f("aurSpeed", U.aurSpeed, auroraSpeed);
    paintText(performance.now());
    uploadText();
    // Static end state: headline at its slid offset on wide/non-touch, hidden on
    // narrow/touch (no slide to play).
    heroRevealDone = true;
    refreshHeroTextForViewport();
    draw(8.0); // static, fully written-in (u_intro defaults to 1)
    // 预热兜底图撤岗: 静态帧已整幅绘出, 直接交叉淡出
    if (heroWarmupStill) { heroWarmupStill = false; heroStill.classList.remove("is-shown"); }
  } else {
    // Intro/boot screen ("Hi, I'm River" → press enter to continue) removed:
    // reveal the live hero immediately instead of waiting for the user to
    // continue. The scene still fades up and the headline types itself in.
    goLive();

    // Arrow-key steering removed — deterministic flight path (u_steer stays 0).

    // ── Pointer parallax (v14, 2026-08-28) ──────────────────────
    // 指针归一化坐标(-1..1)→ u_par,renderValley 里摇 3D 峡谷相机射线;
    // 天空渐变/太阳/光晕是 uv 空间层,不随动,形成"近景移、远景定"的层次
    // 视差。触屏 / reduced-motion 关闭(u_par 保持 applyDefaultUniforms 的
    // 居中默认);指针离窗或 hero 滚离场景区时影响淡出。每帧缓动在 loop()。
    const ptrEnabled = !reduce && !window.matchMedia("(pointer: coarse)").matches;
    const ptr = { x: 0, y: 0, tx: 0, ty: 0, amt: 0, tAmt: 0, init: false };
    if (ptrEnabled) {
      window.addEventListener("pointermove", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        const r = canvas.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) { ptr.tAmt = 0; return; }
        ptr.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        ptr.ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
        if (!ptr.init) { ptr.x = ptr.tx; ptr.y = ptr.ty; ptr.init = true; }
        ptr.tAmt = 1;
      }, { passive: true });
      const ptrOff = function () { ptr.tAmt = 0; };
      document.addEventListener("pointerleave", ptrOff);
      window.addEventListener("blur", ptrOff);
    }

    let bootCur = 1.0, lastTx = 0, lastFrame = 0, fpsEma = frameCap, fpsUi = 0;
    // ── Adaptive-AA governor: probe → settle → measure → keep or revert ──
    let aaCeiling = AA_LADDER.length - 1;  // highest rung known to be sustainable
    let aaPhase = "hold";        // "hold" | "verify" (just climbed, awaiting verdict)
    let aaProbeBase = 0;         // rung to fall back to if a probe climb fails
    let aaNextProbeAt = 0;       // earliest time to attempt another climb
    let aaWindowEnd = 0;         // when the current measurement window closes
    let aaMeasureFrom = 0;       // ignore frames before this (post-change settle)
    let aaFpsSum = 0, aaFpsCount = 0;      // mean rendered fps over the window
    let lastCeilRelax = 0;       // periodic re-probe above a pinned ceiling
    let lastRaf = 0, rafMsEma = 0;   // measured display-refresh interval (every rAF tick)
    function setAaLevel(n) {
      aaLevel = Math.min(AA_LADDER.length - 1, Math.max(0, n));
      AA.taps = AA_LADDER[aaLevel];
      gl.uniform1f(U.aaN, AA.taps);
      if (aaModeSelect) aaModeSelect.value = String(AA.taps);
    }
    let heroVisible = true, looping = false, heroCanRenderLive = false, heroCycleStopped = false;

    // ── True-shitbox bail-out ─────────────────────────────────────
    // If the device can't hold ~20fps even with AA already at the floor, a live
    // raymarch looks worse than a still and just drains the battery. Render one
    // clean sunrise frame, snapshot the canvas into the <img>, swap it in, stop
    // the loop, and drop the GL context to reclaim the GPU.
    let heroFrozen = false;       // true once we've bailed to the static still
    let aaShitboxStrikes = 0;     // consecutive sub-20fps windows at the AA floor
    function freezeStaticHero() {
      if (heroFrozen) return;
      heroFrozen = true;
      looping = false;
      let url = null;
      try {
        setU1f("tod", U.tod, 0.28);             // ~06:45 — warm low sun, just risen
        if (AA_LADDER.indexOf(4) >= 0) { AA.taps = 4; gl.uniform1f(U.aaN, 4); } // crisp still
        draw(cam.clock || 8.0);                 // render the frame…
        // Same synchronous task as the draw → the drawing buffer hasn't been
        // cleared yet (that happens at composite), so toDataURL captures it
        // even without preserveDrawingBuffer.
        url = canvas.toDataURL("image/jpeg", 0.9);
      } catch (e) { url = null; }
      if (url && heroStill) {
        heroStill.onload = function () {
          heroStill.classList.add("is-shown");  // fade still in (to 0.8, matching the canvas)
          canvas.style.opacity = "0";           // …and fade the live canvas out
          const lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();         // reclaim the GPU now the <img> is up
        };
        heroStill.src = url;
      }
      // If the capture failed we simply stop looping; the last drawn frame
      // stays on the canvas and we leave the context intact.
    }
    function stopLiveHeroAfterCycle() {
      if (heroCycleStopped) return;
      heroCycleStopped = true;
      heroCanRenderLive = false;
      looping = false;
      document.body.classList.add("hero-cycle-done");
      // 循环结束 → 切静态日出图: 截一帧晨光淡入, canvas 淡出释放 GPU。
      // 若不切, canvas 停止渲染后缓冲被合成清除 → 全黑。v9: 过渡已在 shader
      // 尾部(溶解到 --page-bg), toDataURL 整幅截图自带尾部, 无需取样对齐。
      freezeStaticHero();
    }
    // Dev hook: call riverFreezeHero() in the console to preview the static
    // sunrise still on any machine, without having to be an actual shitbox.
    window.riverFreezeHero = freezeStaticHero;

    // ── GPU frame-time probe ──────────────────────────────────────
    // rAF fps is clamped to the monitor refresh (≈60Hz), so it cannot show
    // whether the shader is "200fps fast". EXT_disjoint_timer_query measures
    // the actual GPU time spent on the hero draw; 200fps == 5.0ms/frame. We
    // keep a single query in flight and read it back a frame later.
    const gpuExt = gl.getExtension("EXT_disjoint_timer_query");
    let gpuQuery = gpuExt ? gpuExt.createQueryEXT() : null;
    let gpuPending = false, gpuMsEma = 0;
    function gpuTimedDraw(t) {
      if (gpuExt && gpuQuery && !gpuPending) {
        gpuExt.beginQueryEXT(gpuExt.TIME_ELAPSED_EXT, gpuQuery);
        draw(t);
        gpuExt.endQueryEXT(gpuExt.TIME_ELAPSED_EXT);
        gpuPending = true;
      } else {
        draw(t);
      }
      if (gpuExt && gpuPending) {
        const disjoint = gl.getParameter(gpuExt.GPU_DISJOINT_EXT);
        if (disjoint) { gpuPending = false; }
        else if (gpuExt.getQueryObjectEXT(gpuQuery, gpuExt.QUERY_RESULT_AVAILABLE_EXT)) {
          const ns = gpuExt.getQueryObjectEXT(gpuQuery, gpuExt.QUERY_RESULT_EXT);
          const ms = ns / 1.0e6;
          gpuMsEma = gpuMsEma > 0 ? gpuMsEma + (ms - gpuMsEma) * 0.15 : ms;
          gpuPending = false;
        }
      }
    }

    function loop(now) {
      // Pause the expensive WebGL hero while it's scrolled out of view.
      // Background tabs are already throttled by the browser's own rAF.
      if (heroFrozen) { looping = false; return; }
      if (!heroVisible) { looping = false; return; }
      // Context is lost (driver reset / GPU sleep-wake): all GL calls would
      // no-op or error. Stop self-scheduling; the webglcontextrestored handler
      // rebuilds the resources and calls startLoop() to resume.
      if (contextLost) { looping = false; return; }

      // Measure the display refresh from the raw rAF cadence (this runs on every
      // tick, including throttled-away ones). Lets the governor judge fps against
      // the rate this cap can ACTUALLY reach — 40 on a 60Hz panel renders at 30,
      // and that 30 is healthy, not a stall.
      if (lastRaf > 0) {
        const d = now - lastRaf;
        if (d > 1 && d < 100) rafMsEma = rafMsEma > 0 ? rafMsEma + (d - rafMsEma) * 0.1 : d;
      }
      lastRaf = now;

      // Cap render rate so the GPU doesn't starve the compositor during
      // scroll. We still request a frame each rAF to stay smooth. The 4ms slack
      // matters: without it, a rAF tick that lands a hair before the target
      // (jitter is ±1-2ms) gets dropped, so a 60Hz refresh against a 16.7ms
      // target beats down to every-other-frame = 30fps. This was the Safari
      // "stuck at 30" — Safari shows real rAF fps where Chrome hides it behind
      // the GPU-timer readout.
      if (now - lastFrame < frameMin - 4) { requestAnimationFrame(loop); return; }
      const frameDelta = lastFrame > 0 ? now - lastFrame : frameMin;
      lastFrame = now;

      // Anchor the intro clock to this, the first frame the loop actually
      // renders, so the reveal + text delay always play in full from frame 1
      // regardless of how long GPU detection / shader warm-up took beforehand.
      if (state === "live" && !liveClockAnchored) {
        liveT0 = now;
        liveClockAnchored = true;
      }
      if (frameDelta > 0) {
        const fps = 1000 / frameDelta;
        fpsEma += (fps - fpsEma) * 0.12;
        // Feed the governor's measurement window (skip the post-change settle).
        // Gaps over 250ms are pauses (tab switch, iOS scroll suspension, GC),
        // not render speed — one 5s gap averaged in reads as a fake stall.
        if (now >= aaMeasureFrom && frameDelta < 250) { aaFpsSum += fps; aaFpsCount++; }
      }
      // v12.14 - 移除右下角 fps/ms 显示 (用户要求) → 不再 textContent, 节省 layout/reflow 开销
      // 保留 fpsEma / gpuMsEma 内部统计供 AA governor 使用, 仅跳过 DOM 更新
      // fpsUi 变量保留以免改动其他逻辑
      // (空块)

      // ── Adaptive AA governor (probe → settle → measure → verdict) ──
      // Instead of reacting to the instantaneous fps (twitchy: a scroll or GC
      // hitch would wrongly demote AA), we change one rung, let it settle, then
      // measure the MEAN rendered fps over a window and decide:
      //   • climbing: keep the higher rung only if it sustains the target;
      //     otherwise revert and remember that rung as the ceiling.
      //   • holding: drop only on a sustained shortfall, not a blip.
      // Target = the rate this cap can actually reach on the measured panel
      // (refresh ÷ whole-number) so cap-40-pegged-at-30 on 60Hz reads as healthy.
      // Held off until the intro reveal finishes (its heavy frames aren't typical).
      if (aaGovernor && !AA.signed && state === "live" && heroRevealDone
          && now >= aaWindowEnd) {
        const usingGpu = gpuMsEma > 0;
        // No verdict on the very first eligible frame (the "window" would be
        // every frame since page load — intro reveal + shader warm-up demoted
        // good devices on sight) or on a window that collected no samples.
        if (aaWindowEnd > 0 && (usingGpu || aaFpsCount > 0)) {
          // Achievable rate under this cap: the throttle renders on the first
          // rAF tick ≥ (frameMin-4)ms after the last frame, so the real period
          // is ceil((frameMin-4)/tick) ticks. Mirroring that here — instead of
          // Math.round(refresh/cap) — matters at the 60Hz+cap40 boundary: that
          // ratio is exactly 1.5, and a hair of rAF-timing noise (Safari's
          // performance.now() is ~1ms coarse) used to flip the rounding to 1,
          // demanding an impossible ~60fps from a loop that renders 30. Safari
          // has no GPU timer, so it's judged on fps → read as permanently
          // lagging → AA pinned to off while Chrome (GPU-timer path) sat at ×9.
          const tickMs = rafMsEma > 0 ? rafMsEma : 1000 / 60;
          const ticksPerFrame = Math.max(1, Math.ceil((frameMin - 4) / tickMs));
          const achievable = 1000 / (ticksPerFrame * tickMs);
          const meanFps = aaFpsCount > 0 ? aaFpsSum / aaFpsCount : achievable;
          // "Healthy" / "lagging" verdicts. With the GPU timer we judge on draw
          // time vs the frame budget; otherwise on mean fps vs the achievable rate.
          const healthy = usingGpu ? gpuMsEma < frameMin * 0.55 : meanFps >= achievable * 0.90;
          const lagging = usingGpu ? gpuMsEma > frameMin * 0.78 : meanFps <  achievable * 0.82;

          // True-shitbox watch: AA already at the floor and STILL under ~20fps.
          // (gpuMsEma > 50 ⇒ <20 gpu-fps; the meanFps path is gated to caps that
          // actually permit ≥20 so a deliberately low FPS cap doesn't trip it.)
          // Bail after a few sustained windows — or immediately if it's dire.
          const cantHold20 = usingGpu ? gpuMsEma > 50 : meanFps < 20;
          const dire       = usingGpu ? gpuMsEma > 80 : meanFps < 12;
          if (aaLevel === 0 && frameCap >= 25 && cantHold20) {
            aaShitboxStrikes++;
            if (aaShitboxStrikes >= (dire ? 1 : 3)) { freezeStaticHero(); return; }
          } else {
            aaShitboxStrikes = 0;
          }

          if (aaPhase === "verify") {
            // We just climbed a rung — did it hold up?
            if (healthy) {
              aaNextProbeAt = now + 8000;          // success; look higher later
            } else {
              setAaLevel(aaProbeBase);             // revert
              aaCeiling = aaProbeBase;             // and remember this is the limit
              aaNextProbeAt = now + 15000;         // back off before retrying
            }
            aaPhase = "hold";
          } else {
            // Holding. Occasionally relax a pinned ceiling (device may have cooled).
            if (aaCeiling < AA_LADDER.length - 1 && now - lastCeilRelax > 30000) {
              aaCeiling++; lastCeilRelax = now;
            }
            if (lagging && aaLevel > 0) {
              setAaLevel(aaLevel - 1);             // sustained shortfall → drop now
              aaNextProbeAt = now + 15000;
            } else if (healthy && aaLevel < aaCeiling && now >= aaNextProbeAt) {
              aaProbeBase = aaLevel;
              setAaLevel(aaLevel + 1);             // probe one rung up, verify next window
              aaPhase = "verify";
            }
          }
        }
        // Open a fresh window: skip 400ms of settle, then average ~1.1s of frames.
        aaFpsSum = 0; aaFpsCount = 0;
        aaMeasureFrom = now + 400;
        aaWindowEnd = now + 1500;
      }

      // Boot fade: ease u_boot toward 0 once the user continues
      bootCur += ((state === "live" ? 0.0 : 1.0) - bootCur) * 0.05;
      gl.uniform1f(U.boot, bootCur);

      // Intro reveal — two paths. Desktop (slide): the valley condenses in
      // immediately, then the headline types + slides left. Phones/narrow (fade):
      // the text types in first over the bare sky, then fades out and the valley
      // reveals behind it (held back so it has time to load).
      if (state === "live") {
        if (heroTextSlides()) {
          // Desktop: the valley condenses in IMMEDIATELY on going live (from
          // liveT0); the headline waits for it (TEXT_DELAY_MS), types in, then
          // slides left to its resting offset.
          const elapsed = now - liveT0 - TEXT_DELAY_MS - TYPEIN_MS - REVEAL_HOLD_MS;
          const rp = Math.max(0, Math.min(1, (now - liveT0) / REVEAL_MS));
          setU1f("reveal", U.reveal, rp * rp * (3.0 - 2.0 * rp));   // 镜像: 天空 pass 靠它门控
          // The hero text waits for the valley to condense in, then fades in
          // (CSS 0.6s) as it begins to type.
          if (heroTextLive && !heroRevealDone && (now - liveT0) >= TEXT_DELAY_MS) {
            heroTextLive.style.opacity = "1";
          }
          // headline slide — fast; hand X back to the slider once settled
          if (!heroRevealDone) {
            const sp = Math.max(0, Math.min(1, elapsed / TEXT_SLIDE_MS));
            const sEase = sp * sp * (3.0 - 2.0 * sp);
            if (heroTextLive) heroTextLive.style.opacity = "1";
            setHeroTextOffset("x", heroTextTargetX * sEase);  // centred (0) → target
            if (sp >= 1.0) heroRevealDone = true;
          }
        } else {
          // Phones/narrow: the text types in over the bare sky first, holds, then
          // fades out — and the valley reveal is held back (MOBILE_REVEAL_START_MS)
          // so it has time to load and condenses in behind the departing text.
          const elapsed = now - liveT0 - TYPEIN_MS - REVEAL_HOLD_MS;
          const rp = Math.max(0, Math.min(1, (elapsed - MOBILE_REVEAL_START_MS) / MOBILE_REVEAL_MS));
          setU1f("reveal", U.reveal, rp * rp * (3.0 - 2.0 * rp));   // 镜像: 天空 pass 靠它门控
          if (!heroRevealDone) {
            // keep the centred text up (cursor blinking ~2x) for a beat, then fade
            // it out as the valley condenses in behind it.
            if (heroTextLive && elapsed > MOBILE_FADE_DELAY_MS) {
              heroTextLive.style.opacity = "0";
            }
            // Mark the intro done only once the valley has FULLY revealed — not
            // when the text finishes fading. The AA governor / shitbox-bail keys
            // off heroRevealDone and must not start judging fps during the heavy
            // reveal ramp, or a transient dip reads as "can't hold 20fps" and a
            // perfectly capable phone gets frozen to the static still.
            if (rp >= 1.0) heroRevealDone = true;
          }
        }
      }

      setU1f("tod", U.tod, todFrac(now));    // rAF clock (advances here) — 天空昼夜同步
      gl.uniform1f(U.aurHue, auroraHue);
      setU1f("aurSpeed", U.aurSpeed, auroraSpeed);  // 镜像: 极光漂移速度同步到天空 pass

      // Pointer parallax: exponential follow + influence ramp. 幅度上限
      // ~2.6°(0.05 ≈ 半视场的 4.6%),有存在感不喧宾夺主;滚离场景区
      // (scrollY > 0.5vh)自动淡出,回顶恢复。context-restore 后 applyDefault
      // Uniforms 重置为居中,这里每帧重写,天然自愈。
      if (ptrEnabled) {
        const ptrGate = ptr.tAmt && window.scrollY < window.innerHeight * 0.5 ? 1 : 0;
        ptr.x += (ptr.tx - ptr.x) * 0.06;
        ptr.y += (ptr.ty - ptr.y) * 0.06;
        ptr.amt += (ptrGate - ptr.amt) * 0.05;
        gl.uniform2f(U.par, ptr.x * 0.05 * ptr.amt, -ptr.y * 0.032 * ptr.amt);
      }

      // Repaint the terminal text while it's still animating (~14fps).
      // After the subtitle finishes typing we drop to a slow 4Hz cadence
      // so the trailing cursor keeps blinking forever (500ms blink rate).
      const headDone = (now - liveT0 - (heroTextSlides() ? TEXT_DELAY_MS : 0)) >
        (250 + HEAD_LINE.length * 36 + SUB_DELAY + SUB_LINE.length * SUB_RATE + 1400);
      const settled  = state === "live" && headDone && bootCur < 0.02;
      const txGap    = settled ? 250 : 70;
      if (now - lastTx > txGap) {
        paintText(now);
        uploadText();
        lastTx = now;
      }

      // Virtual render clock feeds u_time, decoupled from wall-clock epoch so
      // reloads start from a stable animation phase.
      if (cam.lastNow == null) cam.lastNow = now;
      const cdt = Math.max(0, Math.min(0.1, (now - cam.lastNow) / 1000));
      cam.lastNow = now;
      cam.clock += cdt;

      gpuTimedDraw(cam.clock);
      // 预热兜底图撤岗: live 场景首次绘制完成后立即启动静态图交叉淡出，
      // CSS 0.6s transition 自然顺滑覆盖淡起全过程，大幅消除用户感官上的卡死等待。
      if (heroWarmupStill && (bootCur < 0.85 || state === "live")) {
        heroWarmupStill = false;
        if (heroStill) heroStill.classList.remove("is-shown");
      }
      if (state === "live" && liveClockAnchored && (now - liveT0) >= HERO_LIVE_STOP_MS) {
        stopLiveHeroAfterCycle();
        return;
      }
      requestAnimationFrame(loop);
    }

    function startLoop() {
      if (!heroCanRenderLive || looping || heroFrozen || heroCycleStopped) return;
      if (contextLost) return;   // wait for webglcontextrestored → rebuild → startLoop
      looping = true;
      loop(performance.now());   // first frame now; it self-schedules via rAF
    }

    // Only render the WebGL hero while it's actually on screen.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (ents) {
        heroVisible = ents[0].isIntersecting;
        if (heroVisible && heroCanRenderLive) startLoop();
      }, { rootMargin: "200px 0px 200px 0px", threshold: 0 }).observe(hero);
    }

    // 离开页面时立即停机，彻底释放 GPU 与主线程，杜绝切页掉帧、死锁与资源竞争
    window.addEventListener("pagehide", function () {
      looping = false;
      heroCanRenderLive = false;
    });
    window.addEventListener("beforeunload", function () {
      looping = false;
      heroCanRenderLive = false;
    });

    heroCanRenderLive = true;
    startLoop();
  }
})();

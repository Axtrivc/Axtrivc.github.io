
// ── Hero ASCII-river shader ─────────────────────────────────────
// Fully procedural WebGL hero (no video). A flowing-river intensity
// field is quantised into a monospace glyph atlas, then the rendered
// glyph coverage is blurred with multi-tap sampling for an ascii-magic
// style bloom, and graded into the navy/aqua palette. One pass, no FBO.
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
  const DETECT_GPU_URL = "https://esm.sh/@pmndrs/detect-gpu?bundle";
  const DETECT_GPU_MIN_TIER = 3;   // 0..3; only top-tier GPUs run the live hero.
  const HERO_HEAD_LINE = "Intelligence that flows with you.";
  const HERO_SUB_LINE  = "River is building a new stack for personal AI.";
  const HERO_SUB_DELAY = 300;     // ms after headline finishes before sub starts
  const HERO_SUB_RATE  = 30;      // ms per character
  const HERO_TYPEIN_MS = 250 + HERO_HEAD_LINE.length * 36 + HERO_SUB_DELAY + HERO_SUB_LINE.length * HERO_SUB_RATE;
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
    const opts = { failIfMajorPerformanceCaveat: true, glContext: gl };
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
    revealStaticFallback();
    return;
  }

  // ── Tunables ──────────────────────────────────────────────────
  // Ramp character sets live in RAMP_ASCII / RAMP_MATRIX below.
  const CELL_PX = 6;           // logical px per glyph cell
  const BLOOM = 0.00;          // phosphor halo off by default
  const BRAD_CELLS = 0.30;     // bloom radius, in cells
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
    uniform float u_time;
    uniform sampler2D u_atlas;
    uniform sampler2D u_terrain;
    uniform float u_glyphs;
    uniform float u_cell;
    uniform float u_bloom;
    uniform float u_bRad;
    uniform vec2  u_mouse;   // cursor, device px (y down); offscreen when idle
    uniform float u_mAmt;    // 0..1 interaction influence (eased)
    uniform float u_intro;   // 0..1 intro write-in progress (eased)
    uniform float u_steer;   // lateral flight steering (eased, arrow keys)
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
    uniform float u_horizon; // base horizon Y (0.1..0.7)
    uniform float u_viewHorizon; // active canyon/river vanishing point Y
    uniform float u_scroll;  // worldZ scroll speed (river flow)
    uniform float u_glyph;   // glyph intensity boost
    uniform float u_grain;   // pixel grain amplitude
    uniform float u_vig;     // vignette corner darken (0..0.5)
    uniform float u_bgBright;// base background brightness multiplier
    uniform float u_earth;   // earth/ground brightness multiplier (vs sky)
    uniform float u_blur;    // glyph-layer softening (0 = crisp)
    uniform float u_riverW;  // river base width (world units)
    uniform float u_flowSpd; // river flow speed multiplier
    uniform float u_streak;  // streamline intensity
    uniform float u_crest;   // specular crest brightness
    uniform float u_foam;    // foam flicker intensity
    uniform float u_contOn;  // 1 = render continents, 0 = hidden
    uniform vec3  u_contColor; // continent glyph colour (RGB)
    uniform float u_crtOn;   // 1 = CRT scanlines on, 0 = off
    uniform float u_pixelText; // 1 = chunky pixel text, 0 = sharp
    uniform float u_sun;     // sun disk + glow brightness (0 = none)
    uniform float u_atmo;    // planet-limb / horizon glow intensity
    uniform float u_haze;    // earth atmospheric haze (ground→sky near horizon)
    uniform float u_calm;    // river/field brightness floor at the bottom (1 = no fade)
    uniform float u_sunMaxY; // sun apex Y at noon (smaller = higher in the sky)
    uniform float u_twilight; // 1 = twilight mode: sun orbits a small circle on the horizon
    uniform float u_twRadius; // twilight sun-orbit radius (uv units)
    uniform float u_twEllipse; // twilight orbit Y-axis scale (1 = round, <1 = flatter)
    uniform float u_twEllipseX; // twilight orbit X-axis scale (1 = round baseline)
    uniform float u_twSunZone;  // twilight: sun height (uv) below which sky is sunset-warm
    uniform float u_dotGain; // dot-mode brightness boost (1 = neutral / ASCII)
    uniform float u_dots;    // 1 = dot render mode (separated, capped, no burn)
    uniform float u_lcd;     // 1 = Game Boy DMG LCD treatment
    uniform float u_lcdPx;   // LCD pixel-grid size (device px)
    uniform float u_grad;    // 1 = vivid spectral gradient recolour
    uniform float u_hueA;    // gradient start hue (turns; may wrap)
    uniform float u_hueB;    // gradient end hue (turns; may wrap)
    uniform float u_gradBri; // gradient colour brightness
    uniform float u_mtn;     // distant-mountain intensity/fade (0 = none)
    uniform float u_mtnH;    // distant-mountain height above the horizon (uv units)
    uniform float u_mtnOn;   // 1 = render distant mountains, 0 = hidden
    uniform float u_topo;    // topographic contour strength (0 = none)
    uniform float u_topoN;   // topographic contour density (bands)
    uniform float u_topoOn;  // 1 = render topographic contours, 0 = hidden
    uniform float u_relief;  // 3D relief displacement amount (0 = flat contours)
    uniform float u_canyonDepth; // canyon wall/depth scale (1 = default)
    uniform float u_canyonShadow; // 1 = full canyon self-shadowing, 0 = simpler lighting
    uniform float u_canyonMaxSteps; // PERF: max canyon march iterations
    uniform float u_canyonStepScale; // PERF: larger steps = faster, rougher canyon
    uniform float u_refineSteps; // PERF: canyon hit-refine iterations (4..14)
    uniform float u_refineMode;  // PERF: 0 = bisection, 1 = secant (cheaper)
    uniform float u_hoist;       // PERF: 1 = read per-frame canyon constants cached once
    uniform float u_city;    // city street/light strength (0 = none)
    uniform float u_cityOn;  // 1 = render cities, 0 = hidden

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

    // ── Smooth Worley (cellular) noise ── exponential smooth-min over the
    // neighbourhood (no sharp cell creases); inverting it gives puffy lumps.
    float worley(vec2 p){
      vec2 ip = floor(p), fp = fract(p);
      float res = 0.0;
      for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++){
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(hash(ip + g), hash(ip + g + 19.7));
        vec2 r = g + o - fp;
        res += exp(-18.0 * length(r));
      }
      return -log(res) / 18.0;
    }
    // Cloud density — CUMULUS puffs. Gently billow the sample so puff edges bulge
    // into rounded cauliflower lobes, then build a big low-frequency body with
    // lighter higher-frequency bumps ON it (round puff shape survives instead of
    // dissolving into haze).
    // Procedural CUMULUS density — a rounded billowing body (inverted Worley) with
    // lighter cauliflower bumps, billowed by a domain warp. Small & sparse, shaded
    // by normals + Beer below for the scene's stylised look.
    float cloudDensity(vec2 p){
      p += (fbm(p * 1.3 + 3.7) - 0.5) * 0.35;            // billow the lobes
      return (1.0 - worley(p))                        * 0.70   // big rounded body
           + (1.0 - worley(p * 2.3 + vec2(4.0, 1.0)))  * 0.30;  // cauliflower bumps
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
    // Pure-hue → RGB (full saturation/value); h in turns, wraps via fract.
    vec3 hue2rgb(float h){
      vec3 k = abs(fract(h + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
      return clamp(k - 1.0, 0.0, 1.0);
    }

    // Subtle camera bank — rolls the scene toward the steer direction.
    // Applied to BOTH field() and the grade so the curved horizon and
    // the ASCII ground tilt together; glyph cells stay screen-aligned.
    vec2 bankUV(vec2 uv){
      float roll = u_steer * 0.11;            // ≈ ±2° at full steer — just barely
      float asp  = u_res.x / u_res.y;
      vec2  rc   = (uv - 0.5) * vec2(asp, 1.0);
      rc = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * rc;
      return rc * vec2(1.0 / asp, 1.0) + 0.5;
    }

    // Constellation segment → vec2(line mask, node mask)
    vec2 segMask(vec2 p, vec2 a, vec2 b){
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float d = length(pa - ba * h);
      float line = smoothstep(0.010, 0.004, d);
      float node = smoothstep(0.020, 0.006, min(length(p - a), length(p - b)));
      return vec2(line, node);
    }

    // River centre-line in world space (X as a function of depth Z)
    float riverCx(float wz){
      return 0.90 * sin(wz * 0.16)
           + 0.45 * sin(wz * 0.37 + 1.3)
           + 0.70 * (vnoise(vec2(wz * 0.05, 2.0)) - 0.5);
    }

    const float TERRAIN_SIZE = 512.0;

    // Generated terrain: a generated height texture sampled in stable
    // world-space. Time only advances terrainZ, so features roll toward the
    // viewer instead of emitting, expanding, or swimming sideways.
    const float TERRAIN_GLOBE_R = 96.0;
    const float TERRAIN_CAM_H = 0.84;
    const float TERRAIN_RAY_X = 0.360;
    const float TERRAIN_RAY_Y = 0.700;
    // Max radial surface displacement (world units) at |altitude| = 1. Kept
    // below TERRAIN_CAM_H so the highest peaks still pass beneath the camera.
    const float RELIEF_AMP = 0.6;
    float terrainTanHorizon(){
      float camD = TERRAIN_GLOBE_R + TERRAIN_CAM_H;
      return sqrt(max(0.0, camD * camD - TERRAIN_GLOBE_R * TERRAIN_GLOBE_R)) / TERRAIN_GLOBE_R;
    }
    float terrainHorizonAtX(float uvx){
      float asp = u_res.x / u_res.y;
      float x = (uvx - 0.5) * asp * TERRAIN_RAY_X;
      float tanHorizon = terrainTanHorizon();
      // Physical limb from the same sphere/ray model used by terrainInk().
      // CURVE is intentionally ignored here so it cannot decouple the topo
      // projection from the visible horizon.
      return u_horizon + tanHorizon * (sqrt(1.0 + x * x) - 1.0) / TERRAIN_RAY_Y;
    }
    float terrainHorizon(vec2 uv){
      return terrainHorizonAtX(uv.x);
    }
    vec3 terrainProject(vec2 uv){
      float bend = uv.x - 0.5;
      float hYc  = terrainHorizon(uv);
      float gy   = (uv.y - hYc) / (1.0 - hYc);
      float lateral = clamp(abs(bend) * 2.0, 0.0, 1.0);
      float globeArc = 1.0 - sqrt(max(0.0, 1.0 - lateral * lateral));
      float crown = 1.0 - globeArc;
      float midBody = smoothstep(0.020, 0.78, gy) * (1.0 - smoothstep(0.90, 1.0, gy));
      float sphereGy = gy + crown * 0.315 * midBody;
      float z    = 1.0 / (sphereGy * sphereGy * 0.86 + 0.044);
      float sideRecede = globeArc * (0.72 + 0.24 * (1.0 - smoothstep(0.72, 1.0, gy)));
      float tx   = bend * z * 2.04 * (1.0 - sideRecede * 0.46)
                 + u_steer * (0.14 + z * 0.16);
      float tz   = z * 1.38 + u_time * u_scroll * 0.56;
      return vec3(tx, tz, z);
    }
    float mirror01(float v){
      float m = mod(v, 2.0);
      return 1.0 - abs(m - 1.0);
    }
    vec2 terrainUV(vec2 terrainP){
      return vec2(
        fract(terrainP.x * 0.060 + 0.5),
        0.035 + 0.930 * mirror01(terrainP.y * 0.0085 + 0.17)
      );
    }
    vec4 decodeTerrain(vec4 raw){
      float encodedAlt = clamp(raw.r * (65280.0 / 65535.0) + raw.g * (255.0 / 65535.0), 0.0, 1.0);
      float alt = encodedAlt * 2.0 - 1.0;
      return vec4(alt, 0.0, 0.0, 0.0);
    }
    vec4 terrainFetch(vec2 pixel){
      vec2 p = vec2(
        mod(pixel.x, TERRAIN_SIZE),
        clamp(pixel.y, 0.0, TERRAIN_SIZE - 1.0)
      );
      vec2 uv = (p + 0.5) / TERRAIN_SIZE;
      return decodeTerrain(texture2D(u_terrain, uv));
    }
    // Altitude lookup for the relief refinement loop. The terrain texture is
    // NEAREST-filtered (it packs 16-bit altitude across two bytes, so the GPU
    // can't linearly filter it), so we bilinearly blend four taps by hand —
    // otherwise the displaced surface snaps to texel steps and shows blocky
    // rectangular facets wherever the relief is steep.
    float terrainHeightFast(vec2 terrainMap){
      vec2 coord = vec2(fract(terrainMap.x), clamp(terrainMap.y, 0.0, 1.0)) * TERRAIN_SIZE - 0.5;
      vec2 base = floor(coord);
      vec2 f = fract(coord);
      f = f * f * (3.0 - 2.0 * f);
      float a = terrainFetch(base).x;
      float b = terrainFetch(base + vec2(1.0, 0.0)).x;
      float c = terrainFetch(base + vec2(0.0, 1.0)).x;
      float d = terrainFetch(base + vec2(1.0, 1.0)).x;
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    vec4 terrainSampleAt(vec2 terrainP){
      vec2 coord = terrainUV(terrainP) * TERRAIN_SIZE - 0.5;
      vec2 base = floor(coord);
      vec2 f = fract(coord);
      f = f * f * (3.0 - 2.0 * f);
      vec4 a = terrainFetch(base);
      vec4 b = terrainFetch(base + vec2(1.0, 0.0));
      vec4 c = terrainFetch(base + vec2(0.0, 1.0));
      vec4 d = terrainFetch(base + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    vec4 terrainSampleUV(vec2 terrainMap){
      vec2 coord = fract(terrainMap) * TERRAIN_SIZE - 0.5;
      vec2 base = floor(coord);
      vec2 f = fract(coord);
      f = f * f * (3.0 - 2.0 * f);
      vec4 a = terrainFetch(base);
      vec4 b = terrainFetch(base + vec2(1.0, 0.0));
      vec4 c = terrainFetch(base + vec2(0.0, 1.0));
      vec4 d = terrainFetch(base + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    vec4 terrainSampleGlobeUV(vec2 terrainMap){
      vec2 coord = vec2(fract(terrainMap.x), clamp(terrainMap.y, 0.0, 1.0)) * TERRAIN_SIZE - 0.5;
      vec2 base = floor(coord);
      vec2 f = fract(coord);
      f = f * f * (3.0 - 2.0 * f);
      vec4 a = terrainFetch(base);
      vec4 b = terrainFetch(base + vec2(1.0, 0.0));
      vec4 c = terrainFetch(base + vec2(0.0, 1.0));
      vec4 d = terrainFetch(base + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    vec4 terrainSample(vec2 uv){
      vec3 tp = terrainProject(uv);
      return terrainSampleAt(tp.xy);
    }
    float terrainVisibility(vec2 uv, float z){
      float hYc  = terrainHorizon(uv);
      float gy   = (uv.y - hYc) / (1.0 - hYc);
      float horizonTaper = smoothstep(0.055, 0.19, gy);
      float farTaper = 1.0 - smoothstep(10.0, 26.0, z);
      float bottomTaper = smoothstep(0.02, 0.10, 1.0 - uv.y);
      return horizonTaper * farTaper * bottomTaper;
    }
    float axisValleyOffset(float py){
      return 0.018 * sin(py * 8.0 + 0.7)
           + 0.008 * sin(py * 15.0 - 1.6);
    }
    float sideTerrainLobes(vec2 polarP, float side){
      float acc = 0.0;
      float row0 = floor(polarP.y * 5.2);
      for (int i = -2; i <= 2; i++){
        float row = row0 + float(i);
        float r1 = hash(vec2(row, side * 17.0 + 1.0));
        float r2 = hash(vec2(row, side * 19.0 + 3.0));
        float r3 = hash(vec2(row, side * 23.0 + 5.0));
        float r4 = hash(vec2(row, side * 29.0 + 7.0));
        float r5 = hash(vec2(row, side * 31.0 + 11.0));
        float cy = (row + 0.5 + (r2 - 0.5) * 0.92) / 5.2;
        float cx = axisValleyOffset(cy) + side * (0.060 + 0.110 * r1);
        float sx = 0.052 + 0.105 * r3;
        float sy = 0.100 + 0.240 * r4;
        vec2 q = vec2((polarP.x - cx) / sx, (polarP.y - cy) / sy);
        float blob = exp(-dot(q, q));
        float amp = mix(-0.145, 0.300, r5);
        acc += amp * blob;
      }
      return acc;
    }
    vec3 rotateAroundX(vec3 p, float a){
      float c = cos(a);
      float s = sin(a);
      return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
    }
    vec2 globeModelUV(vec3 n){
      float lon = atan(n.x, n.z) * 0.15915494309189535 + 0.5;
      float lat = asin(clamp(n.y, -1.0, 1.0)) * 0.3183098861837907 + 0.5;
      return vec2(lon, 1.0 - lat);
    }
    float terrainHeightModel(vec2 terrainMap, vec2 polarP){
      return clamp(terrainSampleGlobeUV(terrainMap).x, -1.0, 1.0);
    }
    vec2 terrainMapBase(vec2 heightP){
      return vec2(0.50, 0.50) + vec2(heightP.x * 0.62, heightP.y * 0.355);
    }
    vec2 terrainMapWarped(vec2 heightP){
      return terrainMapBase(heightP);
    }
    float terrainAltitude(vec2 heightP){
      return terrainHeightModel(terrainMapWarped(heightP), heightP);
    }
    float valleyLowCenter(vec2 heightP){
      float predicted = axisValleyOffset(heightP.y);
      float bestX = predicted;
      float bestH = 2.0;
      for (int i = -3; i <= 3; i++){
        float off = float(i) * 0.030;
        vec2 p = vec2(predicted + off, heightP.y);
        float h = terrainAltitude(p) + abs(off) * 0.010;
        if (h < bestH){
          bestH = h;
          bestX = p.x;
        }
      }
      return bestX;
    }
    vec4 terrainInk(vec2 uv){
      float hSurface = terrainHorizon(uv);
      float surfaceOffset = uv.y - hSurface;
      float rayOffset = uv.y - u_horizon;

      // Generated terrain topology. Cast a narrow camera ray into a large sphere,
      // then sample a zoomed-in geodesic patch using local polar coordinates.
      // This keeps the visible terrain locked to the globe without the
      // screen-edge bends caused by flattening the normal back into X/Z.
      float globeR = TERRAIN_GLOBE_R;
      float camD = globeR + TERRAIN_CAM_H;
      float tanHorizon = terrainTanHorizon();
      float asp = u_res.x / u_res.y;
      vec3 ro = vec3(0.0, camD, 0.0);
      vec3 rd = normalize(vec3(
        (uv.x - 0.5) * asp * TERRAIN_RAY_X,
        -tanHorizon - rayOffset * TERRAIN_RAY_Y,
        1.0
      ));
      float b = dot(ro, rd);
      float c = dot(ro, ro) - globeR * globeR;
      float disc = b * b - c;
      if (disc <= 0.0) return vec4(0.0);
      float root = sqrt(disc);
      float t = -b - root;
      if (t <= 0.0) return vec4(0.0);

      float rollTravel = u_time * u_scroll * 0.020;

      // ── Relief displacement ── the painted altitude pushes the surface in
      // and out along the radius (peaks toward the camera, valleys away). A
      // few fixed-point iterations re-solve the view ray against the displaced
      // shell, so the terrain gains real parallax and slope shading as you
      // fly over it — the altitude is actually *felt* as 3D, not drawn flat.
      // |ro+rd*t| = targetR  →  t = -b - sqrt(b*b - (|ro|^2 - targetR^2)).
      float amp = RELIEF_AMP * u_relief;
      for (int i = 0; i < 8; i++){
        if (amp <= 0.0001) break;
        vec3 pp  = ro + rd * t;
        vec3 nnp = normalize(rotateAroundX(normalize(pp), rollTravel));
        float Hk = terrainHeightFast(globeModelUV(nnp));
        float targetR = globeR + amp * Hk;
        float dd = b * b - (dot(ro, ro) - targetR * targetR);
        if (dd <= 0.0) break;
        t = -b - sqrt(dd);
      }

      // Resolved surface point + normal (displaced). Sample the generated
      // terrain by surface normal -> longitude/latitude, rotating the normal
      // around the orbit axis so the terrain stays attached to the globe.
      vec3 hit = ro + rd * t;
      vec3 n = normalize(hit);
      vec3 mapN = normalize(rotateAroundX(n, rollTravel));
      vec2 terrainMap = globeModelUV(mapN);
      vec2 heightP = terrainMap;
      float surfaceDepth = clamp((uv.y - hSurface) / max(1.0 - hSurface, 0.0001), 0.0, 1.0);
      float alt = terrainHeightModel(terrainMap, heightP);
      float displayAlt = clamp(alt * 0.90 + 0.5, 0.0, 1.0);
      float valleyCorridor = 1.0 - smoothstep(-0.16, 0.08, alt);
      float density = max(5.0, u_topoN);
      float bands = displayAlt * density + 0.23;
      float dline = min(fract(bands), 1.0 - fract(bands));

      // Relief lighting is sampled in the same spherical-map space as the
      // contours, so the 3D cue stays registered to the actual bands.
      float texel = 1.0 / TERRAIN_SIZE;
      float altW = terrainHeightModel(terrainMap - vec2(texel * 2.0, 0.0), heightP);
      float altE = terrainHeightModel(terrainMap + vec2(texel * 2.0, 0.0), heightP);
      float altS = terrainHeightModel(terrainMap - vec2(0.0, texel * 2.0), heightP);
      float altN = terrainHeightModel(terrainMap + vec2(0.0, texel * 2.0), heightP);
      // Steepen the sampled slope with the relief amount so the lit/shadowed
      // faces of the displaced terrain read clearly.
      float slopeGain = 8.0 + 16.0 * u_relief;
      vec3 reliefN = normalize(vec3((altW - altE) * slopeGain, 1.0, (altS - altN) * slopeGain * 0.70));
      float horizonSoft = smoothstep(0.000, 0.780, root);
      float ridgeAlt = smoothstep(0.68, 0.96, displayAlt);
      // Constant screen-space line width from the band's pixel derivative, so
      // contours stay crisp and locked to the surface instead of shimmering /
      // warping as the steep canyon walls scroll past. (Without this the width
      // is fixed in altitude units, so it goes sub-pixel on steep slopes.)
      float bandWidth = clamp(fwidth(bands), 0.006, 0.12);
      float line = 1.0 - smoothstep(0.0, bandWidth * (1.4 + ridgeAlt * 0.6), dline);

      float bottomTaper = smoothstep(0.02, 0.10, 1.0 - uv.y);
      float surfaceTaper = smoothstep(-0.010, 0.055, surfaceOffset);
      float sideFeather = 1.0 - smoothstep(0.988, 1.0, abs(uv.x - 0.5) * 2.0);
      float vis = horizonSoft * bottomTaper * surfaceTaper * sideFeather;
      float crown = smoothstep(0.18, 0.74, n.z);
      float reliefAmt = clamp(u_relief, 0.0, 1.3);

      // ── Sun direction from time-of-day ── derived from the same u_tod the
      // sky sun uses, expressed in the terrain tangent frame (x=east, y=up,
      // z=north). The hillshade and cast shadows therefore track the sun:
      // long raking shadows that swing east→west at dawn/dusk, short at noon.
      float sunDay  = (u_tod * 24.0 - 6.0) / 12.0;           // 0 dawn .. 1 dusk
      float sunElev = sin(sunDay * 3.14159265);              // matches sky 'elev'
      float sunUpT  = smoothstep(-0.10, 0.12, sunElev);
      float sunScrX = 0.16 + 0.68 * clamp(sunDay, 0.0, 1.0); // matches sky 'sunX'
      float sunAz   = (sunScrX - 0.5) * 2.0;                 // -0.68 dawn .. +0.68 dusk
      float sunVert = 0.26 + 1.60 * clamp(sunElev, 0.0, 1.0);
      vec3 sunDir = normalize(vec3(sunAz, sunVert, 0.42));
      // After dusk / before dawn, ease toward a soft overhead key so relief
      // stays readable while the hard directional shadows fade with the sun.
      sunDir = normalize(mix(vec3(0.0, 1.0, 0.0), sunDir, sunUpT));

      // ── Hillshade ── the dominant depth cue: the sun rakes the displaced
      // slopes so faces toward it brighten and faces away fall into shadow.
      float lambert = dot(reliefN, sunDir);                       // -1 shadow .. +1 lit
      float hill = pow(clamp(lambert * 0.5 + 0.5, 0.0, 1.0), 1.0 + 1.1 * reliefAmt);
      float hillShade = mix(1.0, mix(0.30, 1.70, hill), reliefAmt);

      // ── Soft cast shadow ── march along the sun's horizontal direction; if
      // higher ground lies toward the sun this point sits in its shade. The
      // per-step height threshold scales with the sun's elevation (low sun →
      // shallow slope → long shadows), so shadow length tracks the day too.
      float lightSlope = sunDir.y / max(length(sunDir.xz), 0.05);
      vec2 sunMapDir = length(sunDir.xz) > 1.0e-3 ? normalize(vec2(sunDir.x, -sunDir.z)) : vec2(0.0);
      float occl = 0.0;
      for (int s = 1; s <= 4; s++){
        float hs = terrainHeightFast(terrainMap + sunMapDir * texel * 7.0 * float(s));
        occl = max(occl, (hs - alt) - float(s) * 0.29 * lightSlope);
      }
      float castShadow = 1.0 - reliefAmt * sunUpT * 0.50 * smoothstep(0.0, 0.18, occl);

      // ── Valley ambient occlusion ── low, concave ground sits in shade.
      float ao = 1.0 - 0.34 * reliefAmt * smoothstep(0.25, -0.35, alt);

      float radialDepth = smoothstep(0.08, 0.90, surfaceDepth) * (1.0 - valleyCorridor * 0.30);
      float elevationDepth = alt * radialDepth;
      float baseShade = 0.52 + 0.28 * crown + 0.17 * clamp(n.y, 0.0, 1.0)
                      + elevationDepth * (0.18 + 0.40 * reliefAmt);
      float sphereShade = baseShade * hillShade * castShadow * ao;

      vec3 lowCol  = vec3(0.050, 0.135, 0.300);
      vec3 midCol  = vec3(0.140, 0.350, 0.470);
      vec3 highCol = vec3(0.180, 0.400, 0.480);
      vec3 fillCol = mix(lowCol, midCol, smoothstep(0.04, 0.78, displayAlt));
      fillCol = mix(fillCol, highCol, smoothstep(0.70, 1.25, displayAlt));
      fillCol *= sphereShade * (0.68 + 0.30 * smoothstep(0.10, 0.92, displayAlt));
      vec3 lineCol = mix(vec3(0.430, 0.660, 0.670), vec3(0.620, 0.720, 0.570), smoothstep(0.10, 1.00, displayAlt));
      lineCol *= sphereShade * (0.94 + 0.34 * smoothstep(0.20, 0.90, displayAlt));

      float topoOn = u_topoOn * u_topo;
      // Higher ground draws denser/more opaque so the shaded relief reads as
      // solid form, not a faint wash over the ground plane.
      float fillA = topoOn * vis * (0.105 + (0.075 + 0.30 * reliefAmt) * smoothstep(0.04, 0.96, displayAlt));
      float lineA = topoOn * vis * line * (0.520 + 0.320 * ridgeAlt);

      float channelX = valleyLowCenter(heightP);
      float channelD = heightP.x - channelX;
      float channelW = clamp(u_riverW * 0.035, 0.030, 0.085);
      float channelJitter = 0.86 + 0.18 * fbm(vec2(heightP.y * 3.2, channelX * 15.0 + 21.0));
      float channelAbs = abs(channelD) / max(channelW * channelJitter, 0.0001);
      float waterBody = 1.0 - smoothstep(0.78, 1.26, channelAbs);
      float waterCore = 1.0 - smoothstep(0.00, 0.72, channelAbs);
      float bankEdge = exp(-sq((channelAbs - 0.96) / 0.28));

      // The channel rides the rotating terrain, but the water texture itself
      // flows upward through that fixed valley path. Its coverage is gated on
      // the same screen-cell lattice as the original dot shader, so water reads
      // as pale pixel ink instead of a dark smooth ribbon.
      float flowY = heightP.y - u_time * u_flowSpd * 0.160;
      float localX = channelD / max(channelW, 0.0001);
      float flow1 = fbm(vec2(localX * 1.6, flowY * 8.0));
      float flow2 = fbm(vec2(localX * 3.4 + 2.0, flowY * 18.0));
      float flow = flow1 * 0.55 + flow2 * 0.45;
      float strm = smoothstep(0.16, 0.86, waterBody * (0.52 + 0.82 * flow) + 0.06);
      float waveA = 0.5 + 0.5 * sin(flowY * 34.0 + localX * 5.4);
      float waveB = 0.5 + 0.5 * sin(flowY * 57.0 + localX * 9.1 + flow * 4.2);
      float crest = pow(waveA * waveB, 5.0) * waterBody * 0.92;
      float streak = abs(sin(localX * 7.4 + flow * 4.5));
      streak = pow(1.0 - smoothstep(0.0, 0.34, streak), 7.0);
      float streakPulse = 0.45 + 0.55 * sin(flowY * 18.0);
      strm = max(strm, crest);
      strm = max(strm, streak * waterBody * streakPulse * u_streak);
      float foam = bankEdge * (0.22 + 0.44 * strm) * clamp(u_foam * 0.42, 0.0, 0.92);
      float waterCell = max(u_res.y / max(u_waterDot, 1.0), 2.0);
      vec2 cellP = uv * u_res / waterCell;
      vec2 cell = floor(cellP);
      vec2 lp = fract(cellP) - 0.5;
      float dotCore = smoothstep(0.45, 0.18, length(lp));
      float cellSpark = step(0.22, hash(cell + floor(flowY * 30.0)));
      float pixelInk = clamp(dotCore * (0.70 + 0.40 * cellSpark + 0.42 * strm), 0.0, 1.0);
      float waterInk = max(pixelInk, waterCore * 0.30);
      vec3 waterBase = vec3(0.790, 0.910, 0.900);
      vec3 waterWhite = vec3(1.000, 0.990, 0.940);
      vec3 waterCol = mix(waterBase, waterWhite, clamp(0.56 + 0.36 * waterCore + 0.32 * strm + 0.18 * foam, 0.0, 1.0));
      float waterA = 0.0;

      float terrainA = clamp(fillA + lineA, 0.0, 0.58);
      vec3 terrainCol = (fillCol * fillA + lineCol * lineA) / max(terrainA, 0.0001);
      float a = clamp(terrainA + waterA * (1.0 - terrainA * 0.32), 0.0, 0.94);
      vec3 col = mix(terrainCol, waterCol, clamp(waterA * 1.55, 0.0, 0.96));
      return vec4(col, a);
    }

    // Town footprint presence (0..1) at a ground point
    float townF(vec2 wp){
      vec2  tcell = floor(wp * 0.75);
      float tOn   = step(0.40, hash(tcell + 17.0));
      vec2  tc    = (tcell + 0.5
                     + (vec2(hash(tcell + 3.0), hash(tcell + 5.0)) - 0.5) * 0.6) / 0.75;
      float td    = length((wp - tc) * vec2(1.0, 0.8));
      return tOn * smoothstep(0.88, 0.05, td);
    }

    // City intensity at a device-pixel P. Self-contained (recomputes the
    // ground projection). A city is a coarse rectilinear BLOCK GRID — lit
    // square blocks separated by dark streets, gently rotated per city —
    // rendered through the scene's halftone so each block reads as a cluster
    // of lit dots. Brighter toward downtown; sparse but present; far edges
    // fade to avoid flicker; slow night pulse. Returns 0 off the cities.
    float cityAt(vec2 P){
      if (u_cityOn < 0.5) return 0.0;
      vec2  uv   = bankUV(P / u_res);
      float hYc  = terrainHorizon(uv);
      if (uv.y <= hYc) return 0.0;
      float gy = (uv.y - hYc) / (1.0 - hYc);
      float z  = 1.0 / (gy * gy * 0.90 + 0.05);
      float worldZ = z * 1.8 + u_time * u_scroll;
      float wzNear = (1.0 / 0.95) * 1.8 + u_time * 1.2;
      float cxN    = riverCx(wzNear);
      float slope  = clamp((riverCx(wzNear + 0.6) - riverCx(wzNear - 0.6)) / 1.2, -0.5, 0.5);
      float follow = cxN + slope * (worldZ - wzNear);
      float worldX = (uv.x - 0.5) * z * 1.6 + follow + u_steer * (0.25 + z * 0.30);
      float cxBase = riverCx(worldZ);
      float width  = max(u_riverW + u_riverW * 0.33 * sin(worldZ * 0.21), u_riverW * 0.45);
      float d      = (worldX - cxBase) / width;
      float offR   = 1.0 - exp(-d * d * 1.6);
      float farRiver = smoothstep(1.30, 2.30, abs(d));
      float contN  = fbm(vec2(worldX * 0.18 + 7.0, worldZ * 0.18 + 13.0));
      float contBody = smoothstep(0.44, 0.54, contN) * farRiver;  // broad land so the city can sprawl
      float bankLand = smoothstep(2.60, 1.10, abs(d)) * smoothstep(0.55, 1.10, abs(d));
      float landMask = max(contBody, bankLand) * offR;
      vec2  wp    = vec2(worldX, worldZ);
      // Sparse but PRESENT: a city is in view much of the time, with open
      // ground between — distinct places, not crowding the scene.
      vec2  ccell = floor(wp * 0.042);
      float here  = step(0.48, hash(ccell + 21.0));
      vec2  cpos  = (ccell + 0.5 + (vec2(hash(ccell + 3.0), hash(ccell + 9.0)) - 0.5) * 0.40) / 0.042;
      float cdst  = length((wp - cpos) * vec2(1.0, 0.85));
      float foot  = here * smoothstep(2.10, 0.05, cdst) * offR;
      if (foot <= 0.001) return 0.0;
      float core  = smoothstep(1.55, 0.05, cdst);             // brighter toward downtown
      // City BLOCK GRID — coarse rectilinear blocks (the squares) with dark
      // streets between, gently rotated per city. Rendered through the scene
      // halftone so each block becomes a little cluster of lit dots → reads
      // as a real city, not a featureless patch.
      float ang   = (hash(ccell + 11.0) - 0.5) * 0.7;
      mat2  R     = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
      float gf    = 3.0 + hash(ccell + 13.0) * 1.3;           // coarse — big, clear blocks
      vec2  g     = R * (wp - cpos) * gf;
      vec2  fr    = abs(fract(g) - 0.5);
      float blocks = smoothstep(0.10, 0.18, min(fr.x, fr.y));  // lit blocks, dark street grid
      vec2  blk    = floor(g);
      float blkLit = 0.55 + 0.45 * hash(blk + 3.0);           // some blocks brighter (lit windows)
      float built  = blocks * blkLit * (0.55 + 0.55 * core);  // denser/brighter downtown
      float aDayL  = (u_tod * 24.0 - 6.0) / 12.0;
      float sunUpL = smoothstep(-0.10, 0.30, sin(aDayL * 3.14159265));
      float nightG = 1.0 - sunUpL;
      float pulse  = 0.75 + 0.25 * sin(u_time * 1.0 + hash(ccell + 4.0) * 6.2831);
      float far    = smoothstep(15.0, 6.0, z);                // fade distant blocks (anti-flicker)
      return foot * built * mix(0.55, pulse, nightG) * far * u_city * 1.35;
    }

    // Aerial flythrough over a gently curved planet (it rotates toward
    // the viewer), a river down the centre, with little cities whose
    // buildings rise on the banks from time to time.
    float field(vec2 P){
      vec2 uv = P / u_res;                  // y-down: 0 top .. 1 bottom
      uv = bankUV(uv);                      // subtle bank toward steer
      float hYc = terrainHorizon(uv);

      // Per-cell fast write-in (random order; all on by u_intro ≈ 0.9)
      vec2  cellp = floor(P / u_cell);
      float th    = hash(cellp + 7.13) * 0.85;
      float rv    = smoothstep(th, th + 0.05, u_intro);

      // River-follow params (pixel-independent — time only)
      float wzNear = (1.0 / 0.95) * 1.8 + u_time * 1.2;
      float cxN    = riverCx(wzNear);
      float slope  = clamp((riverCx(wzNear + 0.6) - riverCx(wzNear - 0.6)) / 1.2, -0.5, 0.5);

      // ── Mountains = the continents' OWN surface, lifted ──────────────
      // The peaks are not a separate sky layer: they are the landmass
      // itself raised in screen space by its relief. We march the ground
      // depths along this column and, for each continent found, lift its
      // crest a fixed screen amount (u_mtnH) ABOVE its real base. The
      // visible FACE spans [crest .. base], so the peak is physically
      // joined to the continent it grows from — and because it's anchored
      // to the land's actual depth, it TRAVELS DOWN with the continent and
      // sinks below the horizon as the land scrolls into the foreground.
      // Computed before the sky/ground split so the same mass renders
      // continuously across the seam. Gated to a band around the horizon.
      float contLift = 0.0;
      if (u_mtnOn > 0.5 && uv.y > hYc - (u_mtnH + 0.02) && uv.y < hYc + 0.16) {
        float elevM = sin(((u_tod * 24.0 - 6.0) / 12.0) * 3.14159265);
        float litM  = mix(0.40, 1.0, smoothstep(-0.10, 0.12, elevM));
        float gyP   = max((uv.y - hYc) / (1.0 - hYc), 0.0);
        for (int i = 0; i < 9; i++) {
          float gyB  = gyP + (float(i) + 0.5) * 0.028;       // march toward the viewer
          float zB   = 1.0 / (gyB * gyB * 0.90 + 0.05);
          float wzB  = zB * 1.8 + u_time * u_scroll;
          float folB = cxN + slope * (wzB - wzNear);
          float wxB  = (uv.x - 0.5) * zB * 1.6 + folB + u_steer * (0.25 + zB * 0.30);
          float cNB  = fbm(vec2(wxB * 0.18 + 7.0, wzB * 0.18 + 13.0));
          // SAME continent field + threshold the ground uses (0.50–0.58).
          float landB = smoothstep(0.50, 0.58, cNB)
                      * smoothstep(1.30, 2.30, abs((wxB - riverCx(wzB)) / max(u_riverW, 0.6)));
          // Jagged ridge profile: SHARP in world-X (a defined mountain
          // crest, not a smooth blob) but VERY SLOW in world-Z, so the shape
          // is stable and scrolls coherently with the land instead of
          // flickering. Gated by landB so it only rises on the continent.
          float jz = wzB * 0.07;
          float r1 = 1.0 - abs(2.0 * vnoise(vec2(wxB * 0.95 + 4.0, jz)) - 1.0);
          float r2 = 1.0 - abs(2.0 * vnoise(vec2(wxB * 2.20 + 9.0, jz + 5.0)) - 1.0);
          float ridge = pow(clamp(r1, 0.0, 1.0), 1.5) * 0.70
                      + pow(clamp(r2, 0.0, 1.0), 2.4) * 0.40;
          float hB = landB * clamp(ridge, 0.0, 1.0);
          float uvyB = hYc + gyB * (1.0 - hYc);              // continent base on screen
          float L    = hB * u_mtnH;                          // screen-space lift
          float topY = uvyB - L;                             // lifted crest
          float onFace = smoothstep(topY - 0.0024, topY + 0.0032, uv.y)        // below the crest
                       * (1.0 - smoothstep(uvyB - 0.0020, uvyB + 0.0090, uv.y)); // above the base
          float frac = clamp((uvyB - uv.y) / max(L, 1e-4), 0.0, 1.0);    // 0 base→1 crest
          // Weight by frac so the rise FADES INTO the existing continent at
          // its base (no doubled, "spilled" copy of the land) — only the
          // lifted crest adds above the landmass it grows from.
          contLift = max(contLift, onFace * frac);
        }
        contLift *= litM * u_mtn;
      }

      if (uv.y < hYc) {
        // ── Sky — stars/constellations at night, sun/clouds by day ──
        float todH  = u_tod * 24.0;
        float aDay  = (todH - 6.0) / 12.0;
        float elev  = sin(aDay * 3.14159265);
        float sunUp = smoothstep(-0.10, 0.12, elev);
        float skyH  = uv.y / max(hYc, 0.001);

        float nightAmt = smoothstep(0.02, -0.45, elev);
        float gap = smoothstep(1.0, 0.74, skyH);

        float g    = hash(cellp + 41.7);
        float mag  = pow(hash(cellp + 5.0), 3.5);
        float star = step(0.90, g) * (0.18 + 0.82 * mag);
        float dens = mix(0.45, 1.0, 1.0 - smoothstep(0.0, 1.0, skyH));
        float tw   = 0.45 + 0.55 * sin(u_time * (1.6 + 3.0 * hash(cellp + 9.0)) + g * 63.0);
        star *= dens * tw;

        vec2 cm = vec2(0.0);
        cm = max(cm, segMask(uv, vec2(0.16, 0.10), vec2(0.22, 0.15)));
        cm = max(cm, segMask(uv, vec2(0.22, 0.15), vec2(0.29, 0.12)));
        cm = max(cm, segMask(uv, vec2(0.29, 0.12), vec2(0.35, 0.18)));
        cm = max(cm, segMask(uv, vec2(0.68, 0.09), vec2(0.74, 0.14)));
        cm = max(cm, segMask(uv, vec2(0.74, 0.14), vec2(0.71, 0.20)));
        cm = max(cm, segMask(uv, vec2(0.74, 0.14), vec2(0.81, 0.17)));
        // The whole constellation (lines + nodes) sparkles: each glyph
        // cell along the path fires discrete bright flashes at random
        // intervals. The shape emerges from where the sparkles cluster,
        // never from a steady drawn line.
        float cellId  = hash(cellp + 7.7);
        float st      = u_time * 1.6 + cellId * 9.0;
        float bucket  = floor(st);
        float lcl     = fract(st);
        float fire    = step(0.72, hash(cellp + bucket * 13.7));
        float env     = smoothstep(0.0, 0.08, lcl) * (1.0 - smoothstep(0.20, 0.55, lcl));
        float sparkle = 0.16 + fire * env * 1.75;
        float conMask = max(cm.x * 0.55, cm.y);   // line + node coverage
        float con     = conMask * sparkle;

        // ✦ Easter egg — full Milky Way only around solar midnight
        float milky  = smoothstep(-0.80, -0.985, elev);
        vec2  mm     = uv - vec2(0.5, hYc * 0.42);
        float ca = cos(-0.55), sa = sin(-0.55);
        float across = mm.x * sa + mm.y * ca;
        float along  = mm.x * ca - mm.y * sa;
        float band   = exp(-(across * across) / 0.020);
        float dust   = fbm(vec2(along * 6.0 + 3.0, across * 11.0));
        float rift   = smoothstep(0.26, 0.62, fbm(vec2(along * 4.0, across * 9.0) + 7.0));
        float mwHaze = band * (0.14 + 0.22 * dust) * rift;
        float mwStr  = step(0.80, hash(cellp + 71.0)) * (0.25 + 0.75 * pow(hash(cellp + 12.0), 2.0));
        mwStr *= band * (0.5 + 0.5 * sin(u_time * (2.0 + 3.0 * hash(cellp + 4.0)) + hash(cellp + 71.0) * 50.0));
        float mw = max(mwHaze, mwStr) * milky;

        float nightSky = max(max(star, con), mw) * nightAmt * gap;

        float sunX = 0.16 + 0.68 * clamp(aDay, 0.0, 1.0);
        float sunBaseY = terrainHorizonAtX(sunX);
        float sunY = mix(sunBaseY, u_sunMaxY, clamp(elev, 0.0, 1.0));
        float asp  = u_res.x / u_res.y;
        float sr   = length((uv - vec2(sunX, sunY)) * vec2(asp, 1.0));
        float sun  = (smoothstep(0.060, 0.030, sr)
                    + smoothstep(0.105, 0.060, sr) * 0.30) * sunUp * u_sun;

        float cl    = fbm(vec2(uv.x * 2.3 + u_time * 0.010, uv.y * 4.2 + 1.0));
        float ccov  = 0.58 + 0.30 * sin(u_time * 0.045
                    + fbm(vec2(uv.x * 0.7, u_time * 0.010)) * 4.0); // waxes & wanes
        float cloud = smoothstep(ccov, ccov + 0.16, cl)
                    * smoothstep(0.0, 0.45, skyH) * (0.25 + 0.75 * sunUp) * 0.45;

        // ✦ Easter egg — northern lights at the peak of midnight:
        // fine vertical curtains that dance in place
        float aurZ  = smoothstep(-0.93, -0.999, elev);
        float aurora = 0.0;
        if (aurZ > 0.001) {                       // only near solar midnight
          float drift = u_time * 0.10;            // flows / dances more
          float fold  = 0.08 * (vnoise(vec2(uv.y * 1.7 + drift, 4.0)) - 0.5);
          float ax    = uv.x + fold;
          float n1    = fbm(vec2(ax * 7.0 + drift * 2.0, 1.7));
          float broad = pow(clamp(1.0 - abs(2.0 * n1 - 1.0), 0.0, 1.0), 1.8);
          float fine  = pow(clamp(1.0 - abs(2.0 *
                          fbm(vec2(ax * 24.0 - drift, 5.0)) - 1.0), 0.0, 1.0), 3.0);
          float dnc   = 0.22 + 0.78 * smoothstep(0.20, 0.86,
                    fbm(vec2(ax * 3.0 - u_time * 0.20, u_time * 0.16 + 2.0)));
          float b0    = broad * dnc;
          // pronounce vertical lines where the curtain peaks in brightness
          float rays  = broad * mix(1.0, 0.30 + 0.70 * fine,
                                    smoothstep(0.35, 0.85, b0));
          // Column height scales with its intensity: tall where bright,
          // short (near the horizon) where faint
          float bot   = hYc - 0.05;
          float it    = smoothstep(0.15, 0.85, b0);
          float tEdge = mix(hYc - 0.10, 0.16, it);
          float aHi   = smoothstep(tEdge - 0.04, tEdge + 0.02, uv.y)
                      * (1.0 - smoothstep(bot, hYc - 0.005, uv.y));
          float aCtr  = smoothstep(0.52, 0.12, abs(uv.x - 0.5));
          aurora = aurZ * rays * dnc * aHi * aCtr * 0.70;
        }

        // Distant mountains are the lifted continent surface (contLift),
        // computed above the branch split so the peak joins its landmass
        // continuously across the seam.
        float skyI = max(nightSky, max(sun, max(cloud, max(aurora, contLift))));
        return clamp(skyI * rv, 0.0, 1.0);
      }

      // Perspective ground projection (near = bottom, far = horizon).
      // worldZ advances with time → the planet rotates toward the viewer.
      float gy = (uv.y - hYc) / (1.0 - hYc);
      float z  = 1.0 / (gy * gy * 0.90 + 0.05);
      float worldZ = z * 1.8 + u_time * u_scroll;
      float follow = cxN + slope * (worldZ - wzNear);
      float worldX = (uv.x - 0.5) * z * 1.6 + follow + u_steer * (0.25 + z * 0.30);

      // ── Mouse interaction ────────────────────────────────────────
      // Project the cursor onto the ground plane (same perspective as
      // worldX/worldZ), then use that world position to (1) BEND the
      // river's centerline toward the cursor at the cursor's depth,
      // and (2) emit concentric RIPPLES across the water surface.
      vec2  mUV   = u_mouse / u_res;                 // 0..1 (y down)
      float mgyR  = (mUV.y - hYc) / (1.0 - hYc);
      float mOn   = u_mAmt * smoothstep(0.0, 0.06, mgyR); // only below horizon
      float mgyS  = max(mgyR, 0.02);
      float mz_   = 1.0 / (mgyS * mgyS * 0.90 + 0.05);
      float mWZ   = mz_ * 1.8 + u_time * u_scroll;
      float mFol  = cxN + slope * (mWZ - wzNear);
      float mWX   = (mUV.x - 0.5) * mz_ * 1.6 + mFol + u_steer * (0.25 + mz_ * 0.30);

      // Bend river center toward cursor — depth-localized Gaussian pull
      float cxBase = riverCx(worldZ);
      float dz     = worldZ - mWZ;
      float bAmt   = exp(-dz * dz * 0.45) * mOn;
      float cx     = cxBase + (mWX - cxBase) * 0.55 * bAmt;

      float width = max(u_riverW + u_riverW * 0.33 * sin(worldZ * 0.21),
                        u_riverW * 0.45);
      float d     = (worldX - cx) / width;
      float chan  = exp(-d * d * 1.6);
      float offR  = 1.0 - chan;                       // away from the river

      // ── River flow ── anisotropic noise stretched along Z so the
      // water reads as streaks SLIDING DOWNSTREAM rather than blobs.
      // Two octaves drift at different speeds for parallax, and a slight
      // shear ties them to the river's curving centerline.
      float fT     = u_time * u_flowSpd;
      float shear  = (worldX - cxBase) * 0.30;        // skew with bank curve
      float flow1  = fbm(vec2(worldX * 1.6, worldZ * 0.42 + shear - fT * 2.6));
      float flow2  = fbm(vec2(worldX * 3.4, worldZ * 0.95 + shear - fT * 4.2));
      float flow   = flow1 * 0.55 + flow2 * 0.45;
      float strm   = smoothstep(0.18, 0.92, chan * (0.45 + 0.75 * flow) + 0.05);

      // ── Specular crests ── sun-glints that slide downstream
      float crestPh = worldZ * 3.0 - fT * 4.2;
      float waveA   = sin(crestPh + worldX * 5.5) * 0.5 + 0.5;
      float waveB   = sin(crestPh * 1.65 + worldX * 9.3) * 0.5 + 0.5;
      float crest   = pow(waveA * waveB, 5.0) * chan;
      strm = max(strm, crest * u_crest);

      // ── Streamlines ── thin bright streaks aligned with the flow,
      // pulsing along Z so you can see the current moving.
      float streak = abs(sin(worldX * 8.0 + flow * 4.5));
      streak = pow(1.0 - smoothstep(0.0, 0.32, streak), 7.0);
      float streakPulse = 0.45 + 0.55 * sin(worldZ * 1.6 - fT * 4.6);
      strm = max(strm, streak * chan * streakPulse * u_streak);

      // ── Foam ── crest peaks catch extra brightness where flow noise
      // happens to align — gives the eye a fast-moving sparkle.
      float foam = smoothstep(0.78, 0.95, flow) * chan;
      foam *= 0.55 + 0.45 * sin(worldZ * 5.0 - fT * 6.0);
      strm = max(strm, foam * u_foam);

      // (Cursor radial ripples removed — the river-bend pull above is
      // the only cursor effect now.)
      float ripGround = 0.0;

      // Rolling banks with directional shading — slopes facing the sun
      // brighten, slopes facing away darken, giving the terrain real form.
      float terr = fbm(vec2(worldX * 0.50, worldZ * 0.50));
      float ridg = vnoise(vec2(worldX * 1.40 + 5.0, worldZ * 1.40));
      // Cross-X slope of the bank height for shading
      float hL   = fbm(vec2((worldX - 0.40) * 0.50, worldZ * 0.50));
      float hR   = fbm(vec2((worldX + 0.40) * 0.50, worldZ * 0.50));
      float slpX = (hR - hL);
      float aDayL = (u_tod * 24.0 - 6.0) / 12.0;
      float sunUpL = smoothstep(-0.10, 0.30, sin(aDayL * 3.14159265));
      float sunX  = clamp(aDayL * 2.0 - 1.0, -1.0, 1.0);   // dawn -1 → dusk +1
      float lit   = 0.55 - slpX * sunX * 2.2;
      lit = mix(0.70, clamp(lit, 0.18, 1.15), sunUpL);
      float land = (0.16 + 0.42 * terr + 0.16 * ridg) * offR * lit;

      // (Cities — street networks that sparkle at night — are computed
      // after the continents below, so they can settle on the landmasses.)

      // ── Continents ── large irregular landmasses with distinct
      // coastlines, scattered along both sides of the river. A low-
      // frequency noise field defines continent presence; inside the
      // landmasses, finer noise paints mountain relief. Continents
      // are pushed well back from the river so they never overlap the
      // water channel or the immediate banks.
      float farRiver  = smoothstep(1.30, 2.30, abs(d));   // hard exclusion
      float contN     = fbm(vec2(worldX * 0.18 + 7.0, worldZ * 0.18 + 13.0));
      // Distinct continent interior + thin coastline rim
      float contBody  = smoothstep(0.50, 0.58, contN) * farRiver;
      float contCoast = (smoothstep(0.46, 0.50, contN)
                        - smoothstep(0.50, 0.58, contN)) * farRiver;
      // Mountain relief inside the continent — uses local slope shading
      float contRelief = fbm(vec2(worldX * 1.20 + 17.0, worldZ * 1.20))
                       + 0.45 * vnoise(vec2(worldX * 2.80, worldZ * 2.80));
      // Slope lighting for mountain ridges
      float contRidge  = pow(smoothstep(0.35, 0.85, contRelief), 1.4);
      float continents = contBody * (0.30 + 0.45 * contRelief + 0.35 * contRidge)
                       * (0.65 + 0.55 * lit);
      // Coastline — bright thin highlight ring around each continent
      continents = max(continents, contCoast * (0.55 + 0.25 * lit));
      continents *= u_contOn;                          // checkbox toggle

      // ── Topographic depth map ── elevation isolines that fill the ground
      // like a bathymetric chart. Elevation shares the continent field so
      // contours bunch around the landmasses (highlands) and undulate across
      // the open water; low-frequency so the lines flow toward the viewer
      // with the scroll instead of flickering. Denser where the terrain is
      // steep (the gradient packs the bands), exactly like a real topo map.
      float topo = 0.0;
      if (u_topoOn > 0.5) {
        // World-X WITHOUT the river-follow term, so the contours only scroll
        // toward the viewer (Z) and never sway left/right as the camera
        // tracks the meandering river.
        float topoX = (uv.x - 0.5) * z * 1.6 + u_steer * (0.25 + z * 0.30);
        // Elevation varies mainly ACROSS the flow (higher freq in topoX) and
        // only slowly ALONG it (low freq in worldZ), so the isolines are
        // elongated down-river — they run PARALLEL to the river as gently
        // wavy perspective rays, not horizontal bands crossing it. The low Z
        // frequency also keeps them from shimmering.
        float topoElev = fbm(vec2(topoX * 0.50 + 7.0, worldZ * 0.07 + 13.0)) * 1.50
                       + 0.38 * fbm(vec2(topoX * 1.00 + 2.0, worldZ * 0.12));
        float bands = topoElev * u_topoN;
        float dline = min(fract(bands), 1.0 - fract(bands));   // dist to nearest isoline
        topo = smoothstep(0.13, 0.03, dline);                  // soft, stable contour line
        // Fade the FAR contours: near the horizon they bunch into sub-pixel
        // lines that alias and flicker, so keep only the readable near–mid
        // bands and let the distance dissolve them smoothly.
        float topoFar = smoothstep(16.0, 7.0, z);
        topo *= (0.32 + 0.68 * offR) * u_topo * topoFar;
      }

      // (Cities are rendered separately in main() via cityAt(), at a FINER
      // dot cell than the rest of the scene so the street grid resolves
      // crisply — they're not folded into this coarse field.)

      // Generated terrain renders as a direct continuous overlay in main(), not
      // through the glyph/dot intensity field. Keeping this at zero prevents
      // a second cell-quantized terrain layer from shearing over the lines.
      float Iother = 0.0;

      // Atmospheric depth fade + soft fade-in just below the horizon
      float fog   = smoothstep(20.0, 1.5, z);
      float horiz = smoothstep(hYc, hYc + 0.20, uv.y);          // soft horizon (river/land/cities)
      // Continents reach much closer to the seam than the rest of the scene
      // so their crest MEETS the distant peaks projecting just above the
      // horizon line — without this gentler fade the peaks float over a
      // dead band and read as detached from the land.
      float horizC = smoothstep(hYc - 0.004, hYc + 0.05, uv.y);
      float I = max(Iother * horiz, continents * 0.95 * horizC) * mix(0.20, 1.0, fog);
      I = max(I, contLift);                            // lifted faces join the land

      float calm = mix(1.0, u_calm, smoothstep(0.66, 1.0, uv.y)); // bottom ease (CALM slider; 1 = no fade)
      return clamp(I * calm * rv, 0.0, 1.0);
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
      float asp = u_res.x / max(1.0, u_res.y);
      float fx  = tan(0.60);                           // field of view
      float sx  = (uv.x - 0.5) * 2.0 * fx * asp;
      float sy  = (u_viewHorizon - uv.y) * 2.0 * fx;   // uv is y-down
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
      float asp2 = u_res.x / max(1.0, u_res.y);
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
        vec2  P    = uv * u_res;
        float cell = max(u_res.y / max(u_cloudDot, 1.0), 2.0);
        vec2  Cd   = floor(P / cell);
        vec2  dotCenter = (Cd + 0.5) * cell;
        vec2  dotUv = dotCenter / u_res;
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
          vec2 P = uv * u_res;
          float cell = max(u_res.y / u_aurDot, 2.0);
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
        vec2 px = 1.0 / u_res;
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
        vec2 P    = uv * u_res;
        float waterCell = max(u_res.y / max(u_waterDot, 1.0), 2.0);
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

    // Glyph coverage at a device-pixel position
    float glyph(vec2 P){
      vec2 cell = floor(P / u_cell);
      vec2 cc   = (cell + 0.5) * u_cell;
      float I   = field(cc);
      // Per-cell jitter → adjacent cells of similar intensity pick
      // different glyphs (dither), so the ASCII varies instead of banding
      float jit = (hash(cell) - 0.5) * 1.7;
      float gi  = clamp(floor(I * u_glyphs + jit), 0.0, u_glyphs - 1.0);
      vec2 lp   = (P - cell * u_cell) / u_cell;
      vec2 luv  = clamp(lp, 0.04, 0.96);          // inset: no LINEAR bleed
      vec2 auv  = vec2((gi + luv.x) / u_glyphs, luv.y);
      return texture2D(u_atlas, auv).r;
    }

    void main(){
      vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);       // y down
      vec2 P  = uv * u_res;                       // screen px (glyph grid)
      vec2 uvR = bankUV(uv);                      // banked uv for the horizon

      // ── Generated hero: smooth in-valley canyon (replaces the ASCII-river scene) ──
      vec3 col = renderValley(uv);
      // Minimal post: boot fade, headline text, gentle vignette, grain.
      col = mix(col, vec3(0.010, 0.017, 0.045), u_boot);
      float tAv = smoothstep(0.30, 0.62, texture2D(u_txt, uv).a);
      col = mix(col, vec3(0.84, 0.93, 0.87), tAv);
      col += tAv * vec3(0.18, 0.40, 0.34) * 0.5;
      vec2 qv = (uv - 0.5) * vec2(1.05, 1.18);
      float vigv = smoothstep(1.22, 0.10, dot(qv, qv) * 2.1);
      col *= mix(0.86, 1.0, vigv);
      col += (hash(uv * u_res + u_time) - 0.5) * u_grain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      return;
#if 0
      float I     = field((floor(P / u_cell) + 0.5) * u_cell);
      float crisp = glyph(P);

      // Optional soft-focus — 4-tap ring averaged into the crisp glyph.
      if (u_blur > 0.001){
        float soft = crisp;
        float r = u_blur * u_cell * 0.55;
        for (int i = 0; i < 4; i++){
          float a = (float(i) + 0.5) * 1.5707963268;  // 2π / 4
          vec2 dir = vec2(cos(a), sin(a)) * r;
          soft += glyph(P + dir);
        }
        soft *= 0.20;                                  // /5
        crisp = mix(crisp, soft, clamp(u_blur, 0.0, 1.0));
      }

      // Glyph-shaped bloom: blur the coverage over two rings of taps.
      // 4 angles × 2 rings = 8 glyph() calls per fragment (down from 12).
      float bloom = 0.0, wsum = 0.0;
      for (int i = 0; i < 4; i++){
        float a = (float(i) + 0.5) * 1.5707963268; // 2π / 4
        vec2 dir = vec2(cos(a), sin(a));
        bloom += glyph(P + dir *  u_bRad)        * 0.55; wsum += 0.55;
        bloom += glyph(P + dir * (u_bRad * 0.5)) * 1.00; wsum += 1.00;
      }
      bloom /= wsum;

      // ── Grade — time-of-day sky + curved ground + glowing ASCII ──
      float hY = u_horizon;
      float bend = uvR.x - 0.5;
      float hYc  = terrainHorizon(uvR); // match Generated terrain's convex globe arc

      float todH  = u_tod * 24.0;
      float aDay  = (todH - 6.0) / 12.0;
      float elev  = sin(aDay * 3.14159265);
      float sunUp = smoothstep(-0.10, 0.12, elev);
      float skyG  = pow(clamp(uvR.y / hYc, 0.0, 1.0), 1.8);

      // Night floor lifted to a deep blue-hour — the sky is never dead
      // black, so even solar midnight reads as a moody cinematic blue.
      vec3 nightTop = vec3(0.026, 0.046, 0.115);
      vec3 nightHor = vec3(0.060, 0.112, 0.245);
      vec3 dayTop   = vec3(0.060, 0.160, 0.420);
      vec3 dayHor   = vec3(0.330, 0.560, 0.820);
      vec3 skyTopC  = mix(nightTop, dayTop, smoothstep(0.0, 0.55, sunUp));
      vec3 skyHor   = mix(nightHor, dayHor, smoothstep(0.0, 0.55, sunUp));
      // Twilight ramp stretched over ~2x the sun-elevation span so the
      // sunrise/sunset warm tint lasts about twice as long (same colour).
      float twR = smoothstep(-0.21, 0.23, elev);
      float twi = smoothstep(0.02, 0.30, twR) * (1.0 - smoothstep(0.30, 0.70, twR));
      skyHor = mix(skyHor, vec3(0.85, 0.45, 0.24), twi * 0.60);
      vec3 sky = mix(skyTopC, skyHor, skyG);

      // Sun glow
      float sunX = 0.16 + 0.68 * clamp(aDay, 0.0, 1.0);
      float sunBaseY = terrainHorizonAtX(sunX);
      float sunY = mix(sunBaseY, u_sunMaxY, clamp(elev, 0.0, 1.0));
      float asp2 = u_res.x / u_res.y;
      float sgl  = exp(-length((uvR - vec2(sunX, sunY)) * vec2(asp2, 1.0)) * 4.0);
      sky += sunUp * sgl * vec3(0.55, 0.42, 0.25) * u_sun;

      // ✦ Northern lights — fine vertical curtains that dance in place
      float aurZ2 = smoothstep(-0.93, -0.999, elev);
      if (aurZ2 > 0.001 && u_aurOn > 0.5) {      // only near solar midnight
        float drift = u_time * 0.10;
        float fold  = 0.08 * (vnoise(vec2(uvR.y * 1.7 + drift, 4.0)) - 0.5);
        float ax    = uvR.x + fold;
        float n1    = fbm(vec2(ax * 7.0 + drift * 2.0, 1.7));
        float broad = pow(clamp(1.0 - abs(2.0 * n1 - 1.0), 0.0, 1.0), 1.8);
        float fine  = pow(clamp(1.0 - abs(2.0 *
                        fbm(vec2(ax * 24.0 - drift, 5.0)) - 1.0), 0.0, 1.0), 3.0);
        float dnc   = 0.22 + 0.78 * smoothstep(0.20, 0.86,
                  fbm(vec2(ax * 3.0 - u_time * 0.20, u_time * 0.16 + 2.0)));
        float b0    = broad * dnc;
        float rays  = broad * mix(1.0, 0.30 + 0.70 * fine,
                                  smoothstep(0.35, 0.85, b0));
        // Column height scales with intensity (tall where bright)
        float bot   = hYc - 0.05;
        float it    = smoothstep(0.15, 0.85, b0);
        float tEdge = mix(hYc - 0.10, 0.16, it);
        float aH    = smoothstep(tEdge - 0.04, tEdge + 0.02, uvR.y)
                    * (1.0 - smoothstep(bot, hYc - 0.005, uvR.y));
        float aCtr  = smoothstep(0.52, 0.12, abs(uvR.x - 0.5));
        // green base; purple only toward the TOP of the intense columns
        float frac  = smoothstep(bot, tEdge, uvR.y);          // 0 base → 1 top
        float pMix  = smoothstep(0.25, 1.0, frac) * smoothstep(0.42, 0.85, b0);
        vec3 aurCol = mix(vec3(0.26, 0.96, 0.52), vec3(0.80, 0.32, 1.00), pMix);
        aurCol = mix(aurCol, vec3(0.25, 0.85, 0.80), 0.05);
        sky += aurZ2 * rays * dnc * aH * aCtr * aurCol * 0.85;
      }

      // Soften harsh midday: a real daytime still happens, but the sky
      // never blows out to flat white — keeps the moody brand even at
      // noon. Golden hour (elev≈0) is untouched; only high sun is tamed.
      float harsh = smoothstep(0.45, 0.95, elev);
      sky *= mix(1.0, 0.80, harsh);

      // Ground — low-frequency drift through several blue tones
      float cv = fbm(P * 0.0016 + vec2(4.0, -u_time * 0.05));
      vec3 bIndigo = vec3(0.020, 0.044, 0.140);
      vec3 bNavy   = vec3(0.055, 0.130, 0.330);
      vec3 bCeru   = vec3(0.085, 0.225, 0.470);
      vec3 bSteel  = vec3(0.070, 0.155, 0.290);
      vec3 ground = mix(bIndigo, bNavy, smoothstep(0.18, 0.55, cv));
      ground = mix(ground, bCeru,  smoothstep(0.55, 0.88, cv) * 0.80);
      ground = mix(ground, bSteel, smoothstep(0.30, 0.05, cv) * 0.40);
      float haze = smoothstep(1.0, hYc, uvR.y);
      ground = mix(ground, skyHor, haze * u_haze);             // atmospheric perspective (HAZE)
      ground += I * 0.06 * vec3(0.10, 0.32, 0.55);

      // Earth illumination + a constant warm base so the ground reads as
      // its own surface, distinct from the sky behind it.
      ground = ground * u_earth + vec3(0.022, 0.020, 0.012) * u_earth;

      float g = smoothstep(hYc - 0.06, hYc + 0.11, uvR.y);     // crisper seam
      vec3 water = mix(sky, ground, g);

      // ── Planet-limb atmosphere ── luminous air hugging the curved
      // horizon: a hot thin core at the seam plus a soft airglow halo
      // that bleeds up into the sky and faintly onto the ground. Tinted
      // warm at golden hour, deep blue after dusk — this is what sells
      // the sense of skimming low over a curved world.
      float dHor  = uvR.y - hYc;                 // +below seam, -above (y-down)
      float above = max(-dHor, 0.0);             // into the sky
      float below = max( dHor, 0.0);             // onto the ground
      vec3  rimC  = mix(skyHor, vec3(1.00, 0.64, 0.34), twi * 0.55);
      float core  = exp(-abs(dHor) * 20.0);                    // tight hot line
      float halo  = exp(-above * 5.5) * 0.40                   // airglow into sky
                  + exp(-below * 8.0) * 0.20;                  // bleed onto ground
      // The limb glow is a TWILIGHT phenomenon — brightest when the sun
      // sits on the horizon (golden / blue hour) and all but gone under
      // high daylight, so the horizon never burns. A small night term
      // keeps a faint glow beneath the stars around midnight. Kept gentle
      // overall so even sunrise / sunset reads as a soft glow, not a band.
      float limb   = exp(-elev * elev / 0.14);                 // peak at golden
      float night  = smoothstep(0.0, -0.5, elev);
      float rimAmt = 0.10 + 0.34 * limb + 0.18 * night;
      vec3  atmo   = rimC * (core * 0.45 + halo) * rimAmt * u_atmo;
      water += atmo;

      // Generated terrain topology: heightfield contours sampled through the
      // ray-sphere projection, so topology follows the globe transform.
      vec4 topoInk = terrainInk(uvR);
      water = mix(water, topoInk.rgb, topoInk.a);

      vec3 aqua  = vec3(0.737, 0.855, 0.816);          // #BCDAD0
      vec3 cream = vec3(0.949, 0.914, 0.839);          // #F2E9D6
      vec3 gcol  = mix(aqua, cream, smoothstep(0.0, 0.62, I));
      // The brightest glyphs (sun, river crest) burn toward white — but
      // NOT in dot mode, where we want dots to keep their colour, not whiteout.
      gcol = mix(gcol, vec3(1.0, 0.99, 0.94), smoothstep(0.72, 1.0, I) * 0.7 * (1.0 - u_dots));

      // ── Continent glyph tint ── recompute the continent mask at
      // this fragment and bias the glyph colour toward u_contColor.
      if (u_contOn > 0.5) {
        float gyC = (uvR.y - hYc) / (1.0 - hYc);
        if (gyC > 0.01) {
          float zC      = 1.0 / (gyC * gyC * 0.90 + 0.05);
          float wzNearC = u_time * u_scroll;
          float worldZC = zC * 1.8 + wzNearC;
          float cxNC    = riverCx(wzNearC);
          float slpC    = clamp((riverCx(wzNearC + 0.6) - riverCx(wzNearC - 0.6))
                                / 1.2, -0.5, 0.5);
          float followC = cxNC + slpC * (worldZC - wzNearC);
          float worldXC = (uvR.x - 0.5) * zC * 1.6 + followC
                        + u_steer * (0.25 + zC * 0.30);
          float cxBaseC = riverCx(worldZC);
          float widthC  = max(1.20 + 0.40 * sin(worldZC * 0.21), 0.55);
          float dC      = (worldXC - cxBaseC) / widthC;
          float farRivC = smoothstep(1.30, 2.30, abs(dC));
          float contNC  = fbm(vec2(worldXC * 0.18 + 7.0, worldZC * 0.18 + 13.0));
          float contMaskC = smoothstep(0.50, 0.58, contNC) * farRivC;
          gcol = mix(gcol, u_contColor, contMaskC * 0.90);
        }
      }

      // Gradient recolour — only the glyph ink + its bloom take a vivid
      // spectral gradient that sweeps HUE across a diagonal (so it runs
      // through many colours like the reference globes); bg is untouched.
      float gt = clamp((uv.x + uv.y) * 0.5, 0.0, 1.0);   // diagonal: top-left → bottom-right
      vec3 gradCol = hue2rgb(fract(mix(u_hueA, u_hueB, gt))) * u_gradBri;
      gcol = mix(gcol, gradCol, u_grad);

      // Crisp pass: glyphs carry the image, just a hint of bloom for life.
      // Gradient mode keeps the normal earth/scene illumination behind the
      // colour-graded glyphs (same lighting as non-gradient mode).
      vec3 col = water * u_bgBright;
      vec3 bloomC = bloom * mix(mix(vec3(0.44, 0.78, 1.00), cream, 0.42), gradCol, u_grad) * u_bloom * 0.55;
      if (u_dots > 0.5) {
        // Dots: brightness from DOT INT with mild intensity falloff, then a
        // luminance-preserving cap so a dot can glow but never clip to pure
        // white. Bloom is cut hard so neighbouring dots stay separated.
        vec3 ink = crisp * gcol * (u_dotGain * (0.30 + 0.70 * I));
        float mx = max(ink.r, max(ink.g, ink.b));
        ink *= (mx > 0.85) ? (0.85 / mx) : 1.0;           // never reaches white
        col += ink;
        col += bloomC * 0.20;                              // faint glow, keeps gaps
      } else {
        col += crisp * gcol * (0.55 + u_glyph * I) * u_dotGain;   // sharp glyph ink
        col += bloomC;
      }

      // ── City pass ── a city is just a BRIGHTER PATCH of the same dot grid
      // as the rest of the scene: same cell size, same lattice, same dot
      // colours — so it reads as that clean halftone grid, lit up. Sampled
      // once per cell on the exact grid the scene already uses.
      {
        float fc    = u_cell;
        vec2  fcell = floor(P / fc);
        float cI    = cityAt((fcell + 0.5) * fc);
        if (cI > 0.003) {
          float jit = (hash(fcell + 3.3) - 0.5) * 1.4;
          float gi  = clamp(floor(cI * u_glyphs + jit), 0.0, u_glyphs - 1.0);
          vec2  lp  = (P - fcell * fc) / fc;
          vec2  luv = clamp(lp, 0.04, 0.96);
          float cov = texture2D(u_atlas, vec2((gi + luv.x) / u_glyphs, luv.y)).r;
          vec3  ccol = mix(vec3(0.737, 0.855, 0.816), vec3(0.949, 0.914, 0.839), smoothstep(0.0, 0.62, cI));
          ccol = mix(ccol, gradCol, u_grad);                       // respect gradient mode
          vec3  cink = cov * ccol * (u_dotGain * (0.34 + 0.66 * cI));
          float mx = max(cink.r, max(cink.g, cink.b));
          cink *= (mx > 0.92) ? (0.92 / mx) : 1.0;
          col += cink;
        }
      }

#endif
      // Gentle vignette
      vec2 q = (uv - 0.5) * vec2(1.05, 1.18);
      float vig = smoothstep(1.22, 0.10, dot(q, q) * 2.1);
      col *= mix(0.80, 1.0, vig);

      // Grain — amplitude from slider
      col += (hash(uv * u_res + u_time) - 0.5) * u_grain;

      // Terminal boot — fade the scene to near-black while booting
      col = mix(col, vec3(0.010, 0.017, 0.045), u_boot);

      // In-shader terminal text. u_pixelText=1 → chunky pixel-block look;
      // 0 (default) → sampled sharp at native resolution (clean, AA'd).
      vec2 tuv = uv;
      if (u_pixelText > 0.5) {
        float blk = max(1.0, u_res.y / 620.0);               // ~2px pixel grid
        tuv = (floor(uv * u_res / blk) + 0.5) * blk / u_res;
      }
      float tA  = texture2D(u_txt, tuv).a;
      tA = smoothstep(0.30, 0.62, tA);
      col = mix(col, vec3(0.84, 0.93, 0.87), tA);
      col += tA * vec3(0.18, 0.40, 0.34) * 0.5;

      // ── Whole-screen CRT (softened) ── scanlines, toggled from the
      // debug console (u_crtOn). Off → col is untouched (no scanlines).
      col *= mix(1.0, 0.96 + 0.04 * sin(uv.y * u_res.y * 3.14159), u_crtOn);
      vec2 cc = uv - 0.5;
      float edge = smoothstep(0.78, 0.45, max(abs(cc.x) * 1.05, abs(cc.y) * 1.18));
      col *= mix(1.0 - u_vig, 1.0, edge);

      // ── Game Boy DMG LCD ── posterize the whole scene to the iconic
      // 4-shade green palette and overlay a fine pixel grid, so it reads
      // as a dot-matrix LCD. Brightest scene → palest green; darkest → deep green.
      if (u_lcd > 0.5) {
        float lum = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
        float q   = floor(lum * 3.999) / 3.0;            // 4 quantised levels
        vec3 g0 = vec3(0.059, 0.220, 0.059);             // #0f380f darkest
        vec3 g1 = vec3(0.188, 0.384, 0.188);             // #306230
        vec3 g2 = vec3(0.545, 0.675, 0.059);             // #8bac0f
        vec3 g3 = vec3(0.608, 0.737, 0.059);             // #9bbc0f lightest
        vec3 lcd = q < 0.16 ? g0 : (q < 0.50 ? g1 : (q < 0.83 ? g2 : g3));
        vec2 cuv = fract(uv * u_res / max(u_lcdPx, 2.0));
        float gx = smoothstep(0.0, 0.12, cuv.x) * (1.0 - smoothstep(0.88, 1.0, cuv.x));
        float gy = smoothstep(0.0, 0.12, cuv.y) * (1.0 - smoothstep(0.88, 1.0, cuv.y));
        lcd *= 0.78 + 0.22 * (gx * gy);                  // thin dark grid gaps
        col = lcd;
      }

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

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[river] shader compile:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;

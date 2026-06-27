/**
 * Axtrivc River — footer 水流动画
 *
 * 移植自 river.ai footer river canvas (script.js?v=89)
 * 保留核心: 多层正弦波 + 点击涟漪 + 鼠标扰动 + IntersectionObserver 视口暂停
 * 简化: 去掉 koi/shark 彩蛋(博客不需要)
 *
 * 颜色: 暖棕主题适配(与博客 #8B6F47/#faf8f5 呼应) + 金/棕/米色波层
 */
(function () {
  'use strict';

  var stage = document.getElementById('axtrivcRiverStage');
  var canvas = document.getElementById('axtrivcRiverCanvas');
  if (!stage || !canvas) return;

  var ctx = canvas.getContext('2d');
  var W = 0, H = 0;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var t = 0;
  var ripples = [];
  var cursor = { x: -9999, y: -9999, active: false };

  function resize() {
    var rect = stage.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Layered waves — 5 主题适配, 每主题 4 层专属 palette
  // 配色逻辑: 后层深饱和(主色暗版) → 中层主色 → 近层主色亮版 → 前景高光(暖白,保持水感)
  // alpha 提升: 0.20→0.42 / 0.24→0.55 / 0.32→0.68 / 0.55→0.85
  // stroke 加粗: 1.0→1.4 / 1.2→1.6, 让线条更清晰可见
  //
  // 配色选取规则:
  //   L1 远景(最深饱和)  — 主题 accent 的深暗版, 约暗 35%
  //   L2 中景(主色)      — 主题 accent 直接用
  //   L3 近景(主色亮版)  — 主题 accent 亮 30%
  //   L4 前景高光(暖白)  — 跟主题背景 bg 一致, 保持水的高光感
  var THEME_WAVES = {
    'wechat-classic': [
      { alpha: 0.42, stroke: 1.4, color: '100, 160, 110' },
      { alpha: 0.55, stroke: 1.4, color: '140, 195, 155' },
      { alpha: 0.68, stroke: 1.6, color: '180, 220, 190' },
      { alpha: 0.85, stroke: 1.2, color: '240, 248, 240' }
    ],
    'lake-blue': [
      { alpha: 0.42, stroke: 1.4, color: '110, 150, 185' },
      { alpha: 0.55, stroke: 1.4, color: '150, 185, 215' },
      { alpha: 0.68, stroke: 1.6, color: '190, 215, 235' },
      { alpha: 0.85, stroke: 1.2, color: '240, 248, 252' }
    ],
    'haze-blue': [
      { alpha: 0.42, stroke: 1.4, color: '130, 140, 155' },
      { alpha: 0.55, stroke: 1.4, color: '165, 175, 190' },
      { alpha: 0.68, stroke: 1.6, color: '200, 208, 218' },
      { alpha: 0.85, stroke: 1.2, color: '248, 249, 251' }
    ],
    'beige-lite': [
      { alpha: 0.42, stroke: 1.4, color: '120, 92, 55' },
      { alpha: 0.55, stroke: 1.4, color: '180, 145, 80' },
      { alpha: 0.68, stroke: 1.6, color: '210, 180, 130' },
      { alpha: 0.85, stroke: 1.2, color: '250, 248, 245' }
    ],
    'lemon-indigo': [
      { alpha: 0.42, stroke: 1.4, color: '90, 110, 165' },
      { alpha: 0.55, stroke: 1.4, color: '135, 150, 195' },
      { alpha: 0.68, stroke: 1.6, color: '180, 190, 225' },
      { alpha: 0.85, stroke: 1.2, color: '245, 246, 252' }
    ]
  };

  // 默认用 beige-lite (博客初始色) 的 palette, 等 themechange 事件覆盖
  var currentWavePalette = THEME_WAVES['beige-lite'];

  // 从 layers 模板 + 当前 palette 合成最终 layers (amp/freq/speed 固定, color 动态)
  var LAYER_TEMPLATE = [
    { amp: 14, freq: 0.0042, speed: 0.012, yOff: 0.62 },
    { amp: 10, freq: 0.0068, speed: 0.020, yOff: 0.70 },
    { amp: 6,  freq: 0.0110, speed: 0.034, yOff: 0.78 },
    { amp: 3,  freq: 0.0200, speed: 0.052, yOff: 0.86 }
  ];
  var layers = LAYER_TEMPLATE.map(function (tpl, i) {
    return Object.assign({}, tpl, currentWavePalette[i]);
  });

  // 监听主题切换事件 — 实时换色, 无需重启动画
  function applyWaveTheme(themeId) {
    var palette = THEME_WAVES[themeId];
    if (!palette) return;
    currentWavePalette = palette;
    for (var i = 0; i < layers.length && i < palette.length; i++) {
      layers[i].color = palette[i].color;
      layers[i].alpha = palette[i].alpha;
      layers[i].stroke = palette[i].stroke;
    }
  }
  window.addEventListener('themechange', function (ev) {
    if (ev && ev.detail && ev.detail.id) applyWaveTheme(ev.detail.id);
  });
  // 启动时也立即同步一次 localStorage 里的主题
  try {
    var savedTheme = localStorage.getItem('axtrivc_theme_v2');
    if (savedTheme) applyWaveTheme(savedTheme);
  } catch (e) { /* localStorage 不可用就保持默认 */ }

  function drawLayer(layer, time) {
    ctx.beginPath();
    var step = 4;
    for (var x = 0; x <= W; x += step) {
      var y =
        layer.yOff * H +
        Math.sin(x * layer.freq + time * layer.speed) * layer.amp +
        Math.sin(x * layer.freq * 2.3 + time * layer.speed * 1.6) * layer.amp * 0.35;

      // 鼠标扰动
      if (cursor.active) {
        var dx = x - cursor.x;
        var dy = y - cursor.y;
        var d2 = dx * dx + dy * dy;
        var r = 110;
        if (d2 < r * r) {
          var f = 1 - Math.sqrt(d2) / r;
          y += Math.sin(time * 0.18 + x * 0.04) * f * 8;
        }
      }

      // 涟漪贡献
      for (var i = 0; i < ripples.length; i++) {
        var rp = ripples[i];
        var rdx = x - rp.x;
        var dist = Math.abs(rdx);
        var edge = rp.radius;
        var band = 28;
        if (dist > edge - band && dist < edge + band) {
          var phase = (dist - edge) / band;
          y += Math.sin(phase * Math.PI) * rp.strength * Math.exp(-rp.age * 0.018);
        }
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(' + layer.color + ', ' + layer.alpha + ')';
    ctx.lineWidth = layer.stroke;
    ctx.stroke();
  }

  var stageVisible = false, running = false;
  function frame() {
    if (!stageVisible) { running = false; return; }
    t += 1;
    ctx.clearRect(0, 0, W, H);

    // 暖棕深水渐变背景(加深, 让线条对比更强)
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(139, 111, 71, 0.15)');
    g.addColorStop(1, 'rgba(100, 75, 40, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < layers.length; i++) drawLayer(layers[i], t);

    // 推进涟漪
    for (var j = ripples.length - 1; j >= 0; j--) {
      var r = ripples[j];
      r.radius += 2.2;
      r.age += 1;
      if (r.age > 220) ripples.splice(j, 1);
    }

    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  // 只在 footer 进入视口时动画(性能优化,抄 river.ai)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (ents) {
      stageVisible = ents[0].isIntersecting;
      if (stageVisible) start();
    }, { rootMargin: '200px 0px 200px 0px', threshold: 0 }).observe(stage);
  } else {
    stageVisible = true;
    start();
  }

  // 交互
  stage.addEventListener('pointermove', function (e) {
    var rect = stage.getBoundingClientRect();
    cursor.x = e.clientX - rect.left;
    cursor.y = e.clientY - rect.top;
    cursor.active = true;
  });
  stage.addEventListener('pointerleave', function () { cursor.active = false; });

  stage.addEventListener('pointerdown', function (e) {
    var rect = stage.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    ripples.push({ x: x, y: y, radius: 0, age: 0, strength: 22 });
    var hint = stage.querySelector('.axtrivc-river-hint');
    if (hint) hint.style.opacity = '0';
  });
})();

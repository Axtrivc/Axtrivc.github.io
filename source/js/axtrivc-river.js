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

  // Layered waves — 暖棕主题适配
  // 从博客 #8B6F47(主色) / #faf8f5(背景) / #C4A96A(按钮hover) 提取
  // 后层淡金 → 中层暖棕 → 前层米白(与 river.ai 层次逻辑一致)
  var layers = [
    { amp: 14, freq: 0.0042, speed: 0.012, yOff: 0.62, alpha: 0.20, stroke: 1.0, color: '196, 169, 106' },   // 淡金
    { amp: 10, freq: 0.0068, speed: 0.020, yOff: 0.70, alpha: 0.24, stroke: 1.0, color: '139, 111, 71' },     // 暖棕(#8B6F47)
    { amp: 6,  freq: 0.0110, speed: 0.034, yOff: 0.78, alpha: 0.32, stroke: 1.2, color: '212, 185, 138' },   // 浅驼
    { amp: 3,  freq: 0.0200, speed: 0.052, yOff: 0.86, alpha: 0.55, stroke: 1.0, color: '250, 248, 245' }    // 米白(#faf8f5)
  ];

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

    // 暖棕深水渐变背景(与博客 #8B6F47 呼应)
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(139, 111, 71, 0)');
    g.addColorStop(1, 'rgba(120, 90, 55, 0.35)');
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

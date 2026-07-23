/**
 * Hero 注入 v13「单 pipeline + 原生滚动」(2026-06-27)
 *
 * 基于 river.ai 性能分析重写：
 *   ✅ 单 GPU pipeline（shader rAF，无第二个 rAF）
 *   ✅ 原生滚动（无 wheel/touch/keyboard hijack）
 *   ✅ 零 CSS 变量 transform（无 calc() 每帧重算）
 *   ✅ hero 绝对定位 100dvh + main margin-top 100dvh
 *   ✅ scrollY >= vh（hero 完全滚出视口）→ hero-released → hero display:none
 *   ✅ body 深蓝兜底，防止下滑过程中露出白色背景
 *   ✅ 滚回顶部 → hero 重新显示
 *
 * 保留：
 *   - hero shader（river-hero.js 自己的 rAF，40fps cap）
 *   - nav 透明背景 + 白字（hero 阶段）
 *   - nav 主题色（released 阶段）
 *   - widget 隐藏/显示切换
 *   - 左下角 typed 副标题（纯 CSS animation，无 setTimeout）
 */
const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function (data) {
  if (!data || typeof data !== 'string') return data;

  if (data.indexOf('id="asciiRiver"') !== -1) return data;

  const canonicalMatch = data.match(/canonical["']?\s*href=["']([^"']+)["']/);
  if (!canonicalMatch) return data;
  const canonical = canonicalMatch[1];
  if (!/axtrivc\.github\.io\/(index\.html)?$/.test(canonical)) return data;

  if (data.indexOf('full_page') === -1) return data;
  if (data.indexOf('</header>') === -1 || data.indexOf('</body>') === -1) return data;

  const heroHtmlPath = path.join(hexo.source_dir, 'hero', 'index.html');
  if (!fs.existsSync(heroHtmlPath)) {
    hexo.log.warn('[hero-inject] source/hero/index.html not found');
    return data;
  }
  const heroSrc = fs.readFileSync(heroHtmlPath, 'utf8');

  const sectionMatch = heroSrc.match(/<section class="hero"[\s\S]*?<\/section>/);
  if (!sectionMatch) return data;
  const heroSection = sectionMatch[0]
    .replace('src="hero-static.jpg"', 'src="/hero/hero-static.jpg"');

  const styleMatch = heroSrc.match(/<style>([\s\S]*?)<\/style>/);
  let heroCss = styleMatch ? styleMatch[1] : '';

  heroCss = heroCss
    .replace(/^\s*html,\s*body\s*\{[^}]*\}\s*$/gm, '')
    .replace(/^\s*\*,\s*\*::before,\s\*::after\s*\{[^}]*\}\s*$/gm, '');

  // ═══════════════════════════════════════════════════════════════
  // v13 CSS：零 CSS 变量、零 calc() transform、零 hijack
  // ═══════════════════════════════════════════════════════════════
  heroCss += `

/* ══ v13 单 pipeline + 原生滚动 ══
 * hero-shell: 绝对定位 100dvh, z-index 0 (背景层)
 * main: margin-top 100dvh, z-index 1 (前景层, 白底)
 * nav: fixed top, z-index 1200 (overlay)
 * 无 CSS 变量, 无 calc() transform, 无 hijack
 * ═════════════════════════════════════════════════════════════ */

/* hero-shell：绝对定位占 100dvh，在文档流中 */
.hero-shell {
  position: relative;
  top: auto;
  left: auto;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #0E2F7E;
  margin: 0;
  padding: 0;
  z-index: 0;
  pointer-events: none;
}
.hero-shell > section.hero {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #0E2F7E;
}
.hero-shell, .hero-shell * {
  font-family: -apple-system, BlinkMacSystemFont, "Inter Tight", "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* ── hero 底部 → 页面内容 渐进过渡 v5（2026-07-23）──
 * 渐变带(.hero-fade) = 动画自身的延伸, 不再是手调固定色带:
 * JS 每帧(12fps)取 hero canvas 底边一条像素带, 垂直翻转拉伸铺满整条带
 * —— 带顶与动画底边逐列同像素, 接缝天然消失; 再以「渐晕+噪声」
 * destination-out 遮罩把条带向下溶解成碎尾。色彩衬底 = 底边采样均色 →
 * 动画夜色系 → --page-bg(跟随主题)。取样失败时退回纯程序渐变。
 * 下方 background 仅作无 JS / 首帧前的兜底, 渲染逻辑在下方 heroJs。 */
.hero-fade {
  position: relative;
  height: clamp(200px, 30vh, 380px);
  background: linear-gradient(180deg,
    #0B1220 0%,
    #101E38 30%,
    #1B3566 52%,
    #46608E 74%,
    #8BA7C6 88%,
    var(--page-bg, #ffffff) 100%);
  pointer-events: none;
}
.hero-fade .hero-fade-ascii {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* canvas：独立 GPU 层 */
.hero-shell canvas.hero-ascii {
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* hero 内部文字：静态定位，无 transform 动画 */
.hero-text {
  position: absolute;
  bottom: clamp(20px, 4vw, 56px);
  left: clamp(20px, 4vw, 56px);
  right: clamp(20px, 4vw, 56px);
  z-index: 3;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.95);
}

/* ── main：紧跟 hero 下方，z-index 1，底色跟随主题页面色 --page-bg ── */
body.hero-page-active main {
  position: relative;
  z-index: 1;
  margin-top: 0;
  background: var(--page-bg, #faf8f5);
}
body.hero-released .hero-shell {
  pointer-events: none !important;
}
body.hero-released main {
  margin-top: 0;
  background: var(--page-bg, #faf8f5);
}

/* ── 2026-06-30 修复：覆盖 butterfly 的 #web_bg 白底 ──
   真因：butterfly 主题注入 <div id="web_bg" style="background:#FFFFFF; position:fixed; z-index:-1">，
   它在 body 和内容之间，遮住 body 的深蓝色。任何 hero ↔ main 过渡缝隙、亚像素间隙都暴露 #FFFFFF。
   修复：hero 阶段把 #web_bg 改成深蓝，与 body 同色；离开 hero 阶段恢复白色（正常浏览）。 */
body.hero-page-active #web_bg {
  background-color: #0E2F7E !important;
}
body.hero-released #web_bg {
  background-color: #FFFFFF !important;
}

/* ── nav：hero 阶段透明 + 白字 ── */
body.hero-page-active #nav,
body.hero-page-active #page-header.full_page #nav {
  opacity: 1 !important;
  visibility: visible !important;
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 1200;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  padding: 0 20px;
  align-items: center;
  transform: translateZ(0);
}
body.hero-page-active #nav a,
body.hero-page-active #nav .site-name,
body.hero-page-active #nav a.site-page,
body.hero-page-active #nav .menus a,
body.hero-page-active #nav .menus_item a {
  color: rgba(255, 255, 255, 0.92) !important;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55), 0 0 12px rgba(80, 180, 130, 0.25);
  transition: color 0.2s ease;
}
body.hero-page-active #nav a:hover,
body.hero-page-active #nav .menus a:hover {
  color: var(--theme-accent-current, #07C160) !important;
  text-shadow: 0 0 14px color-mix(in srgb, var(--theme-accent-current, #07C160) 60%, transparent);
}

/* hero 阶段隐藏 page-header banner */
body.hero-page-active #page-header.full_page {
  position: relative;
  height: 0;
  overflow: hidden;
}
body.hero-page-active #page-header.full_page #site-info,
body.hero-page-active #page-header.full_page #scroll-down,
body.hero-page-active #site-info,
body.hero-page-active #scroll-down {
  display: none !important;
}
body.hero-released #page-header.full_page {
  height: auto;
  overflow: visible;
}
body.hero-released #site-info,
body.hero-released #scroll-down {
  display: block !important;
}

/* nav 内 logo */
body.hero-page-active #blog-info,
body.hero-page-active #nav #blog-info {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  flex-shrink: 0;
  margin-right: 20px;
  position: relative;
  left: 0;
}
body.hero-page-active #blog-info .site-name,
body.hero-page-active #blog-info a,
body.hero-page-active #nav .site-name {
  color: #ffffff !important;
  font-weight: 700 !important;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
}
body.hero-page-active #menus {
  display: flex !important;
  align-items: center;
  background: transparent !important;
  height: 60px;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

/* ── hero 阶段隐藏 fixed widget ── */
body.hero-page-active:not(.hero-released) #music-bar,
body.hero-page-active:not(.hero-released) #music-panel,
body.hero-page-active:not(.hero-released) #rightside,
body.hero-page-active:not(.hero-released) #go-up,
body.hero-page-active:not(.hero-released) #rightside-config,
body.hero-page-active:not(.hero-released) #axtrivc-fab,
body.hero-page-active:not(.hero-released) .fab-publish,
body.hero-page-active:not(.hero-released) #announcement-bg,
body.hero-page-active:not(.hero-released) .announcement,
body.hero-page-active:not(.hero-released) .card-announcement,
body.hero-page-active:not(.hero-released) #dbgToggle,
body.hero-page-active:not(.hero-released) #debugBar {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

/* 释放后：恢复 widget */
body.hero-released #music-bar,
body.hero-released #music-panel.show,
body.hero-released #rightside,
body.hero-released #axtrivc-fab {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

/* 释放后：nav 恢复主题色 */
body.hero-released #nav,
body.hero-released #page-header.full_page #nav {
  background: var(--theme-nav-current, rgba(255, 255, 255, 0.94)) !important;
  background-image: none !important;
}
body.hero-released #nav a,
body.hero-released #nav .site-name,
body.hero-released #nav a.site-page {
  color: var(--theme-text-current, #1a1a1a) !important;
}

/* 卡片融底 */
body.hero-page-active #article-container,
body.hero-page-active .recent-post-item,
body.hero-page-active .card-widget,
body.hero-page-active .card-recent-post,
body.hero-page-active #recent-posts > .recent-post-item {
  border-color: transparent !important;
  box-shadow: none !important;
}
body.hero-page-active .recent-post-item {
  background: transparent !important;
}
body.hero-page-active .card-widget {
  background: transparent !important;
}
body.hero-page-active #recent-posts {
  background: transparent !important;
}

body.hero-page-active {
  background: #0E2F7E;
  overflow-x: hidden;
  overflow-y: auto;
}
body.hero-released {
  background: var(--page-bg, #faf8f5);
}

/* ── 左下角 typed 副标题（纯 CSS animation，无 setTimeout） ── */
.hero-typed-wrap {
  position: absolute;
  left: clamp(20px, 4vw, 56px);
  bottom: clamp(8px, 1.6vw, 22px);
  z-index: 5;
  color: rgba(255, 255, 255, 0.88);
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif;
  font-size: 15px;
  font-weight: 300;
  letter-spacing: 0.04em;
  pointer-events: none;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 14px rgba(80, 180, 130, 0.22);
  max-width: 56ch;
}
.hero-typed-wrap .hero-typed-prefix {
  color: color-mix(in srgb, var(--theme-accent-current, #07C160) 85%, transparent);
  margin-right: 0.4em;
  font-weight: 400;
}
.hero-typed-wrap .hero-typed-cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  margin-left: 2px;
  background: color-mix(in srgb, var(--theme-accent-current, #07C160) 95%, transparent);
  vertical-align: -0.15em;
  animation: heroTypedBlink 1.05s steps(2, start) infinite;
  box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent-current, #07C160) 55%, transparent);
}
@keyframes heroTypedBlink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
@media (max-width: 768px) {
  .hero-typed-wrap { left: 16px; bottom: 18px; font-size: 13px; max-width: 70vw; }
}
`;

  const heroStyleTag = `<style id="hero-inline-css">\n${heroCss}\n</style>`;
  let content = data.replace('</head>', heroStyleTag + '\n</head>');

  // ═══════════════════════════════════════════════════════════════
  // typed 副标题 HTML（打字逻辑在下方 heroJs, 分阶段 setTimeout 控速）
  // ═══════════════════════════════════════════════════════════════
  const typedHtml = `
<div class="hero-typed-wrap" id="hero-typed-wrap">
  <span class="hero-typed-prefix">// </span><span class="hero-typed-text" id="hero-typed-text"></span><span class="hero-typed-cursor"></span>
</div>
`;

  const heroWrapped = `<div class="hero-shell">\n${heroSection}\n${typedHtml}\n</div>\n<div class="hero-fade" aria-hidden="true"><canvas class="hero-fade-ascii" id="heroFadeAscii"></canvas></div>`;

  content = content.replace(
    '</header>',
    '</header>\n\n' + heroWrapped + '\n'
  );

  // ═══════════════════════════════════════════════════════════════
  // v13 极简 JS：原生滚动 + scroll 监听切换 hero-released
  // 无 hijack, 无 RAF, 无 preventDefault
  // ═══════════════════════════════════════════════════════════════
  const heroJs = `
<script>
(function() {
  'use strict';
  var body = document.body;
  var vh = window.innerHeight;
  var released = false;

  // typed 副标题（分阶段 setTimeout: 打字 150ms/字, 停留 2.8s, 删除 70ms/字）
  // 文案池 90 条不重复, 每次访问洗牌随机播放, 一轮播完前不重复
  var lines = [
    '水满则溢,月盈则亏',
    '行到水穷处,坐看云起时',
    '欲穷千里目,更上一层楼',
    '人生若只如初见,何事秋风悲画扇',
    '山重水复疑无路,柳暗花明又一村',
    '海内存知己,天涯若比邻',
    '长风破浪会有时,直挂云帆济沧海',
    '会当凌绝顶,一览众山小',
    '天生我材必有用,千金散尽还复来',
    '仰天大笑出门去,我辈岂是蓬蒿人',
    '竹杖芒鞋轻胜马,一蓑烟雨任平生',
    '且将新火试新茶,诗酒趁年华',
    '人间有味是清欢',
    '一点浩然气,千里快哉风',
    '落霞与孤鹜齐飞,秋水共长天一色',
    '星垂平野阔,月涌大江流',
    '大漠孤烟直,长河落日圆',
    '春江潮水连海平,海上明月共潮生',
    '青山依旧在,几度夕阳红',
    '采菊东篱下,悠然见南山',
    '纸上得来终觉浅,绝知此事要躬行',
    '问渠那得清如许,为有源头活水来',
    '不畏浮云遮望眼,自缘身在最高层',
    '沉舟侧畔千帆过,病树前头万木春',
    '千淘万漉虽辛苦,吹尽狂沙始到金',
    '千磨万击还坚劲,任尔东西南北风',
    '不要人夸好颜色,只留清气满乾坤',
    '等闲识得东风面,万紫千红总是春',
    '沾衣欲湿杏花雨,吹面不寒杨柳风',
    '窗含西岭千秋雪,门泊东吴万里船',
    '劝君更尽一杯酒,西出阳关无故人',
    '桃花潭水深千尺,不及汪伦送我情',
    '孤帆远影碧空尽,唯见长江天际流',
    '明月松间照,清泉石上流',
    '人闲桂花落,夜静春山空',
    '夜来风雨声,花落知多少',
    '路漫漫其修远兮,吾将上下而求索',
    '莫愁前路无知己,天下谁人不识君',
    '读书不觉已春深,一寸光阴一寸金',
    '黑发不知勤学早,白首方悔读书迟',
    '少年易老学难成,一寸光阴不可轻',
    '梅须逊雪三分白,雪却输梅一段香',
    '小舟从此逝,江海寄余生',
    '此中有真意,欲辨已忘言',
    '古今多少事,都付笑谈中',
    '两个黄鹂鸣翠柳,一行白鹭上青天',
    '独在异乡为异客,每逢佳节倍思亲',
    '春眠不觉晓,处处闻啼鸟',
    '抽刀断水水更流,举杯消愁愁更愁',
    '三更灯火五更鸡,正是男儿读书时',
    '记录生活,分享思考',
    '生活不止眼前的代码,还有远方的诗和球场',
    '记录每一个灵光乍现的瞬间',
    '保持热爱,奔赴山海',
    '种一棵树最好的时间是十年前,其次是现在',
    '人生没有白走的路,每一步都算数',
    '愿你出走半生,归来仍是少年',
    '心之所向,素履以往',
    '生如逆旅,一苇以航',
    '凡是过往,皆为序章',
    '星光不问赶路人,时光不负有心人',
    '少年不惧岁月长,彼方尚有荣光在',
    '知足且坚定,温柔且上进',
    '把日子过成诗,把代码写成歌',
    '在代码与足球之间,找到生活的平衡',
    '凌晨的 bug 和清晨的球场,都是青春',
    '足球是圆的,一切皆有可能',
    '不到终场哨响,绝不轻言放弃',
    '每一个不曾起舞的日子,都是对生命的辜负',
    '慢慢来,比较快',
    '今天的 bug,是明天的经验',
    '先让它跑起来,再让它跑得好',
    '代码如诗,简洁即美',
    'Hola, mundo. 你好,世界',
    '¡Vamos! 加油!',
    'El fútbol es vida. 足球即生活',
    'Poco a poco, se va lejos. 慢慢来,走得远',
    '塞翁失马,焉知非福',
    '西语、代码、足球,三倍的快乐',
    '一天一行代码,一天一个单词',
    '把每一篇博客,都当作写给未来的信',
    '少年心事当拏云',
    '热爱可抵岁月漫长',
    '自律给我自由',
    '跑起来,就有风',
    '山高路远,看世界,也找自己',
    '风物长宜放眼量',
    '永远相信美好的事情即将发生'
  ];
  var el = document.getElementById('hero-typed-text');
  if (el) {
    // Fisher-Yates 洗牌: 每轮顺序随机且不重复
    for (var i = lines.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = lines[i]; lines[i] = lines[j]; lines[j] = tmp;
    }
    var li = 0, ci = 0;
    var TYPE_MS = 150, DELETE_MS = 70, HOLD_MS = 2800, GAP_MS = 600;
    function typeLine() {
      var line = lines[li % lines.length];
      if (ci <= line.length) {
        el.textContent = line.slice(0, ci);
        ci++;
        setTimeout(typeLine, TYPE_MS);
      } else {
        setTimeout(eraseLine, HOLD_MS);
      }
    }
    function eraseLine() {
      if (ci >= 0) {
        el.textContent = lines[li % lines.length].slice(0, ci);
        ci--;
        setTimeout(eraseLine, DELETE_MS);
      } else {
        li++;
        setTimeout(typeLine, GAP_MS);
      }
    }
    typeLine();
  }

  // ── hero-fade 动画延续层 v5（2026-07-23）──
  // 渐变 = 动画自身的延伸: 每帧取 hero canvas 底边一条像素带, 垂直翻转
  // 拉伸铺满渐变带(带顶 = 动画底边那一行, 逐列同像素, 接缝天然消失),
  // 再用「渐晕+噪声」destination-out 遮罩把条带向下溶解成碎尾。
  // 色彩衬底: 底边采样均色 → 动画夜色系 → --page-bg, 跟随 themechange。
  // 取样失败(context lost / 静态兜底图)自动退回静态图取样或纯程序渐变。
  (function initFadeExtend() {
    var fade = document.querySelector('.hero-fade');
    var cv = document.getElementById('heroFadeAscii');
    if (!fade || !cv) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var RAMP = ' .:-=+*#%@';           // 与 river-hero.js RAMP_ASCII 一致
    var CELL = 7;                      // css px / cell, 接近 hero 有效字号
    var FPS = 12;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 离屏: 延伸条带 / 溶解遮罩 / 取样探针
    var streakCv = document.createElement('canvas');
    var streakCx = streakCv.getContext('2d');
    var maskCv = document.createElement('canvas');
    var maskCx = maskCv.getContext('2d');
    var probeCv = document.createElement('canvas');
    probeCv.width = 32; probeCv.height = 1;
    var probeCx = probeCv.getContext('2d', { willReadFrequently: true });

    var W = 0, H = 0, dpr = 1, cols = 0, rows = 0;
    var seeds = null, phases = null;
    var stripAvg = [11, 18, 32];       // #0B1220 兜底
    var charColor = 'rgb(170,195,230)';
    var pageBg = '#ffffff';
    var running = false, inView = true, timer = null;

    function readPageBg() {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--page-bg');
      pageBg = (v && v.trim()) || '#ffffff';
      if (W && H) draw(performance.now());   // 主题切换后立即重绘
    }

    // 溶解遮罩: 顶部 25% 不擦(条带与动画严丝合缝), 中部渐擦, 底部全擦;
    // 叠加越往下越密的噪声点, 让尾巴碎成颗粒而不是一条干净的斜坡。
    function buildMask() {
      maskCv.width = W; maskCv.height = H;
      maskCx.clearRect(0, 0, W, H);
      var g = maskCx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0.00, 'rgba(0,0,0,0)');
      g.addColorStop(0.25, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.82, 'rgba(0,0,0,0.94)');
      g.addColorStop(1.00, 'rgba(0,0,0,1)');
      maskCx.fillStyle = g;
      maskCx.fillRect(0, 0, W, H);
      var n = Math.floor(W * H / 1100);
      for (var i = 0; i < n; i++) {
        var y = Math.pow(Math.random(), 0.55) * H;   // 分布偏下
        var a = Math.pow(y / H, 1.7) * 0.9;
        if (a < 0.06) continue;
        maskCx.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')';
        var s = (1 + Math.random() * 2.5) * dpr;
        maskCx.fillRect(Math.random() * W, y, s, s * (1 + Math.random()));
      }
    }

    // 在 hero 绘制的同一同步任务内取样(缓冲未被合成清除) →
    // 更新衬底均色 / 字符亮色 / 重画延伸条带。节流到 15fps。
    var lastHook = 0, lastStreak = 0;
    function ingestFrame(src, now) {
      if (!W || !H) return;                   // 尚未完成首次 resize
      var w = src && (src.naturalWidth || src.width);
      var h = src && (src.naturalHeight || src.height);
      if (!w || w < 8 || !h || h < 8) return;
      if (now - lastStreak < 66) return;
      lastStreak = now;
      var sh = Math.max(2, Math.round(h * 0.004));
      try {
        probeCx.clearRect(0, 0, 32, 1);
        probeCx.drawImage(src, 0, h - sh, w, sh, 0, 0, 32, 1);
        var d = probeCx.getImageData(0, 0, 32, 1).data;
        var i, aS = 0, rS = 0, gS = 0, bS = 0;
        for (i = 0; i < d.length; i += 4) { aS += d[i+3]; rS += d[i]; gS += d[i+1]; bS += d[i+2]; }
        if (aS / 32 < 40) return;             // 缓冲已销毁 → 透明, 丢弃本帧
        stripAvg = [rS / 32 | 0, gS / 32 | 0, bS / 32 | 0];
        var lum = (stripAvg[0] * 2 + stripAvg[1] * 3 + stripAvg[2]) / 6;
        var bc = 0, br = 0, bg = 0, bb = 0, l;
        for (i = 0; i < d.length; i += 4) {
          l = (d[i] * 2 + d[i+1] * 3 + d[i+2]) / 6;
          if (l > lum + 32) { br += d[i]; bg += d[i+1]; bb += d[i+2]; bc++; }
        }
        if (bc > 0) charColor = 'rgb(' + (br / bc | 0) + ',' + (bg / bc | 0) + ',' + (bb / bc | 0) + ')';
        // 重画延伸条带: 翻转拉伸, 带顶 = hero 底边那一行
        streakCx.globalCompositeOperation = 'source-over';
        streakCx.clearRect(0, 0, W, H);
        streakCx.save();
        streakCx.translate(0, H);
        streakCx.scale(1, -1);
        streakCx.drawImage(src, 0, h - sh, w, sh, 0, 0, W, H);
        streakCx.restore();
        streakCx.globalCompositeOperation = 'destination-out';
        streakCx.drawImage(maskCv, 0, 0);
        streakCx.globalCompositeOperation = 'source-over';
      } catch (e) { /* 保持上一帧 */ }
    }
    // river-hero.js 每帧绘制后回调(同一任务, 缓冲保证有效)
    window.__heroFrameHook = function (src) {
      lastHook = performance.now();
      ingestFrame(src, lastHook);
    };

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      // 挂钩沉默 >800ms 且静态兜底图在播 → 改从 <img> 取样(context lost 场景)
      if (now - lastHook > 800) {
        var img = document.getElementById('heroStill');
        if (img && img.classList.contains('is-shown')) ingestFrame(img, now);
      }
      // 1. 色彩衬底: 采样均色 → 动画夜色系 → page-bg
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0.00, 'rgb(' + stripAvg[0] + ',' + stripAvg[1] + ',' + stripAvg[2] + ')');
      g.addColorStop(0.30, '#101E38');
      g.addColorStop(0.52, '#1B3566');
      g.addColorStop(0.74, '#46608E');
      g.addColorStop(0.88, '#8BA7C6');
      g.addColorStop(1.00, pageBg);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // 2. 动画延伸条带(由挂钩/兜底取样维护)
      ctx.drawImage(streakCv, 0, 0);
      // 3. 稀疏字符闪烁(与动画同款 ramp, 限制在顶部 55% 内衰减)
      var t = now / 1000, step = CELL * dpr;
      ctx.fillStyle = charColor;
      for (var r = 0; r < rows; r++) {
        var density = 0.16 * Math.pow(Math.max(0, 1 - r / (rows * 0.55)), 1.4);
        if (density < 0.015) break;
        for (var c = 0; c < cols; c++) {
          var i = r * cols + c;
          var sd = seeds[i];
          if (sd >= density) continue;
          var edge = 1 - sd / density;
          var tw = 0.6 + 0.4 * Math.sin(t * (0.5 + sd * 1.5) + phases[i]);
          var alpha = edge * tw * 0.8;
          if (alpha < 0.04) continue;
          var gi = 1 + (Math.floor(sd * 977 + t * (0.2 + sd * 0.6)) % (RAMP.length - 1));
          ctx.globalAlpha = alpha;
          ctx.fillText(RAMP.charAt(gi), (c + 0.5) * step, (r + 0.55) * step);
        }
      }
      ctx.globalAlpha = 1;
    }

    function resize() {
      var w = fade.clientWidth, h = fade.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.round(w * dpr); H = Math.round(h * dpr);
      cv.width = W; cv.height = H;
      streakCv.width = W; streakCv.height = H;
      cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
      seeds = new Float32Array(cols * rows);
      phases = new Float32Array(cols * rows);
      for (var i = 0; i < seeds.length; i++) {
        seeds[i] = Math.random();
        phases[i] = Math.random() * 6.2832;
      }
      ctx.font = (CELL * dpr) + 'px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      buildMask();
      draw(performance.now());
    }

    function loop(now) {
      if (!running) return;
      draw(now);
      timer = setTimeout(function () { requestAnimationFrame(loop); }, 1000 / FPS);
    }
    function start() {
      if (running || reduced || !inView || document.hidden) return;
      running = true;
      requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
    }

    readPageBg();
    window.addEventListener('themechange', readPageBg);   // theme-system.js 派发自 window
    resize();
    if (reduced) return;                 // 减少动态: 只留静态一帧

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) start(); else stop();
      }).observe(fade);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    var rsTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(resize, 200);
    }, { passive: true });

    start();
  })();

  // scroll 监听：scrollY >= vh（hero 完全滚出视口）→ released
  // 修复：原 0.5vh 触发太早，hero display:none 后 main 还没到 viewport 顶部，
  // 中间露出 body 白色背景。改为 hero 完全滚出才释放，并用 body 深蓝兜底。
  function onScroll() {
    var sy = window.scrollY;
    if (!released && sy >= vh) {
      released = true;
      body.classList.add('hero-released');
      // 通知 hero shader 冻结
      window.dispatchEvent(new Event('hero-frozen'));
    } else if (released && sy < 50) {
      released = false;
      body.classList.remove('hero-released');
      // 通知 hero shader 恢复
      window.dispatchEvent(new Event('hero-unfrozen'));
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function() {
    vh = window.innerHeight;
  }, { passive: true });
})();
</script>
`;

  const scriptMatch = heroSrc.match(/<script src="river-hero\.js"[^>]*><\/script>/);
  const heroScriptTag = scriptMatch ? scriptMatch[0].replace('src="river-hero.js"', 'src="/hero/river-hero.js?v=14"') : '';

  const afterScriptIdx = heroSrc.indexOf(heroScriptTag) + heroScriptTag.length;
  const inlineScriptMatch = heroSrc.slice(afterScriptIdx).match(/<script>[\s\S]*?<\/script>/);
  const heroInitScript = inlineScriptMatch ? inlineScriptMatch[0] : '';

  const heroScripts = heroScriptTag + '\n' + heroInitScript + heroJs;
  content = content.replace('</body>', heroScripts + '\n</body>');

  // mobile sidebar fix
  const sidebarFix = `
<script>
(function () {
  function bindMobileSidebar() {
    var toggleMenu = document.getElementById('toggle-menu');
    var sidebar = document.getElementById('sidebar-menus');
    var menuMask = document.getElementById('menu-mask');
    if (!toggleMenu || !sidebar) return;
    if (toggleMenu.dataset.heroFixed) return;
    toggleMenu.dataset.heroFixed = '1';
    toggleMenu.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.add('open');
      if (menuMask) {
        menuMask.style.cssText = 'display:block;animation:to_show 0.5s';
      }
      document.body.style.overflow = 'hidden';
    });
    if (menuMask) {
      menuMask.addEventListener('click', function () {
        sidebar.classList.remove('open');
        menuMask.style.cssText = 'animation:to_hide 0.5s';
        setTimeout(function () { menuMask.style.cssText = ''; }, 500);
        document.body.style.overflow = '';
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMobileSidebar);
  } else {
    bindMobileSidebar();
  }
  setTimeout(bindMobileSidebar, 500);
})();
</script>
`;
  content = content.replace('</body>', sidebarFix + '\n</body>');

  // 给 body 加 class hero-page-active
  content = content.replace(
    /<body([^>]*)>/,
    '<body$1 class="hero-page-active">'
  );

  hexo.log.info('[hero-inject] ✅ v13 单 pipeline + 原生滚动: ' + canonical);
  return content;
});

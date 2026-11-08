# Hero 渐变带 v8 —— 桥接交叉淡化(把过渡做进 hero 动画内部)

> 执行方式:新对话里说「按 docs/plans/hero-fade-v8-bridge-plan.md 执行」。
> 本计划自包含,不需要上一对话的任何上下文。

## 背景与目标

Hexo 7 + Butterfly 博客(本仓库根目录)。首页 hero = 100dvh WebGL ASCII 河流 shader
(`source/hero/river-hero.js`,构建时由 `scripts/hero-inject.js` 注入首页),hero 下方
是白色内容区。两者之间目前靠 `.hero-fade` 渐变带衔接(实现全部在 `scripts/hero-inject.js`)。

**问题**:用户肉眼在交界处始终能看到一条分界线(刚刷新时最明显,完全加载后变淡但仍可辨)。
截图里几乎看不出,但人眼对 1-2 级色阶的水平直线很敏感。目标:让过渡在结构上没有硬边,
视觉上就是 hero 动画自身的收尾。

favicon 任务已完成(`scripts-py/gen_favicon.py` + `_config.butterfly.yml`),不要重做。

## 现状架构(v7,已部署,不要回退)

- `.hero-shell`(100dvh,内含 placeholder/canvas/still)下面紧跟兄弟元素 `.hero-fade`
  (高 clamp(240px,32vh,420px),内含 2D canvas `#heroFadeAscii`)。
- `river-hero.js` 每帧绘制后同步回调 `window.__heroFrameHook(canvas)`;
  `hero-inject.js` 的 `initFadeExtend()` 在回调里以 66ms 节流取样 canvas 底边 mh 行
  (`mh = round((H/dpr) * (h/ch))`,h=buffer 行数,ch=canvas.clientHeight),
  **垂直翻转**铺满渐变带(带顶 = 动画底边那一行),再用 S 曲线 destination-out 遮罩
  溶解成碎尾;衬底 = 底边暗部 45 分位色 → 夜色系 → `--page-bg` 的 smoothstep 48 级渐变;
  另有白色细颗粒防 banding、稀疏 ASCII 字符闪烁。
- 取样失败兜底:hero canvas/still/placeholder 底部 22% `mask-image` 羽化到
  `section.hero` 底色 #0B1220;首次取样成功给 body 加 `hero-fade-live` 摘除羽化。

## 根因(为什么 v7 仍有一条线)

带子在画布**下面**,两个独立渲染面在一条水平硬边相接,所有误差都挤在那一行上:

1. **重采样滤波不同**:canvas buffer(如 438 行)由合成器放大到显示高(674px);
   带顶镜像是 drawImage 拉伸同一批行。两种滤波结果差 1-2 级 → 接边一条细线。
2. **合成底色不同**:canvas 以 opacity 0.95 垫在 placeholder(径向渐变,局部偏亮偏青)上;
   镜像垫在平坦 #15397A 上 → 底边行与带顶行系统性色差。
3. **取样延迟**:66ms 节流,场景快速变化时(intro 裸星野→山谷凝结、90s 日夜循环)
   带顶是过期帧。
4. **刷新 <1s 瞬态**:placeholder(平滑渐变)还在显示时带子可能已取到星野帧,
   上面平滑、下面星野 → 硬线(用户最新截图即此状态)。

## v8 方案:桥接交叉淡化(bridge crossfade)

核心:**把渐变的起点挪进 hero 画布内部**。镜像不再从画布底边才开始,而是从底边
**上方** OV px 处就以 alpha 0→1 渐入,与画布本身交叉淡化;画布底边以下继续镜面延伸。
整条链路上不存在任何"两个面的硬接边":

```
hero-shell (100dvh)
 ┌─────────────────────────┐
 │  hero canvas (WebGL)    │
 │  ┄┄┄┄┄ 桥接层顶 ┄┄┄┄┄ │ ← 镜像 alpha=0,显示纯画布
 │  [桥接 canvas: 镜像渐入] │ ← OV px 交叉淡化区(z-index 1,文字层 z3/z5 之下)
 │  ┄┄┄ 画布底边 ┄┄┄┄┄ │ ← 镜像 alpha=1,内容=画布底边行,像素级连续
 └─────────────────────────┘
 .hero-fade (240~420px)
 │  镜像(垂直翻转延伸)     │ ← 与桥接层来自同一离屏 strip,行间连续
 │  S 曲线遮罩溶解成碎尾     │
 │  夜色渐变 → --page-bg    │
```

离屏 strip 高 Hb+H(设备 px),一次取样画出**两段**:

- **桥接段** strip 行 [0,Hb):canvas buffer 行 [h-ovs,h) **不翻转**原样续接
  (`ovs = round((Hb/dpr)*(h/ch))`),再以 destination-in 纵向 alpha 0→1 渐变做渐入;
- **延伸段** strip 行 [Hb,Hb+H):canvas 行 [h-mh,h) **垂直翻转**(同 v7),
  再 destination-out 现有的 S 曲线溶解遮罩(画在偏移 (0,Hb) 处)。

两段在 strip 行 Hb 处都 = canvas 底边行 h-1,天然连续。桥接 canvas 只取 strip [0,Hb),
带 canvas 只取 strip [Hb,Hb+H)。

桥接层只交叉淡化,对内容差完全容差(重采样差、透明度合成差、过期帧、placeholder
瞬态全被 OV px 的渐变吸收)。OV 取带高的 28%,clamp(56px, 110px)。

取样链断掉时桥接层为空(透明不可见),自动退回 v7 的羽化兜底路径,行为不变。

附带修改:颗粒层改**亮度自适应双色抖动**——现有白色微粒(70% 以下归零)保留,
另加深色微粒(rgba(8,12,22),从带高 55% 处渐入,alpha≤0.03,密度 W*H/1400),
消除亮尾(#8BA7C6→白)在部分显示器上的 banding 横线。

## 精确修改步骤(全部在 `scripts/hero-inject.js`)

先通读该文件 90-150 行(CSS)、385-400 行(heroWrapped)、543-830 行(initFadeExtend)
再动手。共 5 个编辑点:

### 1. heroWrapped 注入桥接 canvas(约 393 行)

在 `${heroSection}` 与 `${typedHtml}` 之间插入:

```js
const heroWrapped = `<div class="hero-shell">\n${heroSection}\n<canvas class="hero-fade-bridge" id="heroFadeBridge" aria-hidden="true"></canvas>\n${typedHtml}\n</div>\n<div class="hero-fade" ...`;
```

z-index 说明:section.hero 是 position:relative + z-index auto(不建层叠上下文),
其子元素 vignette z1 / hero-text z3 / typed z5 与桥接层同处 shell 层叠上下文。
桥接层 z-index 1 → 在 canvas/placeholder/still(z0)之上、文字(z3/z5)之下。✓

### 2. CSS 新增(.hero-fade 规则附近)

```css
/* 桥接层:hero 画布底部 OV px 交叉淡化区(v8)。仅在取样成功(hero-fade-live)
   后出现;取样链断掉时保持透明不可见,退回羽化兜底。高度由 JS 按带高 28% 内联设置。 */
.hero-shell canvas.hero-fade-bridge {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  width: 100%;
  height: 80px;              /* 兜底值,JS resize 会覆盖 */
  z-index: 1;
  pointer-events: none;
  display: block;
  opacity: 0;
}
body.hero-fade-live .hero-shell canvas.hero-fade-bridge { opacity: 1; }
```

### 3. initFadeExtend 内改造

- 顶部取桥接元素:`var bcv = document.getElementById('heroFadeBridge'); var bcx = bcv && bcv.getContext('2d');`
  若任一为空则整个 initFadeExtend return(与现有 cv/ctx 检查并列)。
- 新增全局量:`var Hb = 0;`(桥接段设备高)。`streakCv` 语义改为 strip(高 Hb+H),可改名
  stripCv/stripCx 并同步改注释(也可不改名,只改逻辑与注释)。
- `resize()` 内:
  ```js
  var OV = Math.max(56, Math.min(110, Math.round(h * 0.28))); // h = fade.clientHeight
  bcv.style.height = OV + 'px';
  Hb = Math.round(OV * dpr);
  bcv.width = W; bcv.height = Hb;
  streakCv.width = W; streakCv.height = Hb + H;   // strip = 桥接段 + 延伸段
  ```
  (maskCv/grainCv 尺寸不变,仍 W×H。)
- `ingestFrame()` 重画 strip 部分,替换现有「streakCx 填充+翻转 drawImage+destination-out」块:
  ```js
  var ch = src.clientHeight || 0;
  var scale = ch > 0 ? (h / ch) : 0;
  var mh = scale > 0 ? Math.round((H / dpr) * scale) : Math.round(h * 0.27);
  var ovs = scale > 0 ? Math.round((Hb / dpr) * scale) : 0;
  mh = Math.max(8, Math.min(h, mh));
  ovs = Math.max(0, Math.min(h - mh, ovs));
  stripCx.globalCompositeOperation = 'source-over';
  stripCx.globalAlpha = 1;
  stripCx.clearRect(0, 0, W, Hb + H);
  stripCx.fillStyle = '#15397A';                 // 与 canvas 0.95 垫色一致的合成基
  stripCx.fillRect(0, 0, W, Hb + H);
  stripCx.globalAlpha = 0.95;
  // 桥接段:底边以上 ovs 行,不翻转原样续接(strip 行 Hb-1 = buffer 行 h-1)
  if (ovs > 0) stripCx.drawImage(src, 0, h - ovs, w, ovs, 0, 0, W, Hb);
  // 延伸段:底边 mh 行垂直翻转(strip 行 Hb = buffer 行 h-1,与桥接段连续)
  stripCx.save();
  stripCx.translate(0, Hb + H);
  stripCx.scale(1, -1);
  stripCx.drawImage(src, 0, h - mh, w, mh, 0, 0, W, H);
  stripCx.restore();
  stripCx.globalAlpha = 1;
  // 溶解遮罩只作用于延伸段
  stripCx.globalCompositeOperation = 'destination-out';
  stripCx.drawImage(maskCv, 0, Hb);
  // 桥接段 alpha 0→1 渐入(与画布交叉淡化,吸收一切接边差)
  stripCx.globalCompositeOperation = 'destination-in';
  var bg = stripCx.createLinearGradient(0, 0, 0, Hb);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(0.55, 'rgba(0,0,0,0.72)');
  bg.addColorStop(1, 'rgba(0,0,0,1)');
  stripCx.fillStyle = bg;
  stripCx.fillRect(0, 0, W, Hb);
  stripCx.globalCompositeOperation = 'source-over';
  // 桥接 canvas = strip 顶部
  bcx.clearRect(0, 0, W, Hb);
  bcx.drawImage(streakCv, 0, 0, W, Hb, 0, 0, W, Hb);
  ```
  注意 `ingestFrame` 早退条件 `if (!W || !H) return;` 要加 `|| !Hb`(首次 resize 前不画)。
- `draw()` 里延伸条的取源改为带偏移:
  `ctx.drawImage(streakCv, 0, Hb, W, H, 0, 0, W, H);`
- `hero-fade-live` 置位逻辑不变(首次取样成功 → 摘羽化 + 桥接层经 CSS 出现)。

### 4. buildGrain 增加深色微粒(在现有白色微粒循环后追加)

```js
var n2 = Math.floor(W * H / 1400);
for (i = 0; i < n2; i++) {
  var y2 = H * (0.55 + Math.random() * 0.45);
  var a2 = Math.pow((y2 / H - 0.55) / 0.45, 1.3) * (0.012 + Math.random() * 0.022);
  if (a2 < 0.008) continue;
  grainCx.fillStyle = 'rgba(8,12,22,' + a2.toFixed(3) + ')';
  grainCx.fillRect(Math.random() * W, y2, dpr, dpr);
}
```

### 5. 注释/文档

- initFadeExtend 头部注释改为 v8 简述(桥接交叉淡化 + strip 两段式 + 双色抖动)。
- 构建验证通过后,更新 `AGENTS.md` 的 `hero-inject.js` 条目:v7→v8,
  要点 = 桥接层在 hero 内部交叉淡化、strip 两段(不翻转续接+翻转延伸)、
  双色抖动;保留「羽化兜底」「#0B1220 底色」「__heroFrameHook 同步取样」等既有红线。

## 红线(勿动)

- 不改 `source/hero/river-hero.js`(取样时机依赖它每帧同步回调 `__heroFrameHook`;
  外部 rAF/定时器取样 WebGL 缓冲会得到纯黑帧)。
- `section.hero` 底色保持 #0B1220;placeholder 基色 #15397A 合成逻辑保持。
- v7 的 smoothstep 48 级色彩路径、S 曲线遮罩、字符闪烁全部保留。
- `_reference/football-daily-v1.js` 勿移回 `scripts/`。

## 验证清单

1. `npx hexo generate` 无报错。
2. `node serve.js`(后台,4000 端口),Playwright MCP 打开 `http://localhost:4000/`:
   - 导航后**立刻**截图(模拟刚刷新)与 5s 后截图:hero 底边交界无可见直线;
     用 ReadMediaFile 的 region 参数放大裁切交界处(hero 底边上下各 150px)检查。
   - 控制台执行 `riverFreezeHero()` 后等 2s 截图:冻结态(静态日出图)交界同样无直线。
   - 向下滚动超过一屏再滚回顶部,交界仍正常。
   - console 无 error。
3. 若本地截图判断不了「人眼是否可见」,以架构正确性为准:全链路不存在两个渲染面的
   硬接边即达标,并在回复中如实说明这一点。

## 提交

- 用户已授权:改完自动 commit + push(中文、conventional commits,如
  `feat(hero): 渐变带 v8 桥接交叉淡化,过渡并入 hero 内部`)。
- push 前若被拒(远端有日报自动提交),先 `git pull --no-edit` 再 push。
- 只 add 改动文件,勿提交 `.playwright-mcp/`、`.workbuddy/`、临时截图等杂物。

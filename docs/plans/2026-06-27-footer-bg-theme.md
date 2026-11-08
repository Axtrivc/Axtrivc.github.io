# Footer Background Theme Adaptation Implementation Plan

> **For implementer (M3):** Use TDD throughout. After each task, commit + push automatically per memory rule. No push limits from GLM.

**Goal:** Make the hardcoded warm-brown footer background (`#faf8f5` / `#efe8dc` / `#e8d9c0` / `#d4bc96`) follow the 5 theme system, WITHOUT changing layout, structure, or any non-color CSS property.

**Architecture:** Add 4 new CSS variables (`--footer-bg`, `--footer-river-top`, `--footer-river-mid`, `--footer-river-bottom`) to each of the 5 theme definitions in `theme-system.js`. `applyTheme()` sets them on `document.documentElement`. `footer-river-inject.js` replaces the 4 hardcoded hex with `var(--footer-...)` calls. Layout/padding/margin/height stay byte-identical to baseline `7fda3720`.

**Tech Stack:** Vanilla JS (no framework), Hexo `after_render:html` filter injection, CSS custom properties.

**Out of Scope (CRITICAL):**
- ❌ Do NOT change footer height (120px desktop, 90px mobile)
- ❌ Do NOT change padding/margin (footer padding-bottom=0, footer-other padding-top=16px)
- ❌ Do NOT add SVG curves, border-radius, or any new HTML elements
- ❌ Do NOT unify body+footer into one color
- ❌ Do NOT add gradients between body and footer
- ❌ Do NOT touch `axtrivc-river.js` (water wave canvas colors already done in `7fda3720`)
- ❌ Do NOT touch `river-hero.js` (hero WebGL shader)
- ✅ ONLY swap hardcoded hex color values for CSS variables

**Baseline commit:** `7fda3720` (feat(river): footer waves adapt to all 5 themes)

---

## Task 1: Add 4 footer color fields to each theme definition

**Files:**
- Modify: `source/js/theme-system.js`

**Step 1: Add fields to each theme in THEME_STYLES**

For each of the 5 themes in `THEME_STYLES` (wechat-classic / lake-blue / haze-blue / beige-lite / lemon-indigo), add these 4 new fields at the end of the theme object (after the last existing field, before the closing `}`):

```js
// Example for wechat-classic (accent=#07C160, bg=#FFFFFF):
footerBg: '#F2FBF5',
footerRiverTop: '#E8F5EC',
footerRiverMid: '#C8E8D3',
footerRiverBottom: '#9CD8B2',
```

**Exact values for all 5 themes** (paste these after each theme's last field):

```js
// wechat-classic (after navTextHover: '#07C160')
footerBg: '#F2FBF5',
footerRiverTop: '#E8F5EC', footerRiverMid: '#C8E8D3', footerRiverBottom: '#9CD8B2',

// lake-blue (after navTextHover: '#10AEFF')
footerBg: '#E6F5FF',
footerRiverTop: '#D4EBFB', footerRiverMid: '#A8D8F5', footerRiverBottom: '#76BFEB',

// haze-blue (after navTextHover: '#4A5568')
footerBg: '#F0F2F5',
footerRiverTop: '#E2E6EC', footerRiverMid: '#C8D0DA', footerRiverBottom: '#A5B0BF',

// beige-lite (after navTextHover: '#8B6F47')
footerBg: '#FAF8F5',
footerRiverTop: '#EFE8DC', footerRiverMid: '#E8D9C0', footerRiverBottom: '#D4BC96',

// lemon-indigo (after navTextHover: '#B45309')
footerBg: '#F6F8FE',
footerRiverTop: '#E8EEFD', footerRiverMid: '#C7D2FE', footerRiverBottom: '#A5B8F0',
```

**Note:** `beige-lite` values are the SAME as the original hardcoded colors (intentional — beige is the default theme, its footer shouldn't change).

**Step 2: Syntax check**
Command: `node --check source/js/theme-system.js`
Expected: no output (success)

**Step 3: Commit**
`git add source/js/theme-system.js && git commit -m "feat(theme): add footerBg + footerRiver{Top,Mid,Bottom} to 5 theme definitions"`

---

## Task 2: Set the 4 CSS variables in applyTheme()

**Files:**
- Modify: `source/js/theme-system.js`

**Step 1: Add setProperty calls**

Find this block (around L184-186, right before the `window.dispatchEvent(new CustomEvent('themechange'...` line):

```js
document.documentElement.style.setProperty('--theme-card-current', t.card);
document.documentElement.style.setProperty('--theme-body-current', t.body);
```

Add 4 lines immediately after `--theme-body-current` (before `themechange` dispatch):

```js
    if (t.footerBg)        document.documentElement.style.setProperty('--footer-bg', t.footerBg);
    if (t.footerRiverTop)    document.documentElement.style.setProperty('--footer-river-top', t.footerRiverTop);
    if (t.footerRiverMid)    document.documentElement.style.setProperty('--footer-river-mid', t.footerRiverMid);
    if (t.footerRiverBottom) document.documentElement.style.setProperty('--footer-river-bottom', t.footerRiverBottom);
```

**Step 2: Syntax check**
Command: `node --check source/js/theme-system.js`
Expected: no output (success)

**Step 3: Commit**
`git add source/js/theme-system.js && git commit -m "feat(theme): applyTheme sets 4 footer CSS variables on documentElement"`

---

## Task 3: Replace hardcoded hex in footer-river-inject.js with CSS variables

**Files:**
- Modify: `scripts/footer-river-inject.js`

**Step 1: Replace 4 hardcoded color values with CSS var()**

Find the `#footer` block (around L34-38):
```js
#footer {
  background-color: #faf8f5 !important;
  ...
}
```
Change `background-color: #faf8f5` → `background-color: var(--footer-bg, #faf8f5)`

Find the `.axtrivc-river-stage` `background:` rule (around L53-56):
```js
background: linear-gradient(180deg, #efe8dc 0%, #e8d9c0 40%, #d4bc96 100%);
```
Change to:
```js
background: linear-gradient(180deg,
  var(--footer-river-top, #efe8dc) 0%,
  var(--footer-river-mid, #e8d9c0) 40%,
  var(--footer-river-bottom, #d4bc96) 100%);
```

Find the `html` / `body` bg兜底 block (around L116-121):
```js
html { background-color: #faf8f5 !important; }
body { background-color: #faf8f5 !important; }
```
Change both `#faf8f5` → `var(--footer-bg, #faf8f5)`

**Important:** Do NOT change ANY other line. No padding, no margin, no height, no border-radius, no SVG, no new elements. ONLY the 5 hex values (`#faf8f5` × 3, `#efe8dc`, `#e8d9c0`, `#d4bc96`) → CSS variables.

**Step 2: Syntax check**
Command: `node --check scripts/footer-river-inject.js`
Expected: no output (success)

**Step 3: Verify ONLY 5 lines changed**
Command: `git diff scripts/footer-river-inject.js | grep '^[-+]' | grep -v '^[-+][-+]' | wc -l`
Expected: 10 (5 removed + 5 added)

**Step 4: Commit**
`git add scripts/footer-river-inject.js && git commit -m "feat(footer): replace 5 hardcoded hex with CSS variables for theme adaptation"`

---

## Verification Checklist

- [ ] All 3 tasks have exact file paths
- [ ] All code blocks are paste-and-run ready (no placeholders)
- [ ] Each task has `node --check` syntax verification command
- [ ] Task 3 has explicit "only 5 lines changed" guard
- [ ] Out of scope section explicitly forbids layout/structure/SVG changes
- [ ] `beige-lite` values match original hardcoded colors (backward compat)
- [ ] Each theme's footerRiver{Top,Mid,Bottom} are perceptually distinct (visible color shift when switching themes)

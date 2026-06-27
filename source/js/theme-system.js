/* ============================================================
   Axtrivc's Blog — Theme System v7
   Direct DOM manipulation — applies IMMEDIATELY on load
   ============================================================ */
(function () {
  'use strict';

  // ---- Constants ----
  var STORAGE_KEY_THEME = 'axtrivc_theme_v2';

  // ---- Theme Definitions ----
  var THEME_STYLES = {
    // === 新增方案 A：微信经典绿白（绿茵足球风） ===
    'wechat-classic': {
      name: 'WeChat Green',
      colors: ['#FFFFFF', '#07C160', '#FA5151', '#F7F7F7', '#191919', '#7A7A7A'],
      bg: '#FFFFFF', body: '#FFFFFF', nav: 'rgba(255,255,255,0.96)', card: '#FFFFFF',
      text: '#191919', heading: '#0A3D2A', secondary: '#7A7A7A', accent: '#07C160',
      border: '#EDEDED', pageHeader: '#FFFFFF', navText: '#191919', navTextHover: '#07C160',
      footerBg: '#F2FBF5',
      footerRiverTop: '#E8F5EC', footerRiverMid: '#C8E8D3', footerRiverBottom: '#9CD8B2',
      footerHint: 'rgba(7, 140, 90, 0.65)', footerText: 'rgba(10, 61, 42, 0.5)'
    },
    // === 新增方案 B：清晨湖蓝（年轻活力） ===
    'lake-blue': {
      name: 'Lake Blue',
      colors: ['#F4FBFF', '#10AEFF', '#FF976A', '#FFFFFF', '#0C447C', '#5A9EC9'],
      bg: '#F4FBFF', body: '#F4FBFF', nav: 'rgba(244,251,255,0.95)', card: '#FFFFFF',
      text: '#191919', heading: '#0C447C', secondary: '#5A9EC9', accent: '#10AEFF',
      border: 'rgba(16,174,255,0.18)', pageHeader: '#E6F5FF', navText: '#0C447C', navTextHover: '#10AEFF',
      footerBg: '#E6F5FF',
      footerRiverTop: '#D4EBFB', footerRiverMid: '#A8D8F5', footerRiverBottom: '#76BFEB',
      footerHint: 'rgba(12, 68, 124, 0.6)', footerText: 'rgba(12, 68, 124, 0.5)'
    },
    // === 新增方案 C：雾霾蓝灰（沉稳） ===
    'haze-blue': {
      name: 'Haze Blue',
      colors: ['#FAFBFC', '#4A5568', '#B85C5C', '#FFFFFF', '#2D3748', '#718096'],
      bg: '#FAFBFC', body: '#FAFBFC', nav: 'rgba(250,251,252,0.95)', card: '#FFFFFF',
      text: '#2D3748', heading: '#2D3748', secondary: '#718096', accent: '#4A5568',
      border: '#EAECEF', pageHeader: '#F0F2F5', navText: '#2D3748', navTextHover: '#4A5568',
      footerBg: '#F0F2F5',
      footerRiverTop: '#E2E6EC', footerRiverMid: '#C8D0DA', footerRiverBottom: '#A5B0BF',
      footerHint: 'rgba(45, 55, 72, 0.6)', footerText: 'rgba(45, 55, 72, 0.5)'
    },
    // === 新增方案 D：米色升级版（扁平化米色） ===
    'beige-lite': {
      name: 'Beige Lite',
      colors: ['#FFFCF5', '#8B6F47', '#C4A96A', '#FFFFFF', '#3A2A1A', '#9A8866'],
      bg: '#FFFCF5', body: '#FFFCF5', nav: 'rgba(255,252,245,0.96)', card: '#FFFFFF',
      text: '#3A2A1A', heading: '#3A2A1A', secondary: '#9A8866', accent: '#8B6F47',
      border: '#EFE8DA', pageHeader: '#FFFCF5', navText: '#3A2A1A', navTextHover: '#8B6F47',
      footerBg: '#FAF8F5',
      footerRiverTop: '#EFE8DC', footerRiverMid: '#E8D9C0', footerRiverBottom: '#D4BC96',
      footerHint: 'rgba(120, 90, 55, 0.65)', footerText: 'rgba(70, 50, 25, 0.5)'
    },
    // === 新增方案 E：柠檬黄 + 深靛蓝（极简时尚撞色） ===
    'lemon-indigo': {
      name: 'Lemon Indigo',
      colors: ['#FFFFFF', '#1E3A8A', '#F5C518', '#FAFAFA', '#1E3A8A', '#4A5568'],
      bg: '#FAFAFA', body: '#FAFAFA', nav: 'rgba(255,255,255,0.97)', card: '#FFFFFF',
      text: '#1E3A8A', heading: '#1E3A8A', secondary: '#4A5568', accent: '#F5C518',
      border: '#C7D2FE', pageHeader: '#FFFFFF', navText: '#1E3A8A', navTextHover: '#B45309',
      footerBg: '#F6F8FE',
      footerRiverTop: '#E8EEFD', footerRiverMid: '#C7D2FE', footerRiverBottom: '#A5B8F0',
      footerHint: 'rgba(30, 58, 138, 0.6)', footerText: 'rgba(30, 58, 138, 0.5)'
    }
  };

  // Current state — DEFAULT to WeChat Green
  var currentTheme = 'wechat-classic';
  try {
    currentTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'wechat-classic';
  } catch (e) { /* Safari 隐私模式或禁用存储时降级到默认 */ }

  // ================================================================
  // APPLY THEME — called immediately on load AND on user selection
  // ================================================================
  function applyTheme(themeId) {
    var t = THEME_STYLES[themeId];
    if (!t) return;

    // CRITICAL: #web_bg overrides Butterfly's hardcoded background
    var webBg = document.getElementById('web_bg');
    if (webBg) {
      webBg.style.backgroundColor = t.bg;
      webBg.style.transition = 'background-color 0.45s ease';
    }

    // html + body background
    document.documentElement.style.backgroundColor = t.bg;
    document.body.style.backgroundColor = t.body;
    document.body.style.color = t.text;

    // 注入主题色到 CSS 变量，让副标题/FAB按钮等跟随主题
    document.documentElement.style.setProperty('--theme-accent', t.accent);
    document.documentElement.style.setProperty('--theme-text', t.text);
    document.documentElement.style.setProperty('--theme-heading', t.heading);

    // Navigation bar
    var nav = document.getElementById('nav');
    if (nav) { nav.style.background = t.nav; }

    // Nav menu items text color
    var navLinks = document.querySelectorAll('#menus .menus_item a, #nav a.site-page, .menus_items a');
    navLinks.forEach(function(link) { link.style.color = t.navText || t.text; });

    // Nav hover style injection
    var styleNavHover = document.getElementById('theme-nav-hover-style');
    if (!styleNavHover) {
      styleNavHover = document.createElement('style');
      styleNavHover.id = 'theme-nav-hover-style';
      document.head.appendChild(styleNavHover);
    }
    styleNavHover.textContent =
      '#menus .menus_item a:hover, #nav a.site-page:hover, .menus_items a:hover { color: ' + (t.navTextHover || t.accent) + ' !important; }';

    // Site title
    var siteTitle = document.querySelector('#site-title, #site-name, .site-name a');
    if (siteTitle) { siteTitle.style.color = t.heading; }

    // Page header / hero — 加 inline style 防止 hexo-butterfly 默认棕色盖过
    var pageHeader = document.getElementById('page-header');
    if (pageHeader) {
      pageHeader.style.backgroundColor = 'transparent';
      pageHeader.style.backgroundImage = 'none';
      var phBefore = pageHeader.querySelector(':scope::before');
    }

    // Article cards
    document.querySelectorAll('.recent-post-item').forEach(function(c) {
      c.style.backgroundColor = t.card;
      c.style.borderColor = t.border;
    });

    // Sidebar widgets
    document.querySelectorAll('.card-widget').forEach(function(w) {
      w.style.backgroundColor = t.card;
      w.style.borderColor = t.border;
    });

    // Headings
    document.querySelectorAll('.article-title, .site-name, #site-title, .item-headline').forEach(function(h) {
      h.style.color = t.heading;
    });

    // Secondary text (but NOT footer background — handled below)
    document.querySelectorAll('.article-meta-wrap, .article-meta-label, .post-meta-date, time, .aside-list-item .content time').forEach(function(s) {
      s.style.color = t.secondary;
    });

    // Accent links
    document.querySelectorAll('.recent-post-info a.article-title, .aside-list-item .content .title a, #pagination a').forEach(function(l) {
      l.style.color = t.accent;
    });

    // ---- Elements that were previously missed ----

    // Footer: 走 CSS !important 规则（theme-system.css 已统一处理），这里不再设内联 style

    // Pagination: current/active page number + all page links bg
    document.querySelectorAll('#pagination .page-number, #pagination .current, .pagination .page-number, .pagination .current').forEach(function(p) {
      if (p.classList.contains('current') || p.id === 'page-current') {
        p.style.backgroundColor = t.accent;
        p.style.borderColor = t.accent;
        p.style.color = '#FFFFFF';
      } else {
        p.style.backgroundColor = t.card;
        p.style.borderColor = t.border;
        p.style.color = t.text;
      }
    });
    // pagination arrow buttons
    document.querySelectorAll('#pagination .extend, #pagination .next, #pagination .prev, .pagination .extend, .pagination a.extend').forEach(function(e) {
      e.style.backgroundColor = t.card;
      e.style.borderColor = t.border;
      e.style.color = t.text;
    });

    // Right-side floating buttons 已被 hide-rightside.css 隐藏，无需设置样式

    // Sidebar Follow Me button (actual DOM id: #card-info-btn)
    var followBtn = document.getElementById('card-info-btn');
    if (followBtn) {
      followBtn.style.backgroundColor = t.accent;
      followBtn.style.color = '#FFFFFF';
    }

    // Body wrap transparent (let web_bg show through)
    var bodyWrap = document.getElementById('body-wrap');
    if (bodyWrap) { bodyWrap.style.backgroundColor = 'transparent'; }

    // CSS custom properties for panel styling + CSS fallbacks
    document.documentElement.style.setProperty('--theme-accent-current', t.accent);
    document.documentElement.style.setProperty('--theme-surface-current', t.card);
    document.documentElement.style.setProperty('--theme-nav-current', t.nav);
    document.documentElement.style.setProperty('--theme-secondary-current', t.secondary);
    document.documentElement.style.setProperty('--theme-text-current', t.text);
    document.documentElement.style.setProperty('--theme-border-current', t.border);
    document.documentElement.style.setProperty('--theme-card-current', t.card);
    document.documentElement.style.setProperty('--theme-body-current', t.body);
    // Footer river 跟随主题（背景渐变 + 提示文字色 + copyright 色调）
    if (t.footerBg)        document.documentElement.style.setProperty('--footer-bg', t.footerBg);
    if (t.footerRiverTop)    document.documentElement.style.setProperty('--footer-river-top', t.footerRiverTop);
    if (t.footerRiverMid)    document.documentElement.style.setProperty('--footer-river-mid', t.footerRiverMid);
    if (t.footerRiverBottom) document.documentElement.style.setProperty('--footer-river-bottom', t.footerRiverBottom);
    if (t.footerHint)        document.documentElement.style.setProperty('--footer-hint', t.footerHint);
    if (t.footerText)        document.documentElement.style.setProperty('--footer-text', t.footerText);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { id: themeId, theme: t } }));

    // Music bar theme adaptation
    var musicBar = document.getElementById('music-bar');
    if (musicBar) {
      musicBar.style.background = t.nav;
      musicBar.style.borderTopColor = t.border;
      musicBar.style.color = t.text;
      musicBar.querySelectorAll('.bar-btn').forEach(function(btn) { btn.style.color = t.accent; });
      var toggleBtn = musicBar.querySelector('.bar-btn-toggle');
      if (toggleBtn) { toggleBtn.style.background = t.accent; toggleBtn.style.color = '#FFFFFF'; }
      var cover = musicBar.querySelector('.bar-cover');
      if (cover) { cover.style.background = 'linear-gradient(135deg, ' + t.accent + ' 0%, ' + t.secondary + ' 100%)'; }
    }

    document.body.setAttribute('data-theme-custom', themeId);

    // === 所有主题统一：标题加粗 + 字号优化 ===
    var boldStyle = document.getElementById('theme-bold-style');
    if (!boldStyle) {
      boldStyle = document.createElement('style');
      boldStyle.id = 'theme-bold-style';
      document.head.appendChild(boldStyle);
    }
    boldStyle.textContent =
      '#site-title, .site-name, .site-name a { font-weight: 800 !important; }' +
      '.article-title, .recent-post-info a.article-title { font-weight: 700 !important; }' +
      '#menus .menus_item a, #nav a.site-page, .menus_items a { font-weight: 600 !important; }' +
      '.item-headline, .card-widget .item-headline { font-weight: 700 !important; }' +
      'body, .recent-post-info, .article-meta-wrap { font-size: 15px; }';
  }

  // ================================================================
  // IMMEDIATE APPLICATION — don't wait for full DOM!
  // Run applyTheme as soon as #web_bg element exists
  // ================================================================
  function tryApplyNow() {
    // Try immediately if #web_bg already exists
    if (document.getElementById('web_bg')) {
      applyTheme(currentTheme);
      return true;
    }
    // 修复：早期 Apply 失败时，直接在 #nav 存在时 fallback 设置 nav 背景
    // 避免 hero 阶段 !important 规则在释放后不生效（v12.10 修复）
    var navEl = document.getElementById('nav');
    if (navEl) {
      var t = THEME_STYLES[currentTheme];
      if (t) {
        navEl.style.background = t.nav;
        navEl.style.backgroundImage = 'none';
        var links = navEl.querySelectorAll('a, .site-name, a.site-page');
        for (var k = 0; k < links.length; k++) {
          links[k].style.color = t.text;
        }
      }
    }
    return false;
  }

  // Strategy 1: Try right away (script runs at bottom of body)
  if (!tryApplyNow()) {
    // Strategy 2: Use MutationObserver to detect when #web_bg appears
    var mo = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;
        for (var j = 0; j < addedNodes.length; j++) {
          if (addedNodes[j].id === 'web_bg' || (addedNodes[j].querySelector && addedNodes[j].querySelector('#web_bg'))) {
            mo.disconnect();
            applyTheme(currentTheme);
            return;
          }
        }
      }
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
    
    // Fallback: interval (in case observer misses it)
    var fallbackTries = 0;
    var fallbackInt = setInterval(function() {
      fallbackTries++;
      if (tryApplyNow()) clearInterval(fallbackInt);
      if (fallbackTries > 40) clearInterval(fallbackInt); // max 2 seconds
    }, 50);
  }

  // ================================================================
  // NAV BUTTON INJECTION
  // ================================================================
  function setupNavButton() {
    if (document.getElementById('nav-theme-trigger')) return true;
    var added = false;

    // 桌面端：顶部导航 #menus .menus_items
    var topMenus = document.querySelector('#menus .menus_items');
    if (topMenus) {
      var item = document.createElement('div');
      item.className = 'menus_item';
      item.style.textAlign = 'center';  // 确保 Theme 按钮下划线居中
      var link = document.createElement('a');
      link.className = 'site-page';
      link.id = 'nav-theme-trigger';
      link.href = 'javascript:void(0)';
      link.style.color = '#333333';
      link.innerHTML = '<i class="fas fa-palette"></i><span>Theme</span>';
      link.setAttribute('title', 'Switch Theme');
      item.appendChild(link);
      topMenus.appendChild(item);
      link.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); togglePanel(); return false;
      });
      added = true;
    }

    // 手机端：侧滑菜单 #sidebar-menus .menus_items
    var sideMenus = document.querySelector('#sidebar-menus .menus_items');
    if (sideMenus) {
      var sItem = document.createElement('div');
      sItem.className = 'menus_item';
      var sLink = document.createElement('a');
      sLink.className = 'site-page';
      sLink.id = 'sidebar-theme-trigger';
      sLink.href = 'javascript:void(0)';
      sLink.innerHTML = '<i class="fas fa-palette"></i><span>Theme</span>';
      sLink.setAttribute('title', 'Switch Theme');
      sItem.appendChild(sLink);
      sideMenus.appendChild(sItem);
      sLink.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        // 关闭侧滑菜单
        var mask = document.getElementById('menu-mask');
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        if (mask) mask.classList.remove('open');
        document.body.classList.remove('open-sidebar');
        setTimeout(togglePanel, 250);
        return false;
      });
      added = true;
    }

    return added;
  }

  // ================================================================
  // PANEL BUILD & EVENTS
  // ================================================================
  function buildPanel() {
    var oldPanel = document.getElementById('theme-panel'), oldOverlay = document.getElementById('theme-overlay');
    if (oldPanel) oldPanel.remove();
    if (oldOverlay) oldOverlay.remove();

    var overlay = document.createElement('div'); overlay.id = 'theme-overlay';
    overlay.addEventListener('click', closePanel); document.body.appendChild(overlay);

    var panel = document.createElement('div'); panel.id = 'theme-panel';
    var html = '<div class="panel-header">';
    html += '<span class="panel-title"><span class="icon">🎨</span>Theme</span>';
    html += '<button class="panel-close" title="Close">&times;</button></div>';
    html += '<div class="panel-section-label">Color Scheme</div>';
    html += '<div class="theme-grid">';
    // 仅保留 4 个简约清新风主题（删除原 6 个 classic 主题）
    var newIds = ['wechat-classic', 'lake-blue', 'haze-blue', 'beige-lite', 'lemon-indigo'];
    newIds.forEach(function(id) {
      var th = THEME_STYLES[id]; if (!th) return;
      var activeClass = (currentTheme === id) ? ' active' : '';
      var swatches = '';
      th.colors.slice(0, 4).forEach(function(c) { swatches += '<span class="swatch-dot" style="background:' + c + ';"></span>'; });
      html += '<div class="theme-option' + activeClass + '" data-theme="' + id + '" role="button" tabindex="0">';
      html += '<div class="theme-swatch">' + swatches + '</div>';
      html += '<span class="theme-name">' + th.name + '</span></div>';
    });
    html += '</div>';

    panel.innerHTML = html; document.body.appendChild(panel); bindPanelEvents();
  }

  function bindPanelEvents() {
    var closeBtn = document.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    document.querySelectorAll('.theme-option[data-theme]').forEach(function(opt) {
      opt.addEventListener('click', function() { selectTheme(this.getAttribute('data-theme')); });
      opt.addEventListener('keydown', function(e) { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); selectTheme(this.getAttribute('data-theme')); }});
    });
  }

  function selectTheme(id) {
    currentTheme=id; localStorage.setItem(STORAGE_KEY_THEME,id); applyTheme(id);
    // 立即同步 nav 背景（v12.10 修复 — 主题切换时 nav 立刻更新）
    var navEl = document.getElementById('nav');
    if (navEl) {
      var t = THEME_STYLES[id];
      if (t) {
        navEl.style.background = t.nav;
        navEl.style.backgroundImage = 'none';
        var links = navEl.querySelectorAll('a, .site-name, a.site-page');
        for (var k = 0; k < links.length; k++) {
          links[k].style.color = t.text;
        }
      }
    }
    document.querySelectorAll('.theme-option[data-theme]').forEach(function(o){o.classList.toggle('active',o.getAttribute('data-theme')===id)});
  }

  function openPanel() { buildPanel(); var o=document.getElementById('theme-overlay'),p=document.getElementById('theme-panel'); if(o)o.classList.add('show');if(p)p.classList.add('show');}
  function closePanel() {var o=document.getElementById('theme-overlay'),p=document.getElementById('theme-panel'); if(o)o.classList.remove('show');if(p)p.classList.remove('show');}
  function togglePanel() { var p=document.getElementById('theme-panel'); if(p&&p.classList.contains('show')) closePanel(); else openPanel(); }

  // ================================================================
  // INIT — setup nav button + keyboard shortcuts
  // ================================================================
  function init() {
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if (document.querySelector('#menus .menus_items') || tries > 15) {
        clearInterval(iv); setupNavButton();
      }
    }, 100);

    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePanel(); });
    document.addEventListener('click', function(e) {
      var panel = document.getElementById('theme-panel'), trigger = document.getElementById('nav-theme-trigger');
      if (panel && panel.classList.contains('show') && !panel.contains(e.target) && (!trigger || !trigger.contains(e.target))) closePanel();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();

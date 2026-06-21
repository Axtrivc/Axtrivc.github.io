/* ============================================================
   Axtrivc's Blog — Standalone Theme Loader
   用于 source/ 下独立 HTML 页面（music / football / espanol）
   与 theme-system.js 共享主题定义，避免重复维护配色
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY_THEME = 'axtrivc_theme_v2';

  var THEME_STYLES = {
    'wechat-classic': {
      bg: '#FFFFFF', body: '#FFFFFF', card: '#FFFFFF',
      text: '#191919', heading: '#0A3D2A', secondary: '#7A7A7A', accent: '#07C160',
      border: '#EDEDED', navText: '#191919', navTextHover: '#07C160'
    },
    'lake-blue': {
      bg: '#F4FBFF', body: '#F4FBFF', card: '#FFFFFF',
      text: '#191919', heading: '#0C447C', secondary: '#5A9EC9', accent: '#10AEFF',
      border: 'rgba(16,174,255,0.18)', navText: '#0C447C', navTextHover: '#10AEFF'
    },
    'haze-blue': {
      bg: '#FAFBFC', body: '#FAFBFC', card: '#FFFFFF',
      text: '#2D3748', heading: '#2D3748', secondary: '#718096', accent: '#4A5568',
      border: '#EAECEF', navText: '#2D3748', navTextHover: '#4A5568'
    },
    'beige-lite': {
      bg: '#FFFCF5', body: '#FFFCF5', card: '#FFFFFF',
      text: '#3A2A1A', heading: '#3A2A1A', secondary: '#9A8866', accent: '#8B6F47',
      border: '#EFE8DA', navText: '#3A2A1A', navTextHover: '#8B6F47'
    },
    'lemon-indigo': {
      bg: '#FAFAFA', body: '#FAFAFA', card: '#FFFFFF',
      text: '#1E3A8A', heading: '#1E3A8A', secondary: '#4A5568', accent: '#F5C518',
      border: '#C7D2FE', navText: '#1E3A8A', navTextHover: '#B45309'
    }
  };

  var DEFAULT_THEME = 'wechat-classic';

  function applyTheme(themeId) {
    var t = THEME_STYLES[themeId] || THEME_STYLES[DEFAULT_THEME];
    var root = document.documentElement;
    root.style.setProperty('--theme-bg', t.bg);
    root.style.setProperty('--theme-body', t.body);
    root.style.setProperty('--theme-card', t.card);
    root.style.setProperty('--theme-text', t.text);
    root.style.setProperty('--theme-heading', t.heading);
    root.style.setProperty('--theme-secondary', t.secondary);
    root.style.setProperty('--theme-accent', t.accent);
    root.style.setProperty('--theme-border', t.border);
    root.style.setProperty('--theme-nav-text', t.navText);
    root.style.setProperty('--theme-nav-hover', t.navTextHover);
    document.body.style.backgroundColor = t.body;
    document.body.style.color = t.text;
    document.body.setAttribute('data-theme', themeId);
  }

  function getCurrentTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY_THEME) || DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  }

  // 立即应用，避免 FOUC（无闪烁）
  applyTheme(getCurrentTheme());

  // 多标签页同步：storage 事件在另一个标签页修改 localStorage 时触发
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY_THEME && e.newValue) {
      applyTheme(e.newValue);
    }
  });

  // 暴露 API 给页面脚本（例如主题切换调试）
  window.AxtrivcStandaloneTheme = {
    apply: applyTheme,
    current: getCurrentTheme,
    themes: THEME_STYLES
  };
})();

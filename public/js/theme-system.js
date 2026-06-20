/* ============================================================
   Axtrivc's Blog — Theme System v7
   Direct DOM manipulation — applies IMMEDIATELY on load
   ============================================================ */
(function () {
  'use strict';

  // ---- Constants ----
  var STORAGE_KEY_THEME = 'axtrivc_theme_v2';
  var STORAGE_KEY_BG = 'axtrivc_custom_bg_v2';

  // ---- Theme Definitions ----
  var THEME_STYLES = {
    wechat: {
      name: 'WeChat',
      colors: ['#EDF6EF', '#07C160', '#576B95', '#FFFFFF', '#191919', '#8A9A99'],
      bg: '#EDF6EF', body: '#EDF6EF', nav: 'rgba(237,246,239,0.96)', card: '#FFFFFF',
      text: '#4A5550', heading: '#1A1A1A', secondary: '#6B7C77', accent: '#07C160',
      border: 'rgba(7,193,96,0.15)', pageHeader: '#E2F2E4', navText: '#333333', navTextHover: '#07C160'
    },
    'warm-beige': {
      name: 'Warm Beige',
      colors: ['#F0E4D0', '#B8860B', '#C4A96A', '#FFF9EE', '#3D2B1A', '#8A7A66'],
      bg: '#F0E4D0', body: '#F0E4D0', nav: 'rgba(240,228,208,0.92)', card: '#FFFBF5',
      text: '#3D2B1A', heading: '#2A1A0A', secondary: '#8A7A66', accent: '#B8860B',
      border: 'rgba(184,134,11,0.16)', pageHeader: '#E8DCC8', navText: '#3D2B1A', navTextHover: '#B8860B'
    },
    'sky-blue': {
      name: 'Sky Blue',
      colors: ['#DAECFA', '#2980B9', '#6BB5F0', '#F0F8FF', '#1A3A5C', '#4A7094'],
      bg: '#DAECFA', body: '#DAECFA', nav: 'rgba(218,236,250,0.92)', card: '#F0F8FF',
      text: '#1A3A5C', heading: '#0D253F', secondary: '#4A7094', accent: '#2980B9',
      border: 'rgba(41,128,185,0.18)', pageHeader: '#C5DEF5', navText: '#1A3A5C', navTextHover: '#2980B9'
    },
    'dusk-pink': {
      name: 'Dusk Pink',
      colors: ['#F8DDD4', '#C06030', '#F0A3B3', '#FFF5F0', '#5C2E24', '#A06A5C'],
      bg: '#F8DDD4', body: '#F8DDD4', nav: 'rgba(248,221,212,0.92)', card: '#FFF5F0',
      text: '#5C2E24', heading: '#3D1A12', secondary: '#A06A5C', accent: '#C06030',
      border: 'rgba(192,96,48,0.18)', pageHeader: '#F0C8BA', navText: '#5C2E24', navTextHover: '#C06030'
    },
    mint: {
      name: 'Mint',
      colors: ['#D4EEE4', '#27AE60', '#7ECDAD', '#F0FFF8', '#1A3D2E', '#4A8068'],
      bg: '#D4EEE4', body: '#D4EEE4', nav: 'rgba(212,238,228,0.92)', card: '#F0FFF8',
      text: '#1A3D2E', heading: '#0D261A', secondary: '#4A8068', accent: '#27AE60',
      border: 'rgba(39,174,96,0.18)', pageHeader: '#BFE0D4', navText: '#1A3D2E', navTextHover: '#27AE60'
    },
    minimal: {
      name: 'Minimal',
      colors: ['#EBEBEB', '#444444', '#888888', '#FFFFFF', '#222222', '#777777'],
      bg: '#EBEBEB', body: '#EBEBEB', nav: 'rgba(235,235,235,0.92)', card: '#FFFFFF',
      text: '#222222', heading: '#111111', secondary: '#777777', accent: '#444444',
      border: '#CCCCCC', pageHeader: '#DDDDDD', navText: '#222222', navTextHover: '#444444'
    }
  };

  // Current state — DEFAULT to WeChat (pure white, most noticeable change)
  var currentTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'wechat';
  var customBg = null;
  try { customBg = JSON.parse(localStorage.getItem(STORAGE_KEY_BG)); } catch(e) { customBg = null; }

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

    // Page header / hero
    var pageHeader = document.getElementById('page-header');
    if (pageHeader) { pageHeader.style.backgroundColor = t.pageHeader; }

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

    // Footer: background + text color — use a slightly darker shade than nav
    var footerWrap = document.getElementById('footer-wrap');
    if (footerWrap) {
      footerWrap.style.backgroundColor = themeId === 'wechat' ? 'rgba(220,237,222,0.95)' : t.nav;
      footerWrap.style.color = t.secondary;
      footerWrap.style.borderTopColor = t.border;
    }
    // Also target footer itself
    document.querySelectorAll('#footer, footer').forEach(function(f) {
      f.style.backgroundColor = themeId === 'wechat' ? 'rgba(220,237,222,0.95)' : t.nav;
      f.style.color = t.secondary;
    });

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

    // Right-side floating buttons (actual DOM: #go-up, #rightside-config)
    document.querySelectorAll('#rightside > button, #go-up, #rightside-config, #hide-aside-btn').forEach(function(btn) {
      btn.style.backgroundColor = t.accent;
      btn.style.color = '#FFFFFF';
    });

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
  }

  // ================================================================
  // IMMEDIATE APPLICATION — don't wait for full DOM!
  // Run applyTheme as soon as #web_bg element exists
  // ================================================================
  function tryApplyNow() {
    // Try immediately if #web_bg already exists
    if (document.getElementById('web_bg')) {
      applyTheme(currentTheme);
      if (customBg) applyCustomBgNow();
      return true;
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
            if (customBg) applyCustomBgNow();
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
    var menusContainer = document.querySelector('#menus .menus_items');
    if (!menusContainer || document.getElementById('nav-theme-trigger')) return false;

    var item = document.createElement('div');
    item.className = 'menus_item';
    var link = document.createElement('a');
    link.className = 'site-page';
    link.id = 'nav-theme-trigger';
    link.href = 'javascript:void(0)';
    // Set initial color immediately to prevent FOUC flash (white on light nav)
    link.style.color = '#333333';
    link.innerHTML = '<i class="fas fa-palette"></i><span>Theme</span>';
    link.setAttribute('title', 'Switch Theme & Background');
    item.appendChild(link);
    menusContainer.appendChild(item);

    link.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation(); togglePanel(); return false;
    });
    return true;
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
    Object.keys(THEME_STYLES).forEach(function(id) {
      var th = THEME_STYLES[id], activeClass = (currentTheme === id) ? ' active' : '';
      var swatches = '';
      th.colors.slice(0, 4).forEach(function(c) { swatches += '<span class="swatch-dot" style="background:' + c + ';"></span>'; });
      html += '<div class="theme-option' + activeClass + '" data-theme="' + id + '" role="button" tabindex="0">';
      html += '<div class="theme-swatch">' + swatches + '</div>';
      html += '<span class="theme-name">' + th.name + '</span></div>';
    });
    html += '</div>';

    // Background section
    html += '<div class="panel-section-label">Background Image</div><div class="bg-section">';
    html += '<div class="bg-upload-area" id="bg-upload" tabindex="0" role="button">';
    html += '<div class="upload-icon">📷</div>';
    html += '<div class="upload-text"><strong>Click or Drag</strong> to upload image<br>or paste URL below</div>';
    html += '<div class="upload-hint">JPG / PNG / WebP &le; 10MB</div></div>';
    html += '<div class="bg-url-row">';
    html += '<input type="text" class="bg-url-input" id="bg-url-input" placeholder="Paste image URL here...">';
    html += '<button class="bg-url-btn" id="bg-url-btn">Apply</button></div>';
    html += '<div class="bg-controls">';
    html += '<div class="bg-control"><label>Opacity <span id="opacity-val">35%</span></label><input type="range" id="bg-opacity" min="5" max="80" value="35"></div>';
    html += '<div class="bg-control"><label>Blur <span id="blur-val">0px</span></label><input type="range" id="bg-blur" min="0" max="20" value="0"></div></div>';
    html += '<button class="bg-remove-btn' + (customBg ? '' : ' hidden') + '" id="bg-remove">Remove Background Image</button></div>';

    panel.innerHTML = html; document.body.appendChild(panel); bindPanelEvents();
  }

  function bindPanelEvents() {
    var closeBtn = document.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    document.querySelectorAll('.theme-option[data-theme]').forEach(function(opt) {
      opt.addEventListener('click', function() { selectTheme(this.getAttribute('data-theme')); });
      opt.addEventListener('keydown', function(e) { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); selectTheme(this.getAttribute('data-theme')); }});
    });

    var uploadArea = document.getElementById('bg-upload');
    if (uploadArea) {
      uploadArea.addEventListener('click', function() {
        var input = document.createElement('input'); input.type='file'; input.accept='image/jpeg,image/png,image/webp';
        input.onchange = function(e) { var f=e.target.files[0]; if(!f||f.size>10*1024*1024)return alert('File too large (>10MB)');
          var r=new FileReader(); r.onload=function(ev){applyCustomBg(ev.target.result)}; r.readAsDataURL(f); };
        input.click();
      });
      ['dragenter','dragover'].forEach(function(ev){uploadArea.addEventListener(ev,function(e){e.preventDefault();this.style.borderColor='#333'},false)});
      ['dragleave','drop'].forEach(function(ev){uploadArea.addEventListener(ev,function(e){e.preventDefault();this.style.borderColor='rgba(0,0,0,0.12)'},false)});
      uploadArea.addEventListener('drop',function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(!f||f.size>10*1024*1024)return alert('File too large');var r=new FileReader();r.onload=function(ev){applyCustomBg(ev.target.result)};r.readAsDataURL(f)},false);
    }
    var urlBtn=document.getElementById('bg-url-btn'), urlInput=document.getElementById('bg-url-input');
    if(urlBtn&&urlInput){
      urlBtn.addEventListener('click',function(){var u=urlInput.value.trim();if(!u)return alert('Enter URL');if(!u.match(/^https?:\/\//i))return alert('URL must start with http/https');applyCustomBg(u)});
      urlInput.addEventListener('keydown',function(e){if(e.key==='Enter')urlBtn.click()});
    }
    var opSlider=document.getElementById('bg-opacity'), blSlider=document.getElementById('bg-blur');
    if(opSlider) opSlider.addEventListener('input',function(){document.getElementById('opacity-val').textContent=this.value+'%';if(customBg){customBg.opacity=parseInt(this.value)/100;updateCustomBgStyle()}});
    if(blSlider) blSlider.addEventListener('input',function(){document.getElementById('blur-val').textContent=this.value+'px';if(customBg){customBg.blur=parseInt(this.value);updateCustomBgStyle()}});
    var rmBtn=document.getElementById('bg-remove');
    if(rmBtn) rmBtn.addEventListener('click', removeCustomBg);
  }

  function selectTheme(id) {
    currentTheme=id; localStorage.setItem(STORAGE_KEY_THEME,id); applyTheme(id);
    document.querySelectorAll('.theme-option[data-theme]').forEach(function(o){o.classList.toggle('active',o.getAttribute('data-theme')===id)});
  }

  // Custom background functions
  function applyCustomBg(url) {
    customBg={url:url,opacity:0.35,blur:0};
    var opEl=document.getElementById('bg-opacity'), blEl=document.getElementById('bg-blur');
    if(opEl) customBg.opacity=parseInt(opEl.value)/100; if(blEl) customBg.blur=parseInt(blEl.value);
    localStorage.setItem(STORAGE_KEY_BG,JSON.stringify(customBg)); updateCustomBgStyle();
    var rmBtn=document.getElementById('bg-remove'); if(rmBtn) rmBtn.classList.remove('hidden');
    var ua=document.getElementById('bg-upload'); if(ua) ua.innerHTML='<div class="upload-icon">✅</div><div class="upload-text"><strong>Image applied!</strong></div>';
  }
  function applyCustomBgNow() {
    if (!customBg) return;
    document.body.classList.add('custom-bg');
    document.documentElement.style.setProperty('--custom-bg-image',"url('"+customBg.url+"')");
    document.documentElement.style.setProperty('--custom-bg-opacity', customBg.opacity);
    document.documentElement.style.setProperty('--custom-bg-blur', customBg.blur+'px');
  }
  function updateCustomBgStyle() {
    applyCustomBgNow(); applyTheme(currentTheme);
  }
  function removeCustomBg() {
    customBg=null; localStorage.removeItem(STORAGE_KEY_BG);
    document.body.classList.remove('custom-bg');
    document.documentElement.style.setProperty('--custom-bg-image','');
    document.documentElement.style.setProperty('--custom-bg-opacity','');
    document.documentElement.style.setProperty('--custom-bg-blur','');
    applyTheme(currentTheme);
    var rmBtn=document.getElementById('bg-remove'); if(rmBtn) rmBtn.classList.add('hidden');
    var ua=document.getElementById('bg-upload');
    if(ua) ua.innerHTML='<div class="upload-icon">📷</div><div class="upload-text"><strong>Click or Drag</strong> to upload image<br>or paste URL below</div><div class="upload-hint">JPG/PNG/WebP ≤10MB</div>';
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

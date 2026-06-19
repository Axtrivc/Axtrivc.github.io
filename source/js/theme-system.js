/* ============================================================
   Axtrivc's Blog — Theme System v5
   Direct DOM manipulation (NOT CSS variables) for max specificity
   ============================================================ */
(function () {
  'use strict';

  // ---- Constants ----
  var STORAGE_KEY_THEME = 'axtrivc_theme_v2';
  var STORAGE_KEY_BG = 'axtrivc_custom_bg_v2';

  // ---- Theme Definitions — FULL STYLE MAPS for each theme ----
  // Each theme has a complete set of color values to apply DIRECTLY via JS
  var THEME_STYLES = {
    wechat: {
      name: 'WeChat',
      colors: ['#FFFFFF', '#07C160', '#576B95', '#F7F8FA', '#1A1A1A', '#576B95'],
      bg: '#F0F2F5',           // #web_bg background - the main visible area
      body: '#F0F2F5',         // body background
      nav: 'rgba(255,255,255,0.92)',  // nav bar
      card: '#FFFFFF',         // article cards
      text: '#191919',          // primary text
      heading: '#000000',       // headings
      secondary: '#576B95',     // secondary text
      accent: '#07C160',        // accent/links
      border: '#E5E7EB',
      pageHeader: '#F0F2F5'
    },
    'warm-beige': {
      name: 'Warm Beige',
      colors: ['#F0E4D0', '#B8860B', '#C4A96A', '#FFF9EE', '#3D2B1A', '#8A7A66'],
      bg: '#F0E4D0',
      body: '#F0E4D0',
      nav: 'rgba(240,228,208,0.92)',
      card: '#FFFBF5',
      text: '#3D2B1A',
      heading: '#2A1A0A',
      secondary: '#8A7A66',
      accent: '#B8860B',
      border: 'rgba(184,134,11,0.16)',
      pageHeader: '#E8DCC8'
    },
    'sky-blue': {
      name: 'Sky Blue',
      colors: ['#DAECFA', '#2980B9', '#6BB5F0', '#F0F8FF', '#1A3A5C', '#4A7094'],
      bg: '#DAECFA',            // CLEARLY blue-tinted
      body: '#DAECFA',
      nav: 'rgba(218,236,250,0.92)',
      card: '#F0F8FF',
      text: '#1A3A5C',
      heading: '#0D253F',
      secondary: '#4A7094',
      accent: '#2980B9',
      border: 'rgba(41,128,185,0.18)',
      pageHeader: '#C5DEF5'
    },
    'dusk-pink': {
      name: 'Dusk Pink',
      colors: ['#F8DDD4', '#C06030', '#F0A3B3', '#FFF5F0', '#5C2E24', '#A06A5C'],
      bg: '#F8DDD4',            // CLEARLY pink-tinted
      body: '#F8DDD4',
      nav: 'rgba(248,221,212,0.92)',
      card: '#FFF5F0',
      text: '#5C2E24',
      heading: '#3D1A12',
      secondary: '#A06A5C',
      accent: '#C06030',
      border: 'rgba(192,96,48,0.18)',
      pageHeader: '#F0C8BA'
    },
    mint: {
      name: 'Mint',
      colors: ['#D4EEE4', '#27AE60', '#7ECDAD', '#F0FFF8', '#1A3D2E', '#4A8068'],
      bg: '#D4EEE4',            // CLEARLY green-tinted
      body: '#D4EEE4',
      nav: 'rgba(212,238,228,0.92)',
      card: '#F0FFF8',
      text: '#1A3D2E',
      heading: '#0D261A',
      secondary: '#4A8068',
      accent: '#27AE60',
      border: 'rgba(39,174,96,0.18)',
      pageHeader: '#BFE0D4'
    },
    minimal: {
      name: 'Minimal',
      colors: ['#EBEBEB', '#444444', '#888888', '#FFFFFF', '#222222', '#777777'],
      bg: '#EBEBEB',
      body: '#EBEBEB',
      nav: 'rgba(235,235,235,0.92)',
      card: '#FFFFFF',
      text: '#222222',
      heading: '#111111',
      secondary: '#777777',
      accent: '#444444',
      border: '#CCCCCC',
      pageHeader: '#DDDDDD'
    }
  };

  // Current state
  var currentTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'warm-beige';
  var customBg = null;
  try { customBg = JSON.parse(localStorage.getItem(STORAGE_KEY_BG)); } catch(e) { customBg = null; }

  // ---- Apply theme function — THE CORE ----
  function applyTheme(themeId) {
    var t = THEME_STYLES[themeId];
    if (!t) return;

    // 1. #web_bg — THE MOST IMPORTANT ONE (Butterfly's background div)
    var webBg = document.getElementById('web_bg');
    if (webBg) {
      webBg.style.backgroundColor = t.bg;
      webBg.style.transition = 'background-color 0.45s ease';
    }

    // 2. html tag
    document.documentElement.style.backgroundColor = t.bg;

    // 3. body
    document.body.style.backgroundColor = t.body;
    document.body.style.color = t.text;

    // 4. Navigation
    var nav = document.getElementById('nav');
    if (nav) { nav.style.background = t.nav; }

    // 5. Page header / hero area
    var pageHeader = document.getElementById('page-header');
    if (pageHeader) { pageHeader.style.backgroundColor = t.pageHeader; }

    // 6. Article cards
    var cards = document.querySelectorAll('.recent-post-item');
    cards.forEach(function(c) {
      c.style.backgroundColor = t.card;
      c.style.borderColor = t.border;
    });

    // 7. Sidebar widgets
    var widgets = document.querySelectorAll('.card-widget');
    widgets.forEach(function(w) {
      w.style.backgroundColor = t.card;
      w.style.borderColor = t.border;
    });

    // 8. Headings
    var headings = document.querySelectorAll('.article-title, .site-name, #site-title, .item-headline, .card-categories .item-headline, .card-tags .item-headline');
    headings.forEach(function(h) { h.style.color = t.heading; });

    // 9. Secondary text
    var secondaries = document.querySelectorAll('.article-meta-wrap, .article-meta-label, .post-meta-date, time, .aside-list-item .content .comment, .aside-list-item .content time, #footer-wrap, .webinfo-item-count, .webinfo-item-name, .card-archive-list-item a span, .card-category-list-item a span, .tag-cloud-tags a');
    secondaries.forEach(function(s) { s.style.color = t.secondary; });

    // 10. Links & accent elements
    var links = document.querySelectorAll('.recent-post-info a.article-title, .aside-list-item .content .title a, #pagination a, .card-tag-cloud a');
    links.forEach(function(l) {
      l.style.color = t.accent;
    });

    // 11. Body wrap
    var bodyWrap = document.getElementById('body-wrap');
    if (bodyWrap) { bodyWrap.style.backgroundColor = 'transparent'; }

    // 12. Store current accent for CSS panel styling
    document.documentElement.style.setProperty('--theme-accent-current', t.accent);
    document.documentElement.style.setProperty('--theme-surface-current', t.card);

    // Set data attribute for any CSS fallback rules
    document.body.setAttribute('data-theme-custom', themeId);
  }

  // ---- Build and inject Theme button into navigation ----
  function setupNavButton() {
    var menusContainer = document.querySelector('#menus .menus_items');
    if (!menusContainer) return false;

    // Check if already injected
    if (document.getElementById('nav-theme-trigger')) return true;

    // Create menu item
    var item = document.createElement('div');
    item.className = 'menus_item';

    var link = document.createElement('a');
    link.className = 'site-page';
    link.id = 'nav-theme-trigger';
    link.href = 'javascript:void(0)';
    link.innerHTML = '<i class="fas fa-palette"></i><span>Theme</span>';
    link.setAttribute('title', 'Switch Theme & Background');

    item.appendChild(link);
    menusContainer.appendChild(item);

    // Click handler
    link.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
      return false;
    });

    return true;
  }

  // ---- Build Panel HTML ----
  function buildPanel() {
    // Remove existing
    var oldPanel = document.getElementById('theme-panel');
    var oldOverlay = document.getElementById('theme-overlay');
    if (oldPanel) oldPanel.remove();
    if (oldOverlay) oldOverlay.remove();

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'theme-overlay';
    overlay.addEventListener('click', closePanel);
    document.body.appendChild(overlay);

    // Panel container
    var panel = document.createElement('div');
    panel.id = 'theme-panel';

    // Header
    var html = '<div class="panel-header">';
    html += '<span class="panel-title"><span class="icon">🎨</span>Theme</span>';
    html += '<button class="panel-close" title="Close">&times;</button>';
    html += '</div>';

    // Themes section label
    html += '<div class="panel-section-label">Color Scheme</div>';

    // Theme grid
    html += '<div class="theme-grid">';
    var themeIds = Object.keys(THEME_STYLES);
    themeIds.forEach(function (id) {
      var th = THEME_STYLES[id];
      var activeClass = (currentTheme === id) ? ' active' : '';
      var swatchHtml = '';
      th.colors.slice(0, 4).forEach(function (color) {
        swatchHtml += '<span class="swatch-dot" style="background:' + color + ';"></span>';
      });
      html += '<div class="theme-option' + activeClass + '" data-theme="' + id + '" role="button" tabindex="0" aria-label="' + th.name + '">';
      html += '<div class="theme-swatch">' + swatchHtml + '</div>';
      html += '<span class="theme-name">' + th.name + '</span>';
      html += '</div>';
    });
    html += '</div>';

    // Background section
    html += '<div class="panel-section-label">Background Image</div>';
    html += '<div class="bg-section">';

    // Upload area
    html += '<div class="bg-upload-area" id="bg-upload" tabindex="0" role="button">';
    html += '<div class="upload-icon">📷</div>';
    html += '<div class="upload-text"><strong>Click or Drag</strong> to upload image<br>or paste URL below</div>';
    html += '<div class="upload-hint">JPG / PNG / WebP &le; 10MB</div>';
    html += '</div>';

    // URL input
    html += '<div class="bg-url-row">';
    html += '<input type="text" class="bg-url-input" id="bg-url-input" placeholder="Paste image URL here...">';
    html += '<button class="bg-url-btn" id="bg-url-btn">Apply</button>';
    html += '</div>';

    // Controls
    html += '<div class="bg-controls">';
    html += '<div class="bg-control"><label>Opacity <span id="opacity-val">35%</span></label><input type="range" id="bg-opacity" min="5" max="80" value="35"></div>';
    html += '<div class="bg-control"><label>Blur <span id="blur-val">0px</span></label><input type="range" id="bg-blur" min="0" max="20" value="0"></div>';
    html += '</div>';

    // Remove button
    html += '<button class="bg-remove-btn' + (customBg ? '' : ' hidden') + '" id="bg-remove">Remove Background Image</button>';

    html += '</div>';

    panel.innerHTML = html;
    document.body.appendChild(panel);

    // Bind events
    bindPanelEvents();
  }

  // ---- Panel event bindings ----
  function bindPanelEvents() {
    // Close button
    var closeBtn = document.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // Theme option clicks
    var options = document.querySelectorAll('.theme-option[data-theme]');
    options.forEach(function(opt) {
      opt.addEventListener('click', function() {
        selectTheme(this.getAttribute('data-theme'));
      });
      opt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTheme(this.getAttribute('data-theme')); }
      });
    });

    // File upload
    var uploadArea = document.getElementById('bg-upload');
    if (uploadArea) {
      uploadArea.addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
        input.onchange = function(e) {
          var file = e.target.files[0]; if (!file || file.size > 10*1024*1024) return alert('File too large (&gt;10MB)');
          var reader = new FileReader();
          reader.onload = function(ev) { applyCustomBg(ev.target.result); };
          reader.readAsDataURL(file);
        };
        input.click();
      });

      // Drag & drop
      ['dragenter','dragover'].forEach(function(ev) {
        uploadArea.addEventListener(ev, function(e) { e.preventDefault(); this.style.borderColor='#333'; this.style.transform='scale(1.02)'; }, false);
      });
      ['dragleave','drop'].forEach(function(ev) {
        uploadArea.addEventListener(ev, function(e) { e.preventDefault(); this.style.borderColor='rgba(0,0,0,0.12)'; this.style.transform='none'; }, false);
      });
      uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        var file = e.dataTransfer.files[0];
        if (!file || file.size > 10*1024*1024) return alert('File too large (&gt;10MB)');
        var reader = new FileReader();
        reader.onload = function(ev) { applyCustomBg(ev.target.result); };
        reader.readAsDataURL(file);
      }, false);
    }

    // URL input
    var urlBtn = document.getElementById('bg-url-btn');
    var urlInput = document.getElementById('bg-url-input');
    if (urlBtn && urlInput) {
      urlBtn.addEventListener('click', function() {
        var url = urlInput.value.trim();
        if (!url) return alert('Please enter an image URL');
        if (!url.match(/^https?:\/\//i)) return alert('URL must start with http:// or https://');
        applyCustomBg(url);
      });
      urlInput.addEventListener('keydown', function(e) { if (e.key==='Enter') urlBtn.click(); });
    }

    // Sliders
    var opacitySlider = document.getElementById('bg-opacity');
    var blurSlider = document.getElementById('bg-blur');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', function() {
        document.getElementById('opacity-val').textContent = this.value + '%';
        if (customBg) { customBg.opacity = parseInt(this.value)/100; updateCustomBgStyle(); }
      });
    }
    if (blurSlider) {
      blurSlider.addEventListener('input', function() {
        document.getElementById('blur-val').textContent = this.value + 'px';
        if (customBg) { customBg.blur = parseInt(this.value); updateCustomBgStyle(); }
      });
    }

    // Remove BG
    var removeBtn = document.getElementById('bg-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', removeCustomBg);
    }
  }

  // ---- Select theme ----
  function selectTheme(id) {
    currentTheme = id;
    localStorage.setItem(STORAGE_KEY_THEME, id);
    applyTheme(id);

    // Update active state in grid
    var options = document.querySelectorAll('.theme-option[data-theme]');
    options.forEach(function(o) { o.classList.toggle('active', o.getAttribute('data-theme')===id); });
  }

  // ---- Custom background ----
  function applyCustomBg(url) {
    customBg = { url: url, opacity: 0.35, blur: 0 };
    var opacityEl = document.getElementById('bg-opacity');
    var blurEl = document.getElementById('bg-blur');
    if (opacityEl) customBg.opacity = parseInt(opacityEl.value)/100;
    if (blurEl) customBg.blur = parseInt(blurEl.value);
    localStorage.setItem(STORAGE_KEY_BG, JSON.stringify(customBg));
    updateCustomBgStyle();

    // Show remove button
    var removeBtn = document.getElementById('bg-remove');
    if (removeBtn) removeBtn.classList.remove('hidden');

    // Visual feedback
    var uploadArea = document.getElementById('bg-upload');
    if (uploadArea) { uploadArea.innerHTML = '<div class="upload-icon">✅</div><div class="upload-text"><strong>Image applied!</strong></div>'; }
  }

  function updateCustomBgStyle() {
    if (!customBg) return;
    document.body.classList.add('custom-bg');
    document.documentElement.style.setProperty('--custom-bg-image', "url('" + customBg.url + "')");
    document.documentElement.style.setProperty('--custom-bg-opacity', customBg.opacity);
    document.documentElement.style.setProperty('--custom-bg-blur', customBg.blur + 'px');

    // Re-apply theme so bg stays correct
    applyTheme(currentTheme);
  }

  function removeCustomBg() {
    customBg = null;
    localStorage.removeItem(STORAGE_KEY_BG);
    document.body.classList.remove('custom-bg');
    document.documentElement.style.setProperty('--custom-bg-image', '');
    document.documentElement.style.setProperty('--custom-bg-opacity', '');
    document.documentElement.style.setProperty('--custom-bg-blur', '');
    applyTheme(currentTheme);

    // Reset UI
    var removeBtn = document.getElementById('bg-remove');
    if (removeBtn) removeBtn.classList.add('hidden');
    var uploadArea = document.getElementById('bg-upload');
    if (uploadArea) {
      uploadArea.innerHTML = '<div class="upload-icon">📷</div><div class="upload-text"><strong>Click or Drag</strong> to upload image<br>or paste URL below</div><div class="upload-hint">JPG / PNG / WebP &le; 10MB</div>';
    }
  }

  // ---- Panel toggle ----
  function openPanel() {
    buildPanel();
    var overlay = document.getElementById('theme-overlay');
    var panel = document.getElementById('theme-panel');
    if (overlay) overlay.classList.add('show');
    if (panel) panel.classList.add('show');
  }

  function closePanel() {
    var overlay = document.getElementById('theme-overlay');
    var panel = document.getElementById('theme-panel');
    if (overlay) overlay.classList.remove('show');
    if (panel) panel.classList.remove('show');
  }

  function togglePanel() {
    var panel = document.getElementById('theme-panel');
    if (panel && panel.classList.contains('show')) {
      closePanel();
    } else {
      openPanel();
    }
  }

  // ---- Initialize ----
  function init() {
    // Wait for Butterfly's DOM to be ready
    var tries = 0;
    var interval = setInterval(function () {
      tries++;
      // Check if nav exists
      var menusContainer = document.querySelector('#menus .menus_items');
      if (menusContainer || tries > 20) {
        clearInterval(interval);

        setupNavButton();
        applyTheme(currentTheme);
        if (customBg) updateCustomBgStyle();
      }
    }, 150);

    // Escape key closes panel
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closePanel();
    });

    // Close on click outside panel
    document.addEventListener('click', function(e) {
      var panel = document.getElementById('theme-panel');
      var trigger = document.getElementById('nav-theme-trigger');
      if (panel && panel.classList.contains('show')) {
        if (!panel.contains(e.target) && !trigger.contains(e.target)) {
          closePanel();
        }
      }
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

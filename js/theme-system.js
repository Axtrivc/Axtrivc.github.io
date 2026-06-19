/**
 * Axtrivc's Blog — Theme System
 * Theme switcher + background customization
 */
(function () {
  'use strict';

  // ============================================================
  // Theme definitions
  // ============================================================
  var THEMES = [
    {
      id: 'wechat',
      name: '微信清新',
      colors: ['#FFFFFF', '#07C160', '#576B95', '#F7F8FA']
    },
    {
      id: 'warm-beige',
      name: '暖米原色',
      colors: ['#F5F0E8', '#8B6F47', '#C4A96A', '#FFFFFF']
    },
    {
      id: 'sky-blue',
      name: '天空浅蓝',
      colors: ['#F5F9FC', '#5B9BD5', '#6BB5F0', '#FFFFFF']
    },
    {
      id: 'dusk-pink',
      name: '薄暮粉',
      colors: ['#FDF8F5', '#D4958B', '#F0A3B3', '#FFFFFF']
    },
    {
      id: 'mint',
      name: '薄荷清绿',
      colors: ['#F5FAF8', '#5FAB8D', '#7ECDAD', '#FFFFFF']
    },
    {
      id: 'minimal',
      name: '极简灰白',
      colors: ['#FAFAFA', '#3A3A3A', '#8C8C8C', '#FFFFFF']
    }
  ];

  var STORAGE_KEY_THEME = 'axtrivc-theme';
  var STORAGE_KEY_BG = 'axtrivc-bg-image';
  var STORAGE_KEY_BG_OPACITY = 'axtrivc-bg-opacity';
  var STORAGE_KEY_BG_BLUR = 'axtrivc-bg-blur';

  // ============================================================
  // State
  // ============================================================
  var currentTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'warm-beige';
  var panelOpen = false;

  // ============================================================
  // DOM creation
  // ============================================================

  // Create trigger button
  var trigger = document.createElement('div');
  trigger.id = 'theme-trigger';
  trigger.title = '切换主题';
  trigger.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  // Create overlay
  var overlay = document.createElement('div');
  overlay.id = 'theme-overlay';

  // Build theme option HTML
  function buildThemeGrid() {
    var html = '';
    THEMES.forEach(function (t) {
      var activeClass = (currentTheme === t.id) ? ' active' : '';
      var dots = t.colors.map(function (c) {
        return '<span class="swatch-dot" style="background:' + c + '"></span>';
      }).join('');
      html +=
        '<div class="theme-option' + activeClass + '" data-theme="' + t.id + '">' +
          '<div class="theme-swatch">' + dots + '</div>' +
          '<span class="theme-name">' + t.name + '</span>' +
        '</div>';
    });
    return html;
  }

  // Create panel
  var panel = document.createElement('div');
  panel.id = 'theme-panel';
  panel.innerHTML =
    '<div class="panel-header">' +
      '<span class="panel-title"><span class="icon">🎨</span>主题切换</span>' +
      '<button class="panel-close" title="关闭">&times;</button>' +
    '</div>' +
    '<div class="panel-section-label">配色方案</div>' +
    '<div class="theme-grid">' + buildThemeGrid() + '</div>' +
    '<div class="panel-section-label">🖼 自定义背景</div>' +
    '<div class="bg-section">' +
      '<div class="bg-upload-area" id="bg-upload-area">' +
        '<div class="upload-icon">📷</div>' +
        '<div class="upload-text">点击或拖拽图片到这里</div>' +
        '<div class="upload-hint">建议 1920×1080 以上，JPG/PNG/WebP</div>' +
      '</div>' +
      '<div class="bg-url-row">' +
        '<input class="bg-url-input" id="bg-url-input" type="text" placeholder="或粘贴图片链接...">' +
        '<button class="bg-url-btn" id="bg-url-btn">应用</button>' +
      '</div>' +
      '<div class="bg-controls">' +
        '<div class="bg-control">' +
          '<label>透明度 <span id="opacity-val">35</span>%</label>' +
          '<input type="range" id="bg-opacity" min="5" max="80" value="35">' +
        '</div>' +
        '<div class="bg-control">' +
          '<label>模糊 <span id="blur-val">0</span>px</label>' +
          '<input type="range" id="bg-blur" min="0" max="20" value="0">' +
        '</div>' +
      '</div>' +
      '<button class="bg-remove-btn hidden" id="bg-remove-btn">✕ 移除背景</button>' +
    '</div>';

  // Hidden file input
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
  fileInput.style.display = 'none';

  // Append to body
  document.body.appendChild(trigger);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  document.body.appendChild(fileInput);

  // ============================================================
  // Theme functions
  // ============================================================

  function applyTheme(themeId) {
    document.body.setAttribute('data-theme', themeId);
    currentTheme = themeId;
    localStorage.setItem(STORAGE_KEY_THEME, themeId);

    // Update active state in panel
    var opts = panel.querySelectorAll('.theme-option');
    opts.forEach(function (el) {
      if (el.getAttribute('data-theme') === themeId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update music bar dynamically
    updateMusicBar(themeId);
  }

  function updateMusicBar(themeId) {
    var bar = document.getElementById('music-bar');
    var mpanel = document.getElementById('music-panel');
    if (!bar || !mpanel) return;

    // Theme-specific music bar colors
    var styles = {
      'wechat': {
        bg: 'rgba(255,255,255,0.90)',
        border: 'rgba(0,0,0,0.06)',
        title: '#191919',
        sub: '#8E8E93',
        accent: '#07C160',
        shadow: 'rgba(0,0,0,0.05)'
      },
      'warm-beige': {
        bg: 'rgba(245,240,232,0.92)',
        border: 'rgba(139,111,71,0.12)',
        title: '#4a3728',
        sub: '#a09080',
        accent: '#8B6F47',
        shadow: 'rgba(139,111,71,0.08)'
      },
      'sky-blue': {
        bg: 'rgba(245,249,252,0.90)',
        border: 'rgba(91,155,213,0.10)',
        title: '#2C3E50',
        sub: '#7F8C8D',
        accent: '#5B9BD5',
        shadow: 'rgba(91,155,213,0.06)'
      },
      'dusk-pink': {
        bg: 'rgba(253,248,245,0.90)',
        border: 'rgba(212,149,139,0.10)',
        title: '#4A3535',
        sub: '#9A8A8A',
        accent: '#D4958B',
        shadow: 'rgba(212,149,139,0.06)'
      },
      'mint': {
        bg: 'rgba(245,250,248,0.90)',
        border: 'rgba(95,171,141,0.10)',
        title: '#2D3E35',
        sub: '#7A8D83',
        accent: '#5FAB8D',
        shadow: 'rgba(95,171,141,0.06)'
      },
      'minimal': {
        bg: 'rgba(250,250,250,0.90)',
        border: 'rgba(0,0,0,0.06)',
        title: '#1A1A1A',
        sub: '#8C8C8C',
        accent: '#3A3A3A',
        shadow: 'rgba(0,0,0,0.04)'
      }
    };

    var s = styles[themeId] || styles['warm-beige'];
    bar.style.background = s.bg;
    bar.style.borderTop = '1px solid ' + s.border;
    bar.style.boxShadow = '0 -2px 20px ' + s.shadow;
    mpanel.style.background = s.bg;
    mpanel.style.border = '1px solid ' + s.border;
    mpanel.style.boxShadow = '0 8px 40px ' + s.shadow;

    // Update text colors
    var barTitle = bar.querySelector('.bar-title');
    var barSub = bar.querySelector('.bar-sub');
    var barBtns = bar.querySelectorAll('.bar-btn');
    var toggleBtn = bar.querySelector('.bar-btn-toggle');
    if (barTitle) barTitle.style.color = s.title;
    if (barSub) barSub.style.color = s.sub;
    barBtns.forEach(function (b) { b.style.color = s.accent; });
    if (toggleBtn) {
      toggleBtn.style.background = s.accent;
      toggleBtn.style.color = '#fff';
    }

    // Update panel header
    var panelHeader = mpanel.querySelector('.panel-header span');
    if (panelHeader) panelHeader.style.color = s.title;
  }

  // ============================================================
  // Panel toggle
  // ============================================================

  function openPanel() {
    panelOpen = true;
    panel.classList.add('show');
    overlay.classList.add('show');
    trigger.style.transform = 'rotate(45deg)';
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('show');
    overlay.classList.remove('show');
    trigger.style.transform = 'rotate(0deg)';
  }

  function togglePanel() {
    if (panelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  // ============================================================
  // Background functions
  // ============================================================

  function applyBackground(dataUrl) {
    document.body.style.setProperty('--custom-bg-url', 'url(' + dataUrl + ')');
    document.body.classList.add('custom-bg');
    localStorage.setItem(STORAGE_KEY_BG, dataUrl);

    // Show remove button
    var removeBtn = document.getElementById('bg-remove-btn');
    if (removeBtn) removeBtn.classList.remove('hidden');
  }

  function removeBackground() {
    document.body.style.removeProperty('--custom-bg-url');
    document.body.classList.remove('custom-bg');
    localStorage.removeItem(STORAGE_KEY_BG);

    var removeBtn = document.getElementById('bg-remove-btn');
    if (removeBtn) removeBtn.classList.add('hidden');
  }

  function setBgOpacity(val) {
    var opacity = val / 100;
    document.body.style.setProperty('--custom-bg-opacity', opacity);
    localStorage.setItem(STORAGE_KEY_BG_OPACITY, val);

    var label = document.getElementById('opacity-val');
    if (label) label.textContent = val;
  }

  function setBgBlur(val) {
    document.body.style.setProperty('--custom-bg-blur', val + 'px');
    localStorage.setItem(STORAGE_KEY_BG_BLUR, val);

    var label = document.getElementById('blur-val');
    if (label) label.textContent = val;
  }

  function handleFile(file) {
    if (!file || !file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
      alert('请选择 JPG、PNG、WebP 或 GIF 格式的图片');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过 10MB');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      applyBackground(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  // ============================================================
  // Initialize
  // ============================================================

  function init() {
    // Apply saved theme
    applyTheme(currentTheme);

    // Restore background
    var savedBg = localStorage.getItem(STORAGE_KEY_BG);
    if (savedBg) {
      applyBackground(savedBg);
    }

    // Restore opacity
    var savedOpacity = localStorage.getItem(STORAGE_KEY_BG_OPACITY);
    if (savedOpacity) {
      setBgOpacity(parseInt(savedOpacity, 10));
      var opacitySlider = document.getElementById('bg-opacity');
      if (opacitySlider) opacitySlider.value = savedOpacity;
    }

    // Restore blur
    var savedBlur = localStorage.getItem(STORAGE_KEY_BG_BLUR);
    if (savedBlur) {
      setBgBlur(parseInt(savedBlur, 10));
      var blurSlider = document.getElementById('bg-blur');
      if (blurSlider) blurSlider.value = savedBlur;
    }
  }

  // ============================================================
  // Event listeners
  // ============================================================

  // Trigger button
  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    togglePanel();
  });

  // Overlay click → close
  overlay.addEventListener('click', function () {
    closePanel();
  });

  // Close button
  panel.addEventListener('click', function (e) {
    var closeBtn = e.target.closest('.panel-close');
    if (closeBtn) {
      closePanel();
      return;
    }

    // Theme selection
    var themeOpt = e.target.closest('.theme-option');
    if (themeOpt) {
      var themeId = themeOpt.getAttribute('data-theme');
      if (themeId && themeId !== currentTheme) {
        applyTheme(themeId);
      }
    }
  });

  // Upload area click
  panel.addEventListener('click', function (e) {
    var uploadArea = e.target.closest('#bg-upload-area');
    if (uploadArea) {
      fileInput.click();
    }
  });

  // URL apply button
  panel.addEventListener('click', function (e) {
    var urlBtn = e.target.closest('#bg-url-btn');
    if (urlBtn) {
      var urlInput = document.getElementById('bg-url-input');
      if (urlInput.value.trim()) {
        // Create an image to verify URL works
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          applyBackground(canvas.toDataURL('image/jpeg', 0.85));
          urlInput.value = '';
        };
        img.onerror = function () {
          alert('无法加载图片，请检查链接是否有效');
        };
        img.src = urlInput.value.trim();
      }
    }
  });

  // Remove bg button
  panel.addEventListener('click', function (e) {
    var removeBtn = e.target.closest('#bg-remove-btn');
    if (removeBtn) {
      removeBackground();
    }
  });

  // File input change
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) {
      handleFile(fileInput.files[0]);
      fileInput.value = '';
    }
  });

  // Drag & drop
  panel.addEventListener('dragover', function (e) {
    var uploadArea = e.target.closest('#bg-upload-area');
    if (uploadArea) {
      e.preventDefault();
      uploadArea.style.borderColor = 'var(--accent)';
      uploadArea.style.background = 'var(--accent-light)';
    }
  });

  panel.addEventListener('dragleave', function (e) {
    var uploadArea = e.target.closest('#bg-upload-area');
    if (uploadArea) {
      uploadArea.style.borderColor = '';
      uploadArea.style.background = '';
    }
  });

  panel.addEventListener('drop', function (e) {
    var uploadArea = e.target.closest('#bg-upload-area');
    if (uploadArea) {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      uploadArea.style.background = '';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    }
  });

  // Opacity slider
  panel.addEventListener('input', function (e) {
    if (e.target.id === 'bg-opacity') {
      setBgOpacity(parseInt(e.target.value, 10));
    }
    if (e.target.id === 'bg-blur') {
      setBgBlur(parseInt(e.target.value, 10));
    }
  });

  // Keyboard shortcut
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panelOpen) {
      closePanel();
    }
  });

  // Close panel on outside click
  document.addEventListener('click', function (e) {
    if (panelOpen && !panel.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
      closePanel();
    }
  });

  // ============================================================
  // Start
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

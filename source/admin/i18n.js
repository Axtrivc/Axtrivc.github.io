/* ============================================================
   Decap CMS 中文化 + 头像圆形预览
   ============================================================ */

// 等待 Decap CMS 完全加载
function waitFor(selector, callback, tries = 0) {
  var el = document.querySelector(selector);
  if (el) return callback(el);
  if (tries > 30) return;
  setTimeout(function () { waitFor(selector, callback, tries + 1); }, 200);
}

// ===== 1. 翻译静态文本 =====
var TRANSLATIONS = {
  // 顶部导航
  'Content': '内容',
  'Workflow': '工作流',
  'Media': '媒体库',
  'Search': '搜索',
  'Quick add': '快速添加',
  // 集合页
  'Collections': '内容集合',
  'Quick add': '新建',
  // 按钮
  'Publish now': '立即发布',
  'Save': '保存',
  'Delete': '删除',
  'Edit': '编辑',
  'View Live': '查看线上',
  'New': '新建',
  'and published': '已发布',
  'as a draft': '草稿',
  // 字段
  'CHANGES SAVED': '已保存',
  'UNSAVED CHANGES': '未保存',
  'OPTIONAL': '选填',
  'Choose an image': '选择图片',
  'Insert from URL': '从 URL 插入',
  'Upload an image': '上传图片',
  'Drag and drop an image here, or click to browse': '拖拽图片到这里，或点击选择文件',
  'Browse files': '选择文件',
  'Search for an image': '搜索图片',
  'Choose existing image': '选择已有图片',
  // 状态
  'Published': '已发布',
  'Draft': '草稿',
  'Editing': '编辑中',
  'in the': '在',
  'collection': '集合',
  'Published on': '发布于',
  'Last modified': '最后修改',
  // 设置
  'Editorial workflow': '编辑工作流',
  // 登录页
  'Login with GitHub': '使用 GitHub 登录',
  'Go back to site': '返回网站',
  // 提示
  'Are you sure': '确定吗',
  'This action cannot be undone': '此操作无法撤销',
  // 列表
  'Add': '添加',
  'Sort by': '排序',
  'Filters': '筛选',
  'Every published entry': '所有已发布条目',
  'No entries': '暂无条目',
};

function translateText(text) {
  if (!text) return text;
  var trimmed = text.trim();
  if (TRANSLATIONS[trimmed]) return TRANSLATIONS[trimmed];
  return text;
}

function applyTranslations() {
  // 按钮文本
  document.querySelectorAll('button, .nc-collectionPage-topHomeLink, .nc-collectionPage-topQuery, a, span, div').forEach(function (el) {
    if (el.children.length === 0 && el.textContent.trim()) {
      var translated = translateText(el.textContent);
      if (translated !== el.textContent) {
        el.textContent = translated;
      }
    }
  });

  // placeholder
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(function (el) {
    var p = el.getAttribute('placeholder');
    var t = translateText(p);
    if (t !== p) el.setAttribute('placeholder', t);
  });
}

// ===== 2. 头像字段：圆形预览 =====
function addAvatarPreview() {
  // 找到 avatar 字段的容器
  var avatarLabels = document.querySelectorAll('.nc-field-control-label');
  var avatarField = null;
  for (var i = 0; i < avatarLabels.length; i++) {
    if (avatarLabels[i].textContent.indexOf('头像') !== -1 || avatarLabels[i].textContent.indexOf('avatar') !== -1) {
      avatarField = avatarLabels[i].closest('.nc-field-control, [class*="field"]');
      break;
    }
  }

  if (!avatarField) return;
  if (avatarField.querySelector('.avatar-preview-box')) return; // 已加过

  // 创建预览框
  var preview = document.createElement('div');
  preview.className = 'avatar-preview-box';
  preview.innerHTML = ''
    + '<div class="avatar-preview-title">圆形预览（实际显示效果）</div>'
    + '<div class="avatar-preview-container">'
    + '<div class="avatar-preview-circle" id="avatar-preview-circle">'
    + '<span class="avatar-preview-placeholder">未上传</span>'
    + '</div>'
    + '<div class="avatar-preview-sizes">'
    + '<div class="size-item"><div class="size-demo size-lg"></div><span>大（侧边栏）</span></div>'
    + '<div class="size-item"><div class="size-demo size-md"></div><span>中（评论区）</span></div>'
    + '<div class="size-item"><div class="size-demo size-sm"></div><span>小</span></div>'
    + '</div>'
    + '</div>';

  avatarField.appendChild(preview);

  // 监听图片 URL 变化
  var observer = new MutationObserver(function (mutations) {
    updateAvatarPreview(avatarField);
  });
  observer.observe(avatarField, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

  // 初次更新
  setTimeout(function () { updateAvatarPreview(avatarField); }, 300);
}

function updateAvatarPreview(avatarField) {
  // 找到图片
  var img = avatarField.querySelector('.nc-imageControl-image img, img[src*="/img/"], img[src*="avatar"]');
  var circle = avatarField.querySelector('#avatar-preview-circle');
  if (!circle) return;

  if (img && img.src) {
    circle.style.backgroundImage = 'url(' + img.src + ')';
    circle.classList.add('has-image');
    var placeholder = circle.querySelector('.avatar-preview-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    // 同步到不同尺寸
    var demos = avatarField.querySelectorAll('.size-demo');
    demos.forEach(function (d) {
      d.style.backgroundImage = 'url(' + img.src + ')';
      d.classList.add('has-image');
    });
  }
}

// ===== 3. 注入 CSS =====
function injectCSS() {
  if (document.getElementById('axtrivc-cms-i18n-css')) return;
  var css = document.createElement('style');
  css.id = 'axtrivc-cms-i18n-css';
  css.textContent = ''
    + '.avatar-preview-box {'
    + '  margin-top: 16px;'
    + '  padding: 16px;'
    + '  background: #F7F9FA;'
    + '  border-radius: 8px;'
    + '  border: 1px dashed #C8D0D8;'
    + '}'
    + '.avatar-preview-title {'
    + '  font-size: 12px;'
    + '  color: #57606A;'
    + '  font-weight: 600;'
    + '  margin-bottom: 12px;'
    + '}'
    + '.avatar-preview-container {'
    + '  display: flex;'
    + '  align-items: center;'
    + '  gap: 20px;'
    + '  flex-wrap: wrap;'
    + '}'
    + '.avatar-preview-circle {'
    + '  width: 96px;'
    + '  height: 96px;'
    + '  border-radius: 50%;'
    + '  background: #E1E4E8;'
    + '  background-size: cover;'
    + '  background-position: center;'
    + '  border: 2px solid #fff;'
    + '  box-shadow: 0 2px 8px rgba(0,0,0,0.12);'
    + '  display: flex;'
    + '  align-items: center;'
    + '  justify-content: center;'
    + '  flex-shrink: 0;'
    + '}'
    + '.avatar-preview-circle.has-image {'
    + '  background-color: transparent;'
    + '}'
    + '.avatar-preview-placeholder {'
    + '  color: #6A737D;'
    + '  font-size: 11px;'
    + '}'
    + '.avatar-preview-sizes {'
    + '  display: flex;'
    + '  gap: 12px;'
    + '  align-items: flex-end;'
    + '}'
    + '.size-item {'
    + '  display: flex;'
    + '  flex-direction: column;'
    + '  align-items: center;'
    + '  gap: 4px;'
    + '}'
    + '.size-item span {'
    + '  font-size: 10px;'
    + '  color: #6A737D;'
    + '}'
    + '.size-demo {'
    + '  border-radius: 50%;'
    + '  background: #E1E4E8;'
    + '  background-size: cover;'
    + '  background-position: center;'
    + '  border: 1px solid #fff;'
    + '  box-shadow: 0 1px 4px rgba(0,0,0,0.1);'
    + '}'
    + '.size-lg { width: 48px; height: 48px; }'
    + '.size-md { width: 32px; height: 32px; }'
    + '.size-sm { width: 22px; height: 22px; }'
    + '.size-demo.has-image { background-color: transparent; }'
    + '';
  document.head.appendChild(css);
}

// ===== 主入口 =====
function init() {
  injectCSS();

  // 定期应用翻译（Decap CMS 是 SPA，路由切换后要重新翻译）
  applyTranslations();
  setInterval(applyTranslations, 1500);

  // 监听 URL 变化，进入站点设置页面时添加预览
  var lastUrl = '';
  setInterval(function () {
    var url = location.hash;
    if (url !== lastUrl) {
      lastUrl = url;
      if (url.indexOf('settings') !== -1) {
        waitFor('.nc-field-control', addAvatarPreview);
      }
    }
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

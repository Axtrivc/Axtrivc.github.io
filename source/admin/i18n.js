/* ============================================================
   Decap CMS 中文化 + 头像圆形预览 v2
   策略：
   - 用 MutationObserver 持续监听整个 #nc-root 节点变化
   - 翻译用 childList + characterData 双重监听
   - 头像预览用 src 属性观察，延迟挂载避免竞态
   ============================================================ */

(function () {
  'use strict';

  // ========== 翻译表 ==========
  var T = {
    // 顶部导航
    'Content': '内容',
    'Workflow': '工作流',
    'Media': '媒体库',
    'Search': '搜索',
    'Quick add': '新建',
    // 按钮 / 操作
    'Publish': '发布',
    'Publish now': '立即发布',
    'Save': '保存',
    'Delete': '删除',
    'Delete unpublished changes': '删除未发布的修改',
    'Edit': '编辑',
    'View Live': '查看线上',
    'New': '新建',
    'Add': '添加',
    'Cancel': '取消',
    'Close': '关闭',
    'Status: Draft': '状态：草稿',
    'Status: Published': '状态：已发布',
    'Status: Pending review': '状态：待审核',
    'Check for preview': '检查预览',
    'Check for Preview': '检查预览',
    // 集合
    'Collections': '内容集合',
    'collection': '集合',
    'Collection': '集合',
    'in the': '在',
    'Published': '已发布',
    'Draft': '草稿',
    'Drafts': '草稿',
    'Pending review': '待审核',
    'Writing in': '正在编辑',
    'and published': '已发布',
    'as a draft': '作为草稿',
    'Published on': '发布于',
    'Last modified': '最后修改',
    // 字段提示
    'CHANGES SAVED': '已保存',
    'UNSAVED CHANGES': '未保存的修改',
    'OPTIONAL': '选填',
    'OPTIONAL FIELD': '选填',
    'REQUIRED': '必填',
    'REQUIRED FIELD': '必填',
    'CHANGES SAVED': '修改已保存',
    'UNSAVED CHANGES': '未保存的修改',
    'Writing in': '正在编辑',
    'in the': '在',
    'collection': '集合',
    'Collection': '集合',
    'Checking preview': '检查预览中',
    // 图片选择器
    'Choose an image': '选择图片',
    'Choose different image': '更换图片',
    'Insert from URL': '从 URL 插入',
    'Replace with URL': '替换为 URL',
    'Upload an image': '上传图片',
    'Remove image': '移除图片',
    'Drag and drop an image here, or click to browse': '拖拽图片到这里，或点击选择文件',
    'Browse files': '选择文件',
    'Search for an image': '搜索图片',
    'Choose existing image': '选择已有图片',
    // 列表
    'Sort by': '排序',
    'Filters': '筛选',
    'Every published entry': '所有已发布条目',
    'No entries': '暂无条目',
    'No results': '没有结果',
    // 登录
    'Login with GitHub': '使用 GitHub 登录',
    'Go back to site': '返回网站',
    'Logging in...': '登录中...',
    // 工作流
    'Editorial workflow': '编辑工作流',
    'Review': '审核',
    'Ready to publish': '待发布',
    // 设置
    'Documentation': '文档',
    'Settings': '设置',
    // 其他
    'Are you sure': '确定吗',
    'This action cannot be undone': '此操作无法撤销',
    'Loading': '加载中',
    'Loading...': '加载中...',
    'Error': '错误',
    'Unknown error': '未知错误',
  };

  // 复合短语（含变量）
  function translateComplex(text) {
    if (!text) return text;
    // "Writing in XXX collection" → "正在编辑 XXX 集合"
    var m = text.match(/^Writing in (.+) collection$/);
    if (m) return '正在编辑 ' + m[1] + ' 集合';
    // "1 entry" / "X entries"
    m = text.match(/^(\d+) entries?$/);
    if (m) return m[1] + ' 篇';
    // "Status: X"
    m = text.match(/^Status:\s*(.+)$/);
    if (m) return '状态：' + (T[m[1]] || m[1]);
    return null;
  }

  function translate(text) {
    if (!text) return text;
    var t = text.trim();
    if (T[t]) return T[t];
    var c = translateComplex(text);
    if (c) return c;
    return text;
  }

  // ========== DOM 翻译引擎 ==========
  function translateNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    // 跳过已翻译标记
    if (node.dataset && node.dataset.axTr) return;

    // 处理文本节点和叶子元素
    var walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    var textNodes = [];
    var n;
    while ((n = walker.nextNode())) textNodes.push(n);

    textNodes.forEach(function (textNode) {
      var original = textNode.nodeValue;
      if (!original || !original.trim()) return;
      // 检查父级是否已处理
      var parent = textNode.parentElement;
      if (parent && parent.dataset && parent.dataset.axTr) return;

      var translated = translate(original);
      if (translated !== original) {
        textNode.nodeValue = translated;
        if (parent) parent.dataset.axTr = '1';
      }
    });

    // placeholder
    node.querySelectorAll && node.querySelectorAll('[placeholder]').forEach(function (el) {
      var p = el.getAttribute('placeholder');
      var t = translate(p);
      if (t !== p) {
        el.setAttribute('placeholder', t);
        el.dataset.axTr = '1';
      }
    });

    // aria-label
    node.querySelectorAll && node.querySelectorAll('[aria-label]').forEach(function (el) {
      var a = el.getAttribute('aria-label');
      var t = translate(a);
      if (t !== a) el.setAttribute('aria-label', t);
    });

    // title
    node.querySelectorAll && node.querySelectorAll('[title]').forEach(function (el) {
      var ti = el.getAttribute('title');
      var t = translate(ti);
      if (t !== ti) el.setAttribute('title', t);
    });
  }

  // ========== 头像圆形预览 ==========
  function injectPreviewCSS() {
    if (document.getElementById('ax-avatar-preview-css')) return;
    var css = document.createElement('style');
    css.id = 'ax-avatar-preview-css';
    css.textContent =
      '.ax-avatar-preview {' +
      '  margin-top: 16px; padding: 18px;' +
      '  background: linear-gradient(180deg, #FAFBFC 0%, #F4F6F8 100%);' +
      '  border-radius: 10px; border: 1px dashed #B0B8C1;' +
      '}' +
      '.ax-avatar-preview-title {' +
      '  font-size: 12px; color: #4A5568; font-weight: 600;' +
      '  margin-bottom: 14px; letter-spacing: 0.3px;' +
      '}' +
      '.ax-avatar-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }' +
      '.ax-avatar-main {' +
      '  width: 110px; height: 110px; border-radius: 50%;' +
      '  background: #E1E4E8; background-size: cover; background-position: center;' +
      '  border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);' +
      '  display: flex; align-items: center; justify-content: center;' +
      '  flex-shrink: 0; transition: all 0.2s;' +
      '}' +
      '.ax-avatar-main.has-image { background-color: transparent; }' +
      '.ax-avatar-placeholder { color: #8B95A1; font-size: 12px; text-align: center; }' +
      '.ax-avatar-sizes { display: flex; gap: 14px; align-items: flex-end; }' +
      '.ax-size-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }' +
      '.ax-size-item span { font-size: 10px; color: #6A737D; white-space: nowrap; }' +
      '.ax-size-demo {' +
      '  border-radius: 50%; background: #E1E4E8; background-size: cover; background-position: center;' +
      '  border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.1);' +
      '}' +
      '.ax-size-demo.has-image { background-color: transparent; }' +
      '.ax-size-lg { width: 56px; height: 56px; }' +
      '.ax-size-md { width: 36px; height: 36px; }' +
      '.ax-size-sm { width: 24px; height: 24px; }';
    document.head.appendChild(css);
  }

  function buildAvatarPreview() {
    var box = document.createElement('div');
    box.className = 'ax-avatar-preview';
    box.innerHTML =
      '<div class="ax-avatar-preview-title">圆形预览（实际显示效果）</div>' +
      '<div class="ax-avatar-row">' +
      '  <div class="ax-avatar-main" id="ax-main-preview">' +
      '    <span class="ax-avatar-placeholder">未上传<br>头像</span>' +
      '  </div>' +
      '  <div class="ax-avatar-sizes">' +
      '    <div class="ax-size-item"><div class="ax-size-demo ax-size-lg"></div><span>大 · 侧栏</span></div>' +
      '    <div class="ax-size-item"><div class="ax-size-demo ax-size-md"></div><span>中 · 评论</span></div>' +
      '    <div class="ax-size-item"><div class="ax-size-demo ax-size-sm"></div><span>小 · 列表</span></div>' +
      '  </div>' +
      '</div>';
    return box;
  }

  function updateAvatarPreview(src) {
    var main = document.getElementById('ax-main-preview');
    if (!main) return;
    var demos = document.querySelectorAll('.ax-size-demo');
    var placeholder = main.querySelector('.ax-avatar-placeholder');

    if (src) {
      main.style.backgroundImage = 'url(' + src + ')';
      main.classList.add('has-image');
      if (placeholder) placeholder.style.display = 'none';
      demos.forEach(function (d) {
        d.style.backgroundImage = 'url(' + src + ')';
        d.classList.add('has-image');
      });
    } else {
      main.style.backgroundImage = '';
      main.classList.remove('has-image');
      if (placeholder) placeholder.style.display = '';
      demos.forEach(function (d) {
        d.style.backgroundImage = '';
        d.classList.remove('has-image');
      });
    }
  }

  function findAvatarField() {
    // 找到头像字段容器
    var controls = document.querySelectorAll('[class*="nc-field-control"], [class*="field-control"]');
    for (var i = 0; i < controls.length; i++) {
      var label = controls[i].querySelector('[class*="label"]');
      if (label && (label.textContent.indexOf('头像') !== -1 || label.textContent.toLowerCase().indexOf('avatar') !== -1)) {
        return controls[i];
      }
    }
    // 备用：直接找包含 "头像" 文本的最近容器
    var all = document.querySelectorAll('label, .nc-field-control-label, [class*="label"]');
    for (var j = 0; j < all.length; j++) {
      if (all[j].textContent.indexOf('头像') !== -1 || all[j].textContent.toLowerCase().indexOf('avatar') !== -1) {
        return all[j].closest('[class*="field"]') || all[j].parentElement;
      }
    }
    return null;
  }

  function findAvatarImageSrc() {
    // 找到当前头像图片的 src
    var imgs = document.querySelectorAll('[class*="nc-imageControl"] img, [class*="image-control"] img, .nc-imageControl-image img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].src && imgs[i].src.indexOf('data:') !== 0) return imgs[i].src;
    }
    // 备用：任何包含 /img/ 的图片
    var all = document.querySelectorAll('img[src*="/img/"]');
    for (var j = 0; j < all.length; j++) {
      if (all[j].src && all[j].complete) return all[j].src;
    }
    return null;
  }

  function mountAvatarPreview() {
    var field = findAvatarField();
    if (!field) return false;
    if (field.querySelector('.ax-avatar-preview')) return true; // 已挂载

    var preview = buildAvatarPreview();
    field.appendChild(preview);

    // 初次更新
    setTimeout(function () {
      var src = findAvatarImageSrc();
      updateAvatarPreview(src);
    }, 200);

    return true;
  }

  // ========== 主入口 ==========
  function init() {
    injectPreviewCSS();

    // 1. 翻译：监听整个 CMS 根节点
    var cmsRoot = document.getElementById('nc-root') || document.body;

    var translationObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            translateNode(node);
          }
        });
      });
    });
    translationObserver.observe(cmsRoot, { childList: true, subtree: true });

    // 初次全量翻译
    translateNode(cmsRoot);

    // 2. 头像预览：监听 URL 变化
    var lastHash = '';
    var avatarCheckInterval = setInterval(function () {
      // 进入 settings 页面时挂载预览
      if (location.hash.indexOf('settings') !== -1) {
        if (mountAvatarPreview()) {
          // 挂载成功后，监听图片变化
          var field = findAvatarField();
          if (field && !field.dataset.axAvatarObserved) {
            field.dataset.axAvatarObserved = '1';
            var imgObserver = new MutationObserver(function () {
              var src = findAvatarImageSrc();
              updateAvatarPreview(src);
            });
            imgObserver.observe(field, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['src'],
            });
          }
        }
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // 等 CMS 框架先加载
    setTimeout(init, 500);
  }
})();

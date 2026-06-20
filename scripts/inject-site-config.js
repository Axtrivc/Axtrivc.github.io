hexo.extend.filter.register('after_post_render', function (data) {
  // 留空 - 预留扩展点
  return data;
});

// 注入站点配置到 window 全局变量
hexo.extend.filter.register('before_generate', function () {
  const fs = require('fs');
  const path = require('path');
  const yaml = require('js-yaml');

  let cfg = {};
  try {
    const cfgPath = path.join(hexo.source_dir, '_data', 'site_config.yml');
    if (fs.existsSync(cfgPath)) {
      cfg = yaml.load(fs.readFileSync(cfgPath, 'utf8')) || {};
    }
  } catch (e) {
    hexo.log.warn('读取 site_config.yml 失败:', e.message);
  }

  // 注入到所有页面的 inject script
  const script = '<script>window.AXTRIVC_SITE_CONFIG = ' + JSON.stringify(cfg) + ';</script>';
  hexo.theme.config.inject = hexo.theme.config.inject || {};
  hexo.theme.config.inject.bottom = hexo.theme.config.inject.bottom || [];
  hexo.theme.config.inject.bottom.unshift(script);
});

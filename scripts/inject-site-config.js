// 注入站点配置到 window 全局变量
hexo.extend.filter.register('before_generate', function () {
  const fs = require('fs');
  const path = require('path');
  const yaml = require('js-yaml');

  // 幂等检查：防止热重载时重复注入
  if (hexo.theme.config.inject && hexo.theme.config.inject.bottom &&
      hexo.theme.config.inject.bottom[0] &&
      typeof hexo.theme.config.inject.bottom[0] === 'string' &&
      hexo.theme.config.inject.bottom[0].includes('AXTRIVC_SITE_CONFIG')) {
    return;
  }

  let cfg = {};
  try {
    const cfgPath = path.join(hexo.source_dir, '_data', 'site_config.yml');
    if (fs.existsSync(cfgPath)) {
      cfg = yaml.load(fs.readFileSync(cfgPath, 'utf8')) || {};
    }
  } catch (e) {
    hexo.log.warn('读取 site_config.yml 失败:', e.message);
  }

  // 安全序列化：转义 </script>、U+2028、U+2029，防止 HTML 注入
  const safeJson = JSON.stringify(cfg)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const script = '<script>window.AXTRIVC_SITE_CONFIG = ' + safeJson + ';</script>';
  hexo.theme.config.inject = hexo.theme.config.inject || {};
  hexo.theme.config.inject.bottom = hexo.theme.config.inject.bottom || [];
  hexo.theme.config.inject.bottom.unshift(script);
});

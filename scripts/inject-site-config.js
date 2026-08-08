// 注入站点配置到 window 全局变量
hexo.extend.filter.register('before_generate', function () {
  const fs = require('fs');
  const path = require('path');
  const yaml = require('js-yaml');

  // 幂等检查：防止热重载时重复注入。全表扫描而非只看 [0]——
  // 若别的插件向 inject.bottom 头部 unshift, 会把本脚本挤到非 0 位, 只查 [0] 会误判未注入。
  var bottom = (hexo.theme.config.inject && hexo.theme.config.inject.bottom) || [];
  var already = bottom.some(function (s) {
    return typeof s === 'string' && s.indexOf('AXTRIVC_SITE_CONFIG') !== -1;
  });
  if (already) {
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

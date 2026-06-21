/**
 * 自动给 inject 的 CSS/JS 资源 URL 加版本号（git commit hash 短摘要）
 *
 * 用法：
 *   - 所有 inject 里的 <link>/<script> 路径里写占位符 {{cache_bust}}
 *   - 这个 filter 在 before_generate 时拿到 git hash，替换所有占位符
 *   - 如果拿不到 git（如 CI 环境异常），降级用时间戳
 *
 * 好处：再也不用手动维护 ?v=20260621a 这种版本号了
 */
hexo.extend.filter.register('before_generate', function () {
  var hash = '';
  try {
    var execSync = require('child_process').execSync;
    hash = execSync('git rev-parse --short HEAD', { cwd: hexo.base_dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    // git 不可用时降级：用当天日期
    hash = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  var inject = hexo.theme.config && hexo.theme.config.inject;
  if (!inject) return;

  ['head', 'bottom'].forEach(function (key) {
    var arr = inject[key];
    if (!Array.isArray(arr)) return;
    inject[key] = arr.map(function (item) {
      if (typeof item === 'string' && item.indexOf('{{cache_bust}}') !== -1) {
        return item.replace(/\{\{cache_bust\}\}/g, hash);
      }
      return item;
    });
  });
});

/**
 * 首页摘要修复(足球日报等含内联 <style>/<script> 的文章)
 *
 * 问题: Butterfly 的 index_post_content(method 3) 用 hexo-util stripHTML 截断正文,
 * stripHTML 只去标签、保留标签内文本, 导致 <style> 块里的 CSS 原样出现在首页卡片预览。
 *
 * 修复: before_post_render 阶段, 对含 <style>/<script> 的文章预先算好 data.postDesc
 * (先删 style/script 整块再 stripHTML), Butterfly 的 postDesc() 发现 postDesc 已存在
 * 会直接使用, 不再从正文截断。优先使用 front-matter 的 excerpt。
 */
hexo.extend.filter.register('before_post_render', function (data) {
  if (!data || !data.content) return data;
  if (data.content.indexOf('<style') === -1 && data.content.indexOf('<script') === -1) return data;

  var util = require('hexo-util');
  var cleaned = data.content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');
  var text = util.stripHTML(cleaned).replace(/\s+/g, ' ').trim();

  var length = 500;
  var cfg = hexo.theme.config && hexo.theme.config.index_post_content;
  if (cfg && cfg.length) length = cfg.length;

  data.postDesc = data.excerpt || util.truncate(text, { length: length });
  return data;
});

---
title: 留言板
date: 2026-04-05 00:00:00
layout: page
top_img: false
aside: false
---

<style>
.board-page { max-width: 700px; margin: 0 auto; padding: 20px; }
.board-hero { text-align: center; padding: 30px 0 20px; }
.board-hero h2 { font-size: 26px; font-weight: 700; color: #4a3728; margin-bottom: 6px; }
.board-hero p { color: #8B6F47; font-size: 13px; }

/* Form */
.msg-form { background: #fff; border-radius: 14px; padding: 24px; margin-bottom: 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #4a3728; margin-bottom: 6px; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.form-group input, .form-group textarea {
  width: 100%; padding: 10px 14px; border: 1.5px solid #e0d5c5; border-radius: 8px;
  font-size: 13px; outline: none; transition: border-color 0.2s; background: #faf8f4; font-family: inherit; resize: vertical;
}
.form-group input:focus, .form-group textarea:focus { border-color: #8B6F47; }
.form-group textarea { min-height: 80px; }
.mood-picker { display: flex; gap: 8px; flex-wrap: wrap; }
.mood-btn { width: 38px; height: 38px; border-radius: 50%; border: 2px solid #e0d5c5; background: #fff; font-size: 18px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
.mood-btn:hover, .mood-btn.selected { border-color: #8B6F47; background: #f5eedf; transform: scale(1.1); }
.btn-submit { display: block; width: 100%; padding: 12px; background: #8B6F47; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 6px; }
.btn-submit:hover { background: #A0845C; }

/* Messages */
.msg-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.msg-list-header h3 { font-size: 16px; color: #4a3728; font-weight: 600; }
.msg-count { font-size: 12px; color: #a09080; background: #f0ebe3; padding: 4px 12px; border-radius: 12px; }

.msg-card { background: #fff; border-radius: 12px; padding: 18px; margin-bottom: 12px; box-shadow: 0 1px 6px rgba(0,0,0,0.04); animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.msg-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.msg-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #8B6F47, #C4A96A); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.msg-meta { flex: 1; }
.msg-name { font-weight: 600; color: #4a3728; font-size: 14px; }
.msg-time { font-size: 11px; color: #c4b49a; }
.msg-mood { font-size: 18px; }
.msg-content { color: #5a4a3a; font-size: 13px; line-height: 1.7; padding-left: 46px; }

.msg-empty { text-align: center; padding: 40px 20px; color: #c4b49a; font-size: 14px; }
.msg-empty span { font-size: 40px; display: block; margin-bottom: 12px; }

/* Reply */
.msg-reply { margin-top: 10px; padding-left: 46px; }
.msg-reply-item { background: #f9f5ef; border-radius: 8px; padding: 10px 14px; margin-bottom: 6px; font-size: 12px; }
.msg-reply-item .reply-name { font-weight: 600; color: #8B6F47; }
.msg-reply-form { display: flex; gap: 8px; margin-top: 8px; }
.msg-reply-form input { flex: 1; padding: 8px 12px; border: 1.5px solid #e0d5c5; border-radius: 6px; font-size: 12px; outline: none; background: #faf8f4; }
.msg-reply-form input:focus { border-color: #8B6F47; }
.msg-reply-form button { padding: 8px 16px; background: #8B6F47; color: #fff; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; white-space: nowrap; }

.msg-actions { padding-left: 46px; margin-top: 8px; }
.btn-reply-toggle { font-size: 12px; color: #a09080; background: none; border: none; cursor: pointer; padding: 0; }
.btn-reply-toggle:hover { color: #8B6F47; }
</style>

<div class="board-page">

  <div class="board-hero">
    <h2>💬 留言板</h2>
    <p>想说点什么就留下吧，匿名的也没关系～</p>
  </div>

  <!-- Form -->
  <div class="msg-form">
    <div class="form-row">
      <div class="form-group">
        <label>昵称</label>
        <input type="text" id="msgName" placeholder="叫什么好呢" maxlength="20" />
      </div>
    </div>
    <div class="form-group">
      <label>心情</label>
      <div class="mood-picker" id="moodPicker">
        <button type="button" class="mood-btn" data-mood="😊">😊</button>
        <button type="button" class="mood-btn" data-mood="🎉">🎉</button>
        <button type="button" class="mood-btn" data-mood="❤️">❤️</button>
        <button type="button" class="mood-btn" data-mood="🔥">🔥</button>
        <button type="button" class="mood-btn" data-mood="🤔">🤔</button>
        <button type="button" class="mood-btn" data-mood="😢">😢</button>
        <button type="button" class="mood-btn" data-mood="😴">😴</button>
        <button type="button" class="mood-btn" data-mood="🤡">🤡</button>
      </div>
    </div>
    <div class="form-group">
      <label>留言内容</label>
      <textarea id="msgContent" placeholder="写点什么吧..." maxlength="500"></textarea>
    </div>
    <button class="btn-submit" onclick="submitMsg()">留下足迹 🐾</button>
  </div>

  <!-- Messages -->
  <div class="msg-list-header">
    <h3>📮 所有留言</h3>
    <span class="msg-count" id="msgCount">0 条留言</span>
  </div>
  <div id="msgList"></div>

</div>

<script>
const STORAGE_KEY = 'axtrivc_messages';
let selectedMood = '😊';

// Mood picker
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMood = btn.dataset.mood;
  });
});
document.querySelector('.mood-btn').classList.add('selected');

function getMessages() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

function saveMessages(msgs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return mins + ' 分钟前';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' 小时前';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + ' 天前';
  return new Date(ts).toLocaleDateString('zh-CN');
}

function renderMessages() {
  const msgs = getMessages();
  const list = document.getElementById('msgList');
  document.getElementById('msgCount').textContent = msgs.length + ' 条留言';

  if (!msgs.length) {
    list.innerHTML = '<div class="msg-empty"><span>📭</span>还没有留言，来当第一个吧！</div>';
    return;
  }

  list.innerHTML = msgs.map((m, i) => `
    <div class="msg-card">
      <div class="msg-header">
        <div class="msg-avatar">${escapeHtml(m.name.charAt(0).toUpperCase())}</div>
        <div class="msg-meta">
          <div class="msg-name">${escapeHtml(m.name)}</div>
          <div class="msg-time">${timeAgo(m.time)}</div>
        </div>
        <div class="msg-mood">${m.mood}</div>
      </div>
      <div class="msg-content">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div>
      ${m.replies && m.replies.length ? `<div class="msg-reply">${m.replies.map(r => `<div class="msg-reply-item"><span class="reply-name">${escapeHtml(r.name)}</span>：${escapeHtml(r.content)}</div>`).join('')}</div>` : ''}
      <div class="msg-actions"><button class="btn-reply-toggle" onclick="toggleReply(${i})">💬 回复</button></div>
      <div class="msg-reply" id="reply-form-${i}" style="display:none">
        <div class="msg-reply-form">
          <input type="text" id="reply-name-${i}" placeholder="你的昵称" maxlength="20" />
          <input type="text" id="reply-content-${i}" placeholder="回复内容..." maxlength="200" />
          <button onclick="addReply(${i})">回复</button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleReply(idx) {
  const form = document.getElementById('reply-form-' + idx);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function addReply(idx) {
  const name = document.getElementById('reply-name-' + idx).value.trim();
  const content = document.getElementById('reply-content-' + idx).value.trim();
  if (!name || !content) return alert('昵称和内容都不能为空哦');
  const msgs = getMessages();
  if (!msgs[idx].replies) msgs[idx].replies = [];
  msgs[idx].replies.push({ name, content, time: Date.now() });
  saveMessages(msgs);
  renderMessages();
}

function submitMsg() {
  const name = document.getElementById('msgName').value.trim() || '匿名';
  const content = document.getElementById('msgContent').value.trim();
  if (!content) return alert('写点什么再提交吧～');
  const msgs = getMessages();
  msgs.unshift({ name, content, mood: selectedMood, time: Date.now(), replies: [] });
  saveMessages(msgs);
  document.getElementById('msgContent').value = '';
  renderMessages();
}

renderMessages();
</script>

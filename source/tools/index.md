---
title: 在线工具箱
date: 2026-04-05 00:00:00
layout: page
top_img: false
aside: false
---

<style>
.tools-page { max-width: 800px; margin: 0 auto; padding: 20px; }
.tools-hero { text-align: center; padding: 30px 0 24px; }
.tools-hero h2 { font-size: 26px; font-weight: 700; color: #4a3728; margin-bottom: 6px; }
.tools-hero p { color: #8B6F47; font-size: 13px; }

/* Tool Grid */
.tool-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 30px; }
.tool-card { background: #fff; border-radius: 14px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.25s; box-shadow: 0 1px 6px rgba(0,0,0,0.04); border: 2px solid transparent; }
.tool-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); border-color: #C4A96A; }
.tool-card.active { border-color: #8B6F47; box-shadow: 0 4px 16px rgba(139,111,71,0.15); }
.tool-icon { font-size: 32px; margin-bottom: 10px; }
.tool-name { font-weight: 600; color: #4a3728; font-size: 15px; margin-bottom: 4px; }
.tool-desc { font-size: 12px; color: #a09080; }

/* Tool Panel */
.tool-panel { display: none; background: #fff; border-radius: 16px; padding: 28px; box-shadow: 0 2px 16px rgba(0,0,0,0.05); animation: slideUp 0.3s ease; }
.tool-panel.active { display: block; }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.panel-title { font-size: 20px; font-weight: 700; color: #4a3728; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #f0ebe3; }

/* Common Form Styles */
.input-group { margin-bottom: 16px; }
.input-group label { display: block; font-size: 13px; font-weight: 600; color: #5a4a3a; margin-bottom: 6px; }
.input-group input, .input-group select {
  width: 100%; padding: 10px 14px; border: 1.5px solid #e0d5c5; border-radius: 8px;
  font-size: 14px; outline: none; transition: border-color 0.2s; background: #faf8f4; box-sizing: border-box;
}
.input-group input:focus, .input-group select:focus { border-color: #8B6F47; }
.form-row { display: flex; gap: 12px; margin-bottom: 16px; }
.form-row .input-group { flex: 1; margin-bottom: 0; }

.btn-primary { padding: 10px 28px; background: #8B6F47; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
.btn-primary:hover { background: #A0845C; }
.btn-secondary { padding: 10px 28px; background: #f0ebe3; color: #5a4a3a; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; transition: background 0.2s; }
.btn-secondary:hover { background: #e0d5c5; }

.result-box { background: linear-gradient(135deg, #faf8f4 0%, #f5eedf 100%); border-radius: 12px; padding: 20px; margin-top: 20px; }
.result-label { font-size: 12px; color: #a09080; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.result-value { font-size: 28px; font-weight: 700; color: #8B6F47; }
.result-sub { font-size: 13px; color: #a09080; margin-top: 6px; }

/* GPA Specific */
.gpa-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 16px; }
.gpa-table th { background: #f5eedf; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #5a4a3a; text-align: center; }
.gpa-table th:first-child { border-radius: 8px 0 0 0; }
.gpa-table th:last-child { border-radius: 0 8px 0 0; }
.gpa-table td { padding: 8px 10px; text-align: center; border-bottom: 1px solid #f0ebe3; }
.gpa-table input { width: 100%; padding: 6px 8px; border: 1px solid #e0d5c5; border-radius: 6px; text-align: center; font-size: 13px; outline: none; background: #fff; }
.gpa-table input:focus { border-color: #8B6F47; }
.gpa-table .btn-del { color: #d4a0a0; cursor: pointer; font-size: 16px; background: none; border: none; padding: 2px 6px; border-radius: 4px; }
.gpa-table .btn-del:hover { color: #c0392b; background: #fce4e4; }

/* Timer Specific */
.timer-display { text-align: center; padding: 40px 0; }
.timer-circle { width: 200px; height: 200px; border-radius: 50%; border: 4px solid #e0d5c5; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; position: relative; }
.timer-circle.running { border-color: #8B6F47; box-shadow: 0 0 30px rgba(139,111,71,0.15); }
.timer-text { font-size: 42px; font-weight: 700; color: #4a3728; font-variant-numeric: tabular-nums; }
.timer-label { font-size: 13px; color: #a09080; margin-top: 8px; }
.timer-btns { display: flex; gap: 12px; justify-content: center; }

/* Countdown Specific */
.countdown-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center; margin-bottom: 20px; }
.countdown-item { background: #faf8f4; border-radius: 12px; padding: 16px 8px; }
.countdown-num { font-size: 36px; font-weight: 700; color: #8B6F47; font-variant-numeric: tabular-nums; }
.countdown-unit { font-size: 12px; color: #a09080; margin-top: 4px; }

/* Converter Specific */
.convert-arrow { display: flex; align-items: center; justify-content: center; margin: 0 12px; color: #c4b49a; font-size: 18px; flex-shrink: 0; }

/* Color Picker */
.color-display { width: 100%; height: 80px; border-radius: 12px; margin-bottom: 16px; border: 2px solid #e0d5c5; }
.color-values { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.color-value { background: #faf8f4; padding: 10px 14px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; color: #5a4a3a; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.color-value:hover { background: #f0ebe3; }
.copy-hint { font-size: 10px; color: #c4b49a; }

@media (max-width: 500px) {
  .countdown-grid { grid-template-columns: repeat(2, 1fr); }
  .timer-text { font-size: 32px; }
  .form-row { flex-direction: column; }
}
</style>

<div class="tools-page">

  <div class="tools-hero">
    <h2>🧰 在线工具箱</h2>
    <p>一些实用的小工具，纯前端运行，数据不离开浏览器</p>
  </div>

  <!-- Tool Selector -->
  <div class="tool-grid">
    <div class="tool-card active" onclick="showTool('gpa')">
      <div class="tool-icon">📊</div>
      <div class="tool-name">GPA 计算器</div>
      <div class="tool-desc">加权平均 / 4.0 制</div>
    </div>
    <div class="tool-card" onclick="showTool('countdown')">
      <div class="tool-icon">⏳</div>
      <div class="tool-name">倒计时</div>
      <div class="tool-desc">考试 / 假期 / 生日</div>
    </div>
    <div class="tool-card" onclick="showTool('timer')">
      <div class="tool-icon">⏱️</div>
      <div class="tool-name">番茄钟</div>
      <div class="tool-desc">25 分钟专注 · 5 分钟休息</div>
    </div>
    <div class="tool-card" onclick="showTool('convert')">
      <div class="tool-icon">📐</div>
      <div class="tool-name">单位换算</div>
      <div class="tool-desc">长度 / 重量 / 温度</div>
    </div>
    <div class="tool-card" onclick="showTool('color')">
      <div class="tool-icon">🎨</div>
      <div class="tool-name">颜色选择器</div>
      <div class="tool-desc">HEX / RGB / HSL</div>
    </div>
    <div class="tool-card" onclick="showTool('json')">
      <div class="tool-icon">📋</div>
      <div class="tool-name">JSON 格式化</div>
      <div class="tool-desc">美化 / 压缩 / 校验</div>
    </div>
  </div>

  <!-- ========== GPA Calculator ========== -->
  <div class="tool-panel active" id="panel-gpa">
    <div class="panel-title">📊 GPA 计算器</div>
    <table class="gpa-table">
      <thead><tr><th style="width:40%">科目</th><th style="width:25%">成绩</th><th style="width:25%">学分</th><th style="width:10%"></th></tr></thead>
      <tbody id="gpaBody"></tbody>
    </table>
    <div style="display:flex;gap:10px;margin-bottom:20px">
      <button class="btn-secondary" onclick="addGpaRow()">+ 添加科目</button>
      <button class="btn-secondary" onclick="clearGpa()">清空</button>
    </div>
    <div class="result-box" id="gpaResult" style="display:none">
      <div class="result-label">加权平均 GPA（4.0 制）</div>
      <div class="result-value" id="gpaValue">0.00</div>
      <div class="result-sub" id="gpaDetail"></div>
    </div>
  </div>

  <!-- ========== Countdown ========== -->
  <div class="tool-panel" id="panel-countdown">
    <div class="panel-title">⏳ 倒计时</div>
    <div class="form-row">
      <div class="input-group">
        <label>事件名称</label>
        <input type="text" id="cdName" placeholder="高考" value="高考" />
      </div>
      <div class="input-group">
        <label>目标日期</label>
        <input type="date" id="cdDate" />
      </div>
    </div>
    <div style="margin-bottom:16px">
      <button class="btn-primary" onclick="startCountdown()">开始倒计时</button>
    </div>
    <div class="result-box" id="cdResult" style="display:none">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:14px;color:#5a4a3a;font-weight:600" id="cdTitle"></div>
      </div>
      <div class="countdown-grid">
        <div class="countdown-item"><div class="countdown-num" id="cdDays">0</div><div class="countdown-unit">天</div></div>
        <div class="countdown-item"><div class="countdown-num" id="cdHours">0</div><div class="countdown-unit">时</div></div>
        <div class="countdown-item"><div class="countdown-num" id="cdMins">0</div><div class="countdown-unit">分</div></div>
        <div class="countdown-item"><div class="countdown-num" id="cdSecs">0</div><div class="countdown-unit">秒</div></div>
      </div>
    </div>
    <div id="cdPresets" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <button class="btn-secondary" onclick="setPreset('高考', '2027-06-07')">🎯 高考 2027</button>
      <button class="btn-secondary" onclick="setPreset('暑假', '2026-07-01')">🏖️ 暑假</button>
      <button class="btn-secondary" onclick="setPreset('元旦', '2027-01-01')">🎆 元旦</button>
      <button class="btn-secondary" onclick="setPreset('春节', '2027-02-06')">🧧 春节</button>
    </div>
  </div>

  <!-- ========== Pomodoro Timer ========== -->
  <div class="tool-panel" id="panel-timer">
    <div class="panel-title">⏱️ 番茄钟</div>
    <div class="timer-display">
      <div class="timer-circle" id="timerCircle">
        <div class="timer-text" id="timerText">25:00</div>
      </div>
      <div class="timer-label" id="timerLabel">专注时间</div>
      <div class="timer-btns">
        <button class="btn-primary" id="timerStartBtn" onclick="toggleTimer()">开始专注</button>
        <button class="btn-secondary" onclick="resetTimer()">重置</button>
      </div>
      <div style="margin-top:16px;font-size:13px;color:#a09080">
        已完成 <strong id="pomodoroCount" style="color:#8B6F47">0</strong> 个番茄
      </div>
    </div>
  </div>

  <!-- ========== Unit Converter ========== -->
  <div class="tool-panel" id="panel-convert">
    <div class="panel-title">📐 单位换算</div>
    <div class="input-group">
      <label>换算类型</label>
      <select id="convType" onchange="updateConvUnits()">
        <option value="length">📏 长度</option>
        <option value="weight">⚖️ 重量</option>
        <option value="temp">🌡️ 温度</option>
        <option value="area">📐 面积</option>
      </select>
    </div>
    <div style="display:flex;align-items:flex-end;gap:0;margin-bottom:20px">
      <div class="input-group" style="flex:1">
        <label>数值</label>
        <input type="number" id="convFrom" value="1" oninput="convertUnit()" />
      </div>
      <div class="input-group" style="flex:1">
        <label>从</label>
        <select id="convFromUnit" onchange="convertUnit()"></select>
      </div>
      <div class="convert-arrow">→</div>
      <div class="input-group" style="flex:1">
        <label>到</label>
        <select id="convToUnit" onchange="convertUnit()"></select>
      </div>
    </div>
    <div class="result-box" id="convResult">
      <div class="result-label">换算结果</div>
      <div class="result-value" id="convValue">—</div>
    </div>
  </div>

  <!-- ========== Color Picker ========== -->
  <div class="tool-panel" id="panel-color">
    <div class="panel-title">🎨 颜色选择器</div>
    <div class="color-display" id="colorDisplay" style="background:#8B6F47"></div>
    <div class="input-group">
      <input type="color" id="colorPicker" value="#8B6F47" oninput="updateColor()" style="width:60px;height:40px;border:none;cursor:pointer;padding:0" />
    </div>
    <div class="color-values">
      <div class="color-value" onclick="copyColor('hex')"><span id="colorHex">#8B6F47</span><span class="copy-hint">点击复制</span></div>
      <div class="color-value" onclick="copyColor('rgb')"><span id="colorRgb">rgb(139, 111, 71)</span><span class="copy-hint">点击复制</span></div>
      <div class="color-value" onclick="copyColor('hsl')"><span id="colorHsl">hsl(36, 32%, 41%)</span><span class="copy-hint">点击复制</span></div>
      <div class="color-value" onclick="copyColor('css')"><span id="colorCss">color: #8B6F47</span><span class="copy-hint">点击复制</span></div>
    </div>
  </div>

  <!-- ========== JSON Formatter ========== -->
  <div class="tool-panel" id="panel-json">
    <div class="panel-title">📋 JSON 格式化</div>
    <div class="input-group">
      <label>输入 JSON</label>
      <textarea id="jsonInput" style="width:100%;min-height:120px;padding:10px 14px;border:1.5px solid #e0d5c5;border-radius:8px;font-size:13px;font-family:'Courier New',monospace;outline:none;background:#faf8f4;resize:vertical;box-sizing:border-box" placeholder='{"key": "value"}'></textarea>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <button class="btn-primary" onclick="formatJson(true)">美化</button>
      <button class="btn-secondary" onclick="formatJson(false)">压缩</button>
    </div>
    <div id="jsonError" style="color:#c0392b;font-size:13px;margin-bottom:10px;display:none"></div>
    <div class="result-box">
      <div class="result-label">输出结果</div>
      <pre id="jsonOutput" style="white-space:pre-wrap;word-break:break-all;font-size:13px;font-family:'Courier New',monospace;color:#5a4a3a;margin:8px 0 0">等待输入...</pre>
    </div>
  </div>

</div>

<script>
// ========== Tool Navigation ==========
function showTool(id) {
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('panel-' + id).classList.add('active');
}

// ========== GPA Calculator ==========
function gradeToGPA(grade) {
  const g = parseFloat(grade);
  if (g >= 90) return 4.0;
  if (g >= 85) return 3.7;
  if (g >= 82) return 3.3;
  if (g >= 78) return 3.0;
  if (g >= 75) return 2.7;
  if (g >= 72) return 2.3;
  if (g >= 68) return 2.0;
  if (g >= 64) return 1.5;
  if (g >= 60) return 1.0;
  return 0;
}

function addGpaRow(name='', grade='', credit='') {
  const tbody = document.getElementById('gpaBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input type="text" value="${name}" placeholder="科目名称"></td><td><input type="number" value="${grade}" placeholder="0-100" min="0" max="100" class="gpa-grade" oninput="calcGPA()"></td><td><input type="number" value="${credit}" placeholder="学分" min="0" step="0.5" class="gpa-credit" oninput="calcGPA()"></td><td><button class="btn-del" onclick="this.closest('tr').remove();calcGPA()">✕</button></td>`;
  tbody.appendChild(tr);
}

function clearGpa() {
  document.getElementById('gpaBody').innerHTML = '';
  document.getElementById('gpaResult').style.display = 'none';
}

function calcGPA() {
  const rows = document.querySelectorAll('#gpaBody tr');
  let totalWeight = 0, totalCredit = 0;
  rows.forEach(r => {
    const g = parseFloat(r.querySelector('.gpa-grade').value);
    const c = parseFloat(r.querySelector('.gpa-credit').value);
    if (!isNaN(g) && !isNaN(c) && c > 0) {
      totalWeight += gradeToGPA(g) * c;
      totalCredit += c;
    }
  });
  if (totalCredit > 0) {
    const gpa = (totalWeight / totalCredit).toFixed(2);
    document.getElementById('gpaValue').textContent = gpa;
    document.getElementById('gpaDetail').textContent = `共 ${rows.length} 门课，总学分 ${totalCredit}`;
    document.getElementById('gpaResult').style.display = 'block';
  }
}

// Init with some example rows
addGpaRow('语文', '', '5');
addGpaRow('数学', '', '5');
addGpaRow('英语', '', '4');
addGpaRow('物理', '', '4');
addGpaRow('化学', '', '3');

// ========== Countdown ==========
let cdInterval = null;
function setPreset(name, date) {
  document.getElementById('cdName').value = name;
  document.getElementById('cdDate').value = date;
  startCountdown();
}
function startCountdown() {
  const name = document.getElementById('cdName').value.trim() || '倒计时';
  const date = document.getElementById('cdDate').value;
  if (!date) return alert('请选择目标日期');
  const target = new Date(date + 'T00:00:00').getTime();
  if (cdInterval) clearInterval(cdInterval);
  document.getElementById('cdTitle').textContent = name;
  document.getElementById('cdResult').style.display = 'block';
  function update() {
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) {
      document.getElementById('cdDays').textContent = '0';
      document.getElementById('cdHours').textContent = '0';
      document.getElementById('cdMins').textContent = '0';
      document.getElementById('cdSecs').textContent = '0';
      document.getElementById('cdTitle').textContent = name + ' 已到！🎉';
      clearInterval(cdInterval);
      return;
    }
    document.getElementById('cdDays').textContent = Math.floor(diff / 86400000);
    document.getElementById('cdHours').textContent = Math.floor((diff % 86400000) / 3600000);
    document.getElementById('cdMins').textContent = Math.floor((diff % 3600000) / 60000);
    document.getElementById('cdSecs').textContent = Math.floor((diff % 60000) / 1000);
  }
  update();
  cdInterval = setInterval(update, 1000);
}

// ========== Pomodoro Timer ==========
let timerInterval = null, timerSeconds = 25 * 60, timerRunning = false, timerMode = 'focus', pomodoroCount = 0;
function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60), s = timerSeconds % 60;
  document.getElementById('timerText').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  document.getElementById('timerLabel').textContent = timerMode === 'focus' ? '专注时间' : '休息时间 ☕';
  document.title = (timerRunning ? (m + ':' + s + ' · ') : '') + '在线工具箱';
}
function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timerStartBtn').textContent = '继续';
    document.getElementById('timerCircle').classList.remove('running');
  } else {
    timerRunning = true;
    document.getElementById('timerStartBtn').textContent = '暂停';
    document.getElementById('timerCircle').classList.add('running');
    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        if (timerMode === 'focus') {
          pomodoroCount++;
          document.getElementById('pomodoroCount').textContent = pomodoroCount;
          timerMode = 'break';
          timerSeconds = 5 * 60;
        } else {
          timerMode = 'focus';
          timerSeconds = 25 * 60;
        }
        document.getElementById('timerStartBtn').textContent = '开始专注';
        document.getElementById('timerCircle').classList.remove('running');
        updateTimerDisplay();
        alert(timerMode === 'focus' ? '休息结束，继续加油！💪' : '专注完成！休息一下吧 ☕');
      }
    }, 1000);
  }
}
function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerMode = 'focus';
  timerSeconds = 25 * 60;
  document.getElementById('timerStartBtn').textContent = '开始专注';
  document.getElementById('timerCircle').classList.remove('running');
  updateTimerDisplay();
}
updateTimerDisplay();

// ========== Unit Converter ==========
const CONV_UNITS = {
  length: {
    options: ['米(m)', '千米(km)', '厘米(cm)', '毫米(mm)', '英寸(in)', '英尺(ft)', '英里(mi)', '海里'],
    toBase: [1, 1000, 0.01, 0.001, 0.0254, 0.3048, 1609.344, 1852]
  },
  weight: {
    options: ['千克(kg)', '克(g)', '毫克(mg)', '吨(t)', '磅(lb)', '盎司(oz)', '斤'],
    toBase: [1, 0.001, 0.000001, 1000, 0.453592, 0.0283495, 0.5]
  },
  temp: {
    options: ['摄氏度(°C)', '华氏度(°F)', '开尔文(K)'],
    special: true
  },
  area: {
    options: ['平方米(m²)', '平方千米(km²)', '公顷', '亩', '平方英尺(ft²)', '英亩'],
    toBase: [1, 1000000, 10000, 666.667, 0.092903, 4046.86]
  }
};

function updateConvUnits() {
  const type = document.getElementById('convType').value;
  const u = CONV_UNITS[type];
  const fromSel = document.getElementById('convFromUnit');
  const toSel = document.getElementById('convToUnit');
  fromSel.innerHTML = toSel.innerHTML = u.options.map((o, i) => `<option value="${i}">${o}</option>`).join('');
  toSel.selectedIndex = 1;
  convertUnit();
}

function convertUnit() {
  const type = document.getElementById('convType').value;
  const val = parseFloat(document.getElementById('convFrom').value);
  const fromI = parseInt(document.getElementById('convFromUnit').value);
  const toI = parseInt(document.getElementById('convToUnit').value);
  if (isNaN(val)) { document.getElementById('convValue').textContent = '—'; return; }
  let result;
  if (type === 'temp') {
    // Special temp conversion
    let celsius;
    if (fromI === 0) celsius = val;
    else if (fromI === 1) celsius = (val - 32) * 5 / 9;
    else celsius = val - 273.15;
    if (toI === 0) result = celsius;
    else if (toI === 1) result = celsius * 9 / 5 + 32;
    else result = celsius + 273.15;
  } else {
    const u = CONV_UNITS[type];
    const base = val * u.toBase[fromI];
    result = base / u.toBase[toI];
  }
  document.getElementById('convValue').textContent = parseFloat(result.toPrecision(10));
}
updateConvUnits();

// ========== Color Picker ==========
function updateColor() {
  const hex = document.getElementById('colorPicker').value;
  document.getElementById('colorDisplay').style.background = hex;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  document.getElementById('colorHex').textContent = hex.toUpperCase();
  document.getElementById('colorRgb').textContent = `rgb(${r}, ${g}, ${b})`;
  // HSL
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }
  document.getElementById('colorHsl').textContent = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  document.getElementById('colorCss').textContent = `color: ${hex}`;
}
function copyColor(type) {
  const text = document.getElementById('color' + type.charAt(0).toUpperCase() + type.slice(1)).textContent;
  navigator.clipboard.writeText(text).then(() => {
    const el = event.currentTarget;
    const hint = el.querySelector('.copy-hint');
    hint.textContent = '已复制!';
    setTimeout(() => hint.textContent = '点击复制', 1500);
  });
}

// ========== JSON Formatter ==========
function formatJson(pretty) {
  const input = document.getElementById('jsonInput').value.trim();
  const errEl = document.getElementById('jsonError');
  const outEl = document.getElementById('jsonOutput');
  if (!input) { errEl.style.display = 'none'; outEl.textContent = '等待输入...'; return; }
  try {
    const obj = JSON.parse(input);
    errEl.style.display = 'none';
    outEl.textContent = pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  } catch (e) {
    errEl.textContent = '❌ JSON 格式错误：' + e.message;
    errEl.style.display = 'block';
    outEl.textContent = '无法解析';
  }
}
</script>

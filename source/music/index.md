---
title: 歌单分享
date: 2026-04-05 00:00:00
layout: page
top_img: false
aside: false
---

<style>
.music-page { max-width: 800px; margin: 0 auto; padding: 20px; }
.music-hero { text-align: center; padding: 40px 0 30px; }
.music-hero h2 { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #4a3728; }
.music-hero p { color: #8B6F47; font-size: 14px; }

/* Spotify Embed */
.spotify-section { margin-bottom: 40px; }
.spotify-section h3 { font-size: 18px; font-weight: 600; color: #4a3728; margin-bottom: 16px; padding-left: 12px; border-left: 3px solid #8B6F47; }
.spotify-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 600px) { .spotify-grid { grid-template-columns: 1fr; } }
.spotify-card { border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }

/* Custom Playlist */
.playlist-section { margin-bottom: 40px; }
.playlist-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.playlist-tab { padding: 8px 20px; border-radius: 20px; border: 1.5px solid #e0d5c5; background: transparent; color: #8B6F47; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.playlist-tab:hover, .playlist-tab.active { background: #8B6F47; color: #fff; border-color: #8B6F47; }

.playlist-list { display: none; }
.playlist-list.active { display: block; }

.song-item { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: #fff; border-radius: 10px; margin-bottom: 8px; transition: all 0.2s; cursor: default; }
.song-item:hover { transform: translateX(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.song-num { width: 28px; text-align: center; font-weight: 700; color: #c4b49a; font-size: 14px; }
.song-cover { width: 44px; height: 44px; border-radius: 8px; background: #e8dcc8; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.song-info { flex: 1; min-width: 0; }
.song-title { font-weight: 600; color: #4a3728; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.song-artist { color: #a09080; font-size: 12px; margin-top: 2px; }
.song-duration { color: #c4b49a; font-size: 12px; flex-shrink: 0; }

/* Now Playing */
.now-playing { background: linear-gradient(135deg, #8B6F47 0%, #A0845C 100%); border-radius: 16px; padding: 24px; color: #fff; margin-bottom: 30px; display: flex; align-items: center; gap: 20px; }
.now-playing-cover { width: 80px; height: 80px; border-radius: 12px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 36px; flex-shrink: 0; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
.now-playing-info { flex: 1; }
.now-playing-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; margin-bottom: 6px; }
.now-playing-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.now-playing-artist { font-size: 13px; opacity: 0.8; }

/* Add Song Form */
.add-song { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
.add-song h3 { font-size: 16px; color: #4a3728; margin-bottom: 14px; }
.form-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.form-row input { flex: 1; min-width: 120px; padding: 10px 14px; border: 1.5px solid #e0d5c5; border-radius: 8px; font-size: 13px; outline: none; transition: border-color 0.2s; background: #faf8f4; }
.form-row input:focus { border-color: #8B6F47; }
.btn-add { padding: 10px 24px; background: #8B6F47; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; transition: background 0.2s; }
.btn-add:hover { background: #A0845C; }
</style>

<div class="music-page">

  <div class="music-hero">
    <h2>🎵 My Playlist</h2>
    <p>用音乐记录心情 · 每首歌都是一个故事</p>
  </div>

  <!-- Now Playing -->
  <div class="now-playing">
    <div class="now-playing-cover">🎧</div>
    <div class="now-playing-info">
      <div class="now-playing-label">♪ Now Playing</div>
      <div class="now-playing-title">Blinding Lights</div>
      <div class="now-playing-artist">The Weeknd</div>
    </div>
  </div>

  <!-- Spotify Playlists -->
  <div class="spotify-section">
    <h3>🎧 我的 Spotify 歌单</h3>
    <div class="spotify-grid">
      <div class="spotify-card">
        <iframe style="border-radius:12px" src="https://open.spotify.com/embed/playlist/6T6g0jNwBR1YLNfCO5miEo?utm_source=generator&theme=0" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
      </div>
      <div class="spotify-card">
        <iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/70kdlALLmDuFcagVQznClA?utm_source=generator&theme=0" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
      </div>
    </div>
  </div>

  <!-- Custom Playlists -->
  <div class="playlist-section">
    <h3>📝 我的歌单</h3>
    <div class="playlist-tabs">
      <button class="playlist-tab active" onclick="switchTab('study')">📚 学习 BGM</button>
      <button class="playlist-tab" onclick="switchTab('chill')">🌙 睡前放松</button>
      <button class="playlist-tab" onclick="switchTab('workout')">🔥 运动</button>
      <button class="playlist-tab" onclick="switchTab('mood')">💫 随心听</button>
    </div>

    <!-- Study Playlist -->
    <div class="playlist-list active" id="playlist-study">
      <div class="song-item"><div class="song-num">1</div><div class="song-cover">🎹</div><div class="song-info"><div class="song-title">River Flows in You</div><div class="song-artist">Yiruma</div></div><div class="song-duration">3:11</div></div>
      <div class="song-item"><div class="song-num">2</div><div class="song-cover">🎼</div><div class="song-info"><div class="song-title">Clair de Lune</div><div class="song-artist">Debussy</div></div><div class="song-duration">5:12</div></div>
      <div class="song-item"><div class="song-num">3</div><div class="song-cover">🎻</div><div class="song-info"><div class="song-title">Experience</div><div class="song-artist">Ludovico Einaudi</div></div><div class="song-duration">5:15</div></div>
      <div class="song-item"><div class="song-num">4</div><div class="song-cover">🎹</div><div class="song-info"><div class="song-title">Comptine d'un autre été</div><div class="song-artist">Yann Tiersen</div></div><div class="song-duration">2:20</div></div>
      <div class="song-item"><div class="song-num">5</div><div class="song-cover">🎶</div><div class="song-info"><div class="song-title">Nuvole Bianche</div><div class="song-artist">Ludovico Einaudi</div></div><div class="song-duration">5:57</div></div>
    </div>

    <!-- Chill Playlist -->
    <div class="playlist-list" id="playlist-chill">
      <div class="song-item"><div class="song-num">1</div><div class="song-cover">🌙</div><div class="song-info"><div class="song-title">Weightless</div><div class="song-artist">Marconi Union</div></div><div class="song-duration">8:09</div></div>
      <div class="song-item"><div class="song-num">2</div><div class="song-cover">🌊</div><div class="song-info"><div class="song-title">Electric Feel</div><div class="song-artist">MGMT</div></div><div class="song-duration">3:49</div></div>
      <div class="song-item"><div class="song-num">3</div><div class="song-cover">✨</div><div class="song-info"><div class="song-title">Sunset Lover</div><div class="song-artist">Petit Biscuit</div></div><div class="song-duration">3:40</div></div>
      <div class="song-item"><div class="song-num">4</div><div class="song-cover">🎸</div><div class="song-info"><div class="song-title">Put Your Records On</div><div class="song-artist">Corinne Bailey Rae</div></div><div class="song-duration">3:35</div></div>
      <div class="song-item"><div class="song-num">5</div><div class="song-cover">💫</div><div class="song-info"><div class="song-title">The Night We Met</div><div class="song-artist">Lord Huron</div></div><div class="song-duration">3:28</div></div>
    </div>

    <!-- Workout Playlist -->
    <div class="playlist-list" id="playlist-workout">
      <div class="song-item"><div class="song-num">1</div><div class="song-cover">⚡</div><div class="song-info"><div class="song-title">Stronger</div><div class="song-artist">Kanye West</div></div><div class="song-duration">5:12</div></div>
      <div class="song-item"><div class="song-num">2</div><div class="song-cover">🔥</div><div class="song-info"><div class="song-title">Lose Yourself</div><div class="song-artist">Eminem</div></div><div class="song-duration">5:26</div></div>
      <div class="song-item"><div class="song-num">3</div><div class="song-cover">💪</div><div class="song-info"><div class="song-title">Eye of the Tiger</div><div class="song-artist">Survivor</div></div><div class="song-duration">4:05</div></div>
      <div class="song-item"><div class="song-num">4</div><div class="song-cover">🏃</div><div class="song-info"><div class="song-title">Till I Collapse</div><div class="song-artist">Eminem ft. Nate Dogg</div></div><div class="song-duration">4:57</div></div>
      <div class="song-item"><div class="song-num">5</div><div class="song-cover">🎵</div><div class="song-info"><div class="song-title">Remember the Name</div><div class="song-artist">Fort Minor</div></div><div class="song-duration">3:50</div></div>
    </div>

    <!-- Mood Playlist -->
    <div class="playlist-list" id="playlist-mood">
      <div class="song-item"><div class="song-num">1</div><div class="song-cover">🌟</div><div class="song-info"><div class="song-title">Bohemian Rhapsody</div><div class="song-artist">Queen</div></div><div class="song-duration">5:55</div></div>
      <div class="song-item"><div class="song-num">2</div><div class="song-cover">🎤</div><div class="song-info"><div class="song-title">Hotel California</div><div class="song-artist">Eagles</div></div><div class="song-duration">6:30</div></div>
      <div class="song-item"><div class="song-num">3</div><div class="song-cover">🎸</div><div class="song-info"><div class="song-title">Stairway to Heaven</div><div class="song-artist">Led Zeppelin</div></div><div class="song-duration">8:02</div></div>
      <div class="song-item"><div class="song-num">4</div><div class="song-cover">💫</div><div class="song-info"><div class="song-title">Imagine</div><div class="song-artist">John Lennon</div></div><div class="song-duration">3:07</div></div>
      <div class="song-item"><div class="song-num">5</div><div class="song-cover">🎹</div><div class="song-info"><div class="song-title">Clocks</div><div class="song-artist">Coldplay</div></div><div class="song-duration">5:07</div></div>
    </div>
  </div>

  <!-- Tip -->
  <div style="text-align:center;color:#a09080;font-size:12px;padding:20px 0;">
    💡 想换歌单里的歌？直接编辑 <code>source/music/index.md</code> 就好～Spotify 嵌入可以替换为自己的播放列表链接
  </div>

</div>

<script>
function switchTab(id) {
  document.querySelectorAll('.playlist-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.playlist-list').forEach(l => l.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('playlist-' + id).classList.add('active');
}
</script>

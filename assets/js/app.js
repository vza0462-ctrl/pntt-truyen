// ===== STATE =====
const state = {
  index: null,
  cache: {},
  currentChapter: null,
  currentChunk: null,
  chapterData: [],
  fontSize: parseInt(localStorage.getItem('pntt_fontSize')) || 18,
  theme: localStorage.getItem('pntt_theme') || 'light',
};

// ===== DOM REFS =====
const $ = id => document.getElementById(id);
const app = $('app');

// ===== PERSISTENT READING PROGRESS =====
const PROGRESS_KEY = 'pntt_progress';

/**
 * Lưu tiến trình đọc (chương + vị trí scroll) xuống localStorage.
 * Gọi mỗi lần scroll (debounced) và khi rời trang.
 */
function saveProgress() {
  if (!state.currentChapter) return;
  
  const scrollY = window.scrollY;
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight
  );
  
  const progress = {
    chapter: state.currentChapter.c,
    scrollY: scrollY,
    docHeight: docHeight,
    savedAt: Date.now(),
  };
  
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    // localStorage may be full; ignore silently
  }
}

/** Đọc tiến trình từ localStorage */
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/** Xoá tiến trình nếu muốn reset */
function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}

// Debounced save — chỉ lưu sau 500ms kể từ lần scroll cuối
let _saveTimeout = null;
function debouncedSaveProgress() {
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(saveProgress, 500);
}

// Lưu ngay lập tức (dùng khi chuyển chương / rời trang)
function saveProgressNow() {
  if (_saveTimeout) {
    clearTimeout(_saveTimeout);
    _saveTimeout = null;
  }
  saveProgress();
}

// ===== INIT =====
async function init() {
  // Load theme
  document.documentElement.setAttribute('data-theme', state.theme);
  $('themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';

  try {
    // Load index
    const resp = await fetch('data/index.json');
    state.index = await resp.json();
    
    // Compute stats
    const lastChunk = state.index[state.index.length - 1];
    const total = lastChunk.e;
    const totalChars = total * 10000; // approximate
    
    $('totalChapters').textContent = total;
    $('totalChars').textContent = (totalChars / 1000).toFixed(0) + 'k';
    
    // Load last read progress (chapter tracking only for home page display)
    const savedProgress = loadProgress();
    const lastRead = savedProgress ? savedProgress.chapter : localStorage.getItem('pntt_lastRead');
    if (lastRead) {
      $('lastReadInfo').innerHTML = `📖 Đang đọc: <strong>Chương ${lastRead}</strong>`;
      $('continueBtn').style.display = 'inline-block';
    }
    
    // Check URL hash
    const hash = parseInt(window.location.hash.replace('#', ''));
    if (hash && hash > 0 && hash <= total) {
      goToChapter(hash);
    }
  } catch(e) {
    console.error(e);
    showToast('Không thể tải dữ liệu. Vui lòng refresh lại.');
  }
}

// ===== NAVIGATION =====
function showHome() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('page-home').classList.add('active');
  window.location.hash = '';
}

function showChapterList() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('page-list').classList.add('active');
  if (state.index) renderChapterList();
}

function startReading() {
  const savedProgress = loadProgress();
  const lastRead = savedProgress ? savedProgress.chapter : localStorage.getItem('pntt_lastRead');
  if (lastRead) {
    goToChapter(parseInt(lastRead));
  } else {
    goToChapter(1);
  }
}

function continueReading() {
  const savedProgress = loadProgress();
  const lastRead = savedProgress ? savedProgress.chapter : localStorage.getItem('pntt_lastRead');
  if (lastRead) goToChapter(parseInt(lastRead));
}

// ===== CHAPTER LIST =====
function renderChapterList() {
  const list = $('chapterList');
  
  if (state.chapterData.length === 0) {
    // Need to load all data first - show loading
    list.innerHTML = '<div class="loading-spinner">Đang tải danh sách...</div>';
    
    // Load chapters in background
    loadAllChapterMeta().then(() => {
      renderListItems();
    });
  } else {
    renderListItems();
  }
}

async function loadAllChapterMeta() {
  try {
    const resp = await fetch('data/meta.json');
    state.chapterData = await resp.json();
  } catch(e) {
    // Fallback: load from chunks
    for (const chunk of state.index) {
      try {
        const resp = await fetch('data/' + chunk.f);
        const data = await resp.json();
        state.chapterData = state.chapterData.concat(data.map(d => ({ c: d.c, t: d.t })));
      } catch(e2) {}
    }
  }
}

function renderListItems() {
  const list = $('chapterList');
  const search = $('chapterSearch').value.toLowerCase().trim();
  
  let filtered = state.chapterData;
  if (search) {
    const num = parseInt(search);
    if (!isNaN(num)) {
      filtered = state.chapterData.filter(ch => ch.c === num);
    } else {
      filtered = state.chapterData.filter(ch => 
        (ch.t || '').toLowerCase().includes(search) || String(ch.c).includes(search)
      );
    }
  }
  
  list.innerHTML = filtered.map(ch => `
    <div class="chapter-item" onclick="goToChapter(${ch.c})">
      <span class="num">Chương ${ch.c}</span>
      <span class="title">${ch.t || ''}</span>
    </div>
  `).join('');
}

function filterChapters() {
  renderListItems();
}

// ===== READING =====
async function goToChapter(num) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('page-read').classList.add('active');
  
  $('readerContent').innerHTML = '<div class="loading-spinner">Đang tải...</div>';
  $('readerTitle').textContent = `Chương ${num}`;
  $('chapterInfo').textContent = `Chương ${num}`;
  
  // Find which chunk this chapter is in
  const chunk = state.index.find(c => num >= c.s && num <= c.e);
  if (!chunk) {
    $('readerContent').innerHTML = '<p style="text-align:center;padding:40px;color:red;">Không tìm thấy chương này</p>';
    return;
  }
  
  try {
    // Load chunk if not cached
    if (!state.cache[chunk.f]) {
      const resp = await fetch('data/' + chunk.f);
      state.cache[chunk.f] = await resp.json();
    }
    
    const chapterData = state.cache[chunk.f].find(ch => ch.c === num);
    if (!chapterData) {
      // Try full JSON fallback
      if (state.chapterData.length > 0) {
        const fallback = state.chapterData.find(ch => ch.c === num);
        if (fallback) {
          renderChapter(fallback);
          return;
        }
      }
      throw new Error('Chapter not found');
    }
    
    renderChapter(chapterData);
  } catch(e) {
    // Ultimate fallback - search through all chunks
    try {
      for (const chunk of state.index) {
        const resp = await fetch('data/' + chunk.f);
        const data = await resp.json();
        const found = data.find(ch => ch.c === num);
        if (found) { renderChapter(found); return; }
      }
    } catch(e2) {}
    
    $('readerContent').innerHTML = '<p style="text-align:center;padding:40px;color:red;">Lỗi tải chương. Thử refresh lại.</p>';
  }
}

function renderChapter(ch) {
  // Save current chapter's scroll before switching (if applicable)
  if (state.currentChapter) {
    saveProgressNow();
  }
  
  state.currentChapter = ch;
  
  // Save progress (chapter number using old key for backward compat)
  localStorage.setItem('pntt_lastRead', ch.c);
  window.location.hash = ch.c;
  
  $('readerTitle').textContent = `Chương ${ch.c}${ch.t ? ': ' + ch.t : ''}`;
  $('chapterInfo').textContent = `Chương ${ch.c} / ${state.index[state.index.length-1].e}`;
  
  // Format content
  const paragraphs = ch.n.split('\n').filter(p => p.trim());
  const contentHtml = paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
  $('readerContent').innerHTML = contentHtml;
  
  // Update navigation buttons
  const total = state.index[state.index.length - 1].e;
  $('prevBtn').disabled = ch.c <= 1;
  $('nextBtn').disabled = ch.c >= total;
  
  // Update progress bar
  const pct = ((ch.c - 1) / (total - 1)) * 100;
  document.querySelector('.reader-progress').style.setProperty('--progress', pct + '%');
  
  // Apply font size first so dimensions are correct
  applyFontSize();
  
  // Restore scroll position if this chapter was saved
  restoreScrollForChapter(ch.c);
}

/**
 * Khôi phục vị trí scroll cho chương hiện tại.
 * Đợi DOM render xong mới scroll.
 */
function restoreScrollForChapter(chapterNum) {
  const savedProgress = loadProgress();
  if (!savedProgress || savedProgress.chapter !== chapterNum) {
    // No saved scroll for this chapter — scroll to top
    window.scrollTo(0, 0);
    return;
  }
  
  const scrollY = savedProgress.scrollY || 0;
  
  // Scroll ngay sau khi render, nhưng có thể chưa đúng vì ảnh/font chưa load xong
  window.scrollTo(0, scrollY);
  
  // Retry sau khi layout ổn định
  let retries = 0;
  function tryScroll() {
    const current = window.scrollY;
    if (Math.abs(current - scrollY) > 5 && retries < 10) {
      window.scrollTo(0, scrollY);
      retries++;
      setTimeout(tryScroll, 200);
    }
  }
  setTimeout(tryScroll, 100);
  setTimeout(() => window.scrollTo(0, scrollY), 400);
}

function prevChapter() {
  if (state.currentChapter && state.currentChapter.c > 1) {
    goToChapter(state.currentChapter.c - 1);
  }
}

function nextChapter() {
  const total = state.index[state.index.length - 1].e;
  if (state.currentChapter && state.currentChapter.c < total) {
    goToChapter(state.currentChapter.c + 1);
  }
}

function jumpToChapter() {
  const val = parseInt($('jumpInput').value);
  const total = state.index[state.index.length - 1].e;
  if (val && val >= 1 && val <= total) {
    goToChapter(val);
    $('jumpInput').value = '';
  }
}

// ===== THEME =====
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem('pntt_theme', state.theme);
  $('themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

// ===== FONT SIZE =====
function toggleFontSize(delta) {
  state.fontSize = Math.min(30, Math.max(14, state.fontSize + delta));
  localStorage.setItem('pntt_fontSize', state.fontSize);
  applyFontSize();
}

function applyFontSize() {
  document.querySelectorAll('.reader-content').forEach(el => {
    el.style.fontSize = state.fontSize + 'px';
  });
}

// ===== SCROLL PROGRESS & SAVE =====
document.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  document.querySelector('.scroll-progress').style.width = Math.min(scrollPercent, 100) + '%';
  
  // Lưu tiến trình (debounced)
  debouncedSaveProgress();
});

// ===== LƯU KHI RỜI TRANG / TẮT TRÌNH DUYỆT =====
window.addEventListener('beforeunload', () => {
  saveProgressNow();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveProgressNow();
  }
});

// ===== KEYBOARD NAV =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') prevChapter();
  if (e.key === 'ArrowRight') nextChapter();
  if (e.key === 'Escape') showHome();
});

// ===== TOAST =====
function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#c00;color:#fff;padding:12px 24px;border-radius:8px;font-size:15px;z-index:999;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ========== RADIO / TEXT-TO-SPEECH ==========
const radio = {
  active: false,
  paragraphs: [],
  currentIndex: 0,
  utterance: null,
  voice: null,
  speed: 1,
  mode: localStorage.getItem('pntt_radioMode') || 'google',
  googleChunks: [],
  googleChunkIdx: 0,
  googleAudio: null,
};

// Google TTS URL — qua proxy local de tranh CORS
const GOOGLE_TTS = '/tts?q=';

let _audioCtx = null;

function unlockAudio() {
  if (_audioCtx) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    _audioCtx.resume();
  } catch(e) {}
}

// ===== TOGGLE RADIO =====
function toggleRadio() {
  const btn = $('radioBtn');
  const player = $('radioPlayer');

  if (radio.active) { stopRadio(); return; }
  if (!state.currentChapter) { showToast('Vui lòng mở một chương trước'); return; }

  const paragraphs = document.querySelectorAll('.reader-content p');
  if (!paragraphs.length) { showToast('Không có nội dung để đọc'); return; }

  unlockAudio();

  radio.active = true;
  radio.paragraphs = [];
  paragraphs.forEach(p => radio.paragraphs.push(p.textContent));
  radio.currentIndex = 0;

  // Đồng bộ mode từ localStorage
  const savedMode = localStorage.getItem('pntt_radioMode');
  if (savedMode) radio.mode = savedMode;
  const modeSel = $('radioMode');
  if (modeSel) modeSel.value = radio.mode;

  btn.textContent = '\uD83D\uDD0A';
  btn.classList.add('active');
  player.style.display = 'block';
  $('radioInfo').textContent = '\uD83C\uDFA7 Chuong ' + state.currentChapter.c + ' \u2014 dang phat...';

  // Nếu chọn Browser mode, tìm giọng Nam ngay
  if (radio.mode === 'browser') {
    findMaleVoice();
  }

  speakParagraph(0);
}

// ===== CHỌN GIỌNG =====
function changeRadioMode(sel) {
  radio.mode = sel.value;
  localStorage.setItem('pntt_radioMode', radio.mode);
  if (radio.mode === 'browser') findMaleVoice();
  // Nếu đang phát, chuyển ngay sang mode mới
  if (radio.active) {
    const ci = radio.currentIndex;
    stopRadioInternal();
    radio.active = true;
    // Re-show UI
    const btn = $('radioBtn');
    const player = $('radioPlayer');
    btn.textContent = '\uD83D\uDD0A';
    btn.classList.add('active');
    player.style.display = 'block';
    $('radioInfo').textContent = '\uD83C\uDFA7 Chuong ' + state.currentChapter.c + ' \u2014 dang phat...';
    setTimeout(() => speakParagraph(ci), 300);
  }
}

// ===== TÌM GIỌNG VIỆT NAM (ưu tiên giọng Nam) =====
let _voicesLoaded = false;

function waitForVoices(callback, retries) {
  if (retries <= 0) { callback([]); return; }
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0 && _voicesLoaded) { callback(v); return; }
  if (v.length > 0) _voicesLoaded = true;
  window.speechSynthesis.onvoiceschanged = () => {
    const vv = window.speechSynthesis.getVoices();
    _voicesLoaded = true;
    callback(vv);
  };
  // Fallback: call again after timeout
  if (v.length > 0) { callback(v); return; }
  setTimeout(() => waitForVoices(callback, retries - 1), 500);
}

function findMaleVoice() {
  waitForVoices(function(voices) {
    // Ưu tiên giọng Nam tiếng Việt
    const vietVoices = voices.filter(v => v.lang && v.lang.startsWith('vi'));
    let found = null;
    
    if (vietVoices.length > 0) {
      // Tìm giọng "Nam" trước
      found = vietVoices.find(v => v.name.toLowerCase().includes('nam'));
      // Nếu không có Nam, lấy bất kỳ giọng Việt nào khác Adam
      if (!found) found = vietVoices.find(v => !v.name.toLowerCase().includes('adam'));
      // Cuối cùng, lấy giọng Việt đầu tiên
      if (!found) found = vietVoices[0];
    }

    radio.voice = found || null;
  }, 10);
}

// ===== MAIN SPEAK =====
function speakParagraph(index) {
  if (!radio.active) return;
  if (index >= radio.paragraphs.length) { finishRadioChapter(); return; }

  radio.currentIndex = index;
  const text = radio.paragraphs[index];
  if (!text || !text.trim()) { speakParagraph(index + 1); return; }

  highlightParagraph(index);

  if (radio.mode === 'browser') {
    speakWithBrowser(text, index);
  } else {
    speakWithGoogle(text, index);
  }
}

// ===== BROWSER TTS (Web Speech API — giọng Nam online) =====
function speakWithBrowser(text, index) {
  setRadioPlaying(true);

  // Nếu chưa có voice thì tìm lại
  if (!radio.voice) {
    findMaleVoice();
  }

  // Chia nhỏ text nếu quá dài (300 ký tự cho SpeechSynthesis)
  const MAX = 300;
  const parts = [];
  for (let i = 0; i < text.length; i += MAX) {
    parts.push(text.substring(i, i + MAX));
  }

  let partIdx = 0;
  function speakPart() {
    if (!radio.active) return;
    if (partIdx >= parts.length) {
      speakParagraph(index + 1);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(parts[partIdx]);
    utterance.lang = 'vi-VN';
    utterance.rate = radio.speed;
    if (radio.voice) utterance.voice = radio.voice;

    utterance.onend = () => {
      partIdx++;
      speakPart();
    };
    utterance.onerror = () => {
      partIdx++;
      speakPart();
    };

    window.speechSynthesis.speak(utterance);
  }

  speakPart();
}

// ===== GOOGLE TTS =====
function speakWithGoogle(text, paraIdx) {
  setRadioPlaying(true);

  const MAX = 200;
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX) {
    chunks.push(text.substring(i, i + MAX));
  }

  radio.googleChunks = chunks;
  radio.googleChunkIdx = 0;
  playGoogleChunk(paraIdx, 0);
}

function playGoogleChunk(paraIdx, chunkIdx) {
  if (!radio.active) return;
  const chunks = radio.googleChunks;
  if (chunkIdx >= chunks.length) {
    speakParagraph(paraIdx + 1);
    return;
  }

  const text = chunks[chunkIdx];
  if (!text.trim()) {
    playGoogleChunk(paraIdx, chunkIdx + 1);
    return;
  }

  const url = GOOGLE_TTS + encodeURIComponent(text);
  const audio = new Audio(url);
  radio.googleAudio = audio;

  audio.onended = () => {
    if (radio.active && chunkIdx + 1 < chunks.length) {
      playGoogleChunk(paraIdx, chunkIdx + 1);
    } else if (radio.active) {
      speakParagraph(paraIdx + 1);
    }
  };

  audio.onerror = () => {
    console.warn('Google TTS error');
    speakParagraph(paraIdx + 1);
  };

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      unlockAudio();
      setTimeout(() => {
        const retry = new Audio(url);
        radio.googleAudio = retry;
        retry.onended = audio.onended;
        retry.onerror = audio.onerror;
        retry.play().catch(() => speakParagraph(paraIdx + 1));
      }, 100);
    });
  }
}

// ===== UI HELPERS =====
function setRadioPlaying(playing) {
  const btn = $('radioPlayPause');
  if (btn) btn.textContent = playing ? '\u23F8' : '\u25B6';
  const wave = $('radioWave');
  if (wave) {
    if (playing) wave.classList.add('active');
    else wave.classList.remove('active');
  }
}

function highlightParagraph(index) {
  document.querySelectorAll('.reader-content p.speaking').forEach(p => p.classList.remove('speaking'));
  const allP = document.querySelectorAll('.reader-content p');
  if (allP[index]) {
    allP[index].classList.add('speaking');
    allP[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function toggleRadioPlayPause() {
  if (radio.mode === 'google') {
    if (radio.googleAudio && !radio.googleAudio.paused) {
      radio.googleAudio.pause();
      setRadioPlaying(false);
    } else if (radio.googleAudio) {
      const pp = radio.googleAudio.play();
      if (pp) pp.then(() => setRadioPlaying(true)).catch(() => {});
    }
  } else {
    // Browser mode
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setRadioPlaying(true);
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setRadioPlaying(false);
    }
  }
}

function stopRadioInternal() {
  radio.active = false;
  window.speechSynthesis.cancel();
  if (radio.googleAudio) { radio.googleAudio.pause(); radio.googleAudio = null; }
  setRadioPlaying(false);
  document.querySelectorAll('.reader-content p.speaking').forEach(p => p.classList.remove('speaking'));
}

function stopRadio() {
  stopRadioInternal();
  const btn = $('radioBtn');
  const player = $('radioPlayer');
  if (btn) { btn.textContent = '\uD83C\uDFA7'; btn.classList.remove('active'); }
  if (player) player.style.display = 'none';
}

function finishRadioChapter() {
  if (!radio.active) return;
  document.querySelectorAll('.reader-content p.speaking').forEach(p => p.classList.remove('speaking'));
  const info = $('radioInfo');
  if (info) info.textContent = '\u2705 Da phat xong chuong nay';
  const btn = $('radioPlayPause');
  if (btn) btn.textContent = '\u2713';

  setTimeout(() => {
    const total = state.index[state.index.length - 1].e;
    if (state.currentChapter && state.currentChapter.c < total) {
      nextChapter();
      setTimeout(() => { if (!radio.active) toggleRadio(); }, 1000);
    } else {
      showToast('Da doc xong toan bo truyen!');
      radio.active = false;
      $('radioBtn').textContent = '\uD83C\uDFA7';
      $('radioBtn').classList.remove('active');
    }
  }, 1500);
}

function changeRadioSpeed(sel) {
  radio.speed = parseFloat(sel.value);
}

// Stop radio when changing chapters
const _origGoToChapter = goToChapter;
goToChapter = function(num) {
  if (radio.active) stopRadio();
  _origGoToChapter(num);
};

// ===== START =====
document.addEventListener('DOMContentLoaded', init);

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
    
    // Load last read
    const lastRead = localStorage.getItem('pntt_lastRead');
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
  const lastRead = localStorage.getItem('pntt_lastRead');
  if (lastRead) {
    goToChapter(parseInt(lastRead));
  } else {
    goToChapter(1);
  }
}

function continueReading() {
  const lastRead = parseInt(localStorage.getItem('pntt_lastRead'));
  if (lastRead) goToChapter(lastRead);
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
  state.currentChapter = ch;
  
  // Save progress
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
  
  // Scroll to top
  window.scrollTo(0, 0);
  
  // Update font size
  applyFontSize();
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

// ===== SCROLL PROGRESS =====
document.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  document.querySelector('.scroll-progress').style.width = Math.min(scrollPercent, 100) + '%';
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

// ===== START =====
document.addEventListener('DOMContentLoaded', init);

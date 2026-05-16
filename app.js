// ==================== CONFIG ====================
const DEMO_API_KEY = ''; // Left empty intentionally — user provides their own key
const STORAGE_KEY = 'luvideo_api_key';
const AUTOPLAY_KEY = 'luvideo_autoplay';
const DEFAULT_QUERY = 'trending music 2024';

// ==================== STATE ====================
const state = {
  apiKey: localStorage.getItem(STORAGE_KEY) || '',
  autoplay: localStorage.getItem(AUTOPLAY_KEY) !== 'false',
  videos: [],
  currentIndex: -1,
  player: null,
  playerReady: false,
  query: '',
};

// ==================== DOM ====================
const $ = id => document.getElementById(id);
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const videoList = $('videoList');
const skeletonList = $('skeletonList');
const emptyState = $('emptyState');
const playerPlaceholder = $('playerPlaceholder');
const youtubePlayerEl = $('youtubePlayer');
const nowPlaying = $('nowPlaying');
const nowPlayingTitle = $('nowPlayingTitle');
const nowPlayingChannel = $('nowPlayingChannel');
const autoplayToggle = $('autoplayToggle');
const autoplayStatus = $('autoplayStatus');
const apiBanner = $('apiBanner');
const modalOverlay = $('modalOverlay');
const apiKeyInput = $('apiKeyInput');
const resultCount = $('resultCount');
const sidebarTitle = $('sidebarTitle');

// ==================== INIT ====================
function init() {
  updateAutoplayUI();

  if (state.apiKey) {
    hideBanner();
    fetchVideos(DEFAULT_QUERY);
  } else {
    showBanner();
    hideSkeletons();
  }

  bindEvents();
}

function bindEvents() {
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  autoplayToggle.addEventListener('click', toggleAutoplay);

  $('showApiModal').addEventListener('click', openModal);
  $('closeBanner').addEventListener('click', hideBanner);
  $('closeModal').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  $('saveApiKey').addEventListener('click', saveApiKey);
  $('useDemoKey').addEventListener('click', useDemoMode);
  apiKeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKey();
  });

  $('prevBtn').addEventListener('click', () => navigate(-1));
  $('nextBtn').addEventListener('click', () => navigate(1));
}

// ==================== API KEY ===============
function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('Vui lòng nhập API key', 'error');
    return;
  }
  state.apiKey = key;
  localStorage.setItem(STORAGE_KEY, key);
  closeModal();
  hideBanner();
  showToast('API key đã được lưu!', 'success');
  fetchVideos(DEFAULT_QUERY);
}

function useDemoMode() {
  // Without a real API key, show instructions
  closeModal();
  showToast('Bạn cần API key thật để tìm kiếm', 'error');
  openModal();
}

// ==================== SEARCH ====================
function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  if (!state.apiKey) {
    openModal();
    return;
  }

  fetchVideos(q);
}

async function fetchVideos(query) {
  state.query = query;
  sidebarTitle.textContent = query === DEFAULT_QUERY ? 'Hàng đầu hôm nay' : `"${query}"`;
  resultCount.textContent = '';
  showSkeletons();
  emptyState.style.display = 'none';

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '20');
    url.searchParams.set('key', state.apiKey);
    url.searchParams.set('safeSearch', 'none');

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      hideSkeletons();
      const msg = data.error.message || 'API lỗi';
      showToast(msg, 'error');
      if (data.error.status === 'REQUEST_DENIED' || data.error.code === 403) {
        openModal();
      }
      return;
    }

    const items = data.items || [];

    // Fetch durations
    const videoIds = items.map(i => i.id.videoId).join(',');
    let durations = {};
    if (videoIds) {
      durations = await fetchDurations(videoIds);
    }

    state.videos = items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumb: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      published: item.snippet.publishedAt,
      duration: durations[item.id.videoId] || '',
    }));

    hideSkeletons();
    renderVideoList();

    resultCount.textContent = `${state.videos.length} video`;

    // Autoplay first video on new search
    if (state.autoplay && state.videos.length > 0) {
      playVideo(0);
    }
  } catch (err) {
    hideSkeletons();
    showToast('Không thể kết nối API', 'error');
    console.error(err);
  }
}

async function fetchDurations(videoIds) {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('id', videoIds);
    url.searchParams.set('key', state.apiKey);

    const res = await fetch(url);
    const data = await res.json();

    const map = {};
    (data.items || []).forEach(item => {
      map[item.id] = parseDuration(item.contentDetails.duration);
    });
    return map;
  } catch { return {}; }
}

function parseDuration(iso) {
  // PT1H2M3S → 1:02:03
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  const s = parseInt(match[3] || 0);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ==================== RENDER ====================
function renderVideoList() {
  // Remove existing cards
  const existing = videoList.querySelectorAll('.video-card');
  existing.forEach(el => el.remove());

  if (state.videos.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  state.videos.forEach((video, index) => {
    const card = createVideoCard(video, index);
    videoList.appendChild(card);
    card.style.animationDelay = `${index * 0.04}s`;
  });

  // Mark active
  updateActiveCard();
}

function createVideoCard(video, index) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.dataset.index = index;

  card.innerHTML = `
    <div class="video-thumb">
      <img src="${video.thumb}" alt="${escapeHtml(video.title)}" loading="lazy" />
      ${video.duration ? `<span class="thumb-duration">${video.duration}</span>` : ''}
      <div class="thumb-play-indicator" style="display:none">▶</div>
    </div>
    <div class="video-info">
      <div class="video-title">${escapeHtml(video.title)}</div>
      <div class="video-meta">
        <span class="video-channel">${escapeHtml(video.channel)}</span>
        <span class="video-views">${formatDate(video.published)}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => playVideo(index));
  return card;
}

function updateActiveCard() {
  document.querySelectorAll('.video-card').forEach((card, i) => {
    const isActive = i === state.currentIndex;
    card.classList.toggle('active', isActive);
    const indicator = card.querySelector('.thumb-play-indicator');
    if (indicator) indicator.style.display = isActive ? 'flex' : 'none';
  });

  // Scroll active into view
  const activeCard = videoList.querySelector('.video-card.active');
  if (activeCard) {
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ==================== NESTED IFRAME DETECTION ====================
// YouTube blocks playback when embedded inside another iframe.
// Detect this and show a fallback open-in-new-tab button instead.
const isNestedIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

if (isNestedIframe) {
  // Inject a notice banner at top
  document.addEventListener('DOMContentLoaded', () => {
    const notice = document.createElement('div');
    notice.style.cssText = `
      position:fixed; top:60px; left:0; right:0; z-index:200;
      background:rgba(255,95,109,0.12); border-bottom:1px solid rgba(255,95,109,0.3);
      color:#ff5f6d; font-size:0.8rem; padding:8px 20px;
      display:flex; align-items:center; gap:10px;
    `;
    notice.innerHTML = `
      <span>⚠️ YouTube không cho phép phát trong iframe lồng nhau.</span>
      <a id="openFullApp" href="https://luvideo.vercel.app" target="_blank"
        style="color:#e8ff47;font-weight:600;text-decoration:none;
               background:rgba(232,255,71,0.1);padding:3px 12px;border-radius:100px;
               border:1px solid rgba(232,255,71,0.3)">
        Mở LuVideo ↗
      </a>
    `;
    document.body.appendChild(notice);
  });
}

// ==================== PLAYER ====================
let ytReady = false;
let ytReadyCallbacks = [];
let playerInitTimer = null;

window.onYouTubeIframeAPIReady = function () {
  ytReady = true;
  ytReadyCallbacks.forEach(fn => fn());
  ytReadyCallbacks = [];
};

// Fallback: if YT API doesn't load in 5s, reload the script
setTimeout(() => {
  if (!ytReady) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
}, 5000);

function playVideo(index) {
  if (index < 0 || index >= state.videos.length) return;

  state.currentIndex = index;
  const video = state.videos[index];

  // Show now playing
  playerPlaceholder.style.display = 'none';
  youtubePlayerEl.style.display = 'block';
  nowPlaying.style.display = 'flex';
  nowPlayingTitle.textContent = video.title;
  nowPlayingChannel.textContent = video.channel;

  updateActiveCard();

  // If nested inside another iframe, open in new tab instead
  if (isNestedIframe) {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank');
    return;
  }

  if (!ytReady) {
    ytReadyCallbacks.push(() => initOrUpdatePlayer(video.id));
  } else {
    initOrUpdatePlayer(video.id);
  }
}

function destroyPlayer() {
  if (state.player) {
    try { state.player.destroy(); } catch { }
    state.player = null;
  }
  // Reset the div (YouTube replaces it with iframe, need fresh div)
  const container = document.getElementById('playerContainer');
  const old = document.getElementById('youtubePlayer');
  if (old) old.remove();
  const fresh = document.createElement('div');
  fresh.id = 'youtubePlayer';
  container.appendChild(fresh);
}

function initOrUpdatePlayer(videoId) {
  clearTimeout(playerInitTimer);

  if (state.player) {
    try {
      state.player.loadVideoById(videoId);
      return;
    } catch {
      // Player broken, rebuild it
      destroyPlayer();
    }
  }

  state.player = new YT.Player('youtubePlayer', {
    videoId,
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      enablejsapi: 1,
    },
    events: {
      onReady: e => {
        e.target.playVideo();
        state.playerReady = true;
      },
      onError: e => {
        console.warn('YT player error:', e.data);
        // Skip to next video on unplayable error (101, 150)
        if ([101, 150, 5].includes(e.data) && state.autoplay) {
          showToast('Video không khả dụng, bỏ qua...', '');
          setTimeout(() => navigate(1), 1500);
        }
      },
      onStateChange: onPlayerStateChange,
    },
  });

  // Safety timeout: if player still black after 8s, rebuild
  playerInitTimer = setTimeout(() => {
    if (state.player) {
      try {
        const ps = state.player.getPlayerState();
        // -1 = unstarted (stuck), rebuild
        if (ps === -1) {
          destroyPlayer();
          state.player = null;
          ytReady && initOrUpdatePlayer(videoId);
        }
      } catch { destroyPlayer(); }
    }
  }, 8000);
}
}

function onPlayerStateChange(event) {
  // YT.PlayerState.ENDED = 0
  if (event.data === 0 && state.autoplay) {
    navigate(1);
  }
}

function navigate(dir) {
  const next = state.currentIndex + dir;
  if (next >= 0 && next < state.videos.length) {
    playVideo(next);
  } else if (dir === 1 && state.videos.length > 0) {
    // Loop to start
    playVideo(0);
  }
}

// ==================== AUTOPLAY ====================
function toggleAutoplay() {
  state.autoplay = !state.autoplay;
  localStorage.setItem(AUTOPLAY_KEY, state.autoplay);
  updateAutoplayUI();
  showToast(`Autoplay ${state.autoplay ? 'BẬT' : 'TẮT'}`, 'success');
}

function updateAutoplayUI() {
  autoplayToggle.classList.toggle('active', state.autoplay);
  autoplayToggle.classList.toggle('off', !state.autoplay);
  autoplayStatus.textContent = state.autoplay ? 'ON' : 'OFF';
}

// ==================== UI HELPERS ====================
function showBanner() { apiBanner.classList.remove('hidden'); }
function hideBanner() { apiBanner.classList.add('hidden'); }

function openModal() {
  modalOverlay.classList.add('open');
  if (state.apiKey) apiKeyInput.value = state.apiKey;
  setTimeout(() => apiKeyInput.focus(), 300);
}

function closeModal() { modalOverlay.classList.remove('open'); }

function showSkeletons() {
  skeletonList.querySelectorAll('.skeleton-item').forEach(el => {
    el.classList.remove('hidden');
  });
}

function hideSkeletons() {
  skeletonList.querySelectorAll('.skeleton-item').forEach(el => {
    el.classList.add('hidden');
  });
}

let toastTimer;
function showToast(msg, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  setTimeout(() => toast.classList.add('show'), 10);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Hôm nay';
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
  return `${Math.floor(days / 365)} năm trước`;
}

// ==================== START ====================
init();
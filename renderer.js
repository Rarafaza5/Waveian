const { ipcRenderer } = require('electron');

const searchInput = document.getElementById('searchInput');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnNext = document.getElementById('btnNext');
const btnPrev = document.getElementById('btnPrev');
const btnOpenYT = document.getElementById('btnOpenYT');

const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');

const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const albumArt = document.getElementById('albumArt');

const suggestionsList = document.getElementById('suggestionsList');

const progressSlider = document.getElementById('progressSlider');
const volumeSlider = document.getElementById('volumeSlider');
const timeCurrent = document.getElementById('timeCurrent');
const timeTotal = document.getElementById('timeTotal');

let isDraggingProgress = false;
let debounceTimer;
let activeIndex = -1;
let currentSuggestions = [];
let realSongs = [];

// Formatar segundos para MM:SS
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Focar no input quando a janela abrir
ipcRenderer.on('focus-input', () => {
  searchInput.focus();
  suggestionsList.style.display = 'none';
});

async function fetchSuggestions(query) {
  if (!query) {
    suggestionsList.style.display = 'none';
    return;
  }

  // 1. Buscar sugestões de texto (Google)
  try {
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    currentSuggestions = data[1] || [];
  } catch (e) {
    currentSuggestions = [];
  }

  // 2. Pedir músicas reais ao main process
  ipcRenderer.send('get-real-search-results', query);
}

ipcRenderer.on('real-search-results-reply', (event, songs) => {
  realSongs = songs;
  renderAllSuggestions();
});

function renderAllSuggestions() {
  suggestionsList.innerHTML = '';
  activeIndex = -1;

  const combined = [];
  
  // Adicionar músicas reais primeiro
  realSongs.forEach(song => {
    combined.push({ type: 'song', ...song });
  });

  // Adicionar sugestões de texto
  currentSuggestions.forEach(text => {
    combined.push({ type: 'term', text: text });
  });

  if (combined.length === 0) {
    suggestionsList.style.display = 'none';
    return;
  }

  combined.forEach((item, index) => {
    const el = document.createElement('div');
    el.classList.add('suggestion-item');
    if (item.type === 'song') el.classList.add('song');

    if (item.type === 'song') {
      el.innerHTML = `
        <img src="${item.art}" class="s-art">
        <div class="s-info">
          <div class="s-title">${item.title}</div>
          <div class="s-artist">${item.artist}</div>
        </div>
        <span class="s-tag">Música</span>
      `;
      el.addEventListener('click', () => selectSong(item.videoId));
    } else {
      el.textContent = item.text;
      el.addEventListener('click', () => selectTerm(item.text));
    }
    
    suggestionsList.appendChild(el);
  });

  suggestionsList.style.display = 'flex';
}

function selectSong(videoId) {
  ipcRenderer.send('play-song-id', videoId);
  closeSearch();
}

function selectTerm(text) {
  ipcRenderer.send('search-and-play', text);
  closeSearch();
}

function closeSearch() {
  searchInput.value = '';
  suggestionsList.style.display = 'none';
  ipcRenderer.send('hide-ui');
}

function updateActiveSuggestion() {
  const items = suggestionsList.querySelectorAll('.suggestion-item');
  items.forEach((item, index) => {
    if (index === activeIndex) {
      item.classList.add('active');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('active');
    }
  });
}

// Eventos
searchInput.addEventListener('input', (e) => {
  const query = searchInput.value.trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
});

searchInput.addEventListener('keydown', (e) => {
  const items = suggestionsList.querySelectorAll('.suggestion-item');
  if (e.key === 'Enter') {
    if (activeIndex >= 0 && items[activeIndex]) {
      items[activeIndex].click();
    } else if (searchInput.value.trim()) {
      selectTerm(searchInput.value.trim());
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (items.length > 0) {
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveSuggestion();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (items.length > 0) {
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveSuggestion();
    }
  } else if (e.key === 'Escape') {
    ipcRenderer.send('hide-ui');
  }
});

if (btnOpenLoginWizard) {
  btnOpenLoginWizard.addEventListener('click', () => {
    ipcRenderer.send('open-login');
  });
}

// Controles
btnPlayPause.addEventListener('click', () => ipcRenderer.send('media-control', 'play-pause'));
btnNext.addEventListener('click', () => ipcRenderer.send('media-control', 'next'));
btnPrev.addEventListener('click', () => ipcRenderer.send('media-control', 'prev'));

progressSlider.addEventListener('mousedown', () => { isDraggingProgress = true; });
progressSlider.addEventListener('mouseup', () => {
  isDraggingProgress = false;
  ipcRenderer.send('media-seek', parseFloat(progressSlider.value));
});

volumeSlider.addEventListener('input', () => {
  ipcRenderer.send('media-volume', parseFloat(volumeSlider.value));
});

ipcRenderer.on('track-update', (event, track) => {
  if (track.title) trackTitle.textContent = track.title;
  if (track.artist) trackArtist.textContent = track.artist;
  if (track.art) albumArt.src = track.art;
  
  if (track.isPlaying) {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
  } else {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }

  if (!isDraggingProgress && track.duration) {
    progressSlider.max = track.duration;
    progressSlider.value = track.currentTime;
    timeCurrent.textContent = formatTime(track.currentTime);
    timeTotal.textContent = formatTime(track.duration);
  }
  volumeSlider.value = track.volume;
});

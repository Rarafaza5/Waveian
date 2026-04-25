const { ipcRenderer } = require('electron');

// Listener para ações do main process
ipcRenderer.on('media-action', (event, action, value) => {
  const playBtn = document.getElementById('play-pause-button');
  const videoEl = document.querySelector('video');

  if (action === 'play-pause') {
    if (playBtn) playBtn.click();
  } else if (action === 'pause-only') {
    if (videoEl && !videoEl.paused) {
      if (playBtn) playBtn.click();
    }
  } else if (action === 'play-only') {
    if (videoEl && videoEl.paused) {
      if (playBtn) playBtn.click();
    }
  } else if (action === 'next') {
    const nextBtn = document.querySelector('.next-button');
    if (nextBtn) nextBtn.click();
  } else if (action === 'prev') {
    const prevBtn = document.querySelector('.previous-button');
    if (prevBtn) prevBtn.click();
  } else if (action === 'seek' && videoEl) {
    videoEl.currentTime = value;
  } else if (action === 'set-volume' && videoEl) {
    videoEl.volume = value;
  } else if (action === 'play-id' && value) {
    window.location.href = `https://music.youtube.com/watch?v=${value}`;
  }
});

// Listener para pesquisa perfeita
ipcRenderer.on('perform-search', (event, query) => {
  window.location.href = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
  
  const observer = new MutationObserver((mutations, obs) => {
    const playBtn = document.querySelector('ytmusic-responsive-list-item-renderer ytmusic-play-button-renderer');
    if (playBtn) {
      playBtn.click();
      obs.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
});

// Enviar status da música a cada 500ms
setInterval(() => {
  try {
    const titleEl = document.querySelector('yt-formatted-string.title.style-scope.ytmusic-player-bar');
    const artistEl = document.querySelector('span.subtitle.style-scope.ytmusic-player-bar');
    const artEl = document.querySelector('img.image.style-scope.ytmusic-player-bar');
    const videoEl = document.querySelector('video');

    if (titleEl && artistEl && videoEl) {
      ipcRenderer.send('track-update', {
        title: titleEl.textContent || titleEl.innerText,
        artist: artistEl.textContent || artistEl.innerText,
        art: artEl ? artEl.src : '',
        isPlaying: !videoEl.paused,
        currentTime: videoEl.currentTime,
        duration: videoEl.duration,
        volume: videoEl.volume
      });
    }
  } catch (e) {}
}, 500);

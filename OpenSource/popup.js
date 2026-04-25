const { ipcRenderer } = require('electron');

const popupTitle = document.getElementById('popupTitle');
const popupArtist = document.getElementById('popupArtist');
const popupArt = document.getElementById('popupArt');

ipcRenderer.on('show-popup-data', (event, track) => {
  if (track.title) popupTitle.textContent = track.title;
  if (track.artist) popupArtist.textContent = track.artist;
  if (track.art) popupArt.src = track.art;
});

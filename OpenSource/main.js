const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen, session, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// User-Agents: Desktop para o Player e Mobile para o Login (O segredo do sucesso)
const PLAYER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const LOGIN_UA = 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('lang', 'pt-PT');

let ytWindow = null;
let uiWindow = null;
let loginWindow = null;
let popupWindow = null;
let tray = null;
let currentSongTitle = "";
let mplayerIsPlaying = false;
let currentVolume = 1;

function createYtWindow() {
  const ses = session.fromPartition('persist:waveian-session');
  
  // Strip Sec-Ch-Ua headers for all Google requests
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://accounts.google.com/*', 'https://*.google.com/*'] }, (details, callback) => {
    Object.keys(details.requestHeaders).forEach(h => {
      if (h.toLowerCase().startsWith('sec-ch-ua')) delete details.requestHeaders[h];
    });
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  ytWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-yt.js'),
      partition: 'persist:waveian-session',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  ytWindow.webContents.setUserAgent(PLAYER_UA);
  ytWindow.loadURL('https://music.youtube.com');
  ytWindow.on('closed', () => { ytWindow = null; });
}

function createLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 500,
    height: 700,
    title: 'Waveian - Conectar Conta',
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:waveian-session', // Mesma partição do player!
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // USAR USER AGENT MOBILE PARA O LOGIN (O Google aceita quase sempre)
  loginWindow.webContents.setUserAgent(LOGIN_UA);
  
  loginWindow.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https://music.youtube.com');

  // Quando voltar para o music.youtube.com, significa que logou!
  loginWindow.webContents.on('did-navigate', (event, url) => {
    if (url.startsWith('https://music.youtube.com')) {
      setTimeout(async () => {
        // Garantir que os cookies sejam salvos no disco
        const ses = session.fromPartition('persist:waveian-session');
        await ses.cookies.flushStore();
        
        if (ytWindow) ytWindow.webContents.reload();
        loginWindow.close();
      }, 2000);
    }
  });

  loginWindow.on('closed', () => { loginWindow = null; });
}

function createUiWindow() {
  uiWindow = new BrowserWindow({
    width: 700,
    height: 550,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  uiWindow.loadFile('index.html');
  uiWindow.on('blur', () => { if (!loginWindow) uiWindow.hide(); });
}

function createPopupWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height } = primaryDisplay.workAreaSize;
  popupWindow = new BrowserWindow({
    width: 350,
    height: 100,
    x: 20,
    y: height - 120,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  popupWindow.loadFile('popup.html');
}

app.whenReady().then(() => {
  createYtWindow();
  createUiWindow();
  createPopupWindow();
  
  try {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir Waveian', click: () => uiWindow.show() },
      { label: 'Sair', click: () => app.quit() }
    ]);
    tray.setToolTip('Waveian');
    tray.setContextMenu(contextMenu);
  } catch(e) {}

  globalShortcut.register('Control+Shift+Space', () => {
    if (uiWindow.isVisible()) {
      uiWindow.hide();
    } else {
      uiWindow.center();
      uiWindow.show();
      uiWindow.webContents.send('focus-input');
    }
  });

  // Atalhos de Volume: Ctrl+Shift+1 (Baixar) e Ctrl+Shift+2 (Aumentar)
  globalShortcut.register('Control+Shift+1', () => {
    currentVolume = Math.max(0, currentVolume - 0.1);
    if (ytWindow) ytWindow.webContents.send('media-action', 'set-volume', currentVolume);
  });

  globalShortcut.register('Control+Shift+2', () => {
    currentVolume = Math.min(1, currentVolume + 0.1);
    if (ytWindow) ytWindow.webContents.send('media-action', 'set-volume', currentVolume);
  });
});

ipcMain.on('open-login', () => {
  createLoginWindow();
});

ipcMain.on('search-and-play', (event, query) => {
  if (ytWindow) ytWindow.webContents.send('perform-search', query);
});

ipcMain.on('get-real-search-results', async (event, query) => {
  try {
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`, {
      headers: { 'User-Agent': PLAYER_UA }
    });
    const html = await response.text();
    const match = html.match(/var ytInitialData = (\{.*?\});/);
    if (match) {
      const data = JSON.parse(match[1]);
      const results = [];
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents;
      if (contents) {
        for (const item of contents) {
          if (item.videoRenderer) {
            const video = item.videoRenderer;
            results.push({
              type: 'song',
              title: video.title.runs[0].text,
              artist: video.ownerText.runs[0].text,
              videoId: video.videoId,
              art: video.thumbnail.thumbnails[0].url
            });
          }
          if (results.length >= 5) break;
        }
      }
      event.reply('real-search-results-reply', results);
    }
  } catch (e) { event.reply('real-search-results-reply', []); }
});

ipcMain.on('play-song-id', (event, videoId) => {
  if (ytWindow) ytWindow.webContents.send('media-action', 'play-id', videoId);
});

ipcMain.on('media-control', (event, action) => {
  if (ytWindow) ytWindow.webContents.send('media-action', action);
});

ipcMain.on('media-seek', (event, value) => {
  if (ytWindow) ytWindow.webContents.send('media-action', 'seek', value);
});

ipcMain.on('media-volume', (event, value) => {
  if (ytWindow) ytWindow.webContents.send('media-action', 'set-volume', value);
});

ipcMain.on('hide-ui', () => { uiWindow.hide(); });

ipcMain.on('track-update', (event, trackInfo) => {
  mplayerIsPlaying = trackInfo.isPlaying;
  currentVolume = trackInfo.volume;
  if (trackInfo.title && trackInfo.title !== currentSongTitle) {
    currentSongTitle = trackInfo.title;
    if (popupWindow && !uiWindow.isVisible()) {
      popupWindow.webContents.send('show-popup-data', trackInfo);
      popupWindow.showInactive();
      setTimeout(() => popupWindow.hide(), 3000);
    }
  }
  if (uiWindow) uiWindow.webContents.send('track-update', trackInfo);
});

setInterval(() => {
  exec('powershell -ExecutionPolicy Bypass -File check-media.ps1', (err, stdout) => {
    if (!err && stdout.trim() === 'True' && mplayerIsPlaying) {
      if (ytWindow) ytWindow.webContents.send('media-action', 'pause-only');
    }
  });
}, 2000);

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const http = require('http');
const store = require('./store');
const { Library } = require('./library');
const { createServer, localIp, localIpv6 } = require('./server');

let mainWindow = null;
let tray = null;
let httpServer = null;
let settings = store.load(app);
const library = new Library();
library.reset(settings.folders);

function status(extra) {
  return {
    running: !!httpServer,
    port: settings.port,
    friendlyName: settings.friendlyName,
    localIp: localIp(),
    localIpv6: localIpv6(),
    folders: settings.folders,
    ...extra,
  };
}

function broadcastStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('status', status());
  updateTrayMenu();
}

function startServer() {
  if (httpServer) return;
  const expressApp = createServer({ library, getSettings: () => settings });
  const srv = http.createServer(expressApp);
  srv.on('error', (err) => {
    httpServer = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-error', err.code === 'EADDRINUSE'
        ? `Port ${settings.port} is already in use by something else.`
        : err.message);
    }
    broadcastStatus();
  });
  srv.listen(settings.port, () => {
    httpServer = srv;
    broadcastStatus();
  });
}

function stopServer() {
  if (!httpServer) return;
  httpServer.close();
  httpServer = null;
  broadcastStatus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 660,
    minWidth: 640,
    minHeight: 560,
    title: 'Beam Server',
    backgroundColor: '#0a0b10',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    icon: path.join(__dirname, '..', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Closing the window backgrounds the app (server keeps running via the
  // tray icon) rather than quitting outright — this is a server, and losing
  // shared folders because someone clicked the red dot would be a bad
  // surprise. Only the tray's own Quit item actually exits the process.
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const s = status();
  tray.setToolTip(s.running ? `Beam Server — ${s.localIp}:${s.port}` : 'Beam Server — stopped');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: s.running ? `Running at ${s.localIp}:${s.port}` : 'Stopped', enabled: false },
    { type: 'separator' },
    { label: 'Show Window', click: () => mainWindow.show() },
    { label: s.running ? 'Stop Server' : 'Start Server', click: () => (s.running ? stopServer() : startServer()) },
    { type: 'separator' },
    { label: 'Quit Beam Server', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const trayIconPath = path.join(__dirname, '..', 'icons', 'trayTemplate.png');
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 });
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  updateTrayMenu();
  tray.on('click', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startServer();

  ipcMain.handle('get-status', () => status());
  ipcMain.handle('start-server', () => { startServer(); return status(); });
  ipcMain.handle('stop-server', () => { stopServer(); return status(); });

  ipcMain.handle('set-friendly-name', (e, name) => {
    settings.friendlyName = (name || '').trim() || settings.friendlyName;
    store.save(app, settings);
    broadcastStatus();
    return status();
  });

  ipcMain.handle('add-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths.length) return status();
    const p = result.filePaths[0];
    if (!settings.folders.find((f) => f.path === p)) {
      settings.folders.push({ path: p, label: path.basename(p) });
      store.save(app, settings);
      library.reset(settings.folders);
    }
    broadcastStatus();
    return status();
  });

  ipcMain.handle('remove-folder', (e, folderPath) => {
    settings.folders = settings.folders.filter((f) => f.path !== folderPath);
    store.save(app, settings);
    library.reset(settings.folders);
    broadcastStatus();
    return status();
  });

  ipcMain.handle('reveal-folder', (e, folderPath) => {
    shell.showItemInFolder(folderPath);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

// Deliberately no window-all-closed quit handler: this is a background
// server app, staying alive via the tray after the window closes is the
// whole point (see the close handler above).
app.on('before-quit', () => { app.isQuitting = true; });

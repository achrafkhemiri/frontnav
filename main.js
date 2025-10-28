const { app, BrowserWindow, ipcMain, dialog, globalShortcut, clipboard, protocol } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');
const os = require('os');

// Register the custom 'app' scheme as privileged early (MUST be done before the app is ready).
// This allows using secure app:// URLs to load local files in packaged apps without
// Chromium blocking access to local resources.
try {
  if (protocol && protocol.registerSchemesAsPrivileged) {
    protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }]);
    // console.log('Registered privileged scheme: app');
  }
} catch (e) {
  console.warn('registerSchemesAsPrivileged failed at startup:', e && e.message);
}

let backendProcess;
let logWindow = null;
let logBuffer = '';
const { app: electronApp } = require('electron');
// allow reassignment when we force a different userData location
let userDataPath = app.getPath ? app.getPath('userData') : (electronApp && electronApp.getPath ? electronApp.getPath('userData') : null);

// Ensure userData path is writable: prefer LOCALAPPDATA if present to avoid Program Files permission issues
try {
  const preferBase = process.env.LOCALAPPDATA || (app.getPath ? app.getPath('appData') : null);
  if (preferBase) {
    const forced = path.join(preferBase, 'NavireApp');
    // Force electron to use a per-user writable directory for profile/cache.
    // Also instruct Chromium to use the same directory for the user-data-dir to avoid cache permission errors.
    try { app.setPath && app.setPath('userData', forced); } catch(e) { console.warn('setPath failed', e && e.message); }
    try { userDataPath = forced; } catch(e) { /* ignore */ }
    try { app.commandLine && app.commandLine.appendSwitch && app.commandLine.appendSwitch('user-data-dir', forced); } catch(e) { console.warn('appendSwitch user-data-dir failed', e && e.message); }
    // console.log('Forcing userData to', forced);
    try { fs.mkdirSync(forced, { recursive: true }); } catch(e) {}
  }
} catch (e) {
  console.warn('Could not set userData path:', e && e.message);
}
function writeStartupLog(msg) {
  try {
    const p = userDataPath ? path.join(userDataPath, 'navire-startup.log') : null;
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    // console.log(entry);
    logBuffer += entry;
    if (p) fs.appendFileSync(p, entry, 'utf8');
  } catch (e) {
    console.warn('Failed to write startup log:', e.message);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: true,
  });
  // For packaged apps we register and use a custom 'app://' protocol which serves files
  // from the resources path. This avoids Chromium blocking direct file:// access to files
  // inside app.asar ("Not allowed to load local resource"). In dev we load the file:// index.
  const indexUrl = app.isPackaged
    ? `app:///${path.posix.join('dist','frontend','index.html')}`
    : `file://${path.join(__dirname, 'dist', 'frontend', 'index.html').replace(/\\/g, '/')}`;

  win.loadURL(indexUrl).catch((err) => {
    console.error('Erreur lors du loadURL:', err);
    writeStartupLog('Erreur lors du loadURL: ' + (err && err.message));
  });
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('did-fail-load:', errorCode, errorDescription, validatedURL);
  });
  // Ensure base href is relative at runtime (important when app is packaged inside asar)
  win.webContents.on('dom-ready', () => {
    try {
      win.webContents.executeJavaScript(`(function(){
        try{
          const existing = document.querySelector('base');
          if(existing){ existing.setAttribute('href','./'); }
          else { const b=document.createElement('base'); b.setAttribute('href','./'); document.head.prepend(b); }
        }catch(e){console.warn('set base href failed', e);}
      })()`);
    } catch(e) {
      console.warn('Could not inject base href script:', e.message);
    }
    // If the app is packaged, open DevTools automatically to help diagnose rendering issues.
    try {
      if (app.isPackaged) {
        win.webContents.openDevTools({ mode: 'undocked' });
        writeStartupLog('Opened DevTools automatically (packaged)');
      }
    } catch (e) {
      console.warn('Failed to open DevTools automatically:', e.message);
    }
  });
  // log renderer console messages to startup log (helpful when DevTools are closed)
  win.webContents.on('console-message', (ev, level, message, line, sourceId) => {
    writeStartupLog(`Renderer console [level=${level}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    const msg = `did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`;
    writeStartupLog(msg);
  });
  // Do not open DevTools or the system console automatically in production/desktop mode.
  // DevTools and logs can still be opened manually with the global shortcut (Ctrl/Cmd+Shift+L)
  // or by calling openLogWindow() in the renderer if needed.
}

function waitForPort(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Timeout waiting for port ' + port));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      socket.once('timeout', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Timeout waiting for port ' + port));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      socket.connect(port, host);
    };
    tryConnect();
  });
}

function isPortOpen(host, port, attemptTimeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let handled = false;
    socket.setTimeout(attemptTimeoutMs);
    socket.once('connect', () => {
      handled = true;
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      if (!handled) {
        handled = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.once('timeout', () => {
      if (!handled) {
        handled = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.connect(port, host);
  });
}

app.whenReady().then(async () => {
  // Register a secure scheme and handler to serve files for app:// URLs when packaged.
  try {
    protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }]);
  } catch (e) {
    // ignore if already registered
  }

  try {
    // Helper to resolve a request URL to an existing file under resourcesPath (preferred)
    function resolveResourcePath(urlPath) {
      // try resources/app/<urlPath>
      const candidates = [
        path.join(process.resourcesPath, 'app', urlPath),
        path.join(process.resourcesPath, urlPath),
        // legacy: app.asar path (may be invalid), try last
        path.join(process.resourcesPath, 'app.asar', urlPath),
      ];
      for (const c of candidates) {
        try { if (fs.existsSync(c)) return c; } catch (e) {}
      }
      return null;
    }

    // Register protocol that serves files from process.resourcesPath when available.
    protocol.registerFileProtocol('app', (request, callback) => {
      try {
        // Normalize URL: accept app://dist/... and app:///dist/...
        // Remove the scheme prefix and any leading slashes to get a relative path inside resources.
        let url = request.url || '';
        // strip protocol (app:// or app:///) robustly
        url = url.replace(/^app:\/\/+/, '');
        // decode percent-encoding
        try { url = decodeURIComponent(url); } catch (e) {}
        // remove any leading slashes that remain
        url = url.replace(/^\/+/, '');

        writeStartupLog('Resolving app protocol URL: ' + request.url + ' -> ' + url);

        const resolved = resolveResourcePath(url);
        if (resolved) {
          writeStartupLog('Resolved app URL to: ' + resolved);
          return callback({ path: resolved });
        }

        // As a final fallback, try __dirname (development/unpacked), but avoid returning paths
        // that are inside an app.asar package because Chromium may block file:// access to them.
        const devFallback = path.normalize(path.join(__dirname, url));
        writeStartupLog('Dev fallback path: ' + devFallback + ' exists=' + fs.existsSync(devFallback));
        if (fs.existsSync(devFallback)) return callback({ path: devFallback });
        // not found
        writeStartupLog('app protocol could not resolve: ' + url);
        return callback({ error: -6 });
      } catch (err) {
        console.error('protocol.registerFileProtocol error', err);
        writeStartupLog('protocol.registerFileProtocol error: ' + (err && err.message));
        callback({ error: -6 });
      }
    });
  } catch (e) {
    console.warn('Failed to register app protocol:', e && e.message);
  }
  // Lancer le backend Spring Boot (spawn permet de récupérer stdout/stderr en continu)
  // backend jar path. When packaged, prefer to look into process.resourcesPath where extraResources are copied.
  function findBackendJar() {
    const candidates = [];
    // dev path
    candidates.push(path.join(__dirname, '..', 'navire', 'target', 'navire-0.0.1-SNAPSHOT.jar'));
    // resourcesPath when packaged
    try {
      if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'navire-0.0.1-SNAPSHOT.jar'));
    } catch (e) {}
    // also check common unpacked location
    try {
      if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'app', 'navire-0.0.1-SNAPSHOT.jar'));
    } catch (e) {}
    for (const c of candidates) {
      try { if (fs.existsSync(c)) return c; } catch (e) {}
    }
    return null;
  }
  const backendPathFound = findBackendJar();
  if (!backendPathFound) {
    writeStartupLog('Backend JAR not found in expected locations. Candidates checked.');
  } else {
    writeStartupLog('Backend JAR resolved to: ' + backendPathFound);
  }
  // Resolve backendPath to use for spawning (fallback to dev path if not packaged)
  const backendPath = backendPathFound || path.join(__dirname, '..', 'navire', 'target', 'navire-0.0.1-SNAPSHOT.jar');
  // console.log('Starting backend jar:', backendPath);
  const backendCwd = fs.existsSync(backendPath) ? path.dirname(backendPath) : null;
  // Vérifier si le port 8086 est déjà occupé (par ex. backend déjà lancé). Si oui, on n'essaie pas de lancer un second backend.
  try {
    const portTaken = await isPortOpen('127.0.0.1', 8086, 1000);
    if (portTaken) {
      // console.log('Port 8086 déjà occupé, on suppose qu\'un backend est déjà en cours d\'exécution. Ouverture de la fenêtre.');
      createWindow();
    } else {
      // spawn le backend et écouter ses logs; hide the java console window on Windows
      if (!backendCwd || !fs.existsSync(backendPath)) {
        writeStartupLog('Backend path not available for spawn: ' + backendPath + ' — opening window without spawning backend.');
        createWindow();
      } else {
        backendProcess = spawn('java', ['-jar', backendPath], { cwd: backendCwd, windowsHide: true });

        backendProcess.stdout.on('data', (data) => {
          const text = data.toString();
          // console.log(`[backend stdout] ${text}`);
          const entry = `[STDOUT ${new Date().toISOString()}] ${text}`;
          logBuffer += entry;
          if (logWindow) logWindow.webContents.send('log-update', entry);
        });
        backendProcess.stderr.on('data', (data) => {
          const text = data.toString();
          console.error(`[backend stderr] ${text}`);
          const entry = `[STDERR ${new Date().toISOString()}] ${text}`;
          logBuffer += entry;
          if (logWindow) logWindow.webContents.send('log-update', entry);
        });
        backendProcess.on('exit', (code, signal) => {
          const entry = `[EXIT ${new Date().toISOString()}] code=${code} signal=${signal}\n`;
          // console.log(`Backend process exited with code=${code} signal=${signal}`);
          logBuffer += entry;
          if (logWindow) logWindow.webContents.send('log-update', entry);
        });

        try {
          // attend que le backend accepte les connexions sur le port 8086
          const PORT_WAIT_MS = 60000; // 60s
          await waitForPort('127.0.0.1', 8086, PORT_WAIT_MS);
          // console.log('Backend disponible sur le port 8086, ouverture de la fenêtre');
          createWindow();
        } catch (err) {
          console.error('Backend n\'a pas répondu dans le délai imparti:', err);
          // malgré l'erreur, on ouvre la fenêtre pour afficher les logs d'erreur éventuels
          createWindow();
        }
      }
    }
  } catch (err) {
    console.error('Erreur lors de la vérification du port 8086:', err);
    // fallback: spawn quand même
    backendProcess = spawn('java', ['-jar', backendPath], { cwd: backendCwd, windowsHide: false });
    backendProcess.stdout.on('data', (data) => {
      // console.log(`[backend stdout] ${data.toString()}`);
    });
    backendProcess.stderr.on('data', (data) => {
      console.error(`[backend stderr] ${data.toString()}`);
    });
    backendProcess.on('exit', (code, signal) => {
      // console.log(`Backend process exited with code=${code} signal=${signal}`);
    });
    createWindow();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// System console window
function openLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }
  logWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const html = `
    <!doctype html>
    <html>
    <head><meta charset="utf-8"><title>System Console</title></head>
    <body style="font-family:Segoe UI, Arial, sans-serif; margin:10px">
      <h3>System Console - Logs</h3>
      <div>
        <button id="copy">Copy to clipboard</button>
        <button id="save">Save to file</button>
        <button id="clear">Clear</button>
      </div>
      <textarea id="logs" style="width:100%;height:80%;margin-top:8px;white-space:pre;overflow:auto;font-family:monospace"></textarea>
      <script>
        const { ipcRenderer } = require('electron');
        const logs = document.getElementById('logs');
        const copyBtn = document.getElementById('copy');
        const saveBtn = document.getElementById('save');
        const clearBtn = document.getElementById('clear');
        ipcRenderer.invoke('get-logs').then((content) => { logs.value = content; logs.scrollTop = logs.scrollHeight; });
        ipcRenderer.on('log-update', (ev, chunk) => { logs.value += chunk; logs.scrollTop = logs.scrollHeight; });
        copyBtn.addEventListener('click', async () => { await ipcRenderer.invoke('copy-logs'); alert('Logs copied to clipboard'); });
        saveBtn.addEventListener('click', async () => { const res = await ipcRenderer.invoke('save-logs'); if (res && res.path) alert('Saved to ' + res.path); else alert('Save cancelled'); });
        clearBtn.addEventListener('click', () => { logs.value = ''; ipcRenderer.invoke('clear-logs'); });
      </script>
    </body>
    </html>
  `;

  logWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  logWindow.on('closed', () => { logWindow = null; });
}

ipcMain.handle('get-logs', async () => {
  return logBuffer;
});
ipcMain.handle('copy-logs', async () => {
  try {
    clipboard.writeText(logBuffer || '');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('save-logs', async () => {
  try {
    const defaultPath = path.join(os.homedir(), `NavireApp-logs-${Date.now()}.txt`);
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, logBuffer, 'utf8');
    return { path: filePath };
  } catch (e) {
    return { error: e.message };
  }
});
ipcMain.handle('clear-logs', async () => { logBuffer = ''; return { ok: true }; });

// Register a global shortcut to open logs window (Ctrl/Cmd+Shift+L)
app.whenReady().then(() => {
  try {
    globalShortcut.register('CommandOrControl+Shift+L', () => {
      openLogWindow();
    });
  } catch (e) {
    console.warn('Could not register global shortcut for logs:', e.message);
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (backendProcess) {
      try { backendProcess.kill(); } catch (e) { /* ignore */ }
    }
    app.quit();
  }
});

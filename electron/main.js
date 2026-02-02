const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

// Handle open external URL
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

let mainWindow;
let serverProcess;

const userDataPath = app.getPath('userData');
const logPath = path.join(userDataPath, 'debug.log');

// Ensure userData directory exists
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

function createWindow() {
  log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow loading local HTTP content (backend) from file:// frontend
      plugins: true,      // Enable PDF viewer and other plugins
    },
  });

  // In development, load from Vite dev server. In production, load built file.
  const isDev = !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../src/dist/index.html')}`;

  log(`Loading URL: ${startUrl}`);

  mainWindow.loadURL(startUrl).catch(err => {
    log(`Failed to load app: ${err.message}`);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startServer() {
  const isDev = !app.isPackaged;
  const serverPath = path.join(__dirname, '../server/index.js');
  const dbPath = path.join(userDataPath, 'rental.db');
  const uploadsPath = path.join(userDataPath, 'uploads');

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  log(`Starting server process at: ${serverPath}`);
  log(`DB Path: ${dbPath}`);
  log(`Uploads Path: ${uploadsPath}`);

  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: 3000,
      DB_PATH: dbPath,
      UPLOADS_PATH: uploadsPath,
      NODE_ENV: isDev ? 'development' : 'production',
      JWT_SECRET: process.env.JWT_SECRET || 'rental-mgt-secret-prod-2026'
    },
    stdio: ['inherit', 'pipe', 'pipe', 'ipc']
  });

  serverProcess.stdout.on('data', (data) => {
    log(`Server STDOUT: ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    log(`Server STDERR: ${data.toString().trim()}`);
  });

  serverProcess.on('message', (msg) => {
    log(`Server IPC Message: ${JSON.stringify(msg)}`);
  });

  serverProcess.on('error', (err) => {
    log(`Failed to start server process: ${err.message}`);
  });

  serverProcess.on('exit', (code, signal) => {
    log(`Server process exited with code ${code} and signal ${signal}`);
  });
}

app.on('ready', () => {
  startServer();
  createWindow();

  // Register F1 shortcut for help
  globalShortcut.register('F1', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-help');
    }
  });
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

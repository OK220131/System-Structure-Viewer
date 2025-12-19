const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, 'build/icon.ico')
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.loadFile('src/index.html');

  // Create menu template
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Open DevTools only in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Read file contents
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read file as binary (for images, etc.)
ipcMain.handle('read-file-binary', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath);
    return { success: true, content: content.toString('base64') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Write file
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read directory
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if path exists
ipcMain.handle('path-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return { success: true, exists: true };
  } catch (error) {
    return { success: true, exists: false };
  }
});

// Open file picker dialog
ipcMain.handle('open-file-dialog', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open directory picker dialog
ipcMain.handle('open-directory-dialog', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get app path (for saves directory)
ipcMain.handle('get-app-path', async () => {
  // If packaged, save next to the executable
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'saves');
  }
  // In development, save in project folder
  return path.join(__dirname, 'saves');
});

// Open file in default application
ipcMain.handle('open-external', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get file stats
ipcMain.handle('get-file-stats', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      success: true,
      stats: {
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
    pathExists: (filePath) => ipcRenderer.invoke('path-exists', filePath),
    getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),

    // Dialog operations
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
    openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),

    // App operations
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    openExternal: (filePath) => ipcRenderer.invoke('open-external', filePath),
    showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),

    // Path utilities
    path: {
        join: (...args) => path.join(...args),
        basename: (filePath) => path.basename(filePath),
        dirname: (filePath) => path.dirname(filePath),
        extname: (filePath) => path.extname(filePath)
    }
});

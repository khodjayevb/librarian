const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Listen for menu events
  onImportBooks: (callback) => {
    ipcRenderer.on('import-books', callback);
  },

  onScanLibrary: (callback) => {
    ipcRenderer.on('scan-library', callback);
  },

  onOpenPreferences: (callback) => {
    ipcRenderer.on('open-preferences', callback);
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
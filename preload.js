const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getDefaultConfigPath: () => ipcRenderer.invoke('get-default-config-path'),
    checkClaudeInstalled: () => ipcRenderer.invoke('check-claude-installed'),
    createDefaultConfig: () => ipcRenderer.invoke('create-default-config'),
    loadConfig: (filePath) => ipcRenderer.invoke('load-config', filePath),
    saveConfig: (filePath, config) => ipcRenderer.invoke('save-config', filePath, config),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),
    getPreferences: () => ipcRenderer.invoke('get-preferences'),
    setPreferences: (preferences) => ipcRenderer.invoke('set-preferences', preferences),
    checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
    createBackup: (filePath) => ipcRenderer.invoke('create-backup', filePath),
    getBackups: (filePath) => ipcRenderer.invoke('get-backups', filePath),
    restoreBackup: (backupPath, targetPath) => ipcRenderer.invoke('restore-backup', backupPath, targetPath),
    checkDependencies: (config) => ipcRenderer.invoke('check-dependencies', config),
    getDependencyInstructions: (dependencyName) => ipcRenderer.invoke('get-dependency-instructions', dependencyName),
    checkSingleDependency: (command) => ipcRenderer.invoke('check-single-dependency', command),
    testServerConfig: (config) => ipcRenderer.invoke('test-server-config', config),
    openContainingFolder: (filePath) => ipcRenderer.invoke('open-containing-folder', filePath),
    openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
    getPlatform: () => process.platform,
    
    // Auto-updater APIs
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onUpdateProgress: (callback) => {
        ipcRenderer.on('download-progress', (event, progress) => callback(progress));
    }
});
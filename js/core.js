// Core application functionality - initialization, config management, auto-save

let currentConfig = { mcpServers: {} };
let originalConfig = null;
let currentConfigPath = '';
let hasUnsavedChanges = false;
let autoSaveTimeout = null;
let isSaving = false;

// DOM elements
const configFilePathSpan = document.getElementById('configFilePath');

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    // Load the config directly
    const preferences = await window.api.getPreferences();
    
    if (preferences.configPath) {
        // Load saved config path
        await loadConfig(preferences.configPath);
    } else {
        // Load default config
        const defaultPath = await window.api.getDefaultConfigPath();
        await loadConfig(defaultPath);
    }
    
    // Set up event listener for changes
    setupChangeTracking();
});

// Load config file
async function loadConfig(filePath) {
    const result = await window.api.loadConfig(filePath);
    if (result.success) {
        currentConfig = result.data;
        originalConfig = JSON.parse(JSON.stringify(result.data));
        currentConfigPath = result.path;
        updateConfigPath(result.path);
        hasUnsavedChanges = false;
        updateAutoSaveStatus('saved');
        
        // Trigger re-render if server management is loaded
        if (window.serverManagement && window.serverManagement.renderServers) {
            window.serverManagement.renderServers();
        }
    } else {
        // Handle file not found specifically
        if (result.errorType === 'FILE_NOT_FOUND') {
            await handleConfigNotFound(filePath);
        } else {
            updateAutoSaveStatus('error', result.error);
            alert(`Error loading config: ${result.error}`);
        }
    }
}

// Handle config file not found
async function handleConfigNotFound(filePath) {
    // Show loading state while checking Claude installation
    showLoadingState('Checking Claude Desktop installation...');
    
    const isClaudeInstalled = await window.api.checkClaudeInstalled();
    
    if (isClaudeInstalled) {
        // Claude is installed, create default config
        showLoadingState('Creating default configuration...');
        
        const createResult = await window.api.createDefaultConfig();
        if (createResult.success) {
            // Hide loading state before reloading
            hideLoadingState();
            // Reload the config
            await loadConfig(createResult.path);
            // Show a success message
            showNotification('Configuration created successfully!', 'success');
        } else {
            hideLoadingState();
            showErrorState('Failed to create configuration', createResult.error);
        }
    } else {
        // Claude is not installed
        hideLoadingState();
        showClaudeNotInstalledState();
    }
}

// Show/hide loading states
function showLoadingState(message) {
    const loadingModal = document.getElementById('loadingModal');
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingModal && loadingMessage) {
        loadingMessage.textContent = message;
        loadingModal.style.display = 'flex';
    }
}

function hideLoadingState() {
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.style.display = 'none';
    }
}

// Show Claude not installed state
function showClaudeNotInstalledState() {
    const modal = document.getElementById('claudeNotInstalledModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Show error state
function showErrorState(title, message) {
    const modal = document.getElementById('errorModal');
    const titleEl = document.getElementById('errorModalTitle');
    const messageEl = document.getElementById('errorModalMessage');
    
    if (modal && titleEl && messageEl) {
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'flex';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Use the showToast from ui-utils if available
    if (window.uiUtils && window.uiUtils.showToast) {
        window.uiUtils.showToast(type, message);
    }
}

// Save config file
async function saveConfig(filePath) {
    // Create backup before saving
    if (currentConfigPath) {
        const backupResult = await window.api.createBackup(currentConfigPath);
        if (!backupResult.success) {
            console.warn('Failed to create backup:', backupResult.error);
        }
    }
    
    const result = await window.api.saveConfig(filePath, currentConfig);
    if (result.success) {
        currentConfigPath = filePath;
        updateConfigPath(filePath);
        originalConfig = JSON.parse(JSON.stringify(currentConfig));
        hasUnsavedChanges = false;
        await updateStatus();
        await window.api.setPreferences({ configPath: filePath });
        alert('Config saved successfully!');
    } else {
        alert(`Error saving config: ${result.error}`);
    }
}

// Track changes and trigger auto-save
function markAsChanged() {
    hasUnsavedChanges = true;
    updateAutoSaveStatus('pending');
    
    // Clear existing timeout
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    
    // Set new timeout for auto-save (500ms delay)
    autoSaveTimeout = setTimeout(async () => {
        await autoSave();
    }, 500);
    
    // Debounced dependency check
    if (markAsChanged.dependencyCheckTimeout) {
        clearTimeout(markAsChanged.dependencyCheckTimeout);
    }
    
    markAsChanged.dependencyCheckTimeout = setTimeout(async () => {
        if (window.systemDeps && window.systemDeps.checkSystemDependencies) {
            await window.systemDeps.checkSystemDependencies();
        }
    }, 1000);
}

// Auto-save functionality
async function autoSave() {
    if (!currentConfigPath || isSaving) return;
    
    isSaving = true;
    updateAutoSaveStatus('saving');
    
    try {
        // Create backup before saving
        const backupResult = await window.api.createBackup(currentConfigPath);
        if (!backupResult.success) {
            console.warn('Failed to create backup:', backupResult.error);
        }
        
        const result = await window.api.saveConfig(currentConfigPath, currentConfig);
        if (result.success) {
            originalConfig = JSON.parse(JSON.stringify(currentConfig));
            hasUnsavedChanges = false;
            updateAutoSaveStatus('saved');
            await window.api.setPreferences({ configPath: currentConfigPath });
        } else {
            updateAutoSaveStatus('error', result.error);
        }
    } catch (error) {
        updateAutoSaveStatus('error', error.message);
    } finally {
        isSaving = false;
    }
}

// Auto-save status indicator
function updateAutoSaveStatus(status, errorMessage = '') {
    const statusElement = document.getElementById('autoSaveStatus');
    if (!statusElement) return;
    
    const statusIcon = statusElement.querySelector('.status-icon');
    const statusText = statusElement.querySelector('.status-text');
    
    switch (status) {
        case 'saved':
            statusIcon.textContent = '✓';
            statusIcon.className = 'status-icon status-saved';
            statusText.textContent = 'Auto-saved';
            break;
        case 'saving':
            statusIcon.textContent = '⟳';
            statusIcon.className = 'status-icon status-saving';
            statusText.textContent = 'Saving...';
            break;
        case 'pending':
            statusIcon.textContent = '•';
            statusIcon.className = 'status-icon status-pending';
            statusText.textContent = 'Changes pending';
            break;
        case 'error':
            statusIcon.textContent = '⚠';
            statusIcon.className = 'status-icon status-error';
            statusText.textContent = 'Save failed';
            statusElement.title = errorMessage;
            break;
    }
}

// Status indicator functions
async function updateStatus(type = 'normal', message = '') {
    const indicator = document.getElementById('statusIndicator');
    if (!indicator) return;
    
    const statusDot = indicator.querySelector('.status-dot');
    const statusText = indicator.querySelector('.status-text');
    
    if (type === 'error') {
        statusDot.className = 'status-dot status-error';
        statusText.textContent = message || 'Error';
        return;
    }
    
    // Check if file exists
    if (currentConfigPath) {
        const fileCheck = await window.api.checkFileExists(currentConfigPath);
        
        if (!fileCheck.exists) {
            statusDot.className = 'status-dot status-warning';
            statusText.textContent = 'File not found';
        } else if (hasUnsavedChanges) {
            statusDot.className = 'status-dot status-warning';
            statusText.textContent = 'Unsaved changes';
        } else {
            statusDot.className = 'status-dot status-success';
            statusText.textContent = 'Saved';
        }
    } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'No file loaded';
    }
}

// Track changes
function setupChangeTracking() {
    // Periodic check for external changes
    setInterval(async () => {
        if (currentConfigPath && !hasUnsavedChanges) {
            const fileCheck = await window.api.checkFileExists(currentConfigPath);
            if (!fileCheck.exists) {
                await updateStatus();
            }
        }
    }, 5000);
}

// Update config file path display
function updateConfigPath(filePath) {
    if (configFilePathSpan) {
        configFilePathSpan.textContent = filePath;
    }
}

// Open containing folder
async function openContainingFolder() {
    if (!currentConfigPath) return;
    
    try {
        const result = await window.api.openContainingFolder(currentConfigPath);
        if (!result.success) {
            if (window.uiUtils && window.uiUtils.showToast) {
                window.uiUtils.showToast('error', 'Failed to open folder');
            }
        }
    } catch (error) {
        console.error('Failed to open containing folder:', error);
        if (window.uiUtils && window.uiUtils.showToast) {
            window.uiUtils.showToast('error', 'Failed to open folder');
        }
    }
}

// Switch config file
async function switchConfigFile() {
    const result = await window.api.openFileDialog();
    if (result.success) {
        await loadConfig(result.filePath);
    }
}

// Auto-updater functions
async function initializeAutoUpdater() {
    // Display current version
    try {
        const version = await window.api.getAppVersion();
        const versionElement = document.getElementById('appVersion');
        if (versionElement) {
            versionElement.textContent = version;
        }
    } catch (error) {
        console.error('Failed to get app version:', error);
    }
    
    // Setup update check button
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', async () => {
            checkUpdatesBtn.disabled = true;
            checkUpdatesBtn.textContent = 'Checking...';
            
            try {
                await window.api.checkForUpdates();
                // The auto-updater will handle the rest via events
            } catch (error) {
                console.error('Failed to check for updates:', error);
                if (window.uiUtils && window.uiUtils.showToast) {
                    window.uiUtils.showToast('error', 'Failed to check for updates');
                }
            } finally {
                setTimeout(() => {
                    checkUpdatesBtn.disabled = false;
                    checkUpdatesBtn.textContent = 'Check for Updates';
                }, 2000);
            }
        });
    }
    
    // Listen for update progress
    window.api.onUpdateProgress((progress) => {
        const updateProgress = document.getElementById('updateProgress');
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        
        if (updateProgress && progressFill && progressPercent) {
            updateProgress.classList.remove('hidden');
            progressFill.style.width = `${progress.percent}%`;
            progressPercent.textContent = `${Math.round(progress.percent)}%`;
        }
    });
}

// Add click listeners for file path icons
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openFolderBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openContainingFolder();
    });
    
    document.getElementById('switchFileBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        switchConfigFile();
    });
    
    // Initialize auto-updater UI
    initializeAutoUpdater();
    
    // Claude not installed modal handlers
    document.getElementById('downloadClaudeBtn')?.addEventListener('click', async () => {
        await window.api.openExternalLink('https://claude.ai/download');
    });
    
    document.getElementById('browseForConfigBtn')?.addEventListener('click', async () => {
        const result = await window.api.openFileDialog();
        if (result.success) {
            const modal = document.getElementById('claudeNotInstalledModal');
            if (modal) modal.style.display = 'none';
            await loadConfig(result.filePath);
        }
    });
    
    // Error modal close button
    document.getElementById('errorModalCloseBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('errorModal');
        if (modal) modal.style.display = 'none';
    });
});

// Export core functionality
window.core = {
    currentConfig: () => currentConfig,
    setCurrentConfig: (config) => { currentConfig = config; },
    currentConfigPath: () => currentConfigPath,
    markAsChanged,
    loadConfig,
    saveConfig,
    hasUnsavedChanges: () => hasUnsavedChanges
};
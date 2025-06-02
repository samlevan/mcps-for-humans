let currentConfig = { mcpServers: {} };
let originalConfig = null;
let currentConfigPath = '';
let editingServerName = null;
let editingDisabledServer = false;
let hasUnsavedChanges = false;
let autoSaveTimeout = null;
let isSaving = false;

// DOM elements
const serversList = document.getElementById('serversList');
const currentPathSpan = document.getElementById('currentPath');
const serverModal = document.getElementById('serverModal');
const modalTitle = document.getElementById('modalTitle');
const serverNameInput = document.getElementById('serverName');
const serverCommandInput = document.getElementById('serverCommand');
const serverArgsInput = document.getElementById('serverArgs');
const envVarsList = document.getElementById('envVarsList');
const commandInput = document.getElementById('commandInput');

// Initialize
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

// Event listeners
// History button (replaces backups)
document.getElementById('historyBtn').addEventListener('click', showBackupsModal);

document.getElementById('systemStatusBtn').addEventListener('click', showSystemStatusModal);

// File switcher
document.getElementById('fileSwitcherBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFileSwitcher();
});

document.getElementById('openDifferentBtn').addEventListener('click', async () => {
    const result = await window.api.openFileDialog();
    if (result.success) {
        hideFileSwitcher();
        await loadConfig(result.filePath);
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.file-info')) {
        hideFileSwitcher();
    }
    if (!e.target.closest('.add-server-dropdown')) {
        hideAddServerDropdown();
    }
});

// Enhanced Add Server dropdown functionality will be initialized in DOMContentLoaded

document.querySelector('.close-btn').addEventListener('click', hideServerModal);
document.getElementById('cancelModalBtn').addEventListener('click', hideServerModal);
document.getElementById('saveServerBtn').addEventListener('click', saveServer);

// Mode toggle state
let isRawMode = false;

// Mode toggle button
document.getElementById('modalModeToggle').addEventListener('click', () => {
    toggleEditMode();
});

document.getElementById('addEnvVarBtn').addEventListener('click', () => {
    addEnvVarRow('', '');
});

// Command parser event listeners
let parseTimeout = null;
commandInput.addEventListener('input', (e) => {
    clearTimeout(parseTimeout);
    parseTimeout = setTimeout(() => {
        parseCommand(e.target.value);
    }, 300); // Debounce for 300ms
});


// Example command buttons
document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const command = e.target.getAttribute('data-command');
        commandInput.value = command;
        parseCommand(command);
    });
});

// Claude not installed modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Download Claude button
    const downloadClaudeBtn = document.getElementById('downloadClaudeBtn');
    if (downloadClaudeBtn) {
        downloadClaudeBtn.addEventListener('click', async () => {
            const platform = navigator.platform.toLowerCase();
            let downloadUrl = 'https://claude.ai/download';
            
            if (platform.includes('mac')) {
                downloadUrl = 'https://claude.ai/download/mac';
            } else if (platform.includes('win')) {
                downloadUrl = 'https://claude.ai/download/windows';
            } else if (platform.includes('linux')) {
                downloadUrl = 'https://claude.ai/download/linux';
            }
            
            await window.api.openExternalLink(downloadUrl);
        });
    }
    
    // Browse for config button
    const browseConfigBtn = document.getElementById('browseConfigBtn');
    if (browseConfigBtn) {
        browseConfigBtn.addEventListener('click', async () => {
            const result = await window.api.openFileDialog();
            if (result.success) {
                const claudeModal = document.getElementById('claudeNotInstalledModal');
                if (claudeModal) {
                    claudeModal.style.display = 'none';
                }
                await loadConfig(result.filePath);
            }
        });
    }
    
    // Close error modal buttons
    const closeErrorBtns = document.querySelectorAll('#closeErrorBtn, .close-error-btn');
    closeErrorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const errorModal = document.getElementById('errorModal');
            if (errorModal) {
                errorModal.style.display = 'none';
            }
        });
    });
});



// Load config file
async function loadConfig(filePath) {
    const result = await window.api.loadConfig(filePath);
    if (result.success) {
        currentConfig = result.data;
        originalConfig = JSON.parse(JSON.stringify(result.data));
        currentConfigPath = result.path;
        currentPathSpan.textContent = result.path;
        hasUnsavedChanges = false;
        updateAutoSaveStatus('saved');
        renderServers();
        // Hide any loading/error states
        hideLoadingState();
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
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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
        currentPathSpan.textContent = filePath;
        originalConfig = JSON.parse(JSON.stringify(currentConfig));
        hasUnsavedChanges = false;
        await updateStatus();
        await window.api.setPreferences({ configPath: filePath });
        alert('Config saved successfully!');
    } else {
        alert(`Error saving config: ${result.error}`);
    }
}

// Render servers list
function renderServers() {
    serversList.innerHTML = '';
    
    if (!currentConfig.mcpServers) {
        currentConfig.mcpServers = {};
    }
    if (!currentConfig.disabledMcpServers) {
        currentConfig.disabledMcpServers = {};
    }
    
    // Combine all servers and sort by name
    const allServers = [];
    
    // Add active servers
    for (const [name, server] of Object.entries(currentConfig.mcpServers)) {
        allServers.push({ name, server, isDisabled: false });
    }
    
    // Add disabled servers
    for (const [name, server] of Object.entries(currentConfig.disabledMcpServers)) {
        allServers.push({ name, server, isDisabled: true });
    }
    
    // Sort all servers by name (case-insensitive)
    allServers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    
    // Render sorted servers
    for (const { name, server, isDisabled } of allServers) {
        renderServerItem(name, server, isDisabled);
    }
}

// Render individual server item
function renderServerItem(name, server, isDisabled) {
    const serverEl = document.createElement('div');
    serverEl.className = `server-item ${isDisabled ? 'server-disabled' : ''}`;
    serverEl.setAttribute('tabindex', '0');
    serverEl.setAttribute('role', 'button');
    serverEl.setAttribute('aria-label', `Click to edit ${name} server`);
    
    // Create clickable edit area (covers most of the row)
    const serverInfo = document.createElement('div');
    serverInfo.className = 'server-info clickable-area';
    
    const serverHeader = document.createElement('div');
    serverHeader.className = 'server-header';
    
    // Toggle button (separate click zone)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = `toggle-btn ${isDisabled ? '' : 'active'}`;
    toggleBtn.innerHTML = `<span class="toggle-slider"></span>`;
    toggleBtn.title = isDisabled ? 'Enable server' : 'Disable server';
    toggleBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering edit
        toggleServerStatus(name, isDisabled);
    };
    
    const serverName = document.createElement('h3');
    serverName.textContent = name;
    serverName.className = 'server-name';
    
    serverHeader.appendChild(toggleBtn);
    serverHeader.appendChild(serverName);
    
    const serverDetails = document.createElement('div');
    serverDetails.className = 'server-details';
    
    serverInfo.appendChild(serverHeader);
    serverInfo.appendChild(serverDetails);
    
    // Delete icon (separate click zone)
    const deleteIcon = document.createElement('button');
    deleteIcon.className = 'delete-icon';
    deleteIcon.innerHTML = '×';
    deleteIcon.title = `Delete ${name} server`;
    deleteIcon.setAttribute('aria-label', `Delete ${name} server`);
    deleteIcon.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering edit
        deleteServer(name, isDisabled);
    };
    
    // Add click-to-edit functionality
    const editableArea = document.createElement('div');
    editableArea.className = 'server-editable-area';
    editableArea.appendChild(serverInfo);
    
    editableArea.onclick = () => editServer(name, isDisabled);
    editableArea.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            editServer(name, isDisabled);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteServer(name, isDisabled);
        }
    };
    
    // Assemble the server item
    serverEl.appendChild(editableArea);
    serverEl.appendChild(deleteIcon);
    
    serversList.appendChild(serverEl);
}

// Toggle server enabled/disabled status
function toggleServerStatus(name, currentlyDisabled) {
    if (currentlyDisabled) {
        // Move from disabled to active
        currentConfig.mcpServers[name] = currentConfig.disabledMcpServers[name];
        delete currentConfig.disabledMcpServers[name];
    } else {
        // Move from active to disabled
        currentConfig.disabledMcpServers[name] = currentConfig.mcpServers[name];
        delete currentConfig.mcpServers[name];
    }
    markAsChanged();
    renderServers();
}

// Show server modal
function showServerModal(serverName = null, isDisabled = false) {
    modalTitle.textContent = serverName ? 'Edit Server' : 'Add MCP Server';
    serverModal.style.display = 'flex';
    
    // Reset to visual mode
    isRawMode = false;
    document.getElementById('visualModeContent').classList.remove('hidden');
    document.getElementById('rawModeContent').classList.add('hidden');
    document.getElementById('modalModeToggle').textContent = '{} Raw';
    document.getElementById('modalModeToggle').title = 'Switch to raw JSON editor';
    
    // Reset form state
    document.getElementById('parsedDisplay').classList.add('hidden');
    document.getElementById('commandError').classList.add('hidden');
    document.getElementById('rawModeError').classList.add('hidden');
    commandInput.classList.remove('error');
    
    const servers = isDisabled ? currentConfig.disabledMcpServers : currentConfig.mcpServers;
    
    if (serverName && servers[serverName]) {
        const server = servers[serverName];
        serverNameInput.value = serverName;
        serverCommandInput.value = server.command || '';
        serverArgsInput.value = server.args ? server.args.join('\n') : '';
        
        // Reconstruct command for the parser input
        const fullCommand = server.command + (server.args ? ' ' + server.args.join(' ') : '');
        commandInput.value = fullCommand;
        parseCommand(fullCommand);
        
        envVarsList.innerHTML = '';
        if (server.env) {
            for (const [key, value] of Object.entries(server.env)) {
                addEnvVarRow(key, value);
            }
        }
    } else {
        serverNameInput.value = '';
        serverCommandInput.value = '';
        serverArgsInput.value = '';
        commandInput.value = '';
        envVarsList.innerHTML = '';
    }
}

// Hide server modal
function hideServerModal() {
    serverModal.style.display = 'none';
    editingServerName = null;
    editingDisabledServer = false;
}

// Add environment variable row
function addEnvVarRow(key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'env-var-row';
    
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'Variable name';
    keyInput.value = key;
    keyInput.className = 'env-var-key';
    
    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'env-var-value-wrapper';
    
    const valueInput = document.createElement('input');
    valueInput.type = 'password';
    valueInput.placeholder = 'Value';
    valueInput.value = value;
    valueInput.className = 'env-var-value';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-small btn-icon';
    toggleBtn.innerHTML = '👁';
    toggleBtn.title = 'Show/hide value';
    toggleBtn.onclick = () => {
        if (valueInput.type === 'password') {
            valueInput.type = 'text';
            toggleBtn.innerHTML = '🙈';
        } else {
            valueInput.type = 'password';
            toggleBtn.innerHTML = '👁';
        }
    };
    
    valueWrapper.appendChild(valueInput);
    valueWrapper.appendChild(toggleBtn);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-small btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => row.remove();
    
    row.appendChild(keyInput);
    row.appendChild(valueWrapper);
    row.appendChild(removeBtn);
    
    envVarsList.appendChild(row);
}

// Save server
function saveServer() {
    const name = serverNameInput.value.trim();
    
    if (!name) {
        alert('Server name is required!');
        return;
    }
    
    let server;
    
    if (isRawMode) {
        // Get config from raw editor
        const rawTextarea = document.getElementById('rawEditorTextarea');
        const rawError = document.getElementById('rawModeError');
        
        try {
            server = JSON.parse(rawTextarea.value);
            
            // Validate required fields
            if (!server.command) {
                throw new Error('Command field is required');
            }
            
            // Validate types
            if (server.args && !Array.isArray(server.args)) {
                throw new Error('Args must be an array');
            }
            
            if (server.env && typeof server.env !== 'object') {
                throw new Error('Environment variables must be an object');
            }
        } catch (error) {
            rawError.textContent = `Error: ${error.message}`;
            rawError.classList.remove('hidden');
            return;
        }
    } else {
        // Parse from command input
        const commandInputValue = commandInput.value.trim();
        if (!commandInputValue) {
            alert('Command is required!');
            return;
        }
        
        let command = '';
        let argsText = '';
        
        try {
            const parsed = parseCommandLine(commandInputValue);
            if (!parsed.command) {
                alert('Invalid command format!');
                return;
            }
            command = parsed.command;
            argsText = parsed.args.join('\n');
        } catch (error) {
            alert(`Command parsing error: ${error.message}`);
            return;
        }
        
        if (!command) {
            alert('Command is required!');
            return;
        }
        
        server = { command };
        
        // Parse arguments
        if (argsText) {
            server.args = argsText.split('\n').map(arg => arg.trim()).filter(arg => arg);
        }
        
        // Parse environment variables
        const envVarRows = envVarsList.querySelectorAll('.env-var-row');
        if (envVarRows.length > 0) {
            server.env = {};
            envVarRows.forEach(row => {
                const key = row.querySelector('.env-var-key').value.trim();
                const value = row.querySelector('.env-var-value').value.trim();
                if (key) {
                    server.env[key] = value;
                }
            });
            if (Object.keys(server.env).length === 0) {
                delete server.env;
            }
        }
    }
    
    // If editing and name changed, delete old entry
    if (editingServerName && editingServerName !== name) {
        if (editingDisabledServer) {
            delete currentConfig.disabledMcpServers[editingServerName];
        } else {
            delete currentConfig.mcpServers[editingServerName];
        }
    }
    
    // Save to appropriate section (maintain current enabled/disabled state)
    if (editingDisabledServer) {
        currentConfig.disabledMcpServers[name] = server;
    } else {
        currentConfig.mcpServers[name] = server;
    }
    
    const isEditing = editingServerName !== null;
    
    markAsChanged();
    renderServers();
    hideServerModal();
    
    // Show success toast for manual entry
    const action = isEditing ? 'updated' : 'added';
    showToast('success', `Server '${name}' ${action} successfully`);
    
    if (!isEditing) {
        highlightNewServer(name);
    }
    
    // Check dependencies after saving
    setTimeout(async () => {
        await checkSystemDependencies();
    }, 100);
}

// Edit server
function editServer(name, isDisabled) {
    editingServerName = name;
    editingDisabledServer = isDisabled;
    showServerModal(name, isDisabled);
}

// Delete server with enhanced confirmation
function deleteServer(name, isDisabled) {
    const confirmed = confirm(
        `Delete '${name}'?\n\n` +
        `This action cannot be undone.`
    );
    
    if (confirmed) {
        if (isDisabled) {
            delete currentConfig.disabledMcpServers[name];
        } else {
            delete currentConfig.mcpServers[name];
        }
        markAsChanged();
        renderServers();
        
        // Show success toast
        showToast('success', `Server '${name}' deleted successfully`);
    }
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === serverModal) {
        hideServerModal();
    }
    if (event.target === document.getElementById('backupsModal')) {
        hideBackupsModal();
    }
    if (event.target === document.getElementById('rawEditorModal')) {
        hideRawEditor();
    }
});


// Status indicator functions
async function updateStatus(type = 'normal', message = '') {
    const indicator = document.getElementById('statusIndicator');
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
        await checkSystemDependencies();
    }, 1000);
}

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

// Backup functions
async function showBackupsModal() {
    const modal = document.getElementById('backupsModal');
    modal.style.display = 'flex';
    
    const backupsList = document.getElementById('backupsList');
    backupsList.innerHTML = '<p>Loading backups...</p>';
    
    if (!currentConfigPath) {
        backupsList.innerHTML = '<p>No config file loaded</p>';
        return;
    }
    
    const result = await window.api.getBackups(currentConfigPath);
    
    if (!result.success || result.backups.length === 0) {
        backupsList.innerHTML = '<p>No backups found</p>';
        return;
    }
    
    backupsList.innerHTML = '';
    result.backups.forEach(backup => {
        const backupItem = document.createElement('div');
        backupItem.className = 'backup-item';
        
        const date = new Date(backup.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        backupItem.innerHTML = `
            <div class="backup-info">
                <strong>${dateStr}</strong>
                <small>${backup.filename}</small>
            </div>
            <button class="btn btn-small" onclick="restoreBackup('${backup.path}')">Restore</button>
        `;
        
        backupsList.appendChild(backupItem);
    });
}

function hideBackupsModal() {
    document.getElementById('backupsModal').style.display = 'none';
}

async function restoreBackup(backupPath) {
    if (!confirm('Are you sure you want to restore this backup? Current changes will be lost.')) {
        return;
    }
    
    const result = await window.api.restoreBackup(backupPath, currentConfigPath);
    if (result.success) {
        hideBackupsModal();
        await loadConfig(currentConfigPath);
        alert('Backup restored successfully!');
    } else {
        alert(`Error restoring backup: ${result.error}`);
    }
}

// Make restore function available globally
window.restoreBackup = restoreBackup;
window.hideBackupsModal = hideBackupsModal;

// Raw editor functionality
let rawEditorServerName = null;
let rawEditorIsDisabled = false;

function showRawEditor(serverName, isDisabled) {
    rawEditorServerName = serverName;
    rawEditorIsDisabled = isDisabled;
    
    const modal = document.getElementById('rawEditorModal');
    const nameSpan = document.getElementById('rawEditorServerName');
    const textarea = document.getElementById('rawEditorContent');
    const errorDiv = document.getElementById('rawEditorError');
    
    nameSpan.textContent = serverName;
    errorDiv.classList.add('hidden');
    
    // Get current server config
    const servers = isDisabled ? currentConfig.disabledMcpServers : currentConfig.mcpServers;
    const serverConfig = servers[serverName] || {};
    
    // Pretty print the JSON
    textarea.value = JSON.stringify(serverConfig, null, 2);
    modal.style.display = 'flex';
    
    // Focus and select all text
    setTimeout(() => {
        textarea.focus();
        textarea.select();
    }, 100);
}

function showRawEditorWithConfig(serverName, isDisabled, config) {
    rawEditorServerName = serverName;
    rawEditorIsDisabled = isDisabled;
    
    const modal = document.getElementById('rawEditorModal');
    const nameSpan = document.getElementById('rawEditorServerName');
    const textarea = document.getElementById('rawEditorContent');
    const errorDiv = document.getElementById('rawEditorError');
    
    nameSpan.textContent = serverName;
    errorDiv.classList.add('hidden');
    
    // Pretty print the provided config
    textarea.value = JSON.stringify(config, null, 2);
    modal.style.display = 'flex';
    
    // Focus and select all text
    setTimeout(() => {
        textarea.focus();
        textarea.select();
    }, 100);
}

function hideRawEditor() {
    document.getElementById('rawEditorModal').style.display = 'none';
    rawEditorServerName = null;
}

function saveRawEditor() {
    const textarea = document.getElementById('rawEditorContent');
    const errorDiv = document.getElementById('rawEditorError');
    
    try {
        // Parse the JSON
        const newConfig = JSON.parse(textarea.value);
        
        // Validate required fields
        if (!newConfig.command) {
            throw new Error('Command field is required');
        }
        
        // Ensure args is an array if present
        if (newConfig.args && !Array.isArray(newConfig.args)) {
            throw new Error('Args must be an array');
        }
        
        // Ensure env is an object if present
        if (newConfig.env && typeof newConfig.env !== 'object') {
            throw new Error('Environment variables must be an object');
        }
        
        // Update the config
        if (rawEditorIsDisabled) {
            currentConfig.disabledMcpServers[rawEditorServerName] = newConfig;
        } else {
            currentConfig.mcpServers[rawEditorServerName] = newConfig;
        }
        
        // Mark as changed and re-render
        markAsChanged();
        renderServers();
        hideRawEditor();
        
    } catch (error) {
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.classList.remove('hidden');
    }
}

// Switch from raw editor back to visual mode
function switchToVisualMode() {
    const textarea = document.getElementById('rawEditorContent');
    const errorDiv = document.getElementById('rawEditorError');
    
    try {
        // Parse the JSON to ensure it's valid
        const config = JSON.parse(textarea.value);
        
        // Validate required fields
        if (!config.command) {
            throw new Error('Command field is required');
        }
        
        // Close raw editor and open visual editor with the parsed config
        hideRawEditor();
        
        // Preserve the editing state
        editingServerName = rawEditorServerName;
        editingDisabledServer = rawEditorIsDisabled;
        
        // Show the server modal with the parsed data
        showServerModal(rawEditorServerName, rawEditorIsDisabled);
        
        // Wait for modal to be fully shown before populating
        setTimeout(() => {
            // Ensure server name is set
            serverNameInput.value = rawEditorServerName;
            
            // Populate the form with the JSON data
            if (config.command) {
                let fullCommand = config.command;
                if (config.args && config.args.length > 0) {
                    // Properly quote arguments that contain spaces
                    const quotedArgs = config.args.map(arg => {
                        if (arg.includes(' ')) {
                            return `"${arg}"`;
                        }
                        return arg;
                    });
                    fullCommand += ' ' + quotedArgs.join(' ');
                }
                commandInput.value = fullCommand;
                parseCommand(fullCommand);
            }
            
            // Clear and repopulate environment variables
            envVarsList.innerHTML = '';
            if (config.env) {
                for (const [key, value] of Object.entries(config.env)) {
                    addEnvVarRow(key, value);
                }
            }
        }, 50);
        
    } catch (error) {
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.classList.remove('hidden');
    }
}

// Toggle between visual and raw edit modes
function toggleEditMode() {
    const visualContent = document.getElementById('visualModeContent');
    const rawContent = document.getElementById('rawModeContent');
    const rawTextarea = document.getElementById('rawEditorTextarea');
    const toggleBtn = document.getElementById('modalModeToggle');
    const rawError = document.getElementById('rawModeError');
    
    isRawMode = !isRawMode;
    
    if (isRawMode) {
        // Switch to raw mode
        visualContent.classList.add('hidden');
        rawContent.classList.remove('hidden');
        toggleBtn.textContent = '👁 Visual';
        toggleBtn.title = 'Switch to visual editor';
        
        // Get current form data and convert to JSON
        const config = getConfigFromForm();
        rawTextarea.value = JSON.stringify(config, null, 2);
        rawError.classList.add('hidden');
        
        // Focus the textarea
        setTimeout(() => {
            rawTextarea.focus();
            rawTextarea.select();
        }, 50);
    } else {
        // Switch to visual mode
        try {
            // Parse and validate the JSON
            const config = JSON.parse(rawTextarea.value);
            
            if (!config.command) {
                throw new Error('Command field is required');
            }
            
            // Update form with parsed data
            updateFormFromConfig(config);
            
            // Show visual content
            visualContent.classList.remove('hidden');
            rawContent.classList.add('hidden');
            toggleBtn.textContent = '{} Raw';
            toggleBtn.title = 'Switch to raw JSON editor';
            rawError.classList.add('hidden');
        } catch (error) {
            // Show error and prevent switching
            rawError.textContent = `Error: ${error.message}`;
            rawError.classList.remove('hidden');
            isRawMode = true; // Stay in raw mode
        }
    }
}

// Get configuration from form fields
function getConfigFromForm() {
    const config = { command: serverCommandInput.value || '' };
    
    // Add arguments if present
    const argsText = serverArgsInput.value.trim();
    if (argsText) {
        config.args = argsText.split('\n').map(arg => arg.trim()).filter(arg => arg);
    }
    
    // Add environment variables if present
    const envVarRows = envVarsList.querySelectorAll('.env-var-row');
    if (envVarRows.length > 0) {
        const env = {};
        envVarRows.forEach(row => {
            const key = row.querySelector('.env-var-key').value.trim();
            const value = row.querySelector('.env-var-value').value.trim();
            if (key) {
                env[key] = value;
            }
        });
        if (Object.keys(env).length > 0) {
            config.env = env;
        }
    }
    
    return config;
}

// Update form fields from config object
function updateFormFromConfig(config) {
    // Update command input
    let fullCommand = config.command || '';
    if (config.args && config.args.length > 0) {
        const quotedArgs = config.args.map(arg => {
            if (arg.includes(' ') || arg.includes('"')) {
                return `"${arg.replace(/"/g, '\\"')}"`;
            }
            return arg;
        });
        fullCommand += ' ' + quotedArgs.join(' ');
    }
    commandInput.value = fullCommand;
    parseCommand(fullCommand);
    
    // Update environment variables
    envVarsList.innerHTML = '';
    if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
            addEnvVarRow(key, value);
        }
    }
}

// Make raw editor functions available globally
window.showRawEditor = showRawEditor;
window.hideRawEditor = hideRawEditor;
window.saveRawEditor = saveRawEditor;
window.switchToVisualMode = switchToVisualMode;

// Command parsing functions
function parseCommand(input) {
    const parsedDisplay = document.getElementById('parsedDisplay');
    const parsedCommand = document.getElementById('parsedCommand');
    const parsedArgs = document.getElementById('parsedArgs');
    const commandError = document.getElementById('commandError');
    
    // Clear previous error
    commandError.classList.add('hidden');
    commandInput.classList.remove('error');
    
    if (!input.trim()) {
        parsedDisplay.classList.add('hidden');
        return;
    }
    
    try {
        const parsed = parseCommandLine(input);
        
        if (!parsed.command) {
            throw new Error('No command specified');
        }
        
        // Display parsed result
        parsedCommand.textContent = parsed.command;
        parsedArgs.textContent = parsed.args.length > 0 ? parsed.args.join(', ') : '(none)';
        parsedDisplay.classList.remove('hidden');
        
        // Update hidden fields
        serverCommandInput.value = parsed.command;
        serverArgsInput.value = parsed.args.join('\n');
        
        // Check dependency for the command
        if (input.trim()) {
            const firstWord = input.trim().split(' ')[0];
            showDependencyWarning(firstWord);
        }
    } catch (error) {
        commandError.textContent = error.message;
        commandError.classList.remove('hidden');
        commandInput.classList.add('error');
        parsedDisplay.classList.add('hidden');
    }
}

function parseCommandLine(input) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;
    
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
            continue;
        }
        
        if (char === quoteChar && inQuotes) {
            inQuotes = false;
            quoteChar = '';
            continue;
        }
        
        if (char === ' ' && !inQuotes) {
            if (current) {
                args.push(current);
                current = '';
            }
            continue;
        }
        
        current += char;
    }
    
    if (inQuotes) {
        throw new Error(`Unclosed quote: ${quoteChar}`);
    }
    
    if (current) {
        args.push(current);
    }
    
    return {
        command: args[0] || '',
        args: args.slice(1)
    };
}


// Auto-save status indicator
function updateAutoSaveStatus(status, errorMessage = '') {
    const statusElement = document.getElementById('autoSaveStatus');
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

// File switcher functions
function toggleFileSwitcher() {
    const dropdown = document.getElementById('fileSwitcherDropdown');
    dropdown.classList.toggle('hidden');
    
    if (!dropdown.classList.contains('hidden')) {
        loadRecentFiles();
    }
}

function hideFileSwitcher() {
    document.getElementById('fileSwitcherDropdown').classList.add('hidden');
}

async function loadRecentFiles() {
    const recentList = document.getElementById('recentFilesList');
    const preferences = await window.api.getPreferences();
    
    // For now, just show current file
    // In future, could track multiple recent files
    recentList.innerHTML = '';
    
    if (currentConfigPath) {
        const recentItem = document.createElement('div');
        recentItem.className = 'recent-file-item current';
        recentItem.innerHTML = `
            <span class="recent-file-path">${currentConfigPath}</span>
            <span class="recent-file-label">Current</span>
        `;
        recentList.appendChild(recentItem);
    }
}

// Import JSON functionality
let importState = {
    parsedServers: [],
    duplicates: [],
    needsServerName: false
};

// Import modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Import modal events
    document.getElementById('pasteFromClipboardBtn').addEventListener('click', pasteFromClipboard);
    document.getElementById('parseJsonBtn').addEventListener('click', parseImportJson);
    document.getElementById('cancelImportBtn').addEventListener('click', hideImportModal);
    document.getElementById('cancelImportBtn2').addEventListener('click', hideImportModal);
    document.getElementById('backToEditBtn').addEventListener('click', backToEditStep);
    document.getElementById('confirmImportBtn').addEventListener('click', confirmImport);
    document.getElementById('closeImportBtn').addEventListener('click', hideImportModal);
    
    // Close import modal when clicking outside
    document.addEventListener('click', (event) => {
        if (event.target === document.getElementById('importJsonModal')) {
            hideImportModal();
        }
    });
});

function showImportModal() {
    const modal = document.getElementById('importJsonModal');
    modal.style.display = 'flex';
    
    // Reset to first step
    showImportStep(1);
    
    // Clear input
    document.getElementById('jsonInput').value = '';
    document.getElementById('jsonError').classList.add('hidden');
    
    // Reset state
    importState = {
        parsedServers: [],
        duplicates: [],
        needsServerName: false
    };
}

function hideImportModal() {
    document.getElementById('importJsonModal').style.display = 'none';
}

function showImportStep(step) {
    // Hide all steps
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`importStep${i}`).classList.add('hidden');
    }
    
    // Show target step
    document.getElementById(`importStep${step}`).classList.remove('hidden');
}

function backToEditStep() {
    showImportStep(1);
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('jsonInput').value = text;
    } catch (error) {
        console.warn('Could not read from clipboard:', error);
        // Fallback - just focus the textarea
        document.getElementById('jsonInput').focus();
    }
}

function parseImportJson() {
    const jsonInput = document.getElementById('jsonInput');
    const jsonError = document.getElementById('jsonError');
    
    let inputText = jsonInput.value.trim();
    
    if (!inputText) {
        showJsonError('Please paste some JSON configuration.');
        return;
    }
    
    // Clear previous errors
    jsonError.classList.add('hidden');
    
    try {
        // Smart detection and cleanup
        inputText = smartJsonCleanup(inputText);
        
        // Parse JSON
        const parsedJson = JSON.parse(inputText);
        
        // Detect format and extract servers
        const detectionResult = detectJsonFormat(parsedJson);
        
        if (!detectionResult.success) {
            showJsonError(detectionResult.error);
            return;
        }
        
        importState.parsedServers = detectionResult.servers;
        importState.needsServerName = detectionResult.needsServerName;
        
        // Check for duplicates
        checkForDuplicates();
        
        // Show preview
        showImportPreview();
        showImportStep(2);
        
    } catch (error) {
        showJsonError(`Invalid JSON: ${error.message}`);
    }
}

function smartJsonCleanup(text) {
    // Remove common copy-paste artifacts
    text = text.trim();
    
    // Remove JavaScript variable declarations
    text = text.replace(/^(const|let|var)\s+\w+\s*=\s*/, '');
    text = text.replace(/;?\s*$/, '');
    
    // Handle trailing commas (simple approach)
    text = text.replace(/,(\s*[}\]])/g, '$1');
    
    return text;
}

function detectJsonFormat(json) {
    // Format 1: Full config with mcpServers wrapper
    if (json.mcpServers && typeof json.mcpServers === 'object') {
        const servers = [];
        for (const [name, config] of Object.entries(json.mcpServers)) {
            if (!config.command) {
                return { success: false, error: `Server "${name}" is missing required "command" field.` };
            }
            servers.push({ name, config });
        }
        return { success: true, servers, needsServerName: false };
    }
    
    // Format 2: Single server format (object with one key that contains a server config)
    if (typeof json === 'object' && !Array.isArray(json)) {
        const keys = Object.keys(json);
        
        // Check if this looks like a server definition (has command)
        if (json.command) {
            // Format 3: Server definition only
            return { success: true, servers: [{ name: null, config: json }], needsServerName: true };
        }
        
        // Check if this looks like Format 2 (single server with name)
        if (keys.length === 1) {
            const serverName = keys[0];
            const serverConfig = json[serverName];
            
            if (serverConfig && typeof serverConfig === 'object' && serverConfig.command) {
                return { success: true, servers: [{ name: serverName, config: serverConfig }], needsServerName: false };
            }
        }
        
        // Check if this looks like multiple servers without mcpServers wrapper
        let allHaveCommand = true;
        const servers = [];
        
        for (const [name, config] of Object.entries(json)) {
            if (!config || typeof config !== 'object' || !config.command) {
                allHaveCommand = false;
                break;
            }
            servers.push({ name, config });
        }
        
        if (allHaveCommand && servers.length > 0) {
            return { success: true, servers, needsServerName: false };
        }
    }
    
    // Format 4: Array of servers
    if (Array.isArray(json)) {
        const servers = [];
        for (let i = 0; i < json.length; i++) {
            const item = json[i];
            if (!item.command) {
                return { success: false, error: `Server at index ${i} is missing required "command" field.` };
            }
            servers.push({ name: null, config: item });
        }
        return { success: true, servers, needsServerName: servers.length > 0 };
    }
    
    return { success: false, error: 'Unrecognized JSON format. Expected MCP server configuration.' };
}

function checkForDuplicates() {
    const existingServers = { ...currentConfig.mcpServers, ...currentConfig.disabledMcpServers };
    importState.duplicates = [];
    
    for (const server of importState.parsedServers) {
        if (server.name && existingServers[server.name]) {
            importState.duplicates.push(server.name);
        }
    }
}

function showImportPreview() {
    const previewDiv = document.getElementById('importPreview');
    const serverNamePrompt = document.getElementById('serverNamePrompt');
    const duplicateHandling = document.getElementById('duplicateHandling');
    
    // Clear preview
    previewDiv.innerHTML = '';
    
    // Show server name prompt if needed
    if (importState.needsServerName) {
        serverNamePrompt.classList.remove('hidden');
        
        // Pre-fill with a suggested name if there's only one server
        if (importState.parsedServers.length === 1) {
            const command = importState.parsedServers[0].config.command;
            const suggestedName = command.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            document.getElementById('newServerName').value = suggestedName;
        }
    } else {
        serverNamePrompt.classList.add('hidden');
    }
    
    // Show duplicate handling if needed
    if (importState.duplicates.length > 0) {
        duplicateHandling.classList.remove('hidden');
        showDuplicateOptions();
    } else {
        duplicateHandling.classList.add('hidden');
    }
    
    // Show preview of servers
    for (let i = 0; i < importState.parsedServers.length; i++) {
        const server = importState.parsedServers[i];
        const serverDiv = createServerPreview(server, i);
        previewDiv.appendChild(serverDiv);
    }
}

function createServerPreview(server, index) {
    const div = document.createElement('div');
    div.className = 'import-preview-item';
    
    const name = server.name || `Server ${index + 1}`;
    
    div.innerHTML = `
        <h4>${name}</h4>
        <div class="import-preview-detail">
            <span class="import-preview-label">Command:</span>
            <span class="import-preview-value">${server.config.command}</span>
        </div>
        ${server.config.args ? `
        <div class="import-preview-detail">
            <span class="import-preview-label">Arguments:</span>
            <span class="import-preview-value">${server.config.args.join(', ')}</span>
        </div>
        ` : ''}
        ${server.config.env ? `
        <div class="import-preview-detail">
            <span class="import-preview-label">Environment:</span>
            <span class="import-preview-value">${Object.keys(server.config.env).length} variable(s)</span>
        </div>
        ` : ''}
    `;
    
    return div;
}

function showDuplicateOptions() {
    const duplicatesList = document.getElementById('duplicatesList');
    duplicatesList.innerHTML = '';
    
    for (const duplicateName of importState.duplicates) {
        const duplicateDiv = document.createElement('div');
        duplicateDiv.className = 'duplicate-item';
        
        duplicateDiv.innerHTML = `
            <div class="duplicate-item-header">Server: ${duplicateName}</div>
            <div class="duplicate-options">
                <div class="duplicate-option">
                    <input type="radio" name="duplicate_${duplicateName}" value="replace" id="replace_${duplicateName}">
                    <label for="replace_${duplicateName}">Replace existing</label>
                </div>
                <div class="duplicate-option">
                    <input type="radio" name="duplicate_${duplicateName}" value="skip" id="skip_${duplicateName}" checked>
                    <label for="skip_${duplicateName}">Skip duplicate</label>
                </div>
                <div class="duplicate-option">
                    <input type="radio" name="duplicate_${duplicateName}" value="rename" id="rename_${duplicateName}">
                    <label for="rename_${duplicateName}">Rename to ${duplicateName}_2</label>
                </div>
            </div>
        `;
        
        duplicatesList.appendChild(duplicateDiv);
    }
}

function confirmImport() {
    const newServerNameInput = document.getElementById('newServerName');
    
    // Validate server name if needed
    if (importState.needsServerName) {
        const serverName = newServerNameInput.value.trim();
        if (!serverName) {
            alert('Please enter a server name.');
            newServerNameInput.focus();
            return;
        }
        
        // Apply name to all servers that need it
        for (const server of importState.parsedServers) {
            if (!server.name) {
                server.name = serverName;
            }
        }
    }
    
    // Process duplicates
    const duplicateActions = {};
    for (const duplicateName of importState.duplicates) {
        const selectedOption = document.querySelector(`input[name="duplicate_${duplicateName}"]:checked`);
        duplicateActions[duplicateName] = selectedOption ? selectedOption.value : 'skip';
    }
    
    // Import servers
    let importedCount = 0;
    let skippedCount = 0;
    let replacedCount = 0;
    
    for (const server of importState.parsedServers) {
        let finalName = server.name;
        
        if (importState.duplicates.includes(server.name)) {
            const action = duplicateActions[server.name];
            
            if (action === 'skip') {
                skippedCount++;
                continue;
            } else if (action === 'rename') {
                finalName = generateUniqueName(server.name);
            } else if (action === 'replace') {
                replacedCount++;
            }
        }
        
        // Add to config
        currentConfig.mcpServers[finalName] = server.config;
        importedCount++;
    }
    
    // Mark as changed and refresh
    markAsChanged();
    renderServers();
    
    // Show success step
    showImportSuccess(importedCount, skippedCount, replacedCount);
    showImportStep(3);
}

function generateUniqueName(baseName) {
    let counter = 2;
    let candidateName = `${baseName}_${counter}`;
    
    while (currentConfig.mcpServers[candidateName] || currentConfig.disabledMcpServers[candidateName]) {
        counter++;
        candidateName = `${baseName}_${counter}`;
    }
    
    return candidateName;
}

function showImportSuccess(imported, skipped, replaced) {
    const summaryDiv = document.getElementById('importSummary');
    summaryDiv.innerHTML = '';
    
    if (imported > 0) {
        const importedItem = document.createElement('div');
        importedItem.className = 'import-summary-item';
        importedItem.textContent = `✅ ${imported} server(s) imported successfully`;
        summaryDiv.appendChild(importedItem);
    }
    
    if (replaced > 0) {
        const replacedItem = document.createElement('div');
        replacedItem.className = 'import-summary-item';
        replacedItem.textContent = `🔄 ${replaced} server(s) replaced`;
        summaryDiv.appendChild(replacedItem);
    }
    
    if (skipped > 0) {
        const skippedItem = document.createElement('div');
        skippedItem.className = 'import-summary-item';
        skippedItem.textContent = `⏭️ ${skipped} server(s) skipped (duplicates)`;
        summaryDiv.appendChild(skippedItem);
    }
}

function showJsonError(message) {
    const jsonError = document.getElementById('jsonError');
    jsonError.textContent = message;
    jsonError.classList.remove('hidden');
}

// Make import functions available globally
window.hideImportModal = hideImportModal;

// System Dependencies Status functionality
let systemStatus = {
    dependencies: {},
    overallStatus: 'unknown'
};

// Initialize system status check
document.addEventListener('DOMContentLoaded', async () => {
    // Initial dependency check
    await checkSystemDependencies();
    
    // Add refresh button event listener
    document.getElementById('refreshDependenciesBtn').addEventListener('click', async () => {
        await checkSystemDependencies();
        updateSystemStatusModal();
    });
    
    // Close system status modal when clicking outside
    document.addEventListener('click', (event) => {
        if (event.target === document.getElementById('systemStatusModal')) {
            hideSystemStatusModal();
        }
    });
});

async function checkSystemDependencies() {
    try {
        const result = await window.api.checkDependencies(currentConfig);
        if (result.success) {
            systemStatus.dependencies = result.results;
            systemStatus.overallStatus = result.overallStatus;
            systemStatus.summary = result.summary;
            updateSystemStatusIndicator();
        }
    } catch (error) {
        console.error('Failed to check dependencies:', error);
        systemStatus.overallStatus = 'unknown';
        updateSystemStatusIndicator();
    }
}

function updateSystemStatusIndicator() {
    const statusBtn = document.getElementById('systemStatusBtn');
    const statusIcon = document.getElementById('systemStatusIcon');
    
    // Remove existing status classes
    statusBtn.classList.remove('status-ok', 'status-warning', 'status-error');
    
    switch (systemStatus.overallStatus) {
        case 'ok':
            statusBtn.classList.add('status-ok');
            statusIcon.textContent = '✅';
            statusBtn.title = 'All required dependencies available';
            break;
        case 'warning':
            statusBtn.classList.add('status-warning');
            statusIcon.textContent = '⚠️';
            statusBtn.title = 'Some optional dependencies missing';
            break;
        case 'error':
            statusBtn.classList.add('status-error');
            statusIcon.textContent = '❌';
            statusBtn.title = 'Missing required dependencies';
            break;
        default:
            statusIcon.textContent = '🔄';
            statusBtn.title = 'Checking system dependencies...';
    }
}

function showSystemStatusModal() {
    const modal = document.getElementById('systemStatusModal');
    modal.style.display = 'flex';
    updateSystemStatusModal();
}

function hideSystemStatusModal() {
    document.getElementById('systemStatusModal').style.display = 'none';
}

function updateSystemStatusModal() {
    updateSystemStatusSummary();
    updateDependenciesList();
    updateServerReadinessList();
}

function updateSystemStatusSummary() {
    const summaryDiv = document.getElementById('systemStatusSummary');
    const statusOverview = document.querySelector('.system-status-overview');
    
    // Remove existing status classes
    statusOverview.classList.remove('status-ok', 'status-warning', 'status-error');
    
    let summaryIcon = '🔄';
    let summaryText = 'Checking system dependencies...';
    
    if (systemStatus.summary) {
        const { available, total, required, requiredMissing } = systemStatus.summary;
        
        switch (systemStatus.overallStatus) {
            case 'ok':
                statusOverview.classList.add('status-ok');
                summaryIcon = '✅';
                summaryText = `All dependencies ready! ${available}/${total} tools available, ${required} required.`;
                break;
            case 'warning':
                statusOverview.classList.add('status-warning');
                summaryIcon = '⚠️';
                summaryText = `${available}/${total} tools available. ${total - available} optional dependencies missing.`;
                break;
            case 'error':
                statusOverview.classList.add('status-error');
                summaryIcon = '❌';
                summaryText = `${requiredMissing} required dependencies missing! ${available}/${total} tools available.`;
                break;
        }
    }
    
    summaryDiv.innerHTML = `
        <div class="status-summary-icon">${summaryIcon}</div>
        <div class="status-summary-text">${summaryText}</div>
    `;
}

function updateDependenciesList() {
    const dependenciesList = document.getElementById('dependenciesList');
    dependenciesList.innerHTML = '';
    
    for (const [depName, depInfo] of Object.entries(systemStatus.dependencies)) {
        const depDiv = createDependencyItem(depName, depInfo);
        dependenciesList.appendChild(depDiv);
    }
}

function createDependencyItem(depName, depInfo) {
    const div = document.createElement('div');
    let statusClass = 'status-not-required';
    let statusIcon = '⚪';
    
    if (depInfo.available) {
        statusClass = 'status-ok';
        statusIcon = '✅';
    } else if (depInfo.required) {
        statusClass = 'status-error';
        statusIcon = '❌';
    }
    
    div.className = `dependency-item ${statusClass}`;
    
    const requiredByText = depInfo.requiredBy && depInfo.requiredBy.length > 0 
        ? `Required by: ${depInfo.requiredBy.join(', ')}`
        : '';
    
    const versionText = depInfo.version ? `Version: ${depInfo.version}` : '';
    
    div.innerHTML = `
        <div class="dependency-status-icon">${statusIcon}</div>
        <div class="dependency-info">
            <div class="dependency-name">${depInfo.name || depName}</div>
            <div class="dependency-description">${depInfo.description}</div>
            ${versionText ? `<div class="dependency-version">${versionText}</div>` : ''}
            ${requiredByText ? `<div class="dependency-required-by">${requiredByText}</div>` : ''}
        </div>
        <div class="dependency-actions">
            ${!depInfo.available ? `<button class="btn btn-small" onclick="showSetupInstructions('${depName}')">Setup</button>` : ''}
            <button class="btn btn-small" onclick="recheckDependency('${depName}')">Check</button>
        </div>
    `;
    
    return div;
}

function updateServerReadinessList() {
    const serverReadinessList = document.getElementById('serverReadinessList');
    serverReadinessList.innerHTML = '';
    
    // Check active servers
    if (currentConfig.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(currentConfig.mcpServers)) {
            const readinessItem = createServerReadinessItem(serverName, serverConfig, false);
            serverReadinessList.appendChild(readinessItem);
        }
    }
    
    // Check disabled servers
    if (currentConfig.disabledMcpServers) {
        for (const [serverName, serverConfig] of Object.entries(currentConfig.disabledMcpServers)) {
            const readinessItem = createServerReadinessItem(serverName, serverConfig, true);
            serverReadinessList.appendChild(readinessItem);
        }
    }
    
    if (serverReadinessList.children.length === 0) {
        serverReadinessList.innerHTML = '<p style="color: #666; font-style: italic;">No servers configured</p>';
    }
}

function createServerReadinessItem(serverName, serverConfig, isDisabled) {
    const div = document.createElement('div');
    
    // Check if the command dependency is available
    const command = serverConfig.command?.toLowerCase();
    let isReady = true;
    let missingDep = null;
    
    if (command) {
        for (const [depName, depInfo] of Object.entries(systemStatus.dependencies)) {
            if (command === depName || command.includes(depName)) {
                if (!depInfo.available) {
                    isReady = false;
                    missingDep = depName;
                }
                break;
            }
        }
    }
    
    const readyClass = isReady ? 'ready' : 'not-ready';
    const statusIcon = isReady ? '✅' : '❌';
    const statusText = isReady ? 'Ready to run' : `Missing: ${missingDep}`;
    const statusColor = isReady ? 'server-readiness-ready' : 'server-readiness-missing';
    
    div.className = `server-readiness-item ${readyClass}`;
    
    div.innerHTML = `
        <div class="server-readiness-info">
            <div class="server-readiness-name">${serverName}${isDisabled ? ' (disabled)' : ''}</div>
            <div class="server-readiness-command">${serverConfig.command}</div>
        </div>
        <div class="server-readiness-status">
            <div class="server-readiness-icon">${statusIcon}</div>
            <div class="server-readiness-text ${statusColor}">${statusText}</div>
            ${!isReady ? `<button class="btn btn-small" onclick="showSetupInstructions('${missingDep}')">Setup</button>` : ''}
        </div>
    `;
    
    return div;
}

async function showSetupInstructions(dependencyName) {
    try {
        const result = await window.api.getDependencyInstructions(dependencyName);
        if (result.success) {
            displaySetupInstructions(result.dependency, result.platform, result.instructions);
        } else {
            alert(`Could not get setup instructions: ${result.error}`);
        }
    } catch (error) {
        alert(`Error getting setup instructions: ${error.message}`);
    }
}

function displaySetupInstructions(dependency, platform, instructions) {
    const instructionsDiv = document.getElementById('setupInstructions');
    const instructionsContent = document.getElementById('instructionsContent');
    
    instructionsContent.innerHTML = '';
    
    const instructionSection = document.createElement('div');
    instructionSection.className = 'instruction-section';
    
    let platformName = platform;
    switch (platform) {
        case 'win32': platformName = 'Windows'; break;
        case 'darwin': platformName = 'macOS'; break;
        case 'linux': platformName = 'Linux'; break;
    }
    
    instructionSection.innerHTML = `
        <div class="instruction-title">
            Setup ${dependency.name} - ${dependency.description}
            <span class="instruction-os">${platformName}</span>
        </div>
    `;
    
    for (const method of instructions.installMethods) {
        const methodDiv = document.createElement('div');
        methodDiv.className = 'instruction-method';
        
        let content = `
            <div class="instruction-method-title">${method.name}</div>
            <div>${method.description}</div>
        `;
        
        if (method.command) {
            content += `<div class="instruction-command">${method.command}</div>`;
        }
        
        if (method.url) {
            content += `<div><a href="${method.url}" class="instruction-link" target="_blank">${method.url}</a></div>`;
        }
        
        if (method.estimatedTime) {
            content += `<div style="color: #666; font-size: 12px; margin-top: 5px;">Estimated time: ${method.estimatedTime}</div>`;
        }
        
        methodDiv.innerHTML = content;
        instructionSection.appendChild(methodDiv);
    }
    
    instructionsContent.appendChild(instructionSection);
    instructionsDiv.classList.remove('hidden');
    
    // Scroll to instructions
    instructionsDiv.scrollIntoView({ behavior: 'smooth' });
}

async function recheckDependency(dependencyName) {
    // Update the specific dependency
    await checkSystemDependencies();
    updateSystemStatusModal();
}



// Add smart warning for import process
const originalConfirmImport = confirmImport;
async function confirmImport() {
    // Check dependencies for servers being imported
    const missingDeps = [];
    
    for (const server of importState.parsedServers) {
        if (server.config && server.config.command) {
            const depCheck = await window.api.checkSingleDependency(server.config.command);
            if (depCheck.success && !depCheck.available && depCheck.dependency) {
                const depName = depCheck.dependency.name;
                if (!missingDeps.includes(depName)) {
                    missingDeps.push(depName);
                }
            }
        }
    }
    
    // Show warning if dependencies are missing
    if (missingDeps.length > 0) {
        const proceed = confirm(
            `⚠️ Warning: The following dependencies are not installed on your system:\n\n` +
            `${missingDeps.join(', ')}\n\n` +
            `You can still import these servers, but they won't be able to run until you install the required tools.\n\n` +
            `Do you want to continue with the import?`
        );
        
        if (!proceed) {
            return;
        }
    }
    
    // Proceed with original import
    const result = originalConfirmImport();
    
    // Check dependencies after import
    setTimeout(async () => {
        await checkSystemDependencies();
    }, 100);
    
    return result;
}

// Add dependency warning to server modal
function showDependencyWarning(command) {
    return window.api.checkSingleDependency(command).then(result => {
        const warningDiv = document.getElementById('dependencyWarning');
        
        if (warningDiv) {
            warningDiv.remove();
        }
        
        if (result.success && !result.available && result.dependency) {
            const warning = document.createElement('div');
            warning.id = 'dependencyWarning';
            warning.className = 'dependency-warning';
            
            warning.innerHTML = `
                <div class="dependency-warning-icon">⚠️</div>
                <div class="dependency-warning-text">
                    This server requires '${result.dependency.name}' which wasn't found on your system.
                </div>
                <a href="#" class="dependency-warning-action" onclick="showSetupInstructions('${result.dependency.name}'); return false;">
                    View Setup Instructions
                </a>
            `;
            
            const modalBody = document.querySelector('#serverModal .modal-body');
            modalBody.insertBefore(warning, modalBody.firstChild);
        }
    }).catch(error => {
        console.warn('Could not check dependency:', error);
    });
}

// Enhanced showServerModal to include dependency warning and focus management
function enhancedShowServerModal(serverName = null, isDisabled = false) {
    // Call the original showServerModal logic
    modalTitle.textContent = serverName ? 'Edit Server' : 'Add MCP Server';
    serverModal.style.display = 'flex';
    
    // Reset to visual mode
    isRawMode = false;
    document.getElementById('visualModeContent').classList.remove('hidden');
    document.getElementById('rawModeContent').classList.add('hidden');
    document.getElementById('modalModeToggle').textContent = '{} Raw';
    document.getElementById('modalModeToggle').title = 'Switch to raw JSON editor';
    
    // Reset form state
    document.getElementById('parsedDisplay').classList.add('hidden');
    document.getElementById('commandError').classList.add('hidden');
    document.getElementById('rawModeError').classList.add('hidden');
    commandInput.classList.remove('error');
    
    const servers = isDisabled ? currentConfig.disabledMcpServers : currentConfig.mcpServers;
    
    if (serverName && servers[serverName]) {
        const server = servers[serverName];
        serverNameInput.value = serverName;
        serverCommandInput.value = server.command || '';
        serverArgsInput.value = server.args ? server.args.join('\n') : '';
        
        // Reconstruct command for the parser input
        const fullCommand = server.command + (server.args ? ' ' + server.args.join(' ') : '');
        commandInput.value = fullCommand;
        parseCommand(fullCommand);
        
        envVarsList.innerHTML = '';
        if (server.env) {
            for (const [key, value] of Object.entries(server.env)) {
                addEnvVarRow(key, value);
            }
        }
        
        // Check for dependency warning when editing existing server
        if (server.command) {
            showDependencyWarning(server.command);
        }
    } else {
        serverNameInput.value = '';
        serverCommandInput.value = '';
        serverArgsInput.value = '';
        commandInput.value = '';
        envVarsList.innerHTML = '';
        
        // For manual entry, focus on server name field
        setTimeout(() => {
            const serverNameInput = document.getElementById('serverName');
            if (serverNameInput) {
                serverNameInput.focus();
            }
        }, 100);
    }
}

// Replace the original function
showServerModal = enhancedShowServerModal;


// Make system status functions available globally
window.hideSystemStatusModal = hideSystemStatusModal;
window.showSetupInstructions = showSetupInstructions;
window.recheckDependency = recheckDependency;

// Enhanced Add Server Flow functionality
let singleServerImportState = {
    parsedServer: null,
    needsServerName: false,
    isValid: false
};

// Add Server dropdown functions
function toggleAddServerDropdown() {
    const dropdown = document.getElementById('addServerDropdownMenu');
    const button = document.getElementById('addServerDropdownBtn');
    
    if (dropdown.classList.contains('hidden')) {
        showAddServerDropdown();
    } else {
        hideAddServerDropdown();
    }
}

function showAddServerDropdown() {
    const dropdown = document.getElementById('addServerDropdownMenu');
    const button = document.getElementById('addServerDropdownBtn');
    
    dropdown.classList.remove('hidden');
    button.classList.add('open');
    
    // Focus first item for accessibility
    const firstItem = dropdown.querySelector('.dropdown-item');
    if (firstItem) {
        firstItem.setAttribute('tabindex', '0');
        firstItem.focus();
    }
}

function hideAddServerDropdown() {
    const dropdown = document.getElementById('addServerDropdownMenu');
    const button = document.getElementById('addServerDropdownBtn');
    
    dropdown.classList.add('hidden');
    button.classList.remove('open');
    
    // Remove tabindex from items
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.removeAttribute('tabindex');
    });
}

// Single Server Import Modal functions
function showSingleServerImportModal() {
    const modal = document.getElementById('singleServerImportModal');
    modal.style.display = 'flex';
    
    // Reset state
    singleServerImportState = {
        parsedServer: null,
        needsServerName: false,
        isValid: false
    };
    
    // Clear inputs
    document.getElementById('singleJsonInput').value = '';
    document.getElementById('singleServerName').value = '';
    
    // Hide elements
    document.getElementById('singleJsonValidation').classList.add('hidden');
    document.getElementById('singleJsonError').classList.add('hidden');
    document.getElementById('singleServerPreview').classList.add('hidden');
    document.getElementById('singleServerNamePrompt').classList.add('hidden');
    document.getElementById('singleServerNameError').classList.add('hidden');
    
    // Reset input styles
    const jsonInput = document.getElementById('singleJsonInput');
    jsonInput.classList.remove('valid', 'invalid');
    
    // Disable add button
    document.getElementById('addSingleServerBtn').disabled = true;
    
    // Focus on text area
    setTimeout(() => {
        jsonInput.focus();
    }, 100);
}

function hideSingleServerImportModal() {
    document.getElementById('singleServerImportModal').style.display = 'none';
}

// Single Server Import event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Enhanced Add Server dropdown functionality
    document.getElementById('addServerDropdownBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAddServerDropdown();
    });

    document.getElementById('manualEntryOption').addEventListener('click', () => {
        hideAddServerDropdown();
        editingServerName = null;
        editingDisabledServer = false;
        showServerModal();
    });

    document.getElementById('pasteJsonOption').addEventListener('click', () => {
        hideAddServerDropdown();
        showSingleServerImportModal();
    });

    // Single server import modal events
    document.getElementById('singlePasteFromClipboardBtn').addEventListener('click', pasteSingleFromClipboard);
    document.getElementById('cancelSingleImportBtn').addEventListener('click', hideSingleServerImportModal);
    document.getElementById('addSingleServerBtn').addEventListener('click', addSingleServer);
    
    // JSON input validation
    const singleJsonInput = document.getElementById('singleJsonInput');
    let singleValidationTimeout = null;
    
    singleJsonInput.addEventListener('input', () => {
        clearTimeout(singleValidationTimeout);
        singleValidationTimeout = setTimeout(() => {
            validateSingleServerJson();
        }, 300);
    });
    
    // Server name input validation
    const singleServerNameInput = document.getElementById('singleServerName');
    singleServerNameInput.addEventListener('input', validateSingleServerName);
    
    // Close modal when clicking outside
    document.addEventListener('click', (event) => {
        if (event.target === document.getElementById('singleServerImportModal')) {
            hideSingleServerImportModal();
        }
    });
    
    // Keyboard support for dropdown
    document.addEventListener('keydown', (e) => {
        const dropdown = document.getElementById('addServerDropdownMenu');
        if (!dropdown.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                hideAddServerDropdown();
                document.getElementById('addServerDropdownBtn').focus();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                navigateDropdown(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Enter') {
                const focusedItem = document.activeElement;
                if (focusedItem && focusedItem.classList.contains('dropdown-item')) {
                    focusedItem.click();
                }
            }
        }
    });
});

function navigateDropdown(direction) {
    const items = Array.from(document.querySelectorAll('#addServerDropdownMenu .dropdown-item'));
    const currentIndex = items.findIndex(item => item === document.activeElement);
    const nextIndex = currentIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < items.length) {
        items[nextIndex].focus();
    }
}

async function pasteSingleFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('singleJsonInput').value = text;
        validateSingleServerJson();
    } catch (error) {
        console.warn('Could not read from clipboard:', error);
        document.getElementById('singleJsonInput').focus();
    }
}

function validateSingleServerJson() {
    const jsonInput = document.getElementById('singleJsonInput');
    const validation = document.getElementById('singleJsonValidation');
    const validationIcon = validation.querySelector('.validation-icon');
    const validationText = validation.querySelector('.validation-text');
    const errorDiv = document.getElementById('singleJsonError');
    const preview = document.getElementById('singleServerPreview');
    const namePrompt = document.getElementById('singleServerNamePrompt');
    
    const inputText = jsonInput.value.trim();
    
    if (!inputText) {
        // Empty input - hide validation
        validation.classList.add('hidden');
        errorDiv.classList.add('hidden');
        preview.classList.add('hidden');
        namePrompt.classList.add('hidden');
        jsonInput.classList.remove('valid', 'invalid');
        singleServerImportState.isValid = false;
        updateSingleAddButton();
        return;
    }
    
    try {
        // Parse JSON
        const parsedJson = JSON.parse(inputText);
        
        // Detect format and extract server
        const detectionResult = detectSingleServerFormat(parsedJson);
        
        if (!detectionResult.success) {
            showSingleValidationError(detectionResult.error);
            return;
        }
        
        // Valid JSON and format
        showSingleValidationSuccess();
        singleServerImportState.parsedServer = detectionResult.server;
        singleServerImportState.needsServerName = detectionResult.needsServerName;
        singleServerImportState.isValid = true;
        
        // Show preview
        showSingleServerPreview(detectionResult.server, detectionResult.needsServerName);
        
        // Show name prompt if needed
        if (detectionResult.needsServerName) {
            namePrompt.classList.remove('hidden');
            
            // Auto-suggest name based on command
            const suggestedName = generateServerName(detectionResult.server.config.command);
            document.getElementById('singleServerName').value = suggestedName;
        } else {
            namePrompt.classList.add('hidden');
        }
        
        updateSingleAddButton();
        
    } catch (error) {
        showSingleValidationError(`Invalid JSON: ${error.message}`);
    }
}

function detectSingleServerFormat(json) {
    // Format 1: Server definition only (no name)
    if (json.command) {
        return {
            success: true,
            server: { name: null, config: json },
            needsServerName: true
        };
    }
    
    // Format 2: Single server with name
    if (typeof json === 'object' && !Array.isArray(json)) {
        const keys = Object.keys(json);
        
        if (keys.length === 1) {
            const serverName = keys[0];
            const serverConfig = json[serverName];
            
            if (serverConfig && typeof serverConfig === 'object' && serverConfig.command) {
                return {
                    success: true,
                    server: { name: serverName, config: serverConfig },
                    needsServerName: false
                };
            }
        }
        
        // Format 3: Full config with mcpServers wrapper (single server)
        if (json.mcpServers && typeof json.mcpServers === 'object') {
            const serverNames = Object.keys(json.mcpServers);
            
            if (serverNames.length === 1) {
                const serverName = serverNames[0];
                const serverConfig = json.mcpServers[serverName];
                
                if (serverConfig && serverConfig.command) {
                    return {
                        success: true,
                        server: { name: serverName, config: serverConfig },
                        needsServerName: false
                    };
                }
            } else if (serverNames.length > 1) {
                return {
                    success: false,
                    error: 'Multiple servers detected. Use "Import JSON" for bulk import.'
                };
            }
        }
    }
    
    return {
        success: false,
        error: 'Unrecognized format. Expected single server configuration.'
    };
}

function showSingleValidationSuccess() {
    const validation = document.getElementById('singleJsonValidation');
    const validationIcon = validation.querySelector('.validation-icon');
    const validationText = validation.querySelector('.validation-text');
    const errorDiv = document.getElementById('singleJsonError');
    const jsonInput = document.getElementById('singleJsonInput');
    
    validation.classList.remove('hidden', 'invalid');
    validation.classList.add('valid');
    validationIcon.textContent = '✅';
    validationText.textContent = 'Valid JSON';
    
    errorDiv.classList.add('hidden');
    jsonInput.classList.remove('invalid');
    jsonInput.classList.add('valid');
}

function showSingleValidationError(message) {
    const validation = document.getElementById('singleJsonValidation');
    const validationIcon = validation.querySelector('.validation-icon');
    const validationText = validation.querySelector('.validation-text');
    const errorDiv = document.getElementById('singleJsonError');
    const jsonInput = document.getElementById('singleJsonInput');
    const preview = document.getElementById('singleServerPreview');
    const namePrompt = document.getElementById('singleServerNamePrompt');
    
    validation.classList.remove('hidden', 'valid');
    validation.classList.add('invalid');
    validationIcon.textContent = '❌';
    validationText.textContent = 'Invalid JSON';
    
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    jsonInput.classList.remove('valid');
    jsonInput.classList.add('invalid');
    
    preview.classList.add('hidden');
    namePrompt.classList.add('hidden');
    
    singleServerImportState.isValid = false;
    updateSingleAddButton();
}

function showSingleServerPreview(server, needsServerName) {
    const preview = document.getElementById('singleServerPreview');
    const previewContent = document.getElementById('singlePreviewContent');
    
    const serverName = server.name || 'New Server';
    
    let previewHtml = `
        <div class="preview-detail">
            <span class="preview-label">Name:</span>
            <span class="preview-value">${serverName}${needsServerName ? ' (will be set)' : ''}</span>
        </div>
        <div class="preview-detail">
            <span class="preview-label">Command:</span>
            <span class="preview-value">${server.config.command}</span>
        </div>
    `;
    
    if (server.config.args && server.config.args.length > 0) {
        previewHtml += `
            <div class="preview-detail">
                <span class="preview-label">Arguments:</span>
                <span class="preview-value">${server.config.args.join(', ')}</span>
            </div>
        `;
    }
    
    if (server.config.env && Object.keys(server.config.env).length > 0) {
        previewHtml += `
            <div class="preview-detail">
                <span class="preview-label">Environment:</span>
                <span class="preview-value">${Object.keys(server.config.env).length} variable(s)</span>
            </div>
        `;
    }
    
    previewContent.innerHTML = previewHtml;
    preview.classList.remove('hidden');
}

function generateServerName(command) {
    // Generate a suggested server name based on the command
    const cleanCommand = command.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return cleanCommand.substring(0, 20); // Limit length
}

function validateSingleServerName() {
    const nameInput = document.getElementById('singleServerName');
    const nameError = document.getElementById('singleServerNameError');
    
    const name = nameInput.value.trim();
    
    if (!name && singleServerImportState.needsServerName) {
        nameInput.classList.add('input-error');
        nameError.textContent = 'Server name is required';
        nameError.classList.remove('hidden');
        updateSingleAddButton();
        return false;
    }
    
    // Check for duplicates
    if (name && (currentConfig.mcpServers[name] || currentConfig.disabledMcpServers[name])) {
        nameInput.classList.add('input-error');
        nameError.textContent = `A server named '${name}' already exists. Please choose a different name.`;
        nameError.classList.remove('hidden');
        updateSingleAddButton();
        return false;
    }
    
    // Valid name
    nameInput.classList.remove('input-error');
    nameError.classList.add('hidden');
    updateSingleAddButton();
    return true;
}

function updateSingleAddButton() {
    const addButton = document.getElementById('addSingleServerBtn');
    
    let isValid = singleServerImportState.isValid;
    
    if (singleServerImportState.needsServerName) {
        const nameInput = document.getElementById('singleServerName');
        const name = nameInput.value.trim();
        isValid = isValid && name && !nameInput.classList.contains('input-error');
    }
    
    addButton.disabled = !isValid;
}

async function addSingleServer() {
    if (!singleServerImportState.isValid) {
        return;
    }
    
    let serverName = singleServerImportState.parsedServer.name;
    
    if (singleServerImportState.needsServerName) {
        const nameInput = document.getElementById('singleServerName');
        serverName = nameInput.value.trim();
        
        if (!validateSingleServerName()) {
            return;
        }
    }
    
    // Check for dependency warning
    const serverConfig = singleServerImportState.parsedServer.config;
    if (serverConfig.command) {
        const depCheck = await window.api.checkSingleDependency(serverConfig.command);
        if (depCheck.success && !depCheck.available && depCheck.dependency) {
            const proceed = confirm(
                `⚠️ Warning: This server requires '${depCheck.dependency.name}' which wasn't found on your system.\n\n` +
                `You can still add this server, but it won't be able to run until you install the required tool.\n\n` +
                `Do you want to continue?`
            );
            
            if (!proceed) {
                return;
            }
        }
    }
    
    // Add server to config
    currentConfig.mcpServers[serverName] = serverConfig;
    
    // Mark as changed and refresh
    markAsChanged();
    renderServers();
    
    // Hide modal
    hideSingleServerImportModal();
    
    // Show success toast
    showToast('success', `Server '${serverName}' added successfully`);
    
    // Highlight new server
    highlightNewServer(serverName);
    
    // Check dependencies
    setTimeout(async () => {
        await checkSystemDependencies();
    }, 100);
}

// Toast notification system
function showToast(type, message) {
    const toast = document.getElementById('toastNotification');
    const toastIcon = toast.querySelector('.toast-icon');
    const toastMessage = toast.querySelector('.toast-message');
    
    // Set content
    toastMessage.textContent = message;
    
    // Set type and icon
    toast.className = `toast-notification ${type}`;
    switch (type) {
        case 'success':
            toastIcon.textContent = '✅';
            break;
        case 'error':
            toastIcon.textContent = '❌';
            break;
        case 'warning':
            toastIcon.textContent = '⚠️';
            break;
        default:
            toastIcon.textContent = 'ℹ️';
    }
    
    // Show toast
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 4000);
}

function highlightNewServer(serverName) {
    // Wait for re-render, then highlight
    setTimeout(() => {
        const serverItems = document.querySelectorAll('.server-item');
        for (const item of serverItems) {
            const nameElement = item.querySelector('.server-readiness-name, h3');
            if (nameElement && nameElement.textContent.trim() === serverName) {
                item.classList.add('newly-added');
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
            }
        }
    }, 100);
}


// Make enhanced add server functions available globally
window.hideSingleServerImportModal = hideSingleServerImportModal;
window.handleConfigNotFound = handleConfigNotFound;
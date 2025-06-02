// Modal management - server modal, import modal, system status modal

// Mode toggle state
let isRawMode = false;
let smartQuotingEnabled = true;

// DOM elements
const serverModal = document.getElementById('serverModal');
const modalTitle = document.getElementById('modalTitle');
const serverNameInput = document.getElementById('serverName');
const serverCommandInput = document.getElementById('serverCommand');
const serverArgsInput = document.getElementById('serverArgs');
const envVarsList = document.getElementById('envVarsList');
const commandInput = document.getElementById('commandInput');

// Show server modal
function showServerModal(serverName = null, isDisabled = false) {
    if (!serverModal) return;
    
    modalTitle.textContent = serverName ? 'Edit Server' : 'Add MCP Server';
    serverModal.style.display = 'flex';
    
    // Reset to visual mode
    isRawMode = false;
    document.getElementById('visualModeContent')?.classList.remove('hidden');
    document.getElementById('rawModeContent')?.classList.add('hidden');
    document.getElementById('modalModeToggle').textContent = '{} Raw';
    document.getElementById('modalModeToggle').title = 'Switch to raw JSON editor';
    
    // Reset form state
    document.getElementById('parsedDisplay')?.classList.add('hidden');
    document.getElementById('commandError')?.classList.add('hidden');
    document.getElementById('rawModeError')?.classList.add('hidden');
    commandInput?.classList.remove('error');
    
    // Hide any previous test results
    if (window.serverTesting && window.serverTesting.hideTestResults) {
        window.serverTesting.hideTestResults();
    }
    
    // Clear any existing dependency warnings
    const existingWarning = document.getElementById('dependencyWarning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const currentConfig = window.core.currentConfig();
    const servers = isDisabled ? currentConfig.disabledMcpServers : currentConfig.mcpServers;
    
    if (serverName && servers[serverName]) {
        const server = servers[serverName];
        serverNameInput.value = serverName;
        serverCommandInput.value = server.command || '';
        serverArgsInput.value = server.args ? server.args.join('\n') : '';
        
        // Reconstruct command for the parser input with proper quoting
        let fullCommand = server.command;
        if (server.args && server.args.length > 0) {
            const quotedArgs = server.args.map(arg => {
                // Quote arguments that contain special characters or spaces (if smart quoting is enabled)
                if (smartQuotingEnabled && (arg.includes(' ') || arg.includes('>') || arg.includes('<') || arg.includes('=') || arg.includes('"') || arg.includes("'"))) {
                    return `"${arg.replace(/"/g, '\\"')}"`;
                }
                return arg;
            });
            fullCommand += ' ' + quotedArgs.join(' ');
        }
        commandInput.value = fullCommand;
        if (window.commandParser) {
            window.commandParser.parseCommand(fullCommand);
        }
        
        envVarsList.innerHTML = '';
        if (server.env) {
            for (const [key, value] of Object.entries(server.env)) {
                if (window.uiUtils) {
                    window.uiUtils.addEnvVarRow(key, value);
                }
            }
        }
        
        // Dependency warnings are now only shown after clicking Test button
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

// Hide server modal
function hideServerModal() {
    if (serverModal) {
        serverModal.style.display = 'none';
    }
    if (window.serverManagement) {
        window.serverManagement.setEditingServerName(null);
        window.serverManagement.setEditingDisabledServer(false);
    }
}

// Toggle between visual and raw edit modes
function toggleEditMode() {
    const visualContent = document.getElementById('visualModeContent');
    const rawContent = document.getElementById('rawModeContent');
    const rawTextarea = document.getElementById('rawEditorTextarea');
    const toggleBtn = document.getElementById('modalModeToggle');
    const rawError = document.getElementById('rawModeError');
    
    if (!visualContent || !rawContent || !rawTextarea || !toggleBtn) return;
    
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
        rawError?.classList.add('hidden');
        
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
            rawError?.classList.add('hidden');
        } catch (error) {
            // Show error and prevent switching
            if (rawError) {
                rawError.textContent = `Error: ${error.message}`;
                rawError.classList.remove('hidden');
            }
            isRawMode = true; // Stay in raw mode
        }
    }
}

// Toggle smart quoting
function toggleSmartQuoting() {
    smartQuotingEnabled = !smartQuotingEnabled;
    const toggleBtn = document.getElementById('smartQuoteToggle');
    
    if (toggleBtn) {
        toggleBtn.textContent = smartQuotingEnabled ? '🔤 Smart Quotes: ON' : '🔤 Smart Quotes: OFF';
        toggleBtn.title = smartQuotingEnabled 
            ? 'Smart quoting enabled - arguments with special characters will be quoted'
            : 'Smart quoting disabled - arguments will not be automatically quoted';
    }
    
    // Re-parse current command to update display
    if (commandInput && commandInput.value && window.commandParser) {
        window.commandParser.parseCommand(commandInput.value);
    }
    
    // If in raw mode and we have a current server loaded, update the visual form
    if (!isRawMode && (window.serverManagement.getEditingServerName())) {
        const currentConfig = window.core.currentConfig();
        const isDisabled = window.serverManagement.getEditingDisabledServer();
        const servers = isDisabled ? currentConfig.disabledMcpServers : currentConfig.mcpServers;
        const serverName = window.serverManagement.getEditingServerName();
        
        if (servers[serverName]) {
            updateFormFromConfig(servers[serverName]);
        }
    }
}

// Get configuration from form fields
function getConfigFromForm() {
    const config = { command: serverCommandInput?.value || '' };
    
    // Add arguments if present
    const argsText = serverArgsInput?.value.trim();
    if (argsText) {
        config.args = argsText.split('\n').map(arg => arg.trim()).filter(arg => arg);
    }
    
    // Add environment variables if present
    const envVarRows = envVarsList?.querySelectorAll('.env-var-row');
    if (envVarRows && envVarRows.length > 0) {
        const env = {};
        envVarRows.forEach(row => {
            const key = row.querySelector('.env-var-key')?.value.trim();
            const value = row.querySelector('.env-var-value')?.value.trim();
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
            // Quote arguments that contain special characters or spaces (if smart quoting is enabled)
            if (smartQuotingEnabled && (arg.includes(' ') || arg.includes('>') || arg.includes('<') || arg.includes('=') || arg.includes('"') || arg.includes("'"))) {
                return `"${arg.replace(/"/g, '\\"')}"`;
            }
            return arg;
        });
        fullCommand += ' ' + quotedArgs.join(' ');
    }
    if (commandInput) {
        commandInput.value = fullCommand;
        if (window.commandParser) {
            window.commandParser.parseCommand(fullCommand);
        }
    }
    
    // Update environment variables
    if (envVarsList) {
        envVarsList.innerHTML = '';
        if (config.env && window.uiUtils) {
            for (const [key, value] of Object.entries(config.env)) {
                window.uiUtils.addEnvVarRow(key, value);
            }
        }
    }
}

// Backup functions
async function showBackupsModal() {
    const modal = document.getElementById('backupsModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    const backupsList = document.getElementById('backupsList');
    if (backupsList) {
        backupsList.innerHTML = '<p>Loading backups...</p>';
    }
    
    const currentConfigPath = window.core.currentConfigPath();
    if (!currentConfigPath) {
        if (backupsList) {
            backupsList.innerHTML = '<p>No config file loaded</p>';
        }
        return;
    }
    
    const result = await window.api.getBackups(currentConfigPath);
    
    if (!result.success || result.backups.length === 0) {
        if (backupsList) {
            backupsList.innerHTML = '<p>No backups found</p>';
        }
        return;
    }
    
    if (backupsList) {
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
}

function hideBackupsModal() {
    const modal = document.getElementById('backupsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function restoreBackup(backupPath) {
    if (!confirm('Are you sure you want to restore this backup? Current changes will be lost.')) {
        return;
    }
    
    const currentConfigPath = window.core.currentConfigPath();
    const result = await window.api.restoreBackup(backupPath, currentConfigPath);
    if (result.success) {
        hideBackupsModal();
        await window.core.loadConfig(currentConfigPath);
        alert('Backup restored successfully!');
    } else {
        alert(`Error restoring backup: ${result.error}`);
    }
}

// Initialize modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Server modal events
    document.querySelector('.close-btn')?.addEventListener('click', hideServerModal);
    document.getElementById('cancelModalBtn')?.addEventListener('click', hideServerModal);
    document.getElementById('saveServerBtn')?.addEventListener('click', () => {
        if (window.serverManagement && window.serverManagement.saveServer) {
            window.serverManagement.saveServer();
        }
    });

    // Mode toggle button
    document.getElementById('modalModeToggle')?.addEventListener('click', () => {
        toggleEditMode();
    });

    // Smart quote toggle button
    document.getElementById('smartQuoteToggle')?.addEventListener('click', () => {
        toggleSmartQuoting();
    });

    // History button (replaces backups)
    document.getElementById('historyBtn')?.addEventListener('click', showBackupsModal);

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === serverModal) {
            hideServerModal();
        }
        if (event.target === document.getElementById('backupsModal')) {
            hideBackupsModal();
        }
    });
});

// Make restore function available globally
window.restoreBackup = restoreBackup;
window.hideBackupsModal = hideBackupsModal;

// Export modal functionality
window.modals = {
    showServerModal,
    hideServerModal,
    toggleEditMode,
    toggleSmartQuoting,
    getConfigFromForm,
    updateFormFromConfig,
    showBackupsModal,
    hideBackupsModal,
    restoreBackup,
    isRawMode: () => isRawMode,
    isSmartQuotingEnabled: () => smartQuotingEnabled
};
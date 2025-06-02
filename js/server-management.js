// Server management functionality - CRUD operations, rendering, toggle functionality

let editingServerName = null;
let editingDisabledServer = false;

// DOM elements
const serversList = document.getElementById('serversList');

// Render servers list
function renderServers() {
    if (!serversList) return;
    
    serversList.innerHTML = '';
    
    const currentConfig = window.core.currentConfig();
    
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
    toggleBtn.title = isDisabled ? 
        'Enable this MCP server - it will be available for Claude to use' : 
        'Disable this MCP server - it will be excluded from Claude but kept in your configuration';
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
    deleteIcon.title = `Delete the '${name}' server permanently from your configuration (this action cannot be undone)`;
    deleteIcon.setAttribute('aria-label', `Delete ${name} server`);
    deleteIcon.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering edit
        deleteServer(name, isDisabled);
    };
    
    // Add click-to-edit functionality
    const editableArea = document.createElement('div');
    editableArea.className = 'server-editable-area';
    editableArea.title = `Click to edit the '${name}' server configuration, including command, arguments, and environment variables`;
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
    const currentConfig = window.core.currentConfig();
    
    if (currentlyDisabled) {
        // Move from disabled to active
        currentConfig.mcpServers[name] = currentConfig.disabledMcpServers[name];
        delete currentConfig.disabledMcpServers[name];
    } else {
        // Move from active to disabled
        currentConfig.disabledMcpServers[name] = currentConfig.mcpServers[name];
        delete currentConfig.mcpServers[name];
    }
    
    window.core.markAsChanged();
    renderServers();
}

// Edit server
function editServer(name, isDisabled) {
    editingServerName = name;
    editingDisabledServer = isDisabled;
    
    if (window.modals && window.modals.showServerModal) {
        window.modals.showServerModal(name, isDisabled);
    }
}

// Delete server with enhanced confirmation
function deleteServer(name, isDisabled) {
    const confirmed = confirm(
        `Delete '${name}'?\n\n` +
        `This action cannot be undone.`
    );
    
    if (confirmed) {
        const currentConfig = window.core.currentConfig();
        
        if (isDisabled) {
            delete currentConfig.disabledMcpServers[name];
        } else {
            delete currentConfig.mcpServers[name];
        }
        
        window.core.markAsChanged();
        renderServers();
        
        // Show success toast
        if (window.uiUtils && window.uiUtils.showToast) {
            window.uiUtils.showToast('success', `Server '${name}' deleted successfully`);
        }
    }
}

// Save server (called from modal)
function saveServer() {
    const serverNameInput = document.getElementById('serverName');
    const name = serverNameInput.value.trim();
    
    if (!name) {
        alert('Server name is required!');
        return;
    }
    
    let server;
    const currentConfig = window.core.currentConfig();
    
    // Check if we're in raw mode (this will be handled by the modals module)
    const isRawMode = window.modals ? window.modals.isRawMode() : false;
    
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
        const commandInput = document.getElementById('commandInput');
        const commandInputValue = commandInput.value.trim();
        if (!commandInputValue) {
            alert('Command is required!');
            return;
        }
        
        let command = '';
        let argsText = '';
        
        try {
            const parsed = window.commandParser.parseCommandLine(commandInputValue);
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
        const envVarsList = document.getElementById('envVarsList');
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
    
    window.core.markAsChanged();
    renderServers();
    
    if (window.modals && window.modals.hideServerModal) {
        window.modals.hideServerModal();
    }
    
    // Show success toast for manual entry
    const action = isEditing ? 'updated' : 'added';
    if (window.uiUtils && window.uiUtils.showToast) {
        window.uiUtils.showToast('success', `Server '${name}' ${action} successfully`);
    }
    
    if (!isEditing && window.uiUtils && window.uiUtils.highlightNewServer) {
        window.uiUtils.highlightNewServer(name);
    }
    
    // Check dependencies after saving
    setTimeout(async () => {
        if (window.systemDeps && window.systemDeps.checkSystemDependencies) {
            await window.systemDeps.checkSystemDependencies();
        }
    }, 100);
}

// Function to add a server programmatically
function addServer(name, serverConfig) {
    const currentConfig = window.core.currentConfig();
    
    // Initialize mcpServers if it doesn't exist
    if (!currentConfig.mcpServers) {
        currentConfig.mcpServers = {};
    }
    
    // Add the server
    currentConfig.mcpServers[name] = serverConfig;
    
    // Save and re-render
    window.core.markAsChanged();
    renderServers();
    
    // Highlight the new server
    if (window.uiUtils && window.uiUtils.highlightNewServer) {
        window.uiUtils.highlightNewServer(name);
    }
    
    // Check dependencies after adding
    setTimeout(async () => {
        if (window.systemDeps && window.systemDeps.checkSystemDependencies) {
            await window.systemDeps.checkSystemDependencies();
        }
    }, 100);
}

// Export server management functionality
window.serverManagement = {
    renderServers,
    renderServerItem,
    toggleServerStatus,
    editServer,
    deleteServer,
    saveServer,
    addServer,
    showServerModal: () => window.modals && window.modals.showServerModal(),
    getEditingServerName: () => editingServerName,
    setEditingServerName: (name) => { editingServerName = name; },
    getEditingDisabledServer: () => editingDisabledServer,
    setEditingDisabledServer: (disabled) => { editingDisabledServer = disabled; }
};